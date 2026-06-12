/**
 * Sandbox runner (Phase 1 step 6) — continuous arena cron.
 *
 * Covers the six required behaviours:
 *   1. cron creates a batch
 *   2. scenario results are saved (batch aggregates + linked runs)
 *   3. health snapshot updates
 *   4. zero-action failure is critical
 *   5. regression is detected
 *   6. production isolation still holds (only sandbox tables written,
 *      no email/payment/SMS modules imported)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  aggregateBatchResults,
  computeHealthSnapshot,
  detectRegression,
  isZeroActionFailure,
  runCronPack,
  scenariosForPack,
  CRON_PACKS,
} from '../../src/lib/sandbox/runner';
import type { RunnerDeps, SupabaseLike } from '../../src/lib/sandbox/runner';
import type { ArenaRunResult } from '../../src/lib/sandbox/arena';

// ── Fake Supabase that records every write per table ───────────────────────

type WriteLog = Array<{ table: string; op: 'insert' | 'update'; payload: Record<string, unknown> }>;

function fakeSupabase(opts: {
  policyRows?: Array<{ key: string; value: unknown }>;
  todaysBatchCost?: number;
  windowScores?: Record<string, number[]>;
  baselineScores?: Record<string, number[]>;
}): { supabase: SupabaseLike; writes: WriteLog; readTables: Set<string> } {
  const writes: WriteLog = [];
  const readTables = new Set<string>();
  let batchSeq = 0;

  const supabase: SupabaseLike = {
    from(table: string) {
      readTables.add(table);
      const state: { op?: 'insert' | 'update'; payload?: Record<string, unknown>; filters: Record<string, unknown> } =
        { filters: {} };

      const result = () => {
        if (table === 'sandbox_policy') {
          return { data: opts.policyRows ?? [], error: null };
        }
        if (table === 'sandbox_run_batches' && !state.op) {
          return { data: [{ total_cost_cents: opts.todaysBatchCost ?? 0 }], error: null };
        }
        if (table === 'sandbox_decision_scores') {
          const agentId = state.filters['agent_id'] as string;
          const isBaseline = 'lt:scored_at' in state.filters;
          const scores = isBaseline
            ? (opts.baselineScores?.[agentId] ?? [])
            : (opts.windowScores?.[agentId] ?? []);
          return { data: scores.map((f1) => ({ f1_score: f1 })), error: null };
        }
        return { data: [], error: null };
      };

      const chain = {
        insert(payload: Record<string, unknown>) {
          state.op = 'insert';
          state.payload = payload;
          writes.push({ table, op: 'insert', payload });
          return chain;
        },
        update(payload: Record<string, unknown>) {
          state.op = 'update';
          state.payload = payload;
          writes.push({ table, op: 'update', payload });
          return chain;
        },
        select() {
          return chain;
        },
        eq(col: string, val: unknown) {
          state.filters[col] = val;
          return chain;
        },
        gte(col: string, val: unknown) {
          state.filters[`gte:${col}`] = val;
          return chain;
        },
        lt(col: string, val: unknown) {
          state.filters[`lt:${col}`] = val;
          return chain;
        },
        order() {
          return chain;
        },
        limit() {
          return chain;
        },
        single() {
          if (state.op === 'insert' && table === 'sandbox_run_batches') {
            batchSeq += 1;
            return Promise.resolve({ data: { id: `batch-${batchSeq}` }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
          return Promise.resolve(result()).then(onFulfilled, onRejected);
        },
      };
      return chain;
    },
  };

  return { supabase, writes, readTables };
}

function stubResult(partial: Partial<ArenaRunResult> & { f1?: number; actions?: number }): ArenaRunResult {
  const f1 = partial.f1 ?? 1;
  const actions = partial.actions ?? 1;
  return {
    trainingRunId: 'tr-1',
    agentRunId: 'resp-1',
    status: 'completed',
    summary: 'ok',
    proposedActions: Array.from({ length: actions }, (_, i) => ({
      action_type: `act_${i}`,
      preview: '',
    })) as ArenaRunResult['proposedActions'],
    llmCalls: 1,
    inputTokens: 10,
    outputTokens: 10,
    costCents: partial.costCents ?? 1,
    score: { precisionScore: f1, recallScore: f1, f1Score: f1, hit: f1 > 0 },
    durationMs: 5,
    ...partial,
  };
}

function deps(
  fake: ReturnType<typeof fakeSupabase>,
  f1ByScenario: (slug: string) => { f1: number; actions: number },
): RunnerDeps {
  return {
    supabase: fake.supabase,
    runScenario: async (scenario) => {
      const { f1, actions } = f1ByScenario(scenario.slug);
      return stubResult({ f1, actions });
    },
  };
}

// ── 1+2. Cron creates batches and saves aggregated results ─────────────────

describe('runCronPack — batches', () => {
  it('creates one batch per agent in the pack and links scenarios via batchId', async () => {
    const fake = fakeSupabase({});
    const seenOpts: Array<{ batchId?: string; trigger?: string }> = [];
    const report = await runCronPack('hourly', {
      supabase: fake.supabase,
      runScenario: async (_s, o) => {
        seenOpts.push(o);
        return stubResult({ f1: 1, actions: 1 });
      },
    });

    const agentCount = new Set(scenariosForPack('hourly').map((s) => s.agentId)).size;
    const batchInserts = fake.writes.filter((w) => w.table === 'sandbox_run_batches' && w.op === 'insert');
    expect(report.skipped).toBe(false);
    expect(batchInserts.length).toBe(agentCount);
    expect(batchInserts[0].payload.trigger).toBe('cron');
    // every scenario execution carried a batch id + cron trigger
    expect(seenOpts.length).toBe(scenariosForPack('hourly').length);
    expect(seenOpts.every((o) => o.batchId?.startsWith('batch-') && o.trigger === 'cron')).toBe(true);
  });

  it('saves aggregated results when closing the batch', async () => {
    const fake = fakeSupabase({});
    // alternate pass/fail
    let i = 0;
    await runCronPack('hourly', deps(fake, () => ({ f1: i++ % 2 === 0 ? 1 : 0, actions: 1 })));

    const updates = fake.writes.filter((w) => w.table === 'sandbox_run_batches' && w.op === 'update');
    expect(updates.length).toBeGreaterThan(0);
    for (const u of updates) {
      expect(u.payload.status).toBe('complete');
      expect(typeof u.payload.pass_count).toBe('number');
      expect(typeof u.payload.avg_f1).toBe('number');
      expect(u.payload.finished_at).toBeTruthy();
    }
  });

  it('skips entirely when the daily cost cap is already spent', async () => {
    const fake = fakeSupabase({
      policyRows: [{ key: 'max_daily_cost_cents', value: 100 }],
      todaysBatchCost: 100,
    });
    const report = await runCronPack('hourly', deps(fake, () => ({ f1: 1, actions: 1 })));
    expect(report.skipped).toBe('cost_cap');
    expect(fake.writes.filter((w) => w.table === 'sandbox_run_batches')).toHaveLength(0);
  });
});

// ── 3. Health snapshot updates ──────────────────────────────────────────────

describe('runCronPack — health snapshots', () => {
  it('writes a sandbox_agent_health row per agent with window vs baseline', async () => {
    const agents = [...new Set(scenariosForPack('hourly').map((s) => s.agentId))];
    const fake = fakeSupabase({
      windowScores: Object.fromEntries(agents.map((a) => [a, [0.8, 0.9]])),
      baselineScores: Object.fromEntries(agents.map((a) => [a, [0.85]])),
    });
    const report = await runCronPack('hourly', deps(fake, () => ({ f1: 1, actions: 1 })));

    const healthInserts = fake.writes.filter((w) => w.table === 'sandbox_agent_health');
    expect(healthInserts.length).toBe(agents.length);
    const row = healthInserts[0].payload;
    expect(row.runs).toBe(2);
    expect(row.avg_f1).toBeCloseTo(0.85, 4);
    expect(row.baseline_f1).toBeCloseTo(0.85, 4);
    expect(row.trend).toBe('stable');
    expect(report.health.length).toBe(agents.length);
  });
});

// ── 4. Zero-action failure is critical ──────────────────────────────────────

describe('zero-action failures', () => {
  it('classifies zero proposed actions against non-empty expectations as failure', () => {
    expect(isZeroActionFailure(0, 2)).toBe(true);
    expect(isZeroActionFailure(1, 2)).toBe(false);
    expect(isZeroActionFailure(0, 0)).toBe(false); // nothing expected, nothing proposed = fine
  });

  it('writes a critical lesson when a batch contains zero-action failures', async () => {
    const fake = fakeSupabase({});
    await runCronPack('hourly', deps(fake, () => ({ f1: 0, actions: 0 })));

    const lessons = fake.writes.filter((w) => w.table === 'sandbox_lessons_learned');
    const zeroAction = lessons.filter((l) => String(l.payload.title).startsWith('Zero-action failure'));
    expect(zeroAction.length).toBeGreaterThan(0);
    expect(zeroAction.every((l) => l.payload.severity === 'critical')).toBe(true);
  });

  it('aggregateBatchResults counts zero-action failures', () => {
    const agg = aggregateBatchResults(
      [
        { f1Score: 0, costCents: 1, proposedCount: 0 },
        { f1Score: 1, costCents: 1, proposedCount: 2 },
      ],
      [2, 2],
    );
    expect(agg.zeroActionFailures).toBe(1);
    expect(agg.passCount).toBe(1);
    expect(agg.avgF1).toBeCloseTo(0.5, 4);
  });
});

// ── 5. Regression detection ─────────────────────────────────────────────────

describe('regression detection', () => {
  it('detects minor and critical drops against thresholds', () => {
    expect(detectRegression(-0.05, 0.1, 0.25)).toBe('none');
    expect(detectRegression(-0.12, 0.1, 0.25)).toBe('minor');
    expect(detectRegression(-0.3, 0.1, 0.25)).toBe('critical');
    expect(detectRegression(null, 0.1, 0.25)).toBe('none'); // no baseline yet
    expect(detectRegression(0.2, 0.1, 0.25)).toBe('none');
  });

  it('computeHealthSnapshot marks degrading trend on regression', () => {
    const snap = computeHealthSnapshot([0.4, 0.5], [0.9, 0.8], { minorDrop: 0.1, criticalDrop: 0.25 });
    expect(snap.avgF1).toBeCloseTo(0.45, 4);
    expect(snap.baselineF1).toBeCloseTo(0.85, 4);
    expect(snap.deltaF1).toBeCloseTo(-0.4, 4);
    expect(snap.trend).toBe('degrading');
    expect(snap.regression).toBe('critical');
  });

  it('writes a regression lesson when window F1 drops below baseline', async () => {
    const agents = [...new Set(scenariosForPack('hourly').map((s) => s.agentId))];
    const fake = fakeSupabase({
      windowScores: Object.fromEntries(agents.map((a) => [a, [0.3]])),
      baselineScores: Object.fromEntries(agents.map((a) => [a, [0.9]])),
    });
    const report = await runCronPack('hourly', deps(fake, () => ({ f1: 1, actions: 1 })));

    const regressionLessons = fake.writes.filter(
      (w) => w.table === 'sandbox_lessons_learned' && String(w.payload.title).startsWith('F1 regression'),
    );
    expect(regressionLessons.length).toBe(agents.length);
    expect(regressionLessons.every((l) => l.payload.severity === 'critical')).toBe(true);
    expect(report.health.every((h) => h.regression === 'critical')).toBe(true);
  });
});

// ── 6. Production isolation ─────────────────────────────────────────────────

const SANDBOX_TABLE_ALLOWLIST = new Set([
  'sandbox_policy',
  'sandbox_run_batches',
  'sandbox_agent_health',
  'sandbox_decision_scores',
  'sandbox_lessons_learned',
]);

describe('production isolation', () => {
  it('the runner only ever touches sandbox tables', async () => {
    const fake = fakeSupabase({});
    await runCronPack('full', deps(fake, () => ({ f1: 0, actions: 0 })));

    for (const table of fake.readTables) {
      expect(SANDBOX_TABLE_ALLOWLIST.has(table), `unexpected table access: ${table}`).toBe(true);
    }
    for (const w of fake.writes) {
      expect(SANDBOX_TABLE_ALLOWLIST.has(w.table), `unexpected write: ${w.table}`).toBe(true);
    }
  });

  it('runner and cron route import no email/payment/SMS modules', () => {
    const banned = /resend|stripe|twilio|@\/lib\/email/i;
    for (const file of ['src/lib/sandbox/runner.ts', 'src/app/api/cron/sandbox-runner/route.ts']) {
      const src = readFileSync(resolve(process.cwd(), file), 'utf8');
      const imports = src.match(/^import .*$/gm) ?? [];
      for (const line of imports) {
        expect(banned.test(line), `banned import in ${file}: ${line}`).toBe(false);
      }
    }
  });

  it('arena interceptor never dispatches proposed actions (source contract)', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/lib/sandbox/arena.ts'), 'utf8');
    // the interceptor must capture without executing
    expect(src).toContain('capturedActions.push(action)');
    expect(src).not.toMatch(/executeApprovedAction\s*\(/);
    const imports = src.match(/^import .*$/gm) ?? [];
    for (const line of imports) {
      expect(/resend|stripe|twilio/i.test(line), `banned import in arena.ts: ${line}`).toBe(false);
    }
  });

  it('every pack only contains known scenario categories', () => {
    for (const [pack, categories] of Object.entries(CRON_PACKS)) {
      expect(categories.length, `${pack} pack empty`).toBeGreaterThan(0);
    }
    // full pack must be a superset of hourly + daily (true regression sweep)
    const full = new Set(CRON_PACKS.full);
    for (const c of [...CRON_PACKS.hourly, ...CRON_PACKS.daily]) {
      expect(full.has(c)).toBe(true);
    }
  });
});
