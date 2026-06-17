import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

// POST /api/upload/fundraising-image — admin only
// Accepts multipart/form-data with a "file" field.
// Uploads to the "fundraising-images" Supabase Storage bucket.
// Returns { url } — the public URL to store in fundraising_items.image_url.
export async function POST(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Storage unavailable' }, { status: 503 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File must be under 5MB' }, { status: 400 });
  }

  const ext = file.name.split('.').pop() ?? 'jpg';
  const timestamp = Date.now();
  const path = `fundraising/${timestamp}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { data, error } = await client.storage
    .from('fundraising-images')
    .upload(path, buffer, { upsert: true, contentType: file.type });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: urlData } = client.storage.from('fundraising-images').getPublicUrl(data.path);

  return NextResponse.json({ url: urlData.publicUrl });
}
