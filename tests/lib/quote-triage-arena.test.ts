/**
 * Regression tests for the quote-triage agent in arena/sandbox mode.
 *
 * These tests ensure:
 *   1. quote-triage always proposes at least one `send_email` action when
 *      given a cleaning-quote scenario input (the arena injects ctx.input,
 *      no real DB rows are present).
 *   2. The deterministic fallback (parse failure path) also emits `send_email`.
 *   3. All SANDBOX_SCENARIOS have the required fields so ScenarioCard never
 *      renders the "Incomplete scenario" warning state.
 */
import { describe, expect, it, vi } from 'vitest';
import { quoteTriageAgent } from '@/lib/agents/agents/quote-triage';
import { SANDBOX_SCENARIOS } from '@/lib/sandbox/scenarios';
import type { AgentContext } from '@/lib/agents/types';

// ── Supabase stub ──────────────────────────────────────────────────────────

/** Returns an empty-result Supabase stub — simulates no submitted quotes in DB. */
function makeSupabase() {
  const chain: Record<string, unknown> = {
    select:      () => chain,
    eq:          () => chain,
    is:          () => chain,
    order:       () => chain,
    limit:       () => chain,
    update:      () => chain,
    single:      async () => ({ data: null, error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
    then(resolve: (v: unknown) => unknown) {
      return Promise.resolve({ data: [], error: null }).then(resolve);
    },
  };
  return { from: () => chain };
}

// ── Context builder ────────────────────────────────────────────────────────

function makeCtx(opts: {
  input?: Record<string, unknown>;
  llmResponse?: string;
}): { ctx: AgentContext; proposed: Array<{ action_type: string; [key: string]: unknown }> } {
  const proposed: Array<{ action_type: string; [key: string]: unknown }> = [];

  const ctx = {
    runId:   'run-test',
    agentId: 'quote-triage',
    trigger: 'manual' as const,
    input:   opts.input ?? {},
    config:  {},
    intent:  'Sandbox: quote-triage test',
    depth:   1,
    supabase: makeSupabase(),
    llm: vi.fn().mockResolvedValue(
      opts.llmResponse ??
        JSON.stringify({
          service:       'cleaning',
          ndis:          false,
          urgency:       'normal',
          estimated_aud: 180,
          confidence:    0.85,
          draft_message: 'Hi! Thanks for your request. We can do a standard clean for around $180.',
          reason:        '3-bed, 2-bath residential clean in Underwood.',
        }),
    ),
    proposeAction: vi.fn().mockImplementation((action) => {
      proposed.push(action as { action_type: string });
      return Promise.resolve();
    }),
    callAgent: vi.fn(),
    log:       vi.fn(),
    memory: {
      load: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as AgentContext;

  return { ctx, proposed };
}

// ── Test suite ─────────────────────────────────────────────────────────────

describe('quote-triage — arena sandbox mode', () => {
  it('proposes send_email for the "New quote request — cleaning" scenario', async () => {
    // This is the exact input from scenarios.ts slug: customer-new-quote-cleaning
    const { ctx, proposed } = makeCtx({
      input: {
        service:    'cleaning',
        suburb:     'Underwood',
        bedrooms:   3,
        bathrooms:  2,
        extras:     [],
        message:    'Hi, I need a regular house clean please.',
      },
    });

    const result = await quoteTriageAgent.run(ctx);

    // Must propose at least one action
    expect(proposed.length).toBeGreaterThan(0);

    // At least one action must be send_email
    const actionTypes = proposed.map((a) => a.action_type);
    expect(actionTypes).toContain('send_email');

    // Summary should confirm triage happened
    expect(result.summary).toMatch(/triaged/i);
  });

  it('proposes send_email for a window-cleaning scenario', async () => {
    const { ctx, proposed } = makeCtx({
      input: {
        service: 'windows',
        suburb:  'Sunnybank Hills',
        storeys: 2,
        message: 'Need inside and outside windows done ASAP.',
      },
      llmResponse: JSON.stringify({
        service:       'windows',
        ndis:          false,
        urgency:       'high',
        estimated_aud: 320,
        confidence:    0.8,
        draft_message: "Hi! We can get your windows sparkling. We'll quote around $320 for a 2-storey home.",
        reason:        '2-storey window clean, interior + exterior.',
      }),
    });

    await quoteTriageAgent.run(ctx);

    const actionTypes = proposed.map((a) => a.action_type);
    expect(actionTypes).toContain('send_email');
  });

  it('proposes send_email as a fallback when LLM output is unparseable', async () => {
    const { ctx, proposed } = makeCtx({
      input: {
        service: 'cleaning',
        suburb:  'Logan Central',
        message: 'Need a clean.',
      },
      llmResponse: 'Sorry, I cannot help with that.', // not valid JSON
    });

    await quoteTriageAgent.run(ctx);

    // Even on parse failure, must propose at least one send_email (fallback)
    const actionTypes = proposed.map((a) => a.action_type);
    expect(actionTypes).toContain('send_email');
  });

  it('never proposes zero actions when ctx.input contains a quote', async () => {
    const { ctx, proposed } = makeCtx({
      input: {
        service: 'yard',
        suburb:  'Loganlea',
        message: 'Big backyard, needs mowing and edging.',
      },
    });

    await quoteTriageAgent.run(ctx);

    expect(proposed.length).toBeGreaterThan(0);
  });

  it('returns early with no actions when there is no DB data and no input', async () => {
    // No input, no DB rows → correct early-exit, no crash
    const { ctx, proposed } = makeCtx({ input: {} });

    const result = await quoteTriageAgent.run(ctx);

    expect(proposed.length).toBe(0);
    expect(result.summary).toMatch(/no new quote/i);
  });

  it('emitted send_email action has required payload fields', async () => {
    const { ctx, proposed } = makeCtx({
      input: {
        service: 'cleaning',
        suburb:  'Underwood',
        message: 'Hi, I need a clean.',
      },
    });

    await quoteTriageAgent.run(ctx);

    const emailAction = proposed.find((a) => a.action_type === 'send_email');
    expect(emailAction).toBeDefined();
    expect(emailAction?.action_type).toBe('send_email');
    expect(emailAction?.target_table).toBe('quotes');
    expect(emailAction?.target_id).toBeDefined();

    const payload = emailAction?.payload as Record<string, unknown>;
    expect(payload?.to).toBeDefined();
    expect(payload?.subject).toBeDefined();
    expect(payload?.html).toBeDefined();
  });
});

// ── Scenario catalogue completeness ───────────────────────────────────────

const REQUIRED_FIELDS = [
  'slug',
  'title',
  'description',
  'agentId',
  'category',
  'difficulty',
] as const;

describe('SANDBOX_SCENARIOS — field completeness (ScenarioCard regression)', () => {
  it('every scenario has all required fields (no ScenarioCard warning states)', () => {
    const violations: string[] = [];

    for (const scenario of SANDBOX_SCENARIOS) {
      for (const field of REQUIRED_FIELDS) {
        const val = scenario[field];
        if (!val || (typeof val === 'string' && val.trim() === '')) {
          violations.push(`${scenario.slug ?? '(no slug)'} — missing: ${field}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('every scenario slug is unique', () => {
    const slugs = SANDBOX_SCENARIOS.map((s) => s.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
  });

  it('every scenario category is a valid ScenarioCategory', () => {
    const valid = new Set(['customer', 'participant', 'marketplace', 'ndis', 'ops', 'growth', 'finance']);
    const invalid = SANDBOX_SCENARIOS.filter((s) => !valid.has(s.category));
    expect(invalid.map((s) => `${s.slug}: ${s.category}`)).toEqual([]);
  });

  it('every scenario difficulty is easy | medium | hard', () => {
    const valid = new Set(['easy', 'medium', 'hard']);
    const invalid = SANDBOX_SCENARIOS.filter((s) => !valid.has(s.difficulty));
    expect(invalid.map((s) => `${s.slug}: ${s.difficulty}`)).toEqual([]);
  });

  it('every scenario has at least one expectedActionType', () => {
    const empty = SANDBOX_SCENARIOS.filter(
      (s) => !Array.isArray(s.expectedActionTypes) || s.expectedActionTypes.length === 0,
    );
    expect(empty.map((s) => s.slug)).toEqual([]);
  });

  it('quote-triage scenarios all expect send_email', () => {
    const quoteScenarios = SANDBOX_SCENARIOS.filter(
      (s) => s.agentId === 'quote-triage' && s.slug.startsWith('customer-new-quote'),
    );
    expect(quoteScenarios.length).toBeGreaterThan(0);
    for (const s of quoteScenarios) {
      expect(s.expectedActionTypes).toContain('send_email');
    }
  });
});
