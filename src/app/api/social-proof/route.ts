import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

export interface SocialProofItem {
  id: string;
  title: string;
  platform: 'tiktok' | 'instagram' | 'facebook';
  source_url: string;
  thumbnail_url: string | null;
  posted_at: string | null;
  status: 'draft' | 'live' | 'archived';
  sort_order: number;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

const APPROVED_HOSTS = [
  'tiktok.com',
  'www.tiktok.com',
  'instagram.com',
  'www.instagram.com',
  'facebook.com',
  'www.facebook.com',
];

function isApprovedSource(url: string) {
  try {
    const parsed = new URL(url);
    return APPROVED_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}

export async function GET() {
  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('social_proof_items')
    .select('*')
    .eq('status', 'live')
    .order('is_featured', { ascending: false })
    .order('sort_order', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

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
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  let body: Partial<SocialProofItem>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.title || !body.platform || !body.source_url) {
    return NextResponse.json({ error: 'title, platform and source_url are required' }, { status: 400 });
  }
  if (!isApprovedSource(body.source_url)) {
    return NextResponse.json({ error: 'Use an approved Buds At Work TikTok, Instagram or Facebook URL' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('social_proof_items')
    .insert({
      title: body.title,
      platform: body.platform,
      source_url: body.source_url,
      thumbnail_url: body.thumbnail_url ?? null,
      posted_at: body.posted_at ?? null,
      status: body.status ?? 'draft',
      sort_order: body.sort_order ?? 0,
      is_featured: body.is_featured ?? false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath('/get-involved');
  return NextResponse.json({ item: data }, { status: 201 });
}
