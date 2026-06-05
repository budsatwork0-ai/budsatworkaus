import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import type { JournalEntryDraft } from '@/types/journal';

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.trim() ?? '';
  const rating = searchParams.get('rating') ?? '';
  const tag = searchParams.get('tag') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 200);
  const offset = Number(searchParams.get('offset') ?? '0');

  let query = (client as any)
    .from('founder_journal_entries')
    .select('id, entry_date, wins, challenges, tags, content_potential_rating, story_opportunity_created, created_at', { count: 'exact' })
    .order('entry_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (rating) query = query.eq('content_potential_rating', rating);
  if (tag) query = query.contains('tags', [tag]);
  if (from) query = query.gte('entry_date', from);
  if (to) query = query.lte('entry_date', to);

  if (search) {
    // Full-text-style search across key narrative fields via ilike
    query = query.or(
      [
        `raw_capture.ilike.%${search}%`,
        `wins.ilike.%${search}%`,
        `challenges.ilike.%${search}%`,
        `customer_activity.ilike.%${search}%`,
        `silvan_updates.ilike.%${search}%`,
        `lessons_learned.ilike.%${search}%`,
        `content_potential_notes.ilike.%${search}%`,
      ].join(','),
    );
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[api/journal] GET list:', error.message);
    return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
  }

  return NextResponse.json({ entries: data ?? [], total: count ?? 0 });
}

export async function POST(req: NextRequest) {
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

  if (!body.entry_date) {
    return NextResponse.json({ error: 'entry_date is required' }, { status: 400 });
  }

  const insert = {
    entry_date:               body.entry_date,
    raw_capture:              body.raw_capture ?? null,
    wins:                     body.wins ?? null,
    challenges:               body.challenges ?? null,
    customer_activity:        body.customer_activity ?? null,
    silvan_updates:           body.silvan_updates ?? null,
    business_progress:        body.business_progress ?? null,
    bud_os_progress:          body.bud_os_progress ?? null,
    memorable_moments:        body.memorable_moments ?? null,
    lessons_learned:          body.lessons_learned ?? null,
    content_potential_notes:  body.content_potential_notes ?? null,
    media_references:         body.media_references ?? null,
    tags:                     body.tags ?? [],
    content_potential_rating: body.content_potential_rating ?? 'none',
    arc_connections:          body.arc_connections ?? [],
    suggested_story_bible_note: body.suggested_story_bible_note ?? null,
    suggested_character_timeline_entry: body.suggested_character_timeline_entry ?? null,
    suggested_arc_update:     body.suggested_arc_update ?? null,
    suggested_open_thread_update: body.suggested_open_thread_update ?? null,
  };

  const { data, error } = await (client as any)
    .from('founder_journal_entries')
    .insert(insert)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'An entry for this date already exists' }, { status: 409 });
    }
    console.error('[api/journal] POST:', error.message);
    return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
