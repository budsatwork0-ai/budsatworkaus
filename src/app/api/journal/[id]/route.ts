import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import type { JournalEntryDraft } from '@/types/journal';
import { runJournalOpportunityPipeline } from '@/lib/journal/pipeline';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { data, error } = await (client as any)
    .from('founder_journal_entries')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    console.error('[api/journal/[id]] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch entry' }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  let body: Partial<JournalEntryDraft>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  const updatable: (keyof JournalEntryDraft)[] = [
    'entry_date', 'raw_capture', 'wins', 'challenges', 'customer_activity', 'silvan_updates',
    'business_progress', 'bud_os_progress', 'memorable_moments', 'lessons_learned',
    'content_potential_notes', 'media_references', 'tags', 'content_potential_rating',
    'arc_connections', 'suggested_story_bible_note', 'suggested_character_timeline_entry',
    'suggested_arc_update', 'suggested_open_thread_update',
  ];
  for (const key of updatable) {
    if (key in body) update[key] = body[key] ?? null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await (client as any)
    .from('founder_journal_entries')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    if (error.code === '23505') return NextResponse.json({ error: 'An entry for this date already exists' }, { status: 409 });
    console.error('[api/journal/[id]] PUT:', error.message);
    return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 });
  }

  // Pipeline hook: fires when an entry is upgraded to low/medium/high and no opportunity exists yet.
  // story_opportunity_created gate makes this idempotent across repeated PUTs.
  if (data && data.content_potential_rating !== 'none' && !data.story_opportunity_created) {
    runJournalOpportunityPipeline(client as any, data).catch((err) =>
      console.error('[api/journal/[id]] PUT pipeline error (non-fatal):', err),
    );
  }

  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { error } = await (client as any)
    .from('founder_journal_entries')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[api/journal/[id]] DELETE:', error.message);
    return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
