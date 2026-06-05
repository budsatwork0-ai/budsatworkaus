import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import {
  type ResearchTrendStatus,
  type ResearchTrendUrgency,
  type ResearchTrendType,
  type ResearchTrendPlatform,
} from '@/types/research-trend';

const PLATFORMS = new Set<ResearchTrendPlatform>(['tiktok','instagram','facebook','youtube','linkedin','website']);
const TYPES     = new Set<ResearchTrendType>(['audio','format','hook','topic','visual_style','other']);
const URGENCIES = new Set<ResearchTrendUrgency>(['evergreen','two_week_window','forty_eight_hour_window']);
const STATUSES  = new Set<ResearchTrendStatus>(['watching','adapting','published','expired']);

const UPDATABLE = [
  'platform',
  'title',
  'description',
  'trend_type',
  'urgency',
  'adaptation_angle',
  'story_arc_id',
  'status',
  'notes',
] as const;

type RouteParams = { params: Promise<{ id: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
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
    .from('research_trends')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Trend not found' }, { status: 404 });
    console.error('[api/research-trends/[id]] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch trend' }, { status: 500 });
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
    if (key === 'story_arc_id') {
      const val = cleanText(body[key]);
      update[key] = val || null;
    } else {
      update[key] = cleanText(body[key]);
    }
  }

  if ('story_arc_id' in update && update.story_arc_id !== null && typeof update.story_arc_id === 'string' && !UUID_RE.test(update.story_arc_id)) {
    return NextResponse.json({ error: 'story_arc_id must be a valid UUID' }, { status: 400 });
  }

  if (typeof update.platform   === 'string' && !PLATFORMS.has(update.platform   as ResearchTrendPlatform)) return NextResponse.json({ error: 'Valid platform is required' },   { status: 400 });
  if (typeof update.trend_type === 'string' && !TYPES.has(update.trend_type     as ResearchTrendType))     return NextResponse.json({ error: 'Valid trend_type is required' }, { status: 400 });
  if (typeof update.urgency    === 'string' && !URGENCIES.has(update.urgency    as ResearchTrendUrgency))  return NextResponse.json({ error: 'Valid urgency is required' },    { status: 400 });
  if (typeof update.status     === 'string' && !STATUSES.has(update.status      as ResearchTrendStatus))   return NextResponse.json({ error: 'Valid status is required' },     { status: 400 });
  if (typeof update.title      === 'string' && !update.title)                                              return NextResponse.json({ error: 'Title cannot be empty' },        { status: 400 });

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await (client as any)
    .from('research_trends')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Trend not found' }, { status: 404 });
    console.error('[api/research-trends/[id]] PUT:', error.message);
    return NextResponse.json({ error: 'Failed to update trend' }, { status: 500 });
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
    .from('research_trends')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[api/research-trends/[id]] DELETE:', error.message);
    return NextResponse.json({ error: 'Failed to delete trend' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
