import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ---------- supabase mock ----------------------------------------------------
// Lightweight chainable query builder. Mirrors the .from().select().eq()...
// shape just enough that the messenger route exercises every branch.

type InsertCapture = {
  table: string;
  row: Record<string, unknown>;
};

let inserted: InsertCapture[] = [];
let existingLeadId: string | null = null;

function makeClient() {
  return {
    from(table: string) {
      const ctx: {
        table: string;
        filters: Record<string, unknown>;
        isFilter: { column: string; value: unknown } | null;
      } = { table, filters: {}, isFilter: null };

      const chain = {
        select: (_: string) => chain,
        eq(column: string, value: unknown) {
          ctx.filters[column] = value;
          return chain;
        },
        is(column: string, value: unknown) {
          ctx.isFilter = { column, value };
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          // Used by the idempotency lookup. Mirror its filters.
          if (
            ctx.table === 'leads' &&
            ctx.filters.source &&
            ctx.filters.external_ref &&
            existingLeadId
          ) {
            return { data: { id: existingLeadId }, error: null };
          }
          return { data: null, error: null };
        },
        async single() {
          throw new Error('single() not implemented in mock');
        },
        insert(row: Record<string, unknown>) {
          inserted.push({ table: ctx.table, row });
          return {
            select: () => ({
              single: async () => ({ data: { id: 'lead_mock_1' }, error: null }),
            }),
            // Allow .insert(...).then(...) usage too
            then: (cb: (r: { data: null; error: null }) => unknown) =>
              cb({ data: null, error: null }),
          };
        },
      };

      return chain;
    },
  };
}

vi.mock('@/lib/supabase/server', () => ({
  createServiceClientSafe: () => makeClient(),
  createServiceClient: () => makeClient(),
}));

// Now import the route AFTER the mock is set up.
let routeModule: typeof import('@/app/api/leads/messenger/route');

beforeEach(async () => {
  inserted = [];
  existingLeadId = null;
  process.env.MESSENGER_INGEST_SECRET = 'test-secret';
  routeModule = await import('@/app/api/leads/messenger/route');
});

afterEach(() => {
  vi.resetModules();
});

function postRequest(payload: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/leads/messenger', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-messenger-secret': 'test-secret',
      ...headers,
    },
    body: JSON.stringify(payload),
  });
}

describe('POST /api/leads/messenger', () => {
  it('rejects requests without the shared secret', async () => {
    const req = postRequest(
      { external_id: 'm_1' },
      { 'x-messenger-secret': 'wrong' }
    );
    const res = await routeModule.POST(req);
    expect(res.status).toBe(401);
  });

  it('rejects payloads without external_id', async () => {
    const req = postRequest({ sender_psid: 'PSID-1' });
    const res = await routeModule.POST(req);
    expect(res.status).toBe(400);
  });

  it('writes a new lead with source=messenger and external_ref', async () => {
    const req = postRequest({
      external_id: 'm_abc123',
      sender_psid: 'PSID-1',
      customer_name: 'Jane Q. Customer',
      service_type: 'yard',
      message_body: 'hi can you do my yard',
    });
    const res = await routeModule.POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deduped).toBe(false);
    expect(body.lead_id).toBe('lead_mock_1');

    const leadInsert = inserted.find((i) => i.table === 'leads');
    expect(leadInsert).toBeTruthy();
    expect(leadInsert!.row.source).toBe('messenger');
    expect(leadInsert!.row.external_ref).toBe('m_abc123');
    expect(leadInsert!.row.customer_name).toBe('Jane Q. Customer');

    const convoInsert = inserted.find((i) => i.table === 'lead_conversations');
    expect(convoInsert).toBeTruthy();
    expect(convoInsert!.row.channel).toBe('messenger');
    expect(convoInsert!.row.direction).toBe('inbound');
  });

  it('is idempotent on duplicate external_id', async () => {
    existingLeadId = 'lead_existing_1';
    const req = postRequest({
      external_id: 'm_dup',
      message_body: 'hello again',
    });
    const res = await routeModule.POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deduped).toBe(true);
    expect(body.lead_id).toBe('lead_existing_1');

    // No second leads row.
    expect(inserted.filter((i) => i.table === 'leads')).toHaveLength(0);
  });

  it('accepts source=instagram', async () => {
    const req = postRequest({
      external_id: 'ig_1',
      source: 'instagram',
      message_body: 'hello from ig',
    });
    const res = await routeModule.POST(req);
    expect(res.status).toBe(200);
    const leadInsert = inserted.find((i) => i.table === 'leads');
    expect(leadInsert!.row.source).toBe('instagram');
  });

  it('rejects source values other than messenger/instagram', async () => {
    const req = postRequest({
      external_id: 'sms_1',
      source: 'sms',
    });
    const res = await routeModule.POST(req);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/leads/messenger (FB verification handshake)', () => {
  it('returns the challenge when the verify token matches', async () => {
    process.env.MESSENGER_VERIFY_TOKEN = 'tok-xyz';
    const req = new NextRequest(
      'http://localhost/api/leads/messenger?hub.mode=subscribe&hub.verify_token=tok-xyz&hub.challenge=abc'
    );
    const res = await routeModule.GET(req);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('abc');
  });

  it('rejects mismatched verify tokens', async () => {
    process.env.MESSENGER_VERIFY_TOKEN = 'tok-xyz';
    const req = new NextRequest(
      'http://localhost/api/leads/messenger?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=abc'
    );
    const res = await routeModule.GET(req);
    expect(res.status).toBe(403);
  });
});
