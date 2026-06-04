import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const section = searchParams.get('section') ?? '';
  const status  = searchParams.get('status') ?? '';

  let query = (client as any)
    .from('story_opportunities')
    .select('*')
    .order('priority')
    .order('created_at', { ascending: false });

  if (section) query = query.eq('section', section);
  if (status)  query = query.eq('status', status);

  const { data, error } = await query;

  if (error) {
    console.error('[api/story-opportunities] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch opportunities' }, { status: 500 });
  }

  return NextResponse.json({ opportunities: data ?? [] });
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const insert = {
    title:              (body.title as string).trim(),
    source_type:        body.source_type ?? 'manual',
    source_ref_id:      body.source_ref_id ?? null,
    related_arc_id:     body.related_arc_id ?? null,
    related_characters: Array.isArray(body.related_characters) ? body.related_characters : [],
    content_angle:      typeof body.content_angle === 'string' ? body.content_angle : '',
    suggested_format:   typeof body.suggested_format === 'string' ? body.suggested_format : '',
    suggested_platform: typeof body.suggested_platform === 'string' ? body.suggested_platform : '',
    priority:           typeof body.priority === 'number' ? body.priority : 0,
    status:             body.status ?? 'new',
    section:            body.section ?? 'surfaced',
    notes:              typeof body.notes === 'string' ? body.notes : '',
  };

  const { data, error } = await (client as any)
    .from('story_opportunities')
    .insert(insert)
    .select()
    .single();

  if (error) {
    console.error('[api/story-opportunities] POST:', error.message);
    return NextResponse.json({ error: 'Failed to create opportunity' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
