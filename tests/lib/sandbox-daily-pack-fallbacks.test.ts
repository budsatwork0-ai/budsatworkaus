/**
 * BUG-2 regression suite — daily/full-pack agents sandbox fallbacks.
 *
 * Verifies that every affected agent produces non-empty proposed actions
 * (matching expectedActionTypes) when the Arena injects synthetic scenario
 * data via ctx.input. Uses regular imports (not `import type`) so Babel
 * transforms without the `import type` parse error.
 *
 * Agents covered:
 *   cfo-agent, price-optimizer, ab-test-architect, conversion-funnel,
 *   seo-meta, lead-scorer, applicant-screener, reconciliation,
 *   scheduling (4 kinds), whs-safety-reminder (2 kinds)
 */

import { describe, it, expect, test } from 'vitest';
import { cfoAgent } from '../../src/lib/agents/agents/cfo-agent';
import { priceOptimizerAgent } from '../../src/lib/agents/agents/price-optimizer';
import { abTestArchitectAgent } from '../../src/lib/agents/agents/ab-test-architect';
import { conversionFunnelAgent } from '../../src/lib/agents/agents/conversion-funnel';
import { seoMetaAgent } from '../../src/lib/agents/agents/seo-meta';
import { leadScorerAgent } from '../../src/lib/agents/agents/lead-scorer';
import { applicantScreenerAgent } from '../../src/lib/agents/agents/applicant-screener';
import { reconciliationAgent } from '../../src/lib/agents/agents/reconciliation';
import { schedulingAgent } from '../../src/lib/agents/agents/scheduling';
import { whsSafetyReminderAgent } from '../../src/lib/agents/agents/whs-safety-reminder';
import { SANDBOX_ID_PREFIX } from '../../src/lib/agents/sandbox-input';

// ── Fake infrastructure ────────────────────────────────────────────────────

interface CapturedAction {
  action_type: string;
  target_table: string;
  target_id: string;
  preview: string;
  payload: Record<string, unknown>;
}

interface DbWrite {
  table: string;
  op: 'insert' | 'update';
  payload: Record<string, unknown>;
}

/**
 * Returns a thenable, fully chainable Supabase query stub.
 * Every query method returns the same chain. When awaited the chain
 * resolves to { data: [], error: null }. `.single()` and `.maybeSingle()`
 * resolve to { data: null, error: null }.
 */
function makeQueryChain(
  onInsert?: (payload: Record<string, unknown>) => void,
  onUpdate?: (payload: Record<string, unknown>) => void,
): Record<string, unknown> {
  const EMPTY = Promise.resolve({ data: [], error: null, count: 0 });
  const NULL_SINGLE = Promise.resolve({ data: null, error: null });

  type Chain = Record<string, (...args: unknown[]) => Chain | Promise<unknown>>;
  const chain: Chain = {} as Chain;

  const passthrough = () => chain;
  for (const m of ['eq','neq','is','in','or','gte','lte','gt','lt','like',
    'ilike','contains','limit','order','filter','not','match','head','count']) {
    chain[m] = passthrough;
  }

  chain['select'] = (_cols?: string) => {
    // select returns the same chainable so callers can chain .eq().lte() etc.
    // It is also thenable — awaiting it gives { data: [], error: null }.
    return Object.assign(chain, {
      then: EMPTY.then.bind(EMPTY),
      catch: EMPTY.catch.bind(EMPTY),
      finally: EMPTY.finally.bind(EMPTY),
    });
  };

  chain['single'] = () => NULL_SINGLE;
  chain['maybeSingle'] = () => NULL_SINGLE;

  chain['insert'] = (payload: unknown) => {
    if (onInsert) onInsert(payload as Record<string, unknown>);
    const inserted = Promise.resolve({ data: { id: 'fake-id', ...(payload as object) }, error: null });
    const insertChain: Chain = {} as Chain;
    insertChain['select'] = () => {
      insertChain['single'] = () => inserted;
      return insertChain;
    };
    insertChain['single'] = () => inserted;
    return insertChain;
  };

  chain['update'] = (payload: unknown) => {
    if (onUpdate) onUpdate(payload as Record<string, unknown>);
    return chain; // chain is still chainable (.eq() etc.)
  };

  chain['upsert'] = (_payload: unknown) => chain;
  chain['delete'] = () => chain;

  // Make the chain itself thenable (for bare `await supabase.from(...).select(...)`)
  chain['then'] = EMPTY.then.bind(EMPTY);
  chain['catch'] = EMPTY.catch.bind(EMPTY);
  chain['finally'] = EMPTY.finally.bind(EMPTY);

  return chain;
}

function fakeSupabase(writes: DbWrite[]) {
  return {
    from: (table: string) =>
      makeQueryChain(
        (payload) => writes.push({ table, op: 'insert', payload }),
        (payload) => writes.push({ table, op: 'update', payload }),
      ),
  };
}

function fakeCtx(
  agentId: string,
  input: Record<string, unknown>,
  llmResponse?: string,
): { ctx: Record<string, unknown>; actions: CapturedAction[]; writes: DbWrite[] } {
  const actions: CapturedAction[] = [];
  const writes: DbWrite[] = [];

  // Default LLM response — valid JSON that agents can parse
  const defaultLlmResponse = JSON.stringify({
    summary: 'Sandbox test result',
    decisions: [],
    findings: [{ title: 'Test finding', severity: 'medium', body: 'body', proposed_change: {} }],
    tests: [{ hypothesis: 'Test hypothesis', page_path: '/test', variant_a: 'A', variant_b: 'B', primary_metric: 'clicks', predicted_lift_pct_range: [5, 15], sample_size_per_variant: 1000, risk_notes: 'none' }],
    biggest_leak_step: 'step2',
    severity: 'medium',
    diagnosis: 'Leak at step2',
    experiments: ['Try X'],
    score: 72,
    tier: 'warm',
    reasons: ['in service area'],
    predicted_value_aud: 350,
    recommendation: 'invite_interview',
    draft_message: 'Hi, we would love to interview you.',
    direction: 'hold',
    recommended_price: 285,
    delta_pct: 0,
    confidence: 0.8,
    rationale: 'Hold — within market range',
    assignments: [],
    weather_warnings: [],
    unassigned: [],
  });

  const ctx = {
    runId: `sandbox-run-${agentId}`,
    agentId,
    trigger: 'manual' as const,
    dryRun: false,
    input,
    config: {},
    intent: `Sandbox test: ${agentId}`,
    depth: 1,
    supabase: fakeSupabase(writes),
    memory: {
      get: async () => null,
      set: async () => {},
      delete: async () => {},
    },
    proposeAction: async (action: CapturedAction) => {
      actions.push(action);
    },
    llm: async (_prompt: string) => llmResponse ?? defaultLlmResponse,
    callAgent: async () => ({ runId: 'stub', status: 'succeeded' as const, summary: 'stub' }),
    log: () => {},
  };

  return { ctx, actions, writes };
}

function actionTypes(actions: CapturedAction[]): string[] {
  return actions.map((a) => a.action_type);
}

// ── cfo-agent ──────────────────────────────────────────────────────────────

describe('cfo-agent sandbox', () => {
  it('produces flag_for_review from finance-cfo-review input', async () => {
    const { ctx, actions } = fakeCtx('cfo-agent', {
      period: 'week', revenue_aud: 14200, cost_aud: 8900, jobs_completed: 31,
    });
    await cfoAgent.run(ctx as never);
    expect(actions.length).toBeGreaterThan(0);
    expect(actionTypes(actions)).toContain('flag_for_review');
  });

  it('falls back to flag_for_review on malformed LLM output', async () => {
    const { ctx, actions } = fakeCtx('cfo-agent', {
      period: 'week', revenue_aud: 14200, cost_aud: 8900, jobs_completed: 31,
    }, '{ INVALID JSON >>>');
    await cfoAgent.run(ctx as never);
    expect(actionTypes(actions)).toContain('flag_for_review');
  });

  it('does not write to DB on sandbox input', async () => {
    const { ctx, writes } = fakeCtx('cfo-agent', {
      period: 'week', revenue_aud: 14200, cost_aud: 8900, jobs_completed: 31,
    });
    await cfoAgent.run(ctx as never);
    const prodTables = ['orders', 'payables', 'subscriptions', 'payments'];
    const prodWrites = writes.filter((w) => prodTables.includes(w.table));
    expect(prodWrites).toHaveLength(0);
  });

  it('production path: no-input returns without sandbox action', async () => {
    const { ctx, actions } = fakeCtx('cfo-agent', {});
    await cfoAgent.run(ctx as never);
    // Production path with empty DB returns no actions (all zeros → LLM produces no decisions)
    const sandboxActions = actions.filter((a) => (a.payload as Record<string, unknown>)?.sandbox === true);
    expect(sandboxActions).toHaveLength(0);
  });
});

// ── price-optimizer ────────────────────────────────────────────────────────

describe('price-optimizer sandbox', () => {
  it('produces flag_for_review from finance-price-optimizer input', async () => {
    const { ctx, actions } = fakeCtx('price-optimizer', {
      service: 'windows', current_rate_aud: 285,
      market_range: { low: 220, high: 320 }, jobs_last_30d: 18,
    });
    await priceOptimizerAgent.run(ctx as never);
    expect(actions.length).toBeGreaterThan(0);
    expect(actionTypes(actions)).toContain('flag_for_review');
  });

  it('falls back to flag_for_review on LLM failure', async () => {
    const { ctx, actions } = fakeCtx('price-optimizer', {
      service: 'windows', current_rate_aud: 285,
      market_range: { low: 220, high: 320 }, jobs_last_30d: 18,
    }, 'not json at all');
    await priceOptimizerAgent.run(ctx as never);
    expect(actionTypes(actions)).toContain('flag_for_review');
  });

  it('does not write to service_pricing in sandbox', async () => {
    const { ctx, writes } = fakeCtx('price-optimizer', {
      service: 'windows', current_rate_aud: 285,
      market_range: { low: 220, high: 320 }, jobs_last_30d: 18,
    });
    await priceOptimizerAgent.run(ctx as never);
    const pricingWrites = writes.filter((w) => w.table === 'service_pricing');
    expect(pricingWrites).toHaveLength(0);
  });
});

// ── ab-test-architect ──────────────────────────────────────────────────────

describe('ab-test-architect sandbox', () => {
  it('produces flag_for_review from growth-ab-test input', async () => {
    const { ctx, actions } = fakeCtx('ab-test-architect', {
      page: 'homepage',
      element: 'primary-cta',
      hypothesis: 'Changing CTA copy to action-oriented language increases click-through.',
    });
    await abTestArchitectAgent.run(ctx as never);
    expect(actions.length).toBeGreaterThan(0);
    expect(actionTypes(actions)).toContain('flag_for_review');
  });

  it('falls back to flag_for_review on LLM failure', async () => {
    const { ctx, actions } = fakeCtx('ab-test-architect', {
      page: 'homepage', element: 'primary-cta', hypothesis: 'test hypothesis',
    }, '{ broken');
    await abTestArchitectAgent.run(ctx as never);
    expect(actionTypes(actions)).toContain('flag_for_review');
  });
});

// ── conversion-funnel ──────────────────────────────────────────────────────

describe('conversion-funnel sandbox', () => {
  it('produces flag_for_review from growth-conversion-funnel input', async () => {
    const { ctx, actions } = fakeCtx('conversion-funnel', {
      funnel_step_views: { step1: 520, step2: 310, step3: 180, submitted: 95 },
      period_days: 30,
    });
    await conversionFunnelAgent.run(ctx as never);
    expect(actions.length).toBeGreaterThan(0);
    expect(actionTypes(actions)).toContain('flag_for_review');
  });

  it('falls back on LLM failure', async () => {
    const { ctx, actions } = fakeCtx('conversion-funnel', {
      funnel_step_views: { step1: 520, step2: 310 }, period_days: 30,
    }, '{ bad');
    await conversionFunnelAgent.run(ctx as never);
    expect(actionTypes(actions)).toContain('flag_for_review');
  });
});

// ── seo-meta ───────────────────────────────────────────────────────────────

describe('seo-meta sandbox', () => {
  it('produces flag_for_review from growth-seo-meta input', async () => {
    const { ctx, actions } = fakeCtx('seo-meta', {
      page_type: 'suburb-landing', suburb: 'Underwood', service: 'cleaning',
    });
    await seoMetaAgent.run(ctx as never);
    expect(actions.length).toBeGreaterThan(0);
    expect(actionTypes(actions)).toContain('flag_for_review');
  });

  it('falls back on LLM failure', async () => {
    const { ctx, actions } = fakeCtx('seo-meta', {
      page_type: 'suburb-landing', suburb: 'Springwood', service: 'windows',
    }, 'not valid json');
    await seoMetaAgent.run(ctx as never);
    expect(actionTypes(actions)).toContain('flag_for_review');
  });
});

// ── lead-scorer ────────────────────────────────────────────────────────────

describe('lead-scorer sandbox', () => {
  it('produces flag_for_review from growth-lead-scoring input', async () => {
    const { ctx, actions } = fakeCtx('lead-scorer', {
      service: 'end-of-lease', suburb: 'Springwood',
      message: 'Need bond clean by end of month.', source: 'website',
    });
    await leadScorerAgent.run(ctx as never);
    expect(actions.length).toBeGreaterThan(0);
    expect(actionTypes(actions)).toContain('flag_for_review');
  });

  it('falls back with default score on LLM failure', async () => {
    const { ctx, actions } = fakeCtx('lead-scorer', {
      service: 'cleaning', suburb: 'Loganlea', message: 'Need a clean.', source: 'website',
    }, '{ invalid');
    await leadScorerAgent.run(ctx as never);
    expect(actionTypes(actions)).toContain('flag_for_review');
  });

  it('does not write to quotes in sandbox', async () => {
    const { ctx, writes } = fakeCtx('lead-scorer', {
      service: 'cleaning', suburb: 'Loganlea', message: 'test', source: 'website',
    });
    await leadScorerAgent.run(ctx as never);
    const quotesWrites = writes.filter((w) => w.table === 'quotes');
    expect(quotesWrites).toHaveLength(0);
  });
});

// ── applicant-screener ─────────────────────────────────────────────────────

describe('applicant-screener sandbox', () => {
  it('produces flag_for_review from ops-applicant-screener input', async () => {
    const { ctx, actions } = fakeCtx('applicant-screener', {
      applicant_name: 'Jack Martin', role: 'cleaner',
      experience_years: 2, suburb: 'Loganlea', has_abn: true,
    });
    await applicantScreenerAgent.run(ctx as never);
    expect(actions.length).toBeGreaterThan(0);
    expect(actionTypes(actions)).toContain('flag_for_review');
  });

  it('falls back on LLM failure', async () => {
    const { ctx, actions } = fakeCtx('applicant-screener', {
      applicant_name: 'Jane Smith', role: 'cleaner', experience_years: 3,
      suburb: 'Springwood', has_abn: false,
    }, '{ bad json');
    await applicantScreenerAgent.run(ctx as never);
    expect(actionTypes(actions)).toContain('flag_for_review');
  });

  it('synthetic applicant_id is sandbox-prefixed — no production write', async () => {
    const { ctx, actions, writes } = fakeCtx('applicant-screener', {
      applicant_name: 'Test Person', role: 'cleaner',
      experience_years: 1, suburb: 'Woodridge', has_abn: true,
    });
    await applicantScreenerAgent.run(ctx as never);
    expect(actions[0].target_id.startsWith(SANDBOX_ID_PREFIX)).toBe(true);
    const applicantWrites = writes.filter((w) => w.table === 'applicants');
    expect(applicantWrites).toHaveLength(0);
  });
});

// ── reconciliation ─────────────────────────────────────────────────────────

describe('reconciliation sandbox', () => {
  it('produces flag_for_review from ops-reconciliation input', async () => {
    const { ctx, actions } = fakeCtx('reconciliation', {
      period_days: 7, expected_payout_aud: 4200, recorded_aud: 4080,
    });
    await reconciliationAgent.run(ctx as never);
    expect(actions.length).toBeGreaterThan(0);
    expect(actionTypes(actions)).toContain('flag_for_review');
  });

  it('produces flag_for_review from finance-stripe-reconcile input', async () => {
    const { ctx, actions } = fakeCtx('reconciliation', {
      payout_id: 'po_sandbox_001', payout_aud: 5840, period: '2026-06-01/2026-06-07',
    });
    await reconciliationAgent.run(ctx as never);
    expect(actions.length).toBeGreaterThan(0);
    expect(actionTypes(actions)).toContain('flag_for_review');
  });

  it('does not write to payments or orders in sandbox', async () => {
    const { ctx, writes } = fakeCtx('reconciliation', {
      period_days: 7, expected_payout_aud: 4200, recorded_aud: 4080,
    });
    await reconciliationAgent.run(ctx as never);
    const prodWrites = writes.filter((w) => ['payments', 'orders'].includes(w.table));
    expect(prodWrites).toHaveLength(0);
  });
});

// ── scheduling ─────────────────────────────────────────────────────────────

describe('scheduling sandbox', () => {
  it('ndis_brief: produces send_email', async () => {
    const { ctx, actions } = fakeCtx('scheduling', {
      job_type: 'ndis-domestic-assistance', participant_name: 'Ethan Taylor',
      suburb: 'Meadowbrook', shift_start: '09:00',
    });
    await schedulingAgent.run(ctx as never);
    expect(actionTypes(actions)).toEqual(['send_email']);
  });

  it('high_volume: produces flag_for_review', async () => {
    const { ctx, actions } = fakeCtx('scheduling', {
      date: '2026-06-20', job_count: 8, available_crew: 3,
    });
    await schedulingAgent.run(ctx as never);
    expect(actionTypes(actions)).toEqual(['flag_for_review']);
  });

  it('crew_no_show: produces schedule_job + send_email', async () => {
    const { ctx, actions } = fakeCtx('scheduling', {
      job_id: 'sandbox-job-001', crew_name: 'Liam Davies',
      hours_before_job: 2, service: 'cleaning',
    });
    await schedulingAgent.run(ctx as never);
    expect(actionTypes(actions)).toContain('schedule_job');
    expect(actionTypes(actions)).toContain('send_email');
  });

  it('late_job: produces send_email + flag_for_review', async () => {
    const { ctx, actions } = fakeCtx('scheduling', {
      job_id: 'sandbox-job-003', overdue_minutes: 45,
      service: 'windows', crew_name: 'Ruby Wilson',
    });
    await schedulingAgent.run(ctx as never);
    expect(actionTypes(actions)).toContain('send_email');
    expect(actionTypes(actions)).toContain('flag_for_review');
  });

  it('schedule_job target_id is sandbox-prefixed — bypasses production ID guard', async () => {
    const { ctx, actions } = fakeCtx('scheduling', {
      job_id: 'sandbox-job-001', crew_name: 'Liam Davies',
      hours_before_job: 2, service: 'cleaning',
    });
    await schedulingAgent.run(ctx as never);
    const scheduleAction = actions.find((a) => a.action_type === 'schedule_job');
    expect(scheduleAction).toBeDefined();
    // crew_no_show order id comes from ctx.input.job_id — already sandbox-prefixed
    expect(scheduleAction!.target_id.startsWith('sandbox')).toBe(true);
  });

  it('production path: empty DB returns no actions', async () => {
    const { ctx, actions } = fakeCtx('scheduling', {});
    await schedulingAgent.run(ctx as never);
    expect(actions).toHaveLength(0);
  });
});

// ── whs-safety-reminder ────────────────────────────────────────────────────

describe('whs-safety-reminder sandbox', () => {
  it('reminder type: produces send_email', async () => {
    const { ctx, actions } = fakeCtx('whs-safety-reminder', {
      crew_count: 6, reminder_type: 'chemical-handling', due_date: '2026-06-30',
    });
    await whsSafetyReminderAgent.run(ctx as never);
    expect(actions.length).toBeGreaterThan(0);
    expect(actionTypes(actions)).toContain('send_email');
  });

  it('incident type: produces flag_for_review', async () => {
    const { ctx, actions } = fakeCtx('whs-safety-reminder', {
      incident_type: 'slip-fall', severity: 'minor',
      crew_name: 'Liam Davies', job_id: 'sandbox-job-002',
    });
    await whsSafetyReminderAgent.run(ctx as never);
    expect(actions.length).toBeGreaterThan(0);
    expect(actionTypes(actions)).toContain('flag_for_review');
  });

  it('incident: does not write to whs_records in sandbox', async () => {
    const { ctx, writes } = fakeCtx('whs-safety-reminder', {
      incident_type: 'slip-fall', severity: 'minor',
      crew_name: 'Liam Davies', job_id: 'sandbox-job-002',
    });
    await whsSafetyReminderAgent.run(ctx as never);
    const whsWrites = writes.filter((w) => w.table === 'whs_records');
    expect(whsWrites).toHaveLength(0);
  });

  it('production path: empty DB returns no actions', async () => {
    const { ctx, actions } = fakeCtx('whs-safety-reminder', {});
    await whsSafetyReminderAgent.run(ctx as never);
    expect(actions).toHaveLength(0);
  });
});

// ── cross-cutting: synthetic IDs never written to production tables ────────

describe('synthetic ID write guard', () => {
  const sandboxInputs: Array<[string, Record<string, unknown>]> = [
    ['cfo-agent', { period: 'week', revenue_aud: 14200, cost_aud: 8900, jobs_completed: 31 }],
    ['price-optimizer', { service: 'windows', current_rate_aud: 285, market_range: { low: 220, high: 320 }, jobs_last_30d: 18 }],
    ['reconciliation', { period_days: 7, expected_payout_aud: 4200, recorded_aud: 4080 }],
    ['applicant-screener', { applicant_name: 'Jack Martin', role: 'cleaner', experience_years: 2, suburb: 'Loganlea', has_abn: true }],
    ['whs-safety-reminder', { incident_type: 'slip-fall', severity: 'minor', crew_name: 'Liam', job_id: 'sandbox-job-002' }],
  ];

  test.each(sandboxInputs)('%s: no production table writes with sandbox IDs', async (agentId, input) => {
    const agents: Record<string, { run: (ctx: never) => Promise<unknown> }> = {
      'cfo-agent': cfoAgent,
      'price-optimizer': priceOptimizerAgent,
      'reconciliation': reconciliationAgent,
      'applicant-screener': applicantScreenerAgent,
      'whs-safety-reminder': whsSafetyReminderAgent,
    };
    const { ctx, writes } = fakeCtx(agentId, input);
    await agents[agentId].run(ctx as never);
    // Any write with a sandbox-prefixed ID in payload should not touch production tables
    const PRODUCTION_TABLES = ['customers', 'orders', 'quotes', 'leads', 'payments', 'employees'];
    const badWrites = writes.filter((w) => {
      if (!PRODUCTION_TABLES.includes(w.table)) return false;
      const payload = JSON.stringify(w.payload);
      return payload.includes(SANDBOX_ID_PREFIX);
    });
    expect(badWrites).toHaveLength(0);
  });
});
