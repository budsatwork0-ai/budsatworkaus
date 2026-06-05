import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import {
  type ResearchTrendPlatform,
  type ResearchTrendType,
  type ResearchTrendUrgency,
  type ResearchTrendStatus,
} from '@/types/research-trend';

const PLATFORMS  = new Set<ResearchTrendPlatform>(['tiktok','instagram','facebook','youtube','linkedin','website']);
const TYPES      = new Set<ResearchTrendType>(['audio','format','hook','topic','visual_style','other']);
const URGENCIES  = new Set<ResearchTrendUrgency>(['evergreen','two_week_window','forty_eight_hour_window']);
const STATUSES   = new Set<ResearchTrendStatus>(['watching','adapting','published','expired']);

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

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const platform   = searchParams.get('platform');
  const status     = searchParams.get('status');
  const trend_type = searchParams.get('trend_type');
  const urgency    = searchParams.get('urgency');

  let query = (client as any)
    .from('research_trends')
    .select('*')
    .order('created_at', { ascending: false });

  if (platform   && PLATFORMS.has(platform as ResearchTrendPlatform))   query = query.eq('platform',   platform);
  if (status     && STATUSES.has(status as ResearchTrendStatus))         query = query.eq('status',     status);
  if (trend_type && TYPES.has(trend_type as ResearchTrendType))          query = query.eq('trend_type', trend_type);
  if (urgency    && URGENCIES.has(urgency as ResearchTrendUrgency))      query = query.eq('urgency',    urgency);

  const { data, error } = await query;

  if (error) {
    console.error('[api/research-trends] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch trends' }, { status: 500 });
  }

  return NextResponse.json({ trends: data ?? [] });
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

  const platform   = cleanText(body.platform)   as ResearchTrendPlatform;
  const trend_type = cleanText(body.trend_type) as ResearchTrendType;
  const urgency    = cleanText(body.urgency)    as ResearchTrendUrgency;
  const status     = (cleanText(body.status) || 'watching') as ResearchTrendStatus;
  const title      = cleanText(body.title);

  if (!PLATFORMS.has(platform))   return NextResponse.json({ error: 'Valid platform is required' },   { status: 400 });
  if (!TYPES.has(trend_type))     return NextResponse.json({ error: 'Valid trend_type is required' }, { status: 400 });
  if (!URGENCIES.has(urgency))    return NextResponse.json({ error: 'Valid urgency is required' },    { status: 400 });
  if (!STATUSES.has(status))      return NextResponse.json({ error: 'Valid status is required' },     { status: 400 });
  if (!title)                     return NextResponse.json({ error: 'Title is required' },             { status: 400 });

  const storyArcIdRaw = cleanText(body.story_arc_id);
  if (storyArcIdRaw && !UUID_RE.test(storyArcIdRaw)) {
    return NextResponse.json({ error: 'story_arc_id must be a valid UUID' }, { status: 400 });
  }
  const storyArcId = storyArcIdRaw || null;

  const insert = {
    platform,
    title,
    description:      cleanText(body.description),
    trend_type,
    urgency,
    adaptation_angle: cleanText(body.adaptation_angle),
    story_arc_id:     storyArcId,
    status,
    notes:            cleanText(body.notes),
  };

  const { data, error } = await (client as any)
    .from('research_trends')
    .insert(insert)
    .select()
    .single();

  if (error) {
    console.error('[api/research-trends] POST:', error.message);
    return NextResponse.json({ error: 'Failed to create trend' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
