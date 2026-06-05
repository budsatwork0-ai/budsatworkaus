import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { type SocialChannelStatus } from '@/types/social-channel';

const UPDATABLE = [
  'handle',
  'profile_url',
  'primary_format',
  'posting_target_per_week',
  'primary_audience',
  'content_notes',
  'status',
  'connected',
  'notes',
] as const;

const STATUSES = new Set<SocialChannelStatus>(['active', 'paused', 'planned', 'archived']);

type RouteParams = { params: Promise<{ id: string }> };

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

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { data, error } = await (client as any)
    .from('marketing_social_channels')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Social channel not found' }, { status: 404 });
    console.error('[api/social-channels/[id]] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch social channel' }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
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

  const update: Record<string, unknown> = {};
  for (const key of UPDATABLE) {
    if (!(key in body)) continue;
    if (key === 'posting_target_per_week') update[key] = cleanInt(body[key]);
    else if (key === 'connected')          update[key] = body[key] === true;
    else                                   update[key] = cleanText(body[key]);
  }

  if (typeof update.status === 'string' && !STATUSES.has(update.status as SocialChannelStatus)) {
    return NextResponse.json({ error: 'Valid status is required' }, { status: 400 });
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await (client as any)
    .from('marketing_social_channels')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Social channel not found' }, { status: 404 });
    console.error('[api/social-channels/[id]] PUT:', error.message);
    return NextResponse.json({ error: 'Failed to update social channel' }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { error } = await (client as any)
    .from('marketing_social_channels')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[api/social-channels/[id]] DELETE:', error.message);
    return NextResponse.json({ error: 'Failed to delete social channel' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
