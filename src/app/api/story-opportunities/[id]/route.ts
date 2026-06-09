import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { scoreIdea } from '@/lib/story/idea-scoring';
import { logPipelineEvent } from '@/lib/growth/pipeline-events';

const UPDATABLE = [
  'title', 'source_type', 'source_ref_id', 'related_arc_id', 'related_characters',
  'content_angle', 'suggested_format', 'suggested_platform',
  'priority', 'status', 'section', 'notes',
] as const;

// Protected fields — the pipeline must never write these via status transitions.
const PROTECTED_SOURCE_TYPES = new Set([
  'story_bible', 'character', 'arc', 'open_thread', 'chapter',
]);

type RouteParams = { params: Promise<{ id: string }> };

// ─── Shared: side-effect when status transitions to in_development ────────────
// Idempotency: content_idea_created gate + unique index on content_ideas.opportunity_id.
// Wrapped in try/catch — never blocks the primary status update from returning.

async function handleInDevelopmentTransition(
  client: any,
  opportunityId: string,
): Promise<void> {
  // Load full opportunity to check gate and build idea payload.
  const { data: opp, error: oppErr } = await client
    .from('story_opportunities')
    .select('*')
    .eq('id', opportunityId)
    .single();

  if (oppErr || !opp) {
    console.error('[story-opportunities/[id]] in_development load error:', oppErr?.message);
    return;
  }

  // Gate: already created — skip.
  if (opp.content_idea_created) return;

  // Never auto-create for internal system milestones or protected source types.
  if (PROTECTED_SOURCE_TYPES.has(opp.source_type)) return;

  // Derive journal_entry_id for traceability (only when source is a journal entry).
  const journalEntryId: string | undefined =
    opp.source_type === 'journal' && opp.source_ref_id ? opp.source_ref_id : undefined;

  // Derive idea title and angle from opportunity.
  const ideaTitle = opp.title?.slice(0, 200) || 'Untitled idea';
  const ideaAngle = opp.content_angle?.slice(0, 500) || '';

  // Insert idea — unique index on opportunity_id absorbs any race-condition duplicate.
  const { data: idea, error: ideaErr } = await client
    .from('content_ideas')
    .insert({
      title:              ideaTitle,
      opportunity_id:     opportunityId,
      related_arc_id:     opp.related_arc_id ?? null,
      related_characters: Array.isArray(opp.related_characters) ? opp.related_characters : [],
      platform_fit:       opp.suggested_platform ?? '',
      format:             opp.suggested_format ?? '',
      hook:               '',
      content_angle:      ideaAngle,
      status:             'captured',
      priority:           opp.priority ?? 0,
      notes:              '',
    })
    .select('id, title, platform_fit, format, hook, content_angle, notes, related_arc_id, related_characters')
    .single();

  if (ideaErr) {
    // Unique constraint violation (code 23505) = already exists, skip silently.
    if (ideaErr.code !== '23505') {
      console.error('[story-opportunities/[id]] idea insert error:', ideaErr.message);
    }
    return;
  }

  // Set gate so this never fires again for this opportunity.
  await client
    .from('story_opportunities')
    .update({ content_idea_created: true })
    .eq('id', opportunityId);

  await logPipelineEvent(client, {
    event_type:       'idea_created',
    source_type:      'opportunity',
    source_id:        opportunityId,
    result_type:      'content_idea',
    result_id:        idea.id,
    journal_entry_id: journalEntryId,
    metadata:         { triggered_by: 'in_development_transition', opportunity_title: opp.title },
  });

  // Score the idea immediately — deterministic, no LLM.
  const ideaForScoring = {
    title:              idea.title,
    platform_fit:       idea.platform_fit,
    format:             idea.format,
    hook:               idea.hook,
    content_angle:      idea.content_angle,
    notes:              idea.notes,
    related_arc_id:     idea.related_arc_id,
    related_characters: idea.related_characters,
  };

  const scoringResult = scoreIdea(ideaForScoring, opp.story_score ?? undefined);

  const { error: scoreErr } = await client
    .from('content_ideas')
    .update({
      idea_score:      scoringResult.idea_score,
      score_breakdown: scoringResult.score_breakdown,
      score_reason:    scoringResult.score_reason,
      scored_at:       new Date().toISOString(),
    })
    .eq('id', idea.id);

  if (scoreErr) {
    console.error('[story-opportunities/[id]] idea score write error:', scoreErr.message);
  }

  await logPipelineEvent(client, {
    event_type:       'idea_scored',
    source_type:      'idea',
    source_id:        idea.id,
    result_type:      'content_idea',
    result_id:        idea.id,
    journal_entry_id: journalEntryId,
    metadata:         { idea_score: scoringResult.idea_score, opportunity_score: opp.story_score },
  });
}

// ─── PUT — manual field update (existing behaviour, unchanged) ────────────────
// Side-effect added: if status is being set to in_development, run the transition.

export async function PUT(req: NextRequest, { params }: RouteParams) {
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

  const update: Record<string, unknown> = {};
  for (const key of UPDATABLE) {
    if (key in body) update[key] = body[key] ?? null;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await (client as any)
    .from('story_opportunities')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    console.error('[api/story-opportunities/[id]] PUT:', error.message);
    return NextResponse.json({ error: 'Failed to update opportunity' }, { status: 500 });
  }

  // Fire side-effect after a successful update — never blocks the response.
  if (update.status === 'in_development') {
    handleInDevelopmentTransition(client as any, id).catch((err) =>
      console.error('[story-opportunities/[id]] PUT side-effect error:', err),
    );
  }

  return NextResponse.json(data);
}

// ─── PATCH — automation-aware status transition ───────────────────────────────
// Preferred route for programmatic status changes. Accepts { status } only.
// Runs side-effects synchronously so the response includes pipeline metadata.

export async function PATCH(req: NextRequest, { params }: RouteParams) {
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

  const newStatus = typeof body.status === 'string' ? body.status.trim() : null;
  const allowed   = ['new', 'in_development', 'published', 'passed'];
  if (!newStatus || !allowed.includes(newStatus)) {
    return NextResponse.json({ error: 'status must be one of: new, in_development, published, passed' }, { status: 400 });
  }

  const { data, error } = await (client as any)
    .from('story_opportunities')
    .update({ status: newStatus })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    console.error('[api/story-opportunities/[id]] PATCH:', error.message);
    return NextResponse.json({ error: 'Failed to update opportunity status' }, { status: 500 });
  }

  let pipelineResult: Record<string, unknown> = {};

  if (newStatus === 'in_development') {
    try {
      await handleInDevelopmentTransition(client as any, id);
      pipelineResult = { pipeline: 'idea_creation_attempted' };
    } catch (err) {
      console.error('[story-opportunities/[id]] PATCH side-effect error:', err);
      pipelineResult = { pipeline: 'idea_creation_failed', error: String(err) };
    }
  }

  return NextResponse.json({ ...data, ...pipelineResult });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { error } = await (client as any)
    .from('story_opportunities')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[api/story-opportunities/[id]] DELETE:', error.message);
    return NextResponse.json({ error: 'Failed to delete opportunity' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
