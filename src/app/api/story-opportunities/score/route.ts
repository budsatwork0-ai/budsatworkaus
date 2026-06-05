import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { evaluateOpportunity } from '@/lib/story/opportunity-scoring';
import { classifyOpportunityExposure } from '@/lib/story/internal-opportunity-filter';
import type { StoryOpportunity } from '@/types/story-engine';

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

  const opportunityId = typeof body.opportunity_id === 'string' ? body.opportunity_id.trim() : null;
  const scoreAll      = body.score_all === true;

  if (!opportunityId && !scoreAll) {
    return NextResponse.json({ error: 'Provide opportunity_id or score_all: true' }, { status: 400 });
  }

  // Fetch target opportunities
  let query = (client as any).from('story_opportunities').select('*');
  if (opportunityId) {
    query = query.eq('id', opportunityId);
  }
  // score_all: fetch every opportunity (no filter)

  const { data: opps, error: fetchErr } = await query;
  if (fetchErr) {
    console.error('[api/story-opportunities/score] Fetch error:', fetchErr.message);
    return NextResponse.json({ error: 'Failed to fetch opportunities' }, { status: 500 });
  }
  if (!opps || opps.length === 0) {
    return NextResponse.json({ error: 'No opportunities found' }, { status: 404 });
  }

  const scored: Array<{ id: string; story_score: number; score_breakdown: object; score_reason: string }> = [];
  const errors: string[] = [];

  for (const opp of opps as StoryOpportunity[]) {
    try {
      const result = evaluateOpportunity(opp);
      const exposure = classifyOpportunityExposure(opp);
      const { error: updateErr } = await (client as any)
        .from('story_opportunities')
        .update({
          source_type:     exposure === 'internal_system_milestone' ? 'internal_system_milestone' : opp.source_type,
          story_score:     result.story_score,
          score_breakdown: result.score_breakdown,
          score_reason:    result.score_reason,
          scored_at:       new Date().toISOString(),
        })
        .eq('id', opp.id);

      if (updateErr) {
        errors.push(`${opp.id}: ${updateErr.message}`);
      } else {
        scored.push({ id: opp.id, ...result });
      }
    } catch (e) {
      errors.push(`${opp.id}: ${e instanceof Error ? e.message : 'unknown error'}`);
    }
  }

  return NextResponse.json(
    { scored: scored.length, results: scored, errors },
    { status: errors.length === scored.length && scored.length === 0 ? 500 : 200 },
  );
}
