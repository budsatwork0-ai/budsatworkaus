import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

type SuggestionType = 'story_bible' | 'character_timeline' | 'arc' | 'open_thread';
type RouteParams = { params: Promise<{ id: string }> };

const STATUS_FIELD: Record<SuggestionType, string> = {
  story_bible:        'suggestion_story_bible_status',
  character_timeline: 'suggestion_character_timeline_status',
  arc:                'suggestion_arc_status',
  open_thread:        'suggestion_open_thread_status',
};

const TARGET_FIELD: Record<SuggestionType, string> = {
  story_bible:        'suggestion_story_bible_target',
  character_timeline: 'suggestion_character_timeline_target',
  arc:                'suggestion_arc_target',
  open_thread:        'suggestion_open_thread_target',
};

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

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

  const suggestionType = body.suggestion_type as SuggestionType;
  const action = body.action as 'apply' | 'skip';
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const targetId = typeof body.target_id === 'string' ? body.target_id.trim() : '';
  const targetSectionKey = typeof body.target_section_key === 'string' ? body.target_section_key.trim() : '';

  const VALID_TYPES: SuggestionType[] = ['story_bible', 'character_timeline', 'arc', 'open_thread'];
  if (!VALID_TYPES.includes(suggestionType)) {
    return NextResponse.json({ error: 'Invalid suggestion_type' }, { status: 400 });
  }
  if (action !== 'apply' && action !== 'skip') {
    return NextResponse.json({ error: 'action must be "apply" or "skip"' }, { status: 400 });
  }

  // Load entry (only the status fields needed)
  const statusField = STATUS_FIELD[suggestionType];
  const { data: entry, error: entryErr } = await (client as any)
    .from('founder_journal_entries')
    .select(`id, entry_date, ${statusField}`)
    .eq('id', id)
    .single();

  if (entryErr || !entry) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  // Idempotency — already resolved, return current state without re-applying
  const currentStatus = entry[statusField] as string | null;
  if (currentStatus === 'applied' || currentStatus === 'skipped') {
    return NextResponse.json({ status: currentStatus, suggestion_type: suggestionType });
  }

  if (action === 'skip') {
    await (client as any)
      .from('founder_journal_entries')
      .update({ [statusField]: 'skipped' })
      .eq('id', id);
    return NextResponse.json({ status: 'skipped', suggestion_type: suggestionType });
  }

  // action === 'apply'
  if (!text) return NextResponse.json({ error: 'text is required for apply' }, { status: 400 });

  const datePrefix = `\n\n[${entry.entry_date} from journal]\n`;
  const appendedText = datePrefix + text;
  const targetField = TARGET_FIELD[suggestionType];
  let targetValue: string | null = null;

  if (suggestionType === 'story_bible') {
    if (!targetSectionKey) {
      return NextResponse.json({ error: 'target_section_key is required' }, { status: 400 });
    }
    const { data: section } = await (client as any)
      .from('story_bible_sections')
      .select('content')
      .eq('section_key', targetSectionKey)
      .single();

    const merged = ((section?.content ?? '') + appendedText).trim();
    const { error: writeErr } = await (client as any)
      .from('story_bible_sections')
      .update({ content: merged, updated_by: 'Jackson Taylor' })
      .eq('section_key', targetSectionKey);

    if (writeErr) {
      console.error('[journal/apply] story_bible write error:', writeErr.message);
      return NextResponse.json({ error: 'Failed to update story bible' }, { status: 500 });
    }
    targetValue = targetSectionKey;
  } else if (suggestionType === 'character_timeline') {
    if (!targetId) {
      return NextResponse.json({ error: 'target_id is required' }, { status: 400 });
    }
    const { data: char } = await (client as any)
      .from('story_characters')
      .select('timeline_notes')
      .eq('id', targetId)
      .single();

    const merged = ((char?.timeline_notes ?? '') + appendedText).trim();
    const { error: writeErr } = await (client as any)
      .from('story_characters')
      .update({ timeline_notes: merged })
      .eq('id', targetId);

    if (writeErr) {
      console.error('[journal/apply] character_timeline write error:', writeErr.message);
      return NextResponse.json({ error: 'Failed to update character timeline' }, { status: 500 });
    }
    targetValue = targetId;
  } else if (suggestionType === 'arc') {
    if (!targetId) {
      return NextResponse.json({ error: 'target_id is required' }, { status: 400 });
    }
    const { data: arc } = await (client as any)
      .from('story_arcs')
      .select('progress_notes')
      .eq('id', targetId)
      .single();

    const merged = ((arc?.progress_notes ?? '') + appendedText).trim();
    const { error: writeErr } = await (client as any)
      .from('story_arcs')
      .update({ progress_notes: merged })
      .eq('id', targetId);

    if (writeErr) {
      console.error('[journal/apply] arc write error:', writeErr.message);
      return NextResponse.json({ error: 'Failed to update arc' }, { status: 500 });
    }
    targetValue = targetId;
  } else if (suggestionType === 'open_thread') {
    if (!targetId) {
      return NextResponse.json({ error: 'target_id is required' }, { status: 400 });
    }
    const { data: thread } = await (client as any)
      .from('story_open_threads')
      .select('progress_notes')
      .eq('id', targetId)
      .single();

    const merged = ((thread?.progress_notes ?? '') + appendedText).trim();
    const { error: writeErr } = await (client as any)
      .from('story_open_threads')
      .update({ progress_notes: merged })
      .eq('id', targetId);

    if (writeErr) {
      console.error('[journal/apply] open_thread write error:', writeErr.message);
      return NextResponse.json({ error: 'Failed to update open thread' }, { status: 500 });
    }
    targetValue = targetId;
  }

  // Mark entry as applied — only after the target write succeeds
  await (client as any)
    .from('founder_journal_entries')
    .update({ [statusField]: 'applied', [targetField]: targetValue })
    .eq('id', id);

  return NextResponse.json({ status: 'applied', suggestion_type: suggestionType, target: targetValue });
}
