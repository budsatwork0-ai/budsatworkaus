import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { scoreIdea } from '@/lib/story/idea-scoring';
import { logPipelineEvent } from '@/lib/growth/pipeline-events';

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanNullableText(value: unknown): string | null {
  const text = cleanText(value);
  return text ? text : null;
}

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { data, error } = await (client as any)
    .from('content_ideas')
    .select('*')
    .order('priority')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[api/content-ideas] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch content ideas' }, { status: 500 });
  }

  return NextResponse.json({ ideas: data ?? [] });
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

  const title = cleanText(body.title);
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

  const insert = {
    title,
    opportunity_id:      cleanNullableText(body.opportunity_id),
    related_arc_id:     cleanNullableText(body.related_arc_id),
    related_characters: Array.isArray(body.related_characters) ? body.related_characters : [],
    platform_fit:       cleanText(body.platform_fit),
    format:             cleanText(body.format),
    hook:               cleanText(body.hook),
    content_angle:      cleanText(body.content_angle),
    status:             body.status ?? 'captured',
    priority:           typeof body.priority === 'number' ? body.priority : 0,
    notes:              cleanText(body.notes),
  };

  const { data, error } = await (client as any)
    .from('content_ideas')
    .insert(insert)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A content idea already exists for this opportunity' }, { status: 409 });
    }
    console.error('[api/content-ideas] POST:', error.message);
    return NextResponse.json({ error: 'Failed to create content idea' }, { status: 500 });
  }

  // ── Post-insert: score the idea ───────────────────────────────────────────────
  // Fetch opportunity score if this idea is linked to one.
  // Wrapped in try/catch — never blocks the 201 response.
  if (data) {
    scoreAndLogIdea(client as any, data).catch((err) =>
      console.error('[api/content-ideas] POST scoring error (non-fatal):', err),
    );
  }

  return NextResponse.json(data, { status: 201 });
}

// ── Post-insert scoring helper ────────────────────────────────────────────────

async function scoreAndLogIdea(client: any, idea: any): Promise<void> {
  let opportunityScore: number | undefined;

  if (idea.opportunity_id) {
    const { data: opp } = await client
      .from('story_opportunities')
      .select('story_score, source_ref_id, source_type')
      .eq('id', idea.opportunity_id)
      .single();
    opportunityScore = opp?.story_score ?? undefined;
  }

  const scoringResult = scoreIdea(
    {
      title:              idea.title,
      platform_fit:       idea.platform_fit,
      format:             idea.format,
      hook:               idea.hook,
      content_angle:      idea.content_angle,
      notes:              idea.notes,
      related_arc_id:     idea.related_arc_id,
      related_characters: idea.related_characters ?? [],
    },
    opportunityScore,
  );

  await client
    .from('content_ideas')
    .update({
      idea_score:      scoringResult.idea_score,
      score_breakdown: scoringResult.score_breakdown,
      score_reason:    scoringResult.score_reason,
      scored_at:       new Date().toISOString(),
    })
    .eq('id', idea.id);

  await logPipelineEvent(client, {
    event_type:  'idea_scored',
    source_type: 'idea',
    source_id:   idea.id,
    result_type: 'content_idea',
    result_id:   idea.id,
    metadata:    { idea_score: scoringResult.idea_score, opportunity_score: opportunityScore },
  });
}
