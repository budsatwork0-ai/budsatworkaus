/**
 * seed-pipeline-run.ts
 *
 * Walks a synthetic improvement run through all ten stages and writes the
 * events / artifacts / agent scores into Supabase. While this script runs,
 * the Mission Control dashboard will light up live via Realtime — every
 * stage flips active → passed, the detail panel fills with scores, and
 * the run finishes with verdict='auto_merge'.
 *
 * Usage:
 *   pnpm tsx scripts/seed-pipeline-run.ts --surface=admin
 *   pnpm tsx scripts/seed-pipeline-run.ts --surface=customer --outcome=rejected
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env (.env.local).
 */

import { createClient } from '@supabase/supabase-js';

const args = Object.fromEntries(
  process.argv.slice(2).map((s) => {
    const [k, v = 'true'] = s.replace(/^--/, '').split('=');
    return [k, v];
  }),
) as Record<string, string>;

const SURFACE = (args.surface ?? 'admin') as 'public' | 'admin' | 'crew' | 'customer';
const OUTCOME = (args.outcome ?? 'success') as 'success' | 'rejected' | 'rollback';
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const STAGES = [
  'detect','analyze','design','generate','sandbox',
  'validate','reject','debate','deploy','observe',
] as const;

type StageId = typeof STAGES[number];

const SCRIPT: Record<StageId, { payload?: Record<string, unknown>; ms: number }> = {
  detect:   { ms: 900,  payload: { metric: 'LCP', delta_ms: 312, confidence: 0.78 } },
  analyze:  { ms: 1100, payload: { precedents: 3, top_match: 'ADR-0142', cosine: 0.86 } },
  design:   { ms: 1400, payload: { blast_radius: 'low', constitution_score: 0.92, allow_list: ['app/(public)/(quote)/components/QuoteCTA.tsx'] } },
  generate: { ms: 1300, payload: { loc: 28, files: 2, deps_added: 0 } },
  sandbox:  { ms: 900,  payload: { preview: 'https://bud-run-7f3c.preview.budsatwork.dev' } },
  validate: { ms: 1500, payload: { lighthouse_delta: '+6', axe_violations_delta: 0, visual_diff_pct: 0.4, bundle_delta_pct: 0.0 } },
  reject:   { ms: 700,  payload: { trips: [] } },
  debate:   { ms: 1300, payload: { composite: 0.88 } },
  deploy:   { ms: 1100, payload: { stages: ['1%','10%','50%','100%'] } },
  observe:  { ms: 1400, payload: { hold_window_min: 30, anomalies: 0 } },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const trigger =
    SURFACE === 'public'   ? 'LCP regression on /quote landing'
  : SURFACE === 'admin'    ? 'CLS spike on /dashboard/financials'
  : SURFACE === 'crew'     ? 'Friction in /crew job-accept flow (3 retries p95)'
  :                          'Conversion drop on /portal/payments (-4.2pp)';

  // 1. Open the run
  const { data: run, error } = await supabase
    .from('pipeline_runs')
    .insert({
      surface: SURFACE,
      trigger_signal: trigger,
      trigger_payload: { source: 'seed-script', outcome: OUTCOME },
      status: 'in_progress',
    })
    .select('*')
    .single();
  if (error || !run) {
    console.error('Could not open run', error);
    process.exit(1);
  }
  console.log(`Opened run ${run.id} on surface=${SURFACE}, outcome=${OUTCOME}`);

  const rejectAt: StageId | null =
    OUTCOME === 'rejected' ? 'reject'
  : OUTCOME === 'rollback' ? 'observe'
  : null;

  // 2. Walk the stages
  for (const stage of STAGES) {
    const step = SCRIPT[stage];
    await supabase.from('pipeline_stage_events').insert({
      run_id: run.id,
      stage,
      status: 'active',
      payload: step.payload,
    });

    // mid-stage artifacts
    if (stage === 'sandbox') {
      await supabase.from('pipeline_artifacts').insert({
        run_id: run.id,
        stage,
        kind: 'preview_url',
        label: 'Vercel preview',
        url: step.payload?.preview as string,
      });
    }
    if (stage === 'validate') {
      await supabase.from('pipeline_artifacts').insert([
        { run_id: run.id, stage, kind: 'lighthouse', label: 'Lighthouse +6', body: { delta: 6 } },
        { run_id: run.id, stage, kind: 'axe', label: '0 new a11y violations', body: { delta: 0 } },
        { run_id: run.id, stage, kind: 'visual_diff', label: '0.4% visual diff', body: { pct: 0.4 } },
      ]);
    }
    if (stage === 'generate') {
      await supabase.from('pipeline_artifacts').insert({
        run_id: run.id,
        stage,
        kind: 'diff',
        label: '+28 / −12 across 2 files',
        url: 'https://github.com/budsatwork/web/pull/2741',
        body: { loc: 28, files: 2 },
      });
    }
    if (stage === 'debate') {
      await supabase.from('pipeline_agent_scores').insert([
        { run_id: run.id, agent: 'architect', dimension: 'confidence', value: 0.91, rationale: 'Smallest diff that solves cause; allow-list respected.' },
        { run_id: run.id, agent: 'taste',     dimension: 'UX',         value: 0.83, rationale: 'Hierarchy and spacing match constitution.' },
        { run_id: run.id, agent: 'sentinel',  dimension: 'stability',  value: 0.88, rationale: 'No correlated error pattern in last 14d.' },
        { run_id: run.id, agent: 'releasebot',dimension: 'rollback',   value: 0.94, rationale: 'Reversible single-file change; flag-guarded.' },
        { run_id: run.id, agent: 'skeptic',   dimension: 'trust',      value: 0.79, rationale: 'No prior failures in this path, but only 3 precedents; recommend cohort gating.', is_skeptic: true },
      ]);
    }

    await sleep(step.ms);

    // Did we fail here?
    if (stage === rejectAt) {
      await supabase.from('pipeline_stage_events').insert({
        run_id: run.id,
        stage,
        status: 'rejected',
        payload: { reason: OUTCOME === 'rejected' ? 'shift index above threshold' : 'rollback: error rate +0.8pp in canary' },
      });
      await supabase
        .from('pipeline_runs')
        .update({
          status: OUTCOME === 'rollback' ? 'rolled_back' : 'rejected',
          verdict: OUTCOME === 'rollback' ? 'rolled_back' : 'rejected',
          rolled_back_at: OUTCOME === 'rollback' ? new Date().toISOString() : null,
          rollback_reason: OUTCOME === 'rollback' ? 'error rate +0.8pp in canary' : null,
          ended_at: new Date().toISOString(),
          composite_score: OUTCOME === 'rollback' ? 0.88 : 0.61,
        })
        .eq('id', run.id);
      console.log(`Stopped at ${stage}: ${OUTCOME}`);
      return;
    } else {
      await supabase.from('pipeline_stage_events').insert({
        run_id: run.id,
        stage,
        status: 'passed',
        payload: step.payload,
      });
    }
  }

  // 3. Success — auto_merge verdict + composite score
  await supabase
    .from('pipeline_runs')
    .update({
      status: 'succeeded',
      verdict: 'auto_merge',
      composite_score: 0.88,
      pr_url: 'https://github.com/budsatwork/web/pull/2741',
      preview_url: 'https://bud-run-7f3c.preview.budsatwork.dev',
      ended_at: new Date().toISOString(),
    })
    .eq('id', run.id);
  console.log(`Run ${run.id} succeeded · verdict=auto_merge · composite=0.88`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
