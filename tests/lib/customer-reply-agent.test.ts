import { describe, expect, it, vi } from 'vitest';
import { customerReplyAgent } from '@/lib/agents/agents/customer-reply';
import type { AgentContext } from '@/lib/agents/types';

// ---------- helpers ----------------------------------------------------------

/**
 * Builds a thenablechain Supabase-like client whose from() calls return
 * different rows depending on which table is queried. Each call chain is
 * awaitable: `await supabase.from('x').select().eq()...` resolves to
 * `{ data, error }`.
 */
function makeSupabase(tables: Record<string, unknown[]>) {
  return {
    from(table: string) {
      const rows = tables[table] ?? [];
      const result = { data: rows, error: null };
      const chain: Record<string, unknown> = {
        select:      () => chain,
        eq:          () => chain,
        in:          () => chain,
        is:          () => chain,
        order:       () => chain,
        limit:       () => chain,
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        single:      async () => ({ data: rows[0] ?? null, error: null }),
        then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return chain;
    },
  };
}

function makeCtx(opts: {
  inbound?: unknown[];
  leads?: unknown[];
  pendingActions?: unknown[];
  llmResponse?: string;
}): { ctx: AgentContext; proposed: unknown[] } {
  const proposed: unknown[] = [];

  const ctx = {
    runId: 'run-test',
    agentId: 'customer-reply',
    trigger: 'manual' as const,
    input: {},
    config: {},
    intent: 'Draft replies to inbound messages',
    depth: 1,
    supabase: makeSupabase({
      lead_conversations: opts.inbound ?? [],
      leads: opts.leads ?? [],
      agent_actions: opts.pendingActions ?? [],
    }),
    llm: vi.fn().mockResolvedValue(opts.llmResponse ?? 'Thank you for reaching out!'),
    proposeAction: vi.fn().mockImplementation((action) => {
      proposed.push(action);
      return Promise.resolve();
    }),
    callAgent: vi.fn(),
    log: vi.fn(),
    memory: {
      load: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as AgentContext;

  return { ctx, proposed };
}

// ---------- fixtures ---------------------------------------------------------

const messengerInbound = [
  {
    id: 'conv-m1',
    lead_id: 'lead-m1',
    body: 'Hi can you clean my gutters?',
    channel: 'messenger',
    created_at: '2026-06-03T01:00:00Z',
  },
];

const emailInbound = [
  {
    id: 'conv-e1',
    lead_id: 'lead-e1',
    body: 'I need a quote for window cleaning',
    channel: 'email',
    created_at: '2026-06-03T01:00:00Z',
  },
];

const instagramInbound = [
  {
    id: 'conv-ig1',
    lead_id: 'lead-ig1',
    body: 'Hey I saw your post, can you help?',
    channel: 'instagram',
    created_at: '2026-06-03T01:00:00Z',
  },
];

const messengerLead = {
  id: 'lead-m1',
  customer_name: 'Jane Doe',
  customer_email: null,
  first_response_at: null,
  reply_channel: 'messenger',
  messenger_psid: 'PSID_jane',
};

const messengerLeadNoPsid = {
  id: 'lead-m1',
  customer_name: 'Unknown Messenger',
  customer_email: null,
  first_response_at: null,
  reply_channel: 'messenger',
  messenger_psid: null,
};

const emailLead = {
  id: 'lead-e1',
  customer_name: 'Bob Smith',
  customer_email: 'bob@example.com',
  first_response_at: null,
  reply_channel: 'email',
  messenger_psid: null,
};

const instagramLead = {
  id: 'lead-ig1',
  customer_name: 'Insta User',
  customer_email: null,
  first_response_at: null,
  reply_channel: 'instagram',
  messenger_psid: null,
};

const phoneLead = {
  id: 'lead-p1',
  customer_name: 'Phone Person',
  customer_email: null,
  first_response_at: null,
  reply_channel: 'phone',
  messenger_psid: null,
};

// ---------- tests ------------------------------------------------------------

describe('customer-reply agent — reply_channel branching', () => {
  it('Messenger lead with messenger_psid creates send_messenger proposal', async () => {
    const { ctx, proposed } = makeCtx({
      inbound: messengerInbound,
      leads: [messengerLead],
    });

    const result = await customerReplyAgent.run(ctx);

    expect(proposed).toHaveLength(1);
    const action = proposed[0] as Record<string, unknown>;
    expect(action.action_type).toBe('send_messenger');
    expect(action.target_table).toBe('leads');
    expect(action.target_id).toBe('lead-m1');

    const payload = action.payload as Record<string, unknown>;
    expect(payload.messenger_psid).toBe('PSID_jane');
    expect(payload.lead_id).toBe('lead-m1');
    expect(payload.conversation_id).toBe('conv-m1');
    expect(typeof payload.drafted_message).toBe('string');
    expect((payload.drafted_message as string).length).toBeGreaterThan(0);
    expect(payload.source).toBe('messenger');
    expect(payload.customer_name).toBe('Jane Doe');

    expect(result.summary).toContain('Messenger');
  });

  it('Email lead still creates send_email proposal', async () => {
    const { ctx, proposed } = makeCtx({
      inbound: emailInbound,
      leads: [emailLead],
    });

    const result = await customerReplyAgent.run(ctx);

    expect(proposed).toHaveLength(1);
    const action = proposed[0] as Record<string, unknown>;
    expect(action.action_type).toBe('send_email');
    expect(action.target_id).toBe('lead-e1');

    const payload = action.payload as Record<string, unknown>;
    expect(payload.to).toBe('bob@example.com');
    expect(payload.subject).toBe('Re: your message');
    expect(typeof payload.html).toBe('string');

    expect(result.summary).toContain('email');
  });

  it('Messenger lead without messenger_psid is flagged for review, not emailed', async () => {
    const { ctx, proposed } = makeCtx({
      inbound: messengerInbound,
      leads: [messengerLeadNoPsid],
    });

    await customerReplyAgent.run(ctx);

    expect(proposed).toHaveLength(1);
    const action = proposed[0] as Record<string, unknown>;
    expect(action.action_type).toBe('flag_for_review');
    expect((action.payload as Record<string, unknown>).reason).toBe('messenger_lead_missing_psid');
    // LLM must NOT be called — no draft needed
    expect((ctx.llm as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it('Instagram lead is flagged for review, not emailed and not sent', async () => {
    const { ctx, proposed } = makeCtx({
      inbound: instagramInbound,
      leads: [instagramLead],
    });

    await customerReplyAgent.run(ctx);

    expect(proposed).toHaveLength(1);
    const action = proposed[0] as Record<string, unknown>;
    expect(action.action_type).toBe('flag_for_review');
    expect((action.payload as Record<string, unknown>).reason).toBe('instagram_reply_not_implemented');
    // No LLM call
    expect((ctx.llm as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it('Phone lead is flagged for review', async () => {
    const phoneInbound = [{ id: 'conv-p1', lead_id: 'lead-p1', body: 'Call me back please', channel: 'phone', created_at: '2026-06-03T01:00:00Z' }];
    const { ctx, proposed } = makeCtx({ inbound: phoneInbound, leads: [phoneLead] });

    await customerReplyAgent.run(ctx);

    expect(proposed).toHaveLength(1);
    expect((proposed[0] as Record<string, unknown>).action_type).toBe('flag_for_review');
    expect((ctx.llm as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it('SMS lead is silently skipped — no proposal, no LLM call', async () => {
    const smsInbound = [{ id: 'conv-s1', lead_id: 'lead-s1', body: 'Text me back', channel: 'sms', created_at: '2026-06-03T01:00:00Z' }];
    const smsLead = { id: 'lead-s1', customer_name: 'SMS Person', customer_email: null, first_response_at: null, reply_channel: 'sms', messenger_psid: null };
    const { ctx, proposed } = makeCtx({ inbound: smsInbound, leads: [smsLead] });

    const result = await customerReplyAgent.run(ctx);

    expect(proposed).toHaveLength(0);
    expect((ctx.llm as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
    expect(result.summary).toBe('No actionable inbound messages.');
  });

  it('Lead with null reply_channel is silently skipped', async () => {
    const noChannelInbound = [{ id: 'conv-nc1', lead_id: 'lead-nc1', body: 'hello', channel: null, created_at: '2026-06-03T01:00:00Z' }];
    const noChannelLead = { id: 'lead-nc1', customer_name: null, customer_email: null, first_response_at: null, reply_channel: null, messenger_psid: null };
    const { ctx, proposed } = makeCtx({ inbound: noChannelInbound, leads: [noChannelLead] });

    const result = await customerReplyAgent.run(ctx);

    expect(proposed).toHaveLength(0);
    expect(result.summary).toBe('No actionable inbound messages.');
  });

  it('Duplicate Messenger reply is blocked — pending send_messenger prevents re-draft', async () => {
    const { ctx, proposed } = makeCtx({
      inbound: messengerInbound,
      leads: [messengerLead],
      pendingActions: [{ target_id: 'lead-m1' }],
    });

    await customerReplyAgent.run(ctx);

    expect(proposed).toHaveLength(0);
    expect((ctx.llm as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it('Duplicate Email reply is blocked — pending send_email prevents re-draft', async () => {
    const { ctx, proposed } = makeCtx({
      inbound: emailInbound,
      leads: [emailLead],
      pendingActions: [{ target_id: 'lead-e1' }],
    });

    await customerReplyAgent.run(ctx);

    expect(proposed).toHaveLength(0);
  });

  it('Messenger LLM prompt instructs plain text output', async () => {
    const { ctx } = makeCtx({
      inbound: messengerInbound,
      leads: [messengerLead],
    });

    await customerReplyAgent.run(ctx);

    const llmCalls = (ctx.llm as ReturnType<typeof vi.fn>).mock.calls;
    expect(llmCalls).toHaveLength(1);
    const prompt = llmCalls[0][0] as string;
    // Prompt must tell the model to stay in plain text
    expect(prompt).toMatch(/plain text/i);
    // Prompt must explicitly forbid markdown / formatting tags
    expect(prompt).toMatch(/no html/i);
  });

  it('Mixed batch: Messenger + Email + Instagram handled in one run', async () => {
    const { ctx, proposed } = makeCtx({
      inbound: [...messengerInbound, ...emailInbound, ...instagramInbound],
      leads: [messengerLead, emailLead, instagramLead],
    });

    const result = await customerReplyAgent.run(ctx);

    const types = (proposed as Record<string, unknown>[]).map((a) => a.action_type);
    expect(types).toContain('send_messenger');
    expect(types).toContain('send_email');
    expect(types).toContain('flag_for_review');
    expect(result.summary).toContain('Messenger');
    expect(result.summary).toContain('email');
    expect(result.summary).toContain('flagged');
  });

  it('Returns early when no inbound messages exist', async () => {
    const { ctx, proposed } = makeCtx({ inbound: [], leads: [] });
    const result = await customerReplyAgent.run(ctx);
    expect(proposed).toHaveLength(0);
    expect(result.summary).toBe('No inbound messages.');
  });
});

