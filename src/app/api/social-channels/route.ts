import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { type SocialChannelPlatform, type SocialChannelStatus } from '@/types/social-channel';

const PLATFORMS = new Set<SocialChannelPlatform>(['tiktok', 'instagram', 'facebook', 'youtube', 'linkedin', 'website']);
const STATUSES  = new Set<SocialChannelStatus>(['active', 'paused', 'planned', 'archived']);

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanInt(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

async function requireAdmin() {
  const authUser = await getAuthUser();
  if (!authUser) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (authUser.role !== 'admin') return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  return { authUser };
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { data, error } = await (client as any)
    .from('marketing_social_channels')
    .select('*')
    .order('platform');

  if (error) {
    console.error('[api/social-channels] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch social channels' }, { status: 500 });
  }

  return NextResponse.json({ channels: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const platform = cleanText(body.platform) as SocialChannelPlatform;
  const status   = (cleanText(body.status) || 'planned') as SocialChannelStatus;

  if (!PLATFORMS.has(platform)) return NextResponse.json({ error: 'Valid platform is required' }, { status: 400 });
  if (!STATUSES.has(status))    return NextResponse.json({ error: 'Valid status is required' },   { status: 400 });

  const insert = {
    platform,
    handle:                  cleanText(body.handle),
    profile_url:             cleanText(body.profile_url),
    primary_format:          cleanText(body.primary_format),
    posting_target_per_week: cleanInt(body.posting_target_per_week),
    primary_audience:        cleanText(body.primary_audience),
    content_notes:           cleanText(body.content_notes),
    status,
    connected:               body.connected === true,
    notes:                   cleanText(body.notes),
  };

  const { data, error } = await (client as any)
    .from('marketing_social_channels')
    .insert(insert)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A channel for this platform already exists' }, { status: 409 });
    }
    console.error('[api/social-channels] POST:', error.message);
    return NextResponse.json({ error: 'Failed to create social channel' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
