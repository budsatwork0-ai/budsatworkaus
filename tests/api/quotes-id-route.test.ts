import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAuthUser = vi.fn();
const createServiceClientSafe = vi.fn();
const createStripeClientSafe = vi.fn(() => null);

vi.mock('@/lib/auth', () => ({ getAuthUser }));
vi.mock('@/lib/supabase/server', () => ({ createServiceClientSafe }));
vi.mock('@/lib/stripe/server', () => ({ createStripeClientSafe }));

const ADMIN = { id: 'admin-1', role: 'admin', email: 'admin@test.local' };
const EMPLOYEE = { id: 'employee-1', role: 'employee', email: 'employee@test.local' };

interface Row {
  [key: string]: unknown;
}

function makeTableChain(rows: Row[]) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  let filtered = rows;
  let updatePatch: Row | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = { calls };
  for (const method of ['select', 'order', 'limit'] as const) {
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
  chain.update = (patch: Row) => {
    calls.push({ method: 'update', args: [patch] });
    updatePatch = patch;
    return chain;
  };
  chain.single = async () => ({ data: updatePatch ? { ...filtered[0], ...updatePatch } : filtered[0] ?? null, error: null });
  chain.maybeSingle = async () => ({ data: filtered[0] ?? null, error: null });
  chain.then = (onfulfilled: (value: unknown) => unknown) =>
    Promise.resolve({ data: filtered, error: null }).then(onfulfilled);
  return chain;
}

function makeClient(rowsByTable: Record<string, Row[]>) {
  const from = vi.fn((table: string) => makeTableChain(rowsByTable[table] ?? []));
  return { from };
}

function req(url: string, init?: RequestInit) {
  return new Request(url, init) as never;
}

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  createStripeClientSafe.mockReturnValue(null);
});

describe('GET /api/quotes/[id]', () => {
  it('allows an admin to view a sandbox quote', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(
      makeClient({ quotes: [{ id: 'q1', customer_id: null, environment: 'sandbox' }] })
    );
    const { GET } = await import('@/app/api/quotes/[id]/route');

    const res = await GET(req('https://app.test/api/quotes/q1'), routeParams('q1'));
    expect(res.status).toBe(200);
  });

  it('forbids an employee from viewing a sandbox quote, even though employees can view production quotes', async () => {
    getAuthUser.mockResolvedValue(EMPLOYEE);
    createServiceClientSafe.mockReturnValue(
      makeClient({ quotes: [{ id: 'q1', customer_id: null, environment: 'sandbox' }] })
    );
    const { GET } = await import('@/app/api/quotes/[id]/route');

    const res = await GET(req('https://app.test/api/quotes/q1'), routeParams('q1'));
    expect(res.status).toBe(403);
  });

  it('still allows an employee to view a production quote', async () => {
    getAuthUser.mockResolvedValue(EMPLOYEE);
    createServiceClientSafe.mockReturnValue(
      makeClient({ quotes: [{ id: 'q1', customer_id: null, environment: 'production' }] })
    );
    const { GET } = await import('@/app/api/quotes/[id]/route');

    const res = await GET(req('https://app.test/api/quotes/q1'), routeParams('q1'));
    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/quotes/[id]', () => {
  function patch(id: string, body: Record<string, unknown>) {
    return [
      req(`https://app.test/api/quotes/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      routeParams(id),
    ] as const;
  }

  it('forbids an employee from patching a sandbox quote', async () => {
    getAuthUser.mockResolvedValue(EMPLOYEE);
    createServiceClientSafe.mockReturnValue(
      makeClient({ quotes: [{ id: 'q1', status: 'submitted', environment: 'sandbox' }] })
    );
    const { PATCH } = await import('@/app/api/quotes/[id]/route');

    const res = await PATCH(...patch('q1', { notes: 'hello' }));
    expect(res.status).toBe(403);
  });

  it('rejects cancelling a quote whose linked order belongs to a different workspace', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    const quotes: Row[] = [
      {
        id: 'q1',
        status: 'finalized',
        environment: 'production',
        converted_order_id: 'order-1',
        stripe_checkout_session_id: null,
      },
    ];
    const orders: Row[] = [{ id: 'order-1', environment: 'sandbox' }];
    createServiceClientSafe.mockReturnValue(makeClient({ quotes, orders }));
    const { PATCH } = await import('@/app/api/quotes/[id]/route');

    const res = await PATCH(...patch('q1', { status: 'cancelled', cancellation_reason: 'test' }));
    expect(res.status).toBe(409);
  });

  it('allows cancelling a quote whose linked order shares its workspace', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    const quotes: Row[] = [
      {
        id: 'q1',
        status: 'finalized',
        environment: 'production',
        converted_order_id: 'order-1',
        stripe_checkout_session_id: null,
      },
    ];
    const orders: Row[] = [{ id: 'order-1', environment: 'production' }];
    const client = makeClient({ quotes, orders });
    createServiceClientSafe.mockReturnValue(client);
    const { PATCH } = await import('@/app/api/quotes/[id]/route');

    const res = await PATCH(...patch('q1', { status: 'cancelled', cancellation_reason: 'test' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.quote.status).toBe('cancelled');
  });

  it('preserves the existing response shape', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(
      makeClient({ quotes: [{ id: 'q1', status: 'submitted', environment: 'production' }] })
    );
    const { PATCH } = await import('@/app/api/quotes/[id]/route');

    const res = await PATCH(...patch('q1', { notes: 'hi' }));
    const body = await res.json();
    expect(Object.keys(body)).toEqual(['quote']);
  });
});
