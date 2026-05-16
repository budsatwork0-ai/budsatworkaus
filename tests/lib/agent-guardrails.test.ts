import { describe, expect, it } from 'vitest';
import {
  GuardrailBlockedError,
  PolicyRunner,
  callLoopPolicy,
  contextDriftPolicy,
  costBudgetPolicy,
  dangerousActionPolicy,
  hallucinationPolicy,
  intentCompletionPolicy,
  recursionDepthPolicy,
  stableHash,
  type LineageEntry,
  type PolicyContext,
} from '@/lib/agents/guardrails';

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

/**
 * Minimal fake Supabase that lets the hallucination policy "find" rows
 * via maybeSingle(). The runner only ever uses `.from(...).select(...).
 * eq(...).maybeSingle()`; everything else is unused in tests.
 */
function fakeSupabase(rows: Record<string, Record<string, unknown>[]>): any {
  return {
    from(table: string) {
      const data = rows[table] ?? [];
      let filter: { col: string; val: unknown } | null = null;
      const chain: any = {
        select() {
          return chain;
        },
        eq(col: string, val: unknown) {
          filter = { col, val };
          return chain;
        },
        async maybeSingle() {
          if (!filter) return { data: data[0] ?? null, error: null };
          const f = filter;
          const hit = data.find((r) => r[f.col] === f.val);
          return { data: hit ?? null, error: null };
        },
        async insert() {
          return { data: null, error: null };
        },
      };
      return chain;
    },
  };
}

function makePctx(overrides: Partial<PolicyContext> = {}): PolicyContext {
  const lineage: LineageEntry[] =
    overrides.lineage ??
    [
      {
        runId: 'run-1',
        agentId: 'agent-a',
        inputHash: stableHash({ a: 1 }),
        intent: 'analyze quote pipeline conversion drop in Logan suburbs',
        costCents: 0,
      },
    ];
  return {
    agentId: 'agent-a',
    runId: 'run-1',
    lineage,
    intent: 'analyze quote pipeline conversion drop in Logan suburbs',
    cumulativeCostCents: 0,
    runCostCents: 0,
    supabase: overrides.supabase ?? (fakeSupabase({}) as any),
    config: overrides.config ?? {},
    ...overrides,
  };
}

// ----------------------------------------------------------------------
// recursion-depth
// ----------------------------------------------------------------------

describe('recursion-depth policy', () => {
  it('allows depth under the limit', async () => {
    const v = await recursionDepthPolicy.preAgentCall!(
      { childAgentId: 'agent-b', childInput: {}, childIntent: 'help out' },
      makePctx({ lineage: Array(3).fill(makePctx().lineage[0]) }),
    );
    expect(v.kind).toBe('allow');
  });

  it('blocks at the configured max depth', async () => {
    const v = await recursionDepthPolicy.preAgentCall!(
      { childAgentId: 'agent-b', childInput: {}, childIntent: 'help' },
      makePctx({
        lineage: Array(5).fill(makePctx().lineage[0]),
        config: { max_depth: 5 },
      }),
    );
    expect(v.kind).toBe('block');
  });
});

// ----------------------------------------------------------------------
// call-loop
// ----------------------------------------------------------------------

describe('call-loop policy', () => {
  it('blocks repeating (agentId, input) in the lineage', async () => {
    const dupInput = { rebuild: 'everything' };
    const lineage = [
      {
        runId: 'run-1',
        agentId: 'parent',
        inputHash: stableHash({ root: true }),
        intent: 'root',
        costCents: 0,
      },
      {
        runId: 'run-2',
        agentId: 'agent-x',
        inputHash: stableHash({ agentId: 'agent-x', input: dupInput }),
        intent: 'first try',
        costCents: 0,
      },
    ];
    const v = await callLoopPolicy.preAgentCall!(
      { childAgentId: 'agent-x', childInput: dupInput, childIntent: 'retry' },
      makePctx({ lineage }),
    );
    expect(v.kind).toBe('block');
  });

  it('allows distinct inputs to the same agent', async () => {
    const lineage = [
      {
        runId: 'run-1',
        agentId: 'parent',
        inputHash: stableHash({ root: true }),
        intent: 'root',
        costCents: 0,
      },
    ];
    const v = await callLoopPolicy.preAgentCall!(
      { childAgentId: 'agent-x', childInput: { unique: 1 }, childIntent: '' },
      makePctx({ lineage }),
    );
    expect(v.kind).toBe('allow');
  });
});

// ----------------------------------------------------------------------
// cost-budget
// ----------------------------------------------------------------------

describe('cost-budget policy', () => {
  it('allows below caps', async () => {
    const v = await costBudgetPolicy.preLLM!(
      { prompt: 'hi' },
      makePctx({ runCostCents: 10, cumulativeCostCents: 20 }),
    );
    expect(v.kind).toBe('allow');
  });

  it('blocks when per-run cap is reached', async () => {
    const v = await costBudgetPolicy.preLLM!(
      { prompt: 'hi' },
      makePctx({
        runCostCents: 200,
        cumulativeCostCents: 200,
        config: { max_run_cents: 200, max_lineage_cents: 9999 },
      }),
    );
    expect(v.kind).toBe('block');
  });

  it('blocks when lineage cap is reached', async () => {
    const v = await costBudgetPolicy.preLLM!(
      { prompt: 'hi' },
      makePctx({
        runCostCents: 50,
        cumulativeCostCents: 700,
        config: { max_run_cents: 999, max_lineage_cents: 500 },
      }),
    );
    expect(v.kind).toBe('block');
  });
});

// ----------------------------------------------------------------------
// dangerous-action
// ----------------------------------------------------------------------

describe('dangerous-action policy', () => {
  it('blocks bulk delete', async () => {
    const v = await dangerousActionPolicy.preAction!(
      {
        action: {
          action_type: 'delete_customers',
          payload: { ids: Array.from({ length: 30 }, (_, i) => i) },
          preview: 'wipe 30 customers',
        },
      },
      makePctx(),
    );
    expect(v.kind).toBe('block');
    if (v.kind === 'block') expect(v.treatAsApprovalNeeded).toBe(true);
  });

  it('blocks large refunds', async () => {
    const v = await dangerousActionPolicy.preAction!(
      {
        action: {
          action_type: 'refund',
          payload: { amount_cents: 60000 },
          preview: 'refund $600',
        },
      },
      makePctx(),
    );
    expect(v.kind).toBe('block');
  });

  it('allows ordinary actions', async () => {
    const v = await dangerousActionPolicy.preAction!(
      {
        action: {
          action_type: 'send_email',
          payload: { to: 'x@example.com', subject: 'hi', html: '<p>' },
          preview: 'send',
        },
      },
      makePctx(),
    );
    expect(v.kind).toBe('allow');
  });
});

// ----------------------------------------------------------------------
// context-drift
// ----------------------------------------------------------------------

describe('context-drift policy', () => {
  it('allows on-topic child intents', async () => {
    const v = await contextDriftPolicy.preAgentCall!(
      {
        childAgentId: 'lead-scorer',
        childInput: {},
        childIntent: 'score Logan suburbs quote leads for conversion',
      },
      makePctx(),
    );
    expect(v.kind).toBe('allow');
  });

  it('blocks off-topic child intents', async () => {
    const v = await contextDriftPolicy.preAgentCall!(
      {
        childAgentId: 'agent-architect',
        childInput: {},
        childIntent:
          'restart all servers and migrate database to new region tonight',
      },
      makePctx(),
    );
    expect(v.kind).toBe('block');
  });
});

// ----------------------------------------------------------------------
// intent-completion
// ----------------------------------------------------------------------

describe('intent-completion policy', () => {
  it('warns on empty summaries', async () => {
    const v = await intentCompletionPolicy.postAgentRun!(
      { summary: '', output: {} },
      makePctx(),
    );
    expect(v.kind).toBe('warn');
  });

  it('warns on summaries unrelated to intent', async () => {
    const v = await intentCompletionPolicy.postAgentRun!(
      { summary: 'baked muffins for the office breakfast', output: {} },
      makePctx(),
    );
    expect(v.kind).toBe('warn');
  });

  it('allows summaries that echo the intent', async () => {
    const v = await intentCompletionPolicy.postAgentRun!(
      {
        summary:
          'identified two Logan suburbs with the largest quote conversion drop',
        output: {},
      },
      makePctx(),
    );
    expect(v.kind).toBe('allow');
  });
});

// ----------------------------------------------------------------------
// hallucination-guard
// ----------------------------------------------------------------------

describe('hallucination policy', () => {
  it('blocks when the referenced row does not exist', async () => {
    const supabase = fakeSupabase({ quotes: [] });
    const v = await hallucinationPolicy.preAction!(
      {
        action: {
          action_type: 'send_email',
          target_table: 'quotes',
          target_id: 'nope-uuid',
          payload: { to: 'x@example.com', subject: 'q', html: '<p>' },
          preview: 'reply',
        },
      },
      makePctx({ supabase: supabase as any }),
    );
    expect(v.kind).toBe('block');
  });

  it('allows when the referenced row exists', async () => {
    const supabase = fakeSupabase({ quotes: [{ id: 'real-uuid' }] });
    const v = await hallucinationPolicy.preAction!(
      {
        action: {
          action_type: 'send_email',
          target_table: 'quotes',
          target_id: 'real-uuid',
          payload: { to: 'x@example.com', subject: 'q', html: '<p>' },
          preview: 'reply',
        },
      },
      makePctx({ supabase: supabase as any }),
    );
    expect(v.kind).toBe('allow');
  });
});

// ----------------------------------------------------------------------
// PolicyRunner aggregation
// ----------------------------------------------------------------------

describe('PolicyRunner', () => {
  it('throws GuardrailBlockedError on a blocking verdict', async () => {
    const runner = new PolicyRunner({ policies: [recursionDepthPolicy], silent: true });
    const pctx = makePctx({
      lineage: Array(5).fill(makePctx().lineage[0]),
      config: { max_depth: 5 },
    });
    await expect(
      runner.preAgentCall(
        { childAgentId: 'agent-b', childInput: {}, childIntent: 'help' },
        pctx,
      ),
    ).rejects.toBeInstanceOf(GuardrailBlockedError);
  });

  it('honours `disabled` to skip a policy entirely', async () => {
    const runner = new PolicyRunner({
      policies: [recursionDepthPolicy],
      disabled: ['recursion-depth'],
      silent: true,
    });
    expect(runner.activeIds()).toEqual([]);
  });
});
