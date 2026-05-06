import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import {
  checkRateLimit,
  feedbackRatelimit,
  getClientIp,
  verifyTurnstile,
} from '@/lib/rate-limit';
import { randomUUID } from 'crypto';

const VALID_TYPES = ['bug_report', 'feature_idea', 'general'] as const;
const ALLOWED_PHOTO_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_PHOTO_EXT = new Set(['jpg', 'jpeg', 'png', 'webp']);

// POST /api/feedback — public, accepts multipart/form-data.
// Defenses (no session required, so all four matter):
//   1. Upstash IP rate limit before parsing the body.
//   2. Cloudflare Turnstile token check before touching storage.
//   3. MIME + extension allowlist on the photo before upload.
//   4. Existing 5MB cap is checked on the File handle, before allocating
//      its ArrayBuffer — confirmed.
export async function POST(req: NextRequest) {
  // 1. Rate limit by IP — first defense, costs one Redis round-trip.
  const ip = getClientIp(req);
  const rl = await checkRateLimit(feedbackRatelimit, ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many feedback submissions. Please wait a few minutes and try again.' },
      { status: 429 }
    );
  }

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const formData = await req.formData();
  const type = formData.get('type') as string | null;
  const subject = (formData.get('subject') as string | null)?.trim();
  const description = (formData.get('description') as string | null)?.trim();
  const photo = formData.get('photo') as File | null;
  const turnstileToken = formData.get('turnstileToken') as string | null;

  // 2. Turnstile — a free user-solved CAPTCHA is the simplest defense against
  // a bot pumping the storage bucket and feedback table. Authenticated users
  // can skip; everyone else has to clear it. No-op when env unset (dev).
  const authUser = await getAuthUser().catch(() => null);
  if (!authUser) {
    const tsCheck = await verifyTurnstile(turnstileToken);
    if (!tsCheck.ok) {
      return NextResponse.json({ error: tsCheck.error }, { status: tsCheck.status });
    }
  }

  // Validation
  if (!type || !VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }
  if (!subject || subject.length < 3) {
    return NextResponse.json({ error: 'Subject required (min 3 chars)' }, { status: 400 });
  }
  if (!description || description.length < 10) {
    return NextResponse.json({ error: 'Description required (min 10 chars)' }, { status: 400 });
  }

  // Optional photo upload
  let photo_url: string | null = null;
  if (photo && photo.size > 0) {
    if (photo.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Photo must be under 5MB' }, { status: 400 });
    }
    // 3. Type allowlist — prevents the bucket from being used as a generic
    // file host (HTML, SVG-with-script, executables) and keeps malware-scan
    // surface area narrow. Both MIME and extension are checked because
    // either one alone is forgeable client-side.
    if (!ALLOWED_PHOTO_MIME.has(photo.type)) {
      return NextResponse.json(
        { error: 'Photo must be a JPEG, PNG, or WebP image.' },
        { status: 400 }
      );
    }
    const ext = photo.name.split('.').pop()?.toLowerCase() || 'jpg';
    if (!ALLOWED_PHOTO_EXT.has(ext)) {
      return NextResponse.json(
        { error: 'Photo must be a JPEG, PNG, or WebP image.' },
        { status: 400 }
      );
    }
    const path = `${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await photo.arrayBuffer());

    const { data: uploadData, error: uploadError } = await client.storage
      .from('feedback')
      .upload(path, buffer, { contentType: photo.type });

    if (uploadError) {
      return NextResponse.json({ error: 'Photo upload failed' }, { status: 500 });
    }

    const { data: urlData } = client.storage.from('feedback').getPublicUrl(uploadData.path);
    photo_url = urlData.publicUrl;
  }

  const { data, error } = await (client as any)
    .from('site_feedback')
    .insert({ type, subject, description, photo_url })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}

// GET /api/feedback — admin/employee only
export async function GET(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authUser.role !== 'admin' && authUser.role !== 'employee') {
    return NextResponse.json({ error: 'Admin or employee access required' }, { status: 403 });
  }

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const type = searchParams.get('type');
  const limit = parseInt(searchParams.get('limit') || '100', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  let query = (client as any)
    .from('site_feedback')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && status !== 'all') query = query.eq('status', status);
  if (type && type !== 'all') query = query.eq('type', type);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ feedback: data, total: count });
}
