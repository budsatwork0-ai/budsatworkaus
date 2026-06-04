import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { data, error } = await (client as any)
    .from('story_open_threads')
    .select('*')
    .order('status')
    .order('opened_date', { ascending: true });

  if (error) {
    console.error('[api/story-threads] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch threads' }, { status: 500 });
  }

  return NextResponse.json({ threads: data ?? [] });
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
    description:        typeof body.description === 'string' ? body.description : '',
    related_arc_id:     body.related_arc_id ?? null,
    related_characters: Array.isArray(body.related_characters) ? body.related_characters : [],
    status:             'open',
    opened_date:        body.opened_date ?? new Date().toISOString().slice(0, 10),
  };

  const { data, error } = await (client as any)
    .from('story_open_threads')
    .insert(insert)
    .select()
    .single();

  if (error) {
    console.error('[api/story-threads] POST:', error.message);
    return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
