import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAuthUser = vi.fn();
const createServiceClientSafe = vi.fn();
const createStripeClient = vi.fn();
const getResendClient = vi.fn(() => null);
const recordAnalyticsEvent = vi.fn();

vi.mock('@/lib/auth', () => ({ getAuthUser }));
vi.mock('@/lib/supabase/server', () => ({ createServiceClientSafe }));
vi.mock('@/lib/stripe/server', () => ({ createStripeClient }));
vi.mock('@/lib/email/resend', () => ({ getResendClient, FROM_ADDRESS: 'admin@budsatwork.com' }));
vi.mock('@/lib/analytics/server', () => ({ recordAnalyticsEvent }));

const ADMIN = { id: 'admin-1', role: 'admin', email: 'admin@test.local' };

interface Row {
  [key: string]: unknown;
}

function fakeStripe() {
  return {
    checkout: {
      sessions: {
        create: vi.fn(async () => ({ id: 'sess_1', url: 'https://stripe.test/pay/sess_1' })),
      },
    },
    customers: { create: vi.fn(async () => ({ id: 'cus_1' })) },
  };
}

/** Table-specific fake: reads resolve from `rows`; `.insert()`/`.update()`
 * resolve to whatever `terminalData` this table was configured with (so a
 * test can directly control what the "trigger" produced, independent of
 * whatever was actually inserted — the point is to test the app-level
 * compatibility check against a controlled DB response). */
function makeTableChain(rows: Row[], terminalData?: Row) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  let filtered = rows;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = { calls };
  for (const method of ['select', 'order', 'limit', 'insert', 'update'] as const) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return chain;
    };
  }
  chain.eq = (column: string, value: unknown) => {
    calls.push({ method: 'eq', args: [column, value] });
    filtered = filtered.filter((row) => row[column] === value);
    return chain;
  };
  chain.single = async () => ({ data: terminalData ?? filtered[0] ?? null, error: null });
  chain.maybeSingle = async () => ({ data: terminalData ?? filtered[0] ?? null, error: null });
  chain.then = (onfulfilled: (value: unknown) => unknown) =>
    Promise.resolve({ data: filtered, error: null }).then(onfulfilled);
  return chain;
}

function makeClient(config: {
  quotes: Row[];
  orders?: Row[];
  ordersTerminal?: Row;
  customers?: Row[];
}) {
  const from = vi.fn((table: string) => {
    if (table === 'orders') return makeTableChain(config.orders ?? [], config.ordersTerminal);
    if (table === 'customers') return makeTableChain(config.customers ?? []);
    return makeTableChain(config.quotes);
  });
  return { from };
}

function req(url: string) {
  return new Request(url, { method: 'POST' }) as never;
}

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  createStripeClient.mockReturnValue(fakeStripe());
  getResendClient.mockReturnValue(null);
});

describe('POST /api/quotes/[id]/checkout — workspace compatibility', () => {
  it('a sandbox quote converts into a sandbox order when the DB correctly propagates workspace', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    const quote: Row = {
      id: 'q1',
      status: 'finalized',
      payment_status: 'not_requested',
      reviewed_total: 200,
      submitted_total: 200,
      total: 200,
      customer_id: null,
      customer_email: null,
      environment: 'sandbox',
      converted_order_id: null,
    };
    createServiceClientSafe.mockReturnValue(
      makeClient({ quotes: [quote], ordersTerminal: { id: 'order-1', environment: 'sandbox' } })
    );
    const { POST } = await import('@/app/api/quotes/[id]/checkout/route');

    const res = await POST(req('https://app.test/api/quotes/q1/checkout'), routeParams('q1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.order_id).toBe('order-1');
  });

  it('a production quote converts into a production order when the DB correctly propagates workspace', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    const quote: Row = {
      id: 'q1',
      status: 'finalized',
      payment_status: 'not_requested',
      reviewed_total: 200,
      submitted_total: 200,
      total: 200,
      customer_id: null,
      customer_email: null,
      environment: 'production',
      converted_order_id: null,
    };
    createServiceClientSafe.mockReturnValue(
      makeClient({ quotes: [quote], ordersTerminal: { id: 'order-1', environment: 'production' } })
    );
    const { POST } = await import('@/app/api/quotes/[id]/checkout/route');

    const res = await POST(req('https://app.test/api/quotes/q1/checkout'), routeParams('q1'));
    expect(res.status).toBe(200);
  });

  it('rejects the checkout if a sandbox quote would otherwise produce a production order (trigger bypass/failure)', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    const quote: Row = {
      id: 'q1',
      status: 'finalized',
      payment_status: 'not_requested',
      reviewed_total: 200,
      submitted_total: 200,
      total: 200,
      customer_id: null,
      customer_email: null,
      environment: 'sandbox',
      converted_order_id: null,
    };
    // Simulates a broken/bypassed DB trigger: the order comes back production
    // even though the quote is sandbox.
    createServiceClientSafe.mockReturnValue(
      makeClient({ quotes: [quote], ordersTerminal: { id: 'order-1', environment: 'production' } })
    );
    const { POST } = await import('@/app/api/quotes/[id]/checkout/route');

    const res = await POST(req('https://app.test/api/quotes/q1/checkout'), routeParams('q1'));
    expect(res.status).toBe(409);
    expect(createStripeClient().checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('rejects the checkout if a production quote would otherwise produce a sandbox order (trigger bypass/failure)', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    const quote: Row = {
      id: 'q1',
      status: 'finalized',
      payment_status: 'not_requested',
      reviewed_total: 200,
      submitted_total: 200,
      total: 200,
      customer_id: null,
      customer_email: null,
      environment: 'production',
      converted_order_id: null,
    };
    createServiceClientSafe.mockReturnValue(
      makeClient({ quotes: [quote], ordersTerminal: { id: 'order-1', environment: 'sandbox' } })
    );
    const { POST } = await import('@/app/api/quotes/[id]/checkout/route');

    const res = await POST(req('https://app.test/api/quotes/q1/checkout'), routeParams('q1'));
    expect(res.status).toBe(409);
  });

  it('blocks an unauthenticated guest from checking out a sandbox quote', async () => {
    getAuthUser.mockResolvedValue(null);
    const quote: Row = {
      id: 'q1',
      status: 'finalized',
      payment_status: 'not_requested',
      reviewed_total: 200,
      submitted_total: 200,
      total: 200,
      customer_id: null,
      customer_email: null,
      environment: 'sandbox',
      converted_order_id: null,
    };
    createServiceClientSafe.mockReturnValue(makeClient({ quotes: [quote] }));
    const { POST } = await import('@/app/api/quotes/[id]/checkout/route');

    const res = await POST(req('https://app.test/api/quotes/q1/checkout'), routeParams('q1'));
    expect(res.status).toBe(403);
  });

  it('scopes the Stripe-customer lookup to the quote\'s own workspace', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    const quote: Row = {
      id: 'q1',
      status: 'finalized',
      payment_status: 'not_requested',
      reviewed_total: 200,
      submitted_total: 200,
      total: 200,
      customer_id: null,
      customer_email: 'sarah@example.com',
      environment: 'production',
      converted_order_id: null,
    };
    const client = makeClient({
      quotes: [quote],
      ordersTerminal: { id: 'order-1', environment: 'production' },
      customers: [{ id: 'cust-1', email: 'sarah@example.com', stripe_customer_id: null, environment: 'production' }],
    });
    createServiceClientSafe.mockReturnValue(client);
    const { POST } = await import('@/app/api/quotes/[id]/checkout/route');

    await POST(req('https://app.test/api/quotes/q1/checkout'), routeParams('q1'));

    const customersChainCall = client.from.mock.results.find(
      (_r: unknown, i: number) => client.from.mock.calls[i][0] === 'customers'
    );
    const eqCalls = customersChainCall?.value.calls.filter((c: { method: string }) => c.method === 'eq');
    expect(eqCalls).toContainEqual({ method: 'eq', args: ['environment', 'production'] });
  });
});
