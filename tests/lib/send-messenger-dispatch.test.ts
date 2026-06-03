/**
 * Tests for the send_messenger runtime dispatch handler.
 * Kept in its own file so the top-level vi.mock for @supabase/supabase-js
 * doesn't leak into the customer-reply agent tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── top-level mock (hoisted by Vitest before any imports) ────────────────────

// Chainable update mock: .update().eq().is() all resolve cleanly
const eqAfterUpdate = vi.fn().mockReturnValue({
  is: vi.fn().mockResolvedValue({ error: null }),
});
const updateFn = vi.fn().mockReturnValue({ eq: eqAfterUpdate });
const insertFn  = vi.fn().mockResolvedValue({ error: null });
const singleFn  = vi.fn();

function makeChain(returnSingle: () => Promise<unknown>) {
  const c: Record<string, unknown> = {
    select: () => c,
    eq:     () => c,
    is:     () => c,
    update: updateFn,
    insert: insertFn,
    single: returnSingle,
  };
  return c;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'agent_actions') {
        return makeChain(singleFn);
      }
      // leads, lead_conversations
      return {
        update: updateFn,
        insert: insertFn,
        select: () => ({ eq: () => ({ eq: () => ({ single: singleFn }) }) }),
        from: () => ({}),
      };
    }),
  })),
}));

// ── import after mock ────────────────────────────────────────────────────────

import { executeApprovedAction } from '@/lib/agents/runtime';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// ── helpers ──────────────────────────────────────────────────────────────────

const approvedMessengerAction = {
  id: 'action-1',
  action_type: 'send_messenger',
  target_table: 'leads',
  target_id: 'lead-m1',
  status: 'approved',
  payload: {
    messenger_psid: 'PSID_test',
    drafted_message: 'Hi! We can help with that.',
    lead_id: 'lead-m1',
    conversation_id: 'conv-1',
    customer_name: 'Jane',
    source: 'messenger',
  },
};

// ── tests ────────────────────────────────────────────────────────────────────

describe('send_messenger dispatch handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MESSENGER_PAGE_ACCESS_TOKEN;
    singleFn.mockResolvedValue({ data: approvedMessengerAction, error: null });
  });

  afterEach(() => {
    delete process.env.MESSENGER_PAGE_ACCESS_TOKEN;
  });

  it('throws clearly when MESSENGER_PAGE_ACCESS_TOKEN is missing', async () => {
    await expect(executeApprovedAction('action-1')).rejects.toThrow(
      'send_messenger: MESSENGER_PAGE_ACCESS_TOKEN is not configured',
    );
  });

  it('does NOT call fetch when token is missing — no accidental live send', async () => {
    try { await executeApprovedAction('action-1'); } catch { /* expected */ }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls Graph API with correct recipient and message when token is present', async () => {
    process.env.MESSENGER_PAGE_ACCESS_TOKEN = 'test-page-token';
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ recipient_id: 'PSID_test', message_id: 'mid_1' }),
    });

    await executeApprovedAction('action-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.facebook.com/v20.0/me/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer test-page-token',
          'content-type': 'application/json',
        }),
      }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.recipient.id).toBe('PSID_test');
    expect(body.message.text).toBe('Hi! We can help with that.');
  });

  it('throws on Graph API error response', async () => {
    process.env.MESSENGER_PAGE_ACCESS_TOKEN = 'test-page-token';
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => '{"error":{"message":"Invalid PSID"}}',
    });

    await expect(executeApprovedAction('action-1')).rejects.toThrow(
      'send_messenger: Graph API 400',
    );
  });

  it('throws clearly on missing messenger_psid in payload', async () => {
    process.env.MESSENGER_PAGE_ACCESS_TOKEN = 'test-page-token';
    singleFn.mockResolvedValueOnce({
      data: {
        ...approvedMessengerAction,
        payload: { drafted_message: 'hello', lead_id: 'lead-m1' },
      },
      error: null,
    });

    await expect(executeApprovedAction('action-1')).rejects.toThrow(
      'send_messenger: missing messenger_psid',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws clearly on missing drafted_message in payload', async () => {
    process.env.MESSENGER_PAGE_ACCESS_TOKEN = 'test-page-token';
    singleFn.mockResolvedValueOnce({
      data: {
        ...approvedMessengerAction,
        payload: { messenger_psid: 'PSID_test', lead_id: 'lead-m1' },
      },
      error: null,
    });

    await expect(executeApprovedAction('action-1')).rejects.toThrow(
      'send_messenger: missing drafted_message',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
