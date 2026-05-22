/**
 * GET /api/pipeline/runs/[id]
 *
 * Full detail for a single run: events, artifacts, agent scores.
 * Used when you click into a historical run from the run history drawer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { STAGES } from '@/lib/pipeline/stages';
import type { PipelineRun, PipelineRunDetail, PipelineStageEvent, PipelineStageId } from '@/lib/pipeline/types';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ error: 'bad id' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );

  const [{ data: run }, { data: events }, { data: artifacts }, { data: scores }] = await Promise.all([
    supabase.from('pipeline_runs').select('*').eq('id', id).maybeSingle<PipelineRun>(),
    supabase.from('pipeline_stage_events').select('*').eq('run_id', id).order('ts', { ascending: true }),
    supabase.from('pipeline_artifacts').select('*').eq('run_id', id).order('created_at', { ascending: true }),
    supabase.from('pipeline_agent_scores').select('*').eq('run_id', id).order('created_at', { ascending: true }),
  ]);

  if (!run) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const stages = STAGES.reduce(
    (acc, s) => ((acc[s.id] = 'idle'), acc),
    {} as Record<PipelineStageId, PipelineRunDetail['stages'][PipelineStageId]>,
  );
  (events ?? []).forEach((e: PipelineStageEvent) => {
    stages[e.stage] = e.status;
  });

  const detail: PipelineRunDetail = {
    run,
    stages,
    events: events ?? [],
    artifacts: artifacts ?? [],
    scores: scores ?? [],
  };

  return NextResponse.json(detail);
}
