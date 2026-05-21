/**
 * POST /api/pipeline/simulate
 *
 * Creates a pipeline run for the given surface and walks it through all ten
 * stages in real time (500 ms per stage so the Realtime subscription in
 * AutonomyPipeline lights up live). Supports three outcome modes:
 *   success  — all stages pass → verdict auto_merge
 *   rejected — stops at reject gate
 *   rollback — stops at observe with a rollback event
 *
 * Uses the service-role key so RLS is bypassed and writes succeed regardless
 * of the caller's session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { PipelineSurface } from '@/lib/pipeline/types';

const VALID_SURFACES: PipelineSurface[] = ['public', 'admin', 'crew', 'customer'];
const VALID_OUTCOMES = ['success', 'rejected', 'rollback'] as const;
type Outcome = (typeof VALID_OUTCOMES)[number];

const STAGES = [
  'detect', 'analyze', 'design', 'generate', 'sandbox',
  'validate', 'reject', 'debate', 'deploy', 'observe',
] as const;
type StageId = (typeof STAGES)[number];

const SCRIPT: Record<StageId, { payload: Record<string, unknown> }> = {
  detect:   { payload: { metric: 'LCP', delta_ms: 312, confidence: 0.78 } },
  analyze:  { payload: { precedents: 3, top_match: 'ADR-0142', cosine: 0.86 } },
  design:   { payload: { blast_radius: 'low', constitution_score: 0.92 } },
  generate: { payload: { loc: 28, files: 2, deps_added: 0 } },
  sandbox:  { payload: { preview: 'https://bud-sim.preview.budsatwork.dev' } },
  validate: { payload: { lighthouse_delta: '+6', axe_violations_delta: 0, visual_diff_pct: 0.4 } },
  reject:   { payload: { trips: [] } },
  debate:   { payload: { composite: 0.88 } },
  deploy:   { payload: { stages: ['1%', '10%', '50%', '100%'] } },
  observe:  { payload: { hold_window_min: 30, anomalies: 0 } },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const surface = body.surface as PipelineSurface;
  const outcome: Outcome = VALID_OUTCOMES.includes(body.outcome) ? body.outcome : 'success';

  if (!surface || !VALID_SURFACES.includes(surface)) {
    return NextResponse.json({ error: 'invalid surface' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const triggerMap: Record<PipelineSurface, string> = {
    public:   'LCP regression on /quote landing',
    admin:    'CLS spike on /dashboard/financials',
    crew:     'Friction in /crew job-accept flow (3 retries p95)',
    customer: 'Conversion drop on /portal/payments (-4.2pp)',
  };

  const { data: run, error } = await supabase
    .from('pipeline_runs')
    .insert({
      surface,
      trigger_signal: triggerMap[surface],
      trigger_payload: { source: 'simulate-api', outcome },
      status: 'in_progress',
    })
    .select('*')
    .single();

  if (error || !run) {
    return NextResponse.json({ error: error?.message ?? 'failed to create run' }, { status: 500 });
  }

  const rejectAt: StageId | null =
    outcome === 'rejected' ? 'reject' : outcome === 'rollback' ? 'observe' : null;

  for (const stage of STAGES) {
    const step = SCRIPT[stage];

    await supabase.from('pipeline_stage_events').insert({
      run_id: run.id, stage, status: 'active', payload: step.payload,
    });

    if (stage === 'sandbox') {
      await supabase.from('pipeline_artifacts').insert({
        run_id: run.id, stage, kind: 'preview_url',
        label: 'Vercel preview', url: step.payload.preview as string,
      });
    }
    if (stage === 'generate') {
      await supabase.from('pipeline_artifacts').insert({
        run_id: run.id, stage, kind: 'diff',
        label: '+28 / −12 across 2 files',
        url: 'https://github.com/budsatwork0-ai/budsatworkaus/pull/1',
        body: { loc: 28, files: 2 },
      });
    }
    if (stage === 'validate') {
      await supabase.from('pipeline_artifacts').insert([
        { run_id: run.id, stage, kind: 'lighthouse', label: 'Lighthouse +6', body: { delta: 6 } },
        { run_id: run.id, stage, kind: 'axe', label: '0 new a11y violations', body: { delta: 0 } },
        { run_id: run.id, stage, kind: 'visual_diff', label: '0.4% visual diff', body: { pct: 0.4 } },
      ]);
    }
    if (stage === 'debate') {
      await supabase.from('pipeline_agent_scores').insert([
        { run_id: run.id, agent: 'architect',  dimension: 'confidence', value: 0.91, rationale: 'Smallest diff that solves cause; allow-list respected.' },
        { run_id: run.id, agent: 'taste',      dimension: 'UX',         value: 0.83, rationale: 'Hierarchy and spacing match constitution.' },
        { run_id: run.id, agent: 'sentinel',   dimension: 'stability',  value: 0.88, rationale: 'No correlated error pattern in last 14d.' },
        { run_id: run.id, agent: 'releasebot', dimension: 'rollback',   value: 0.94, rationale: 'Reversible single-file change; flag-guarded.' },
        { run_id: run.id, agent: 'skeptic',    dimension: 'trust',      value: 0.79, rationale: 'Only 3 precedents; recommend cohort gating.', is_skeptic: true },
      ]);
    }

    await sleep(500);

    if (stage === rejectAt) {
      await supabase.from('pipeline_stage_events').insert({
        run_id: run.id, stage, status: 'rejected',
        payload: {
          reason: outcome === 'rejected'
            ? 'shift index above threshold'
            : 'rollback: error rate +0.8pp in canary',
        },
      });
      await supabase.from('pipeline_runs').update({
        status: outcome === 'rollback' ? 'rolled_back' : 'rejected',
        verdict: outcome === 'rollback' ? 'rolled_back' : 'rejected',
        rolled_back_at: outcome === 'rollback' ? new Date().toISOString() : null,
        rollback_reason: outcome === 'rollback' ? 'error rate +0.8pp in canary' : null,
        ended_at: new Date().toISOString(),
        composite_score: outcome === 'rollback' ? 0.88 : 0.61,
      }).eq('id', run.id);
      return NextResponse.json({ ok: true, run_id: run.id, verdict: outcome });
    }

    await supabase.from('pipeline_stage_events').insert({
      run_id: run.id, stage, status: 'passed', payload: step.payload,
    });
  }

  await supabase.from('pipeline_runs').update({
    status: 'succeeded',
    verdict: 'auto_merge',
    composite_score: 0.88,
    pr_url: 'https://github.com/budsatwork0-ai/budsatworkaus/pull/1',
    preview_url: 'https://bud-sim.preview.budsatwork.dev',
    ended_at: new Date().toISOString(),
  }).eq('id', run.id);

  return NextResponse.json({ ok: true, run_id: run.id, verdict: 'auto_merge' });
}
