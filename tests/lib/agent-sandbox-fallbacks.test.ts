/**
 * Sandbox input detection + deterministic fallbacks for the three agents
 * that previously produced zero actions in arena scenarios (F1 = 0):
 * reviews, customer-reply, lapsed-win-back.
 *
 * Covers:
 *   - each failing scenario now produces non-empty proposedActions with
 *     exactly the expected action types (→ F1 = 1.0)
 *   - send_email / flag_for_review payloads carry required fields
 *   - malformed LLM output triggers the deterministic fallback, not []
 *   - synthetic sandbox- IDs are never written to production tables
 *   - production (no-input) behaviour is unchanged
 *   - nothing in this change touches auto-promotion
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { customerReplyAgent } from '../../src/lib/agents/agents/customer-reply';
import { reviewsAgent } from '../../src/lib/agents/agents/reviews';
import { lapsedWinBackAgent } from '../../src/lib/agents/agents/lapsed-win-back';
import {
  canWriteToProduction,
  isSandboxId,
  detectSandboxCustomerMessage,
} from '../../src/lib/agents/sandbox-input';
import { SANDBOX_SCENARIOS } from '../../src/lib/sandbox/scenarios';
import type { AgentContext, AgentDefinition, ProposedAction } from '../../src/lib/agents/types';

const AGENTS: Record<string, AgentDefinition> = {
  'customer-reply': customerReplyAgent,
  reviews: reviewsAgent,
  'lapsed-win-back': lapsedWinBackAgent,
};

// ── Fake ctx ────────────────────────────────────────────────────────────────

type FakeOpts = {
  input?: Record<string, unknown>;
  llm?: (prompt: string) => Promise<string>;
  rpcRows?: unknown[] | null;
};

function fakeCtx(opts: FakeOpts) {
  const actions: ProposedAction[] = [];
  const writes: Array<{ table: string; op: string }> = [];
  const queriedTables: string[] = [];

  const chain = (table: string) => {
    const c = {
      select: () => c,
      eq: () => c,
      in: () => c,
      is: () => c,
      not: () => c,
      lt: () => c,
      order: () => c,
      limit: () => c,
      insert: () => {
        writes.push({ table, op: 'insert' });
        return c;
      },
      update: () => {
        writes.push({ table, op: 'update' });
        return c;
      },
      single: () => Promise.resolve({ data: { id: 'row-1' }, error: null }),
      then: (res: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(res),
    };
    return c;
  };

  const ctx = {
    runId: 'run-1',
    agentId: 'test',
    trigger: 'manual',
    dryRun: false,
    input: opts.input ?? {},
    config: {},
    intent: 'Sandbox: test',
    depth: 1,
    memory: {} as AgentContext['memory'],
    supabase: {
      from: (table: string) => {
        queriedTables.push(table);
        return chain(table);
      },
      rpc: () => Promise.resolve({ data: opts.rpcRows ?? null, error: null }),
    } as unknown as AgentContext['supabase'],
    proposeAction: async (a: ProposedAction) => {
      actions.push(a);
    },
    llm: opts.llm ?? (async () => 'A warm, friendly drafted reply.'),
    callAgent: async () => ({ runId: 'child', status: 'succeeded' as const, summary: '' }),
    log: () => {},
  } as unknown as AgentContext;

  return { ctx, actions, writes, queriedTables };
}

function multiset(arr: string[]): string[] {
  return [...arr].sort();
}

// ── 1. Every previously failing scenario now scores F1 = 1.0 ───────────────

const TARGET_SCENARIOS = SANDBOX_SCENARIOS.filter((s) =>
  ['reviews', 'customer-reply', 'lapsed-win-back'].includes(s.agentId),
);

describe('arena scenarios produce exactly the expected action types', () => {
  it('covers all 8 scenarios for the three agents', () => {
    expect(TARGET_SCENARIOS.length).toBe(8);
  });

  for (const scenario of TARGET_SCENARIOS) {
    it(`${scenario.slug} → [${scenario.expectedActionTypes.join(', ')}]`, async () => {
      const llm =
        scenario.agentId === 'lapsed-win-back'
          ? async () => JSON.stringify({ subject: 'We miss you!', body: 'Come back soon.', offer_summary: 'top-up' })
          : undefined;
      const { ctx, actions } = fakeCtx({ input: scenario.input, llm });

      await AGENTS[scenario.agentId].run(ctx);

      expect(actions.length, 'must propose at least one action').toBeGreaterThan(0);
      // exact match (same types, no extras) → precision = recall = F1 = 1.0
      expect(multiset(actions.map((a) => a.action_type))).toEqual(
        multiset(scenario.expectedActionTypes),
      );
    });
  }
});

// ── 2. Required payload fields ──────────────────────────────────────────────

describe('action payload completeness', () => {
  it('send_email actions always include non-empty to/subject/html', async () => {
    for (const scenario of TARGET_SCENARIOS) {
      const llm =
        scenario.agentId === 'lapsed-win-back'
          ? async () => JSON.stringify({ subject: 's', body: 'b', offer_summary: 'o' })
          : undefined;
      const { ctx, actions } = fakeCtx({ input: scenario.input, llm });
      await AGENTS[scenario.agentId].run(ctx);

      for (const a of actions.filter((x) => x.action_type === 'send_email')) {
        expect(String(a.payload.to ?? '')).toMatch(/@/);
        expect(String(a.payload.subject ?? '').length).toBeGreaterThan(0);
        expect(String(a.payload.html ?? '').length).toBeGreaterThan(0);
      }
    }
  });

  it('flag_for_review actions carry resource identification + reason', async () => {
    for (const scenario of TARGET_SCENARIOS.filter((s) =>
      s.expectedActionTypes.includes('flag_for_review'),
    )) {
      const { ctx, actions } = fakeCtx({ input: scenario.input });
      await AGENTS[scenario.agentId].run(ctx);

      const flags = actions.filter((x) => x.action_type === 'flag_for_review');
      expect(flags.length).toBeGreaterThan(0);
      for (const f of flags) {
        expect(String(f.payload.reason ?? '').length).toBeGreaterThan(0);
        const resourceId = f.payload.lead_id ?? f.payload.review_id ?? f.target_id;
        expect(String(resourceId ?? '').length).toBeGreaterThan(0);
        expect(f.target_table, 'flag must identify a resource type/table').toBeTruthy();
      }
    }
  });
});

// ── 3. Malformed LLM output → deterministic fallback, never [] ─────────────

describe('LLM failure fallbacks', () => {
  it('customer-reply: LLM throws → fallback email still proposed', async () => {
    const { ctx, actions } = fakeCtx({
      input: { complaint: 'Cleaner was late. Very unhappy.', customer_name: 'Noah' },
      llm: async () => {
        throw new Error('model unavailable');
      },
    });
    const result = await customerReplyAgent.run(ctx);
    const types = actions.map((a) => a.action_type);
    expect(types).toContain('send_email');
    expect(types).toContain('flag_for_review');
    const email = actions.find((a) => a.action_type === 'send_email')!;
    expect(String(email.payload.html)).toContain('Noah');
    expect(result.output?.used_fallback).toBe(true);
  });

  it('reviews: LLM throws → fallback review-request email still proposed', async () => {
    const { ctx, actions } = fakeCtx({
      input: { sentiment: 'positive', customer_name: 'Grace', service: 'cleaning' },
      llm: async () => {
        throw new Error('model unavailable');
      },
    });
    await reviewsAgent.run(ctx);
    expect(actions.map((a) => a.action_type)).toEqual(['send_email']);
    expect(String(actions[0].payload.html)).toContain('{{REVIEW_URL}}');
  });

  it('lapsed-win-back: malformed JSON → fallback win-back email still proposed', async () => {
    const { ctx, actions } = fakeCtx({
      input: { days_since_last_job: 60, service: 'cleaning', customer_name: 'Sophie Harris' },
      llm: async () => 'this is not json at all',
    });
    const result = await lapsedWinBackAgent.run(ctx);
    expect(actions.map((a) => a.action_type)).toEqual(['send_email']);
    const email = actions[0];
    expect(String(email.payload.subject).length).toBeGreaterThan(0);
    expect(String(email.payload.html)).toContain('Sophie');
    expect(String(email.payload.html)).toContain('60');
    expect(result.output?.used_fallback).toBe(true);
  });

  it('lapsed-win-back: empty-string LLM output → fallback (no empty subject/body)', async () => {
    const { ctx, actions } = fakeCtx({
      input: { days_since_last_job: 95, customer_count: 12, service: 'cleaning' },
      llm: async () => '',
    });
    await lapsedWinBackAgent.run(ctx);
    expect(actions.length).toBe(1);
    expect(String(actions[0].payload.subject).length).toBeGreaterThan(0);
    expect(String(actions[0].payload.html).length).toBeGreaterThan(0);
  });
});

// ── 4. Synthetic IDs never written to production tables ────────────────────

describe('production write isolation', () => {
  it('sandbox scenario runs perform zero DB writes', async () => {
    for (const scenario of TARGET_SCENARIOS) {
      const llm =
        scenario.agentId === 'lapsed-win-back'
          ? async () => JSON.stringify({ subject: 's', body: 'b', offer_summary: 'o' })
          : undefined;
      const { ctx, writes } = fakeCtx({ input: scenario.input, llm });
      await AGENTS[scenario.agentId].run(ctx);
      expect(writes, `${scenario.slug} must not write to any table`).toHaveLength(0);
    }
  });

  it('all synthetic target ids carry the sandbox- prefix', async () => {
    for (const scenario of TARGET_SCENARIOS) {
      const llm =
        scenario.agentId === 'lapsed-win-back'
          ? async () => JSON.stringify({ subject: 's', body: 'b', offer_summary: 'o' })
          : undefined;
      const { ctx, actions } = fakeCtx({ input: scenario.input, llm });
      await AGENTS[scenario.agentId].run(ctx);
      for (const a of actions) {
        expect(isSandboxId(a.target_id), `${scenario.slug}: ${a.target_id}`).toBe(true);
      }
    }
  });

  it('lapsed-win-back production loop skips rows with sandbox ids (write guard)', async () => {
    const { ctx, writes, actions } = fakeCtx({
      input: {}, // production path
      rpcRows: [
        {
          customer_id: 'sandbox-evil',
          email: 'x@y.z',
          name: 'X',
          last_service: 'cleaning',
          last_job_at: new Date().toISOString(),
        },
      ],
      llm: async () => JSON.stringify({ subject: 's', body: 'b', offer_summary: 'o' }),
    });
    await lapsedWinBackAgent.run(ctx);
    expect(writes).toHaveLength(0); // insert skipped by canWriteToProduction guard
    expect(actions).toHaveLength(0);
  });

  it('canWriteToProduction blocks sandbox-prefixed ids only', () => {
    expect(canWriteToProduction('sandbox-lead')).toBe(false);
    expect(canWriteToProduction('sandbox-anything')).toBe(false);
    expect(canWriteToProduction('5b9e9f3a-real-uuid')).toBe(true);
  });
});

// ── 5. Production (no-input) behaviour unchanged ────────────────────────────

describe('production path unchanged', () => {
  it('empty input does not trigger the sandbox path', () => {
    expect(detectSandboxCustomerMessage({})).toBeNull();
  });

  it('customer-reply with no input queries lead_conversations and proposes nothing', async () => {
    const { ctx, actions, queriedTables } = fakeCtx({ input: {} });
    const result = await customerReplyAgent.run(ctx);
    expect(queriedTables).toContain('lead_conversations');
    expect(actions).toHaveLength(0);
    expect(result.summary).toBe('No inbound messages.');
  });

  it('reviews with no input queries jobs and proposes nothing on empty data', async () => {
    const { ctx, actions, queriedTables } = fakeCtx({ input: {} });
    const result = await reviewsAgent.run(ctx);
    expect(queriedTables).toContain('jobs');
    expect(actions).toHaveLength(0);
    expect(result.summary).toBe('Queued 0 review email(s).');
  });

  it('lapsed-win-back with no input calls the RPC and proposes nothing on empty data', async () => {
    const { ctx, actions } = fakeCtx({ input: {}, rpcRows: null });
    const result = await lapsedWinBackAgent.run(ctx);
    expect(actions).toHaveLength(0);
    expect(result.summary).toBe('No lapsed customers eligible for outreach.');
  });
});

// ── 6. Auto-promotion untouched ─────────────────────────────────────────────

describe('auto-promotion stays disabled', () => {
  it('no agent or helper file references promotion state', () => {
    const files = [
      'src/lib/agents/sandbox-input.ts',
      'src/lib/agents/agents/customer-reply.ts',
      'src/lib/agents/agents/reviews.ts',
      'src/lib/agents/agents/lapsed-win-back.ts',
    ];
    for (const f of files) {
      const src = readFileSync(resolve(process.cwd(), f), 'utf8');
      expect(/auto_promote|agent_config_versions|sandbox_policy/.test(src), f).toBe(false);
    }
  });
});
