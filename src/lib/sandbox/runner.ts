/**
 * Sandbox Runner — Phase 1 step 6 of the continuous agent improvement loop.
 *
 * Orchestrates scheduled (cron) sweeps of Agent Training Arena scenarios:
 *   1. Groups a pack's scenarios by agent and runs each group as a
 *      sandbox_run_batches row (trigger='cron').
 *   2. Delegates actual execution to the existing arena interceptor
 *      (runSandboxScenario) — proposed actions are captured, never dispatched.
 *      No emails, no Stripe, no Twilio, no production writes.
 *   3. Aggregates batch results (pass count, avg F1, cost).
 *   4. Computes per-agent health snapshots (24h window vs trailing 7d
 *      baseline) into sandbox_agent_health.
 *   5. Flags zero-action failures as critical and writes regression lessons
 *      when delta F1 breaches sandbox_policy thresholds.
 *
 * Spend is capped per-day via sandbox_policy.max_daily_cost_cents.
 * This module never reads or writes auto-promotion state — promotion does
 * not exist yet and auto_promote_enabled stays false.
 */

import { SANDBOX_SCENARIOS } from './scenarios';
import type { SandboxScenarioTemplate, ScenarioCategory } from './scenarios';
import type { ArenaRunResult } from './arena';

// ── Packs ───────────────────────────────────────────────────────────────────

export type CronPack = 'hourly' | 'daily' | 'full';

export const CRON_PACKS: Record<CronPack, ScenarioCategory[]> = {
  // customer/quote scenarios every hour
  hourly: ['customer'],
  // operational packs once a day
  daily: ['ops', 'finance', 'ndis', 'growth'],
  // full regression nightly — every category
  full: ['customer', 'participant', 'marketplace', 'ndis', 'ops', 'growth', 'finance'],
};

export const PASS_F1_THRESHOLD = 0.5;

// ── Pure helpers (unit-tested in tests/lib/sandbox-runner.test.ts) ──────────

export interface BatchResultLike {
  f1Score: number;
  costCents: number;
  proposedCount: number;
}

export interface BatchAggregate {
  scenarioCount: number;
  passCount: number;
  avgF1: number;
  totalCostCents: number;
  zeroActionFailures: number;
}

export function aggregateBatchResults(
  results: BatchResultLike[],
  expectedCounts: number[],
): BatchAggregate {
  const scenarioCount = results.length;
  const passCount = results.filter((r) => r.f1Score >= PASS_F1_THRESHOLD).length;
  const avgF1 =
    scenarioCount === 0
      ? 0
      : Math.round((results.reduce((s, r) => s + r.f1Score, 0) / scenarioCount) * 10000) / 10000;
  const totalCostCents = results.reduce((s, r) => s + (r.costCents || 0), 0);
  const zeroActionFailures = results.filter((r, i) =>
    isZeroActionFailure(r.proposedCount, expectedCounts[i] ?? 0),
  ).length;
  return { scenarioCount, passCount, avgF1, totalCostCents, zeroActionFailures };
}

/**
 * A zero-action failure is the worst failure mode: the scenario expected at
 * least one action and the agent proposed nothing at all. Always critical.
 */
export function isZeroActionFailure(proposedCount: number, expectedCount: number): boolean {
  return expectedCount > 0 && proposedCount === 0;
}

export type RegressionLevel = 'none' | 'minor' | 'critical';

export function detectRegression(
  deltaF1: number | null,
  minorDrop: number,
  criticalDrop: number,
): RegressionLevel {
  if (deltaF1 === null) return 'none'; // no baseline yet
  if (deltaF1 <= -criticalDrop) return 'critical';
  if (deltaF1 <= -minorDrop) return 'minor';
  return 'none';
}

export interface HealthSnapshot {
  runs: number;
  passRate: number | null;
  avgF1: number | null;
  baselineF1: number | null;
  deltaF1: number | null;
  trend: 'improving' | 'stable' | 'degrading';
  regression: RegressionLevel;
}

export function computeHealthSnapshot(
  windowF1s: number[],
  baselineF1s: number[],
  thresholds: { minorDrop: number; criticalDrop: number },
): HealthSnapshot {
  const round = (v: number) => Math.round(v * 10000) / 10000;
  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;

  const runs = windowF1s.length;
  const avgF1 = runs === 0 ? null : round(avg(windowF1s));
  const passRate =
    runs === 0 ? null : round(windowF1s.filter((f) => f >= PASS_F1_THRESHOLD).length / runs);
  const baselineF1 = baselineF1s.length === 0 ? null : round(avg(baselineF1s));
  const deltaF1 = avgF1 === null || baselineF1 === null ? null : round(avgF1 - baselineF1);

  const regression = detectRegression(deltaF1, thresholds.minorDrop, thresholds.criticalDrop);
  const trend: HealthSnapshot['trend'] =
    deltaF1 === null
      ? 'stable'
      : regression !== 'none'
        ? 'degrading'
        : deltaF1 >= thresholds.minorDrop
          ? 'improving'
          : 'stable';

  return { runs, passRate, avgF1, baselineF1, deltaF1, trend, regression };
}

// ── Orchestration ───────────────────────────────────────────────────────────

/**
 * Minimal structural type for the Supabase client so tests can inject a fake.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupabaseLike = { from: (table: string) => any };

export interface RunnerDeps {
  supabase: SupabaseLike;
  runScenario: (
    scenario: SandboxScenarioTemplate,
    opts: { triggeredBy?: string; batchId?: string; trigger?: 'manual' | 'cron' | 'eval' },
  ) => Promise<ArenaRunResult>;
  now?: () => Date;
}

export interface CronPackReport {
  pack: CronPack;
  skipped: false | 'cost_cap';
  batches: Array<{
    batchId: string;
    agentId: string;
    scenarioCount: number;
    passCount: number;
    avgF1: number;
    totalCostCents: number;
    zeroActionFailures: number;
  }>;
  health: Array<{
    agentId: string;
    avgF1: number | null;
    baselineF1: number | null;
    deltaF1: number | null;
    trend: string;
    regression: RegressionLevel;
  }>;
  totalCostCents: number;
  durationMs: number;
}

const DEFAULT_POLICY = {
  max_daily_cost_cents: 500,
  regression_minor_drop: 0.1,
  regression_critical_drop: 0.25,
};

async function loadPolicy(supabase: SupabaseLike): Promise<typeof DEFAULT_POLICY> {
  const { data } = await supabase.from('sandbox_policy').select('key, value');
  const out = { ...DEFAULT_POLICY };
  for (const row of (data ?? []) as Array<{ key: string; value: unknown }>) {
    if (row.key in out) {
      const num = Number(row.value);
      if (Number.isFinite(num)) out[row.key as keyof typeof DEFAULT_POLICY] = num;
    }
  }
  return out;
}

async function spentTodayCents(supabase: SupabaseLike, now: Date): Promise<number> {
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { data } = await supabase
    .from('sandbox_run_batches')
    .select('total_cost_cents')
    .gte('started_at', startOfDay.toISOString());
  return ((data ?? []) as Array<{ total_cost_cents: number }>).reduce(
    (s, r) => s + (r.total_cost_cents || 0),
    0,
  );
}

export function scenariosForPack(pack: CronPack): SandboxScenarioTemplate[] {
  const categories = new Set<ScenarioCategory>(CRON_PACKS[pack]);
  return SANDBOX_SCENARIOS.filter((s) => categories.has(s.category));
}

function groupByAgent(
  scenarios: SandboxScenarioTemplate[],
): Map<string, SandboxScenarioTemplate[]> {
  const groups = new Map<string, SandboxScenarioTemplate[]>();
  for (const s of scenarios) {
    const list = groups.get(s.agentId) ?? [];
    list.push(s);
    groups.set(s.agentId, list);
  }
  return groups;
}

/**
 * Run one cron pack: batches per agent, then health snapshots + regression
 * lessons for every agent the pack touched.
 */
export async function runCronPack(pack: CronPack, deps: RunnerDeps): Promise<CronPackReport> {
  const now = deps.now ?? (() => new Date());
  const startedAt = now();
  const { supabase, runScenario } = deps;

  const policy = await loadPolicy(supabase);
  const alreadySpent = await spentTodayCents(supabase, startedAt);

  const report: CronPackReport = {
    pack,
    skipped: false,
    batches: [],
    health: [],
    totalCostCents: 0,
    durationMs: 0,
  };

  if (alreadySpent >= policy.max_daily_cost_cents) {
    report.skipped = 'cost_cap';
    report.durationMs = now().getTime() - startedAt.getTime();
    return report;
  }

  const groups = groupByAgent(scenariosForPack(pack));

  for (const [agentId, scenarios] of groups) {
    // Stop opening new batches once the cap is hit mid-run.
    if (alreadySpent + report.totalCostCents >= policy.max_daily_cost_cents) break;

    const { data: batchRow, error: batchErr } = await supabase
      .from('sandbox_run_batches')
      .insert({
        agent_id: agentId,
        trigger: 'cron',
        status: 'running',
        scenario_count: scenarios.length,
      })
      .select('id')
      .single();

    if (batchErr || !batchRow) continue; // agent missing from agents table etc — skip, keep sweeping

    const batchId: string = batchRow.id;
    const results: BatchResultLike[] = [];
    const expectedCounts: number[] = [];
    let failed = false;

    for (const scenario of scenarios) {
      expectedCounts.push(scenario.expectedActionTypes.length);
      try {
        const r = await runScenario(scenario, {
          triggeredBy: 'cron:sandbox-runner',
          batchId,
          trigger: 'cron',
        });
        results.push({
          f1Score: r.score.f1Score,
          costCents: r.costCents,
          proposedCount: r.proposedActions.length,
        });
      } catch {
        failed = true;
        results.push({ f1Score: 0, costCents: 0, proposedCount: 0 });
      }
    }

    const agg = aggregateBatchResults(results, expectedCounts);
    report.totalCostCents += agg.totalCostCents;

    await supabase
      .from('sandbox_run_batches')
      .update({
        status: failed ? 'failed' : 'complete',
        scenario_count: agg.scenarioCount,
        pass_count: agg.passCount,
        avg_f1: agg.avgF1,
        total_cost_cents: agg.totalCostCents,
        finished_at: now().toISOString(),
      })
      .eq('id', batchId);

    report.batches.push({
      batchId,
      agentId,
      scenarioCount: agg.scenarioCount,
      passCount: agg.passCount,
      avgF1: agg.avgF1,
      totalCostCents: agg.totalCostCents,
      zeroActionFailures: agg.zeroActionFailures,
    });
  }

  // ── Health snapshots for every agent this pack touched ──────────────────
  const windowStart = new Date(startedAt.getTime() - 24 * 60 * 60 * 1000);
  const baselineStart = new Date(startedAt.getTime() - 8 * 24 * 60 * 60 * 1000);

  for (const batch of report.batches) {
    const { data: windowRows } = await supabase
      .from('sandbox_decision_scores')
      .select('f1_score')
      .eq('agent_id', batch.agentId)
      .gte('scored_at', windowStart.toISOString());

    const { data: baselineRows } = await supabase
      .from('sandbox_decision_scores')
      .select('f1_score')
      .eq('agent_id', batch.agentId)
      .gte('scored_at', baselineStart.toISOString())
      .lt('scored_at', windowStart.toISOString());

    const windowF1s = ((windowRows ?? []) as Array<{ f1_score: number }>).map((r) =>
      Number(r.f1_score),
    );
    const baselineF1s = ((baselineRows ?? []) as Array<{ f1_score: number }>).map((r) =>
      Number(r.f1_score),
    );

    const snapshot = computeHealthSnapshot(windowF1s, baselineF1s, {
      minorDrop: policy.regression_minor_drop,
      criticalDrop: policy.regression_critical_drop,
    });

    await supabase.from('sandbox_agent_health').insert({
      agent_id: batch.agentId,
      window_start: windowStart.toISOString(),
      window_end: startedAt.toISOString(),
      runs: snapshot.runs,
      pass_rate: snapshot.passRate,
      avg_f1: snapshot.avgF1,
      avg_precision: null,
      avg_recall: null,
      baseline_f1: snapshot.baselineF1,
      delta_f1: snapshot.deltaF1,
      trend: snapshot.trend,
    });

    // Regression lesson (warning for minor, critical for critical drop).
    if (snapshot.regression !== 'none') {
      await supabase.from('sandbox_lessons_learned').insert({
        agent_id: batch.agentId,
        title: `F1 regression detected: ${batch.agentId}`,
        observation: `Rolling 24h avg F1 ${snapshot.avgF1} vs 7d baseline ${snapshot.baselineF1} (delta ${snapshot.deltaF1}). Detected by sandbox-runner cron (${pack} pack).`,
        recommendation:
          'Review the failing scenarios in this window. If a recent config change caused the drop, revert via agent_config_versions.',
        severity: snapshot.regression === 'critical' ? 'critical' : 'warning',
        source: 'auto',
        environment: 'sandbox',
      });
    }

    // Zero-action failures are the worst failure mode — surface as critical.
    if (batch.zeroActionFailures > 0) {
      await supabase.from('sandbox_lessons_learned').insert({
        agent_id: batch.agentId,
        title: `Zero-action failure: ${batch.agentId}`,
        observation: `${batch.zeroActionFailures} scenario(s) in batch ${batch.batchId} expected actions but the agent proposed nothing.`,
        recommendation:
          'Agent is not producing any proposed actions for expected inputs. Check system prompt, input parsing, and action schema.',
        severity: 'critical',
        source: 'auto',
        environment: 'sandbox',
      });
    }

    report.health.push({
      agentId: batch.agentId,
      avgF1: snapshot.avgF1,
      baselineF1: snapshot.baselineF1,
      deltaF1: snapshot.deltaF1,
      trend: snapshot.trend,
      regression: snapshot.regression,
    });
  }

  report.durationMs = now().getTime() - startedAt.getTime();
  return report;
}
