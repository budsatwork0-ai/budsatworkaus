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
    .from('story_arcs')
    .select('*')
    .order('priority')
    .order('created_at');

  if (error) {
    console.error('[api/story-arcs] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch arcs' }, { status: 500 });
  }

  return NextResponse.json({ arcs: data ?? [] });
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
    title:               (body.title as string).trim(),
    description:         typeof body.description === 'string' ? body.description : '',
    status:              body.status ?? 'active',
    start_date:          body.start_date ?? null,
    end_date:            body.end_date ?? null,
    priority:            typeof body.priority === 'number' ? body.priority : 0,
    characters_involved: Array.isArray(body.characters_involved) ? body.characters_involved : [],
    journal_entry_links: Array.isArray(body.journal_entry_links) ? body.journal_entry_links : [],
    progress_notes:      typeof body.progress_notes === 'string' ? body.progress_notes : '',
  };

  const { data, error } = await (client as any)
    .from('story_arcs')
    .insert(insert)
    .select()
    .single();

  if (error) {
    console.error('[api/story-arcs] POST:', error.message);
    return NextResponse.json({ error: 'Failed to create arc' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
