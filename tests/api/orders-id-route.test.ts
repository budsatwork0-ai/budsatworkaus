import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAuthUser = vi.fn();
const createServiceClientSafe = vi.fn();
const recordAnalyticsEvent = vi.fn();

vi.mock('@/lib/auth', () => ({ getAuthUser }));
vi.mock('@/lib/supabase/server', () => ({ createServiceClientSafe }));
vi.mock('@/lib/analytics/server', () => ({ recordAnalyticsEvent }));

const ADMIN = { id: 'admin-1', role: 'admin', email: 'admin@test.local' };
const EMPLOYEE = { id: 'employee-1', role: 'employee', email: 'employee@test.local' };
const CUSTOMER_USER = { id: 'customer-1', role: 'customer', email: 'sarah@example.com' };

interface Row {
  [key: string]: unknown;
}

function makeTableChain(rows: Row[]) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  let filtered = rows;
  let updatePatch: Row | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = { calls };
  for (const method of ['select', 'order'] as const) {
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

function makeClient(rows: Row[]) {
  return { from: vi.fn(() => makeTableChain(rows)) };
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
});

const BASE_ORDER: Row = {
  id: 'o1',
  status: 'confirmed',
  customer_id: null,
  customer_name: 'Sarah',
  customer_email: 'sarah@example.com',
  service_type: 'cleaning',
  context: 'home',
  scope: null,
  quote_id: null,
  analytics_session_id: null,
  scheduled_date: null,
  scheduled_time: null,
  final_price: 200,
};

describe('GET /api/orders/[id]', () => {
  it('allows an admin to view a sandbox order', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient([{ ...BASE_ORDER, environment: 'sandbox' }]));
    const { GET } = await import('@/app/api/orders/[id]/route');

    const res = await GET(req('https://app.test/api/orders/o1'), routeParams('o1'));
    expect(res.status).toBe(200);
  });

  it('forbids an employee from viewing a sandbox order, even though employees can view production orders', async () => {
    getAuthUser.mockResolvedValue(EMPLOYEE);
    createServiceClientSafe.mockReturnValue(makeClient([{ ...BASE_ORDER, environment: 'sandbox' }]));
    const { GET } = await import('@/app/api/orders/[id]/route');

    const res = await GET(req('https://app.test/api/orders/o1'), routeParams('o1'));
    expect(res.status).toBe(403);
  });

  it('does not expose order data before authorization is checked', async () => {
    getAuthUser.mockResolvedValue(EMPLOYEE);
    createServiceClientSafe.mockReturnValue(makeClient([{ ...BASE_ORDER, environment: 'sandbox', customer_email: 'secret@x.com' }]));
    const { GET } = await import('@/app/api/orders/[id]/route');

    const res = await GET(req('https://app.test/api/orders/o1'), routeParams('o1'));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(JSON.stringify(body)).not.toContain('secret@x.com');
  });

  it('still allows an employee to view a production order', async () => {
    getAuthUser.mockResolvedValue(EMPLOYEE);
    createServiceClientSafe.mockReturnValue(makeClient([{ ...BASE_ORDER, environment: 'production' }]));
    const { GET } = await import('@/app/api/orders/[id]/route');

    const res = await GET(req('https://app.test/api/orders/o1'), routeParams('o1'));
    expect(res.status).toBe(200);
  });

  it('preserves customer ownership access to their own production order', async () => {
    getAuthUser.mockResolvedValue(CUSTOMER_USER);
    createServiceClientSafe.mockReturnValue(
      makeClient([{ ...BASE_ORDER, customer_id: 'customer-1', environment: 'production' }])
    );
    const { GET } = await import('@/app/api/orders/[id]/route');

    const res = await GET(req('https://app.test/api/orders/o1'), routeParams('o1'));
    expect(res.status).toBe(200);
  });

  it('denies a customer viewing an order they do not own', async () => {
    getAuthUser.mockResolvedValue(CUSTOMER_USER);
    createServiceClientSafe.mockReturnValue(
      makeClient([{ ...BASE_ORDER, customer_id: 'someone-else', environment: 'production' }])
    );
    const { GET } = await import('@/app/api/orders/[id]/route');

    const res = await GET(req('https://app.test/api/orders/o1'), routeParams('o1'));
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/orders/[id]', () => {
  function patch(id: string, body: Record<string, unknown>) {
    return [
      req(`https://app.test/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      routeParams(id),
    ] as const;
  }

  it('forbids an employee from patching a sandbox order', async () => {
    getAuthUser.mockResolvedValue(EMPLOYEE);
    createServiceClientSafe.mockReturnValue(makeClient([{ ...BASE_ORDER, environment: 'sandbox' }]));
    const { PATCH } = await import('@/app/api/orders/[id]/route');

    const res = await PATCH(...patch('o1', { notes: 'hello' }));
    expect(res.status).toBe(403);
  });

  it('allows an admin to patch a sandbox order', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient([{ ...BASE_ORDER, environment: 'sandbox' }]));
    const { PATCH } = await import('@/app/api/orders/[id]/route');

    const res = await PATCH(...patch('o1', { notes: 'hello' }));
    expect(res.status).toBe(200);
  });

  it('rescheduling stays within the discovered order workspace', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient([{ ...BASE_ORDER, environment: 'production' }]));
    const { PATCH } = await import('@/app/api/orders/[id]/route');

    const res = await PATCH(...patch('o1', { scheduled_date: '2026-08-01', scheduled_time: '9am' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.scheduled_date).toBe('2026-08-01');
  });

  it('completion stays within the discovered order workspace', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient([{ ...BASE_ORDER, environment: 'production' }]));
    const { PATCH } = await import('@/app/api/orders/[id]/route');

    const res = await PATCH(...patch('o1', { status: 'completed' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('completed');
    expect(body.completed_at).toBeTruthy();
  });

  it('a customer can only cancel, and only their own production order', async () => {
    getAuthUser.mockResolvedValue(CUSTOMER_USER);
    createServiceClientSafe.mockReturnValue(
      makeClient([{ ...BASE_ORDER, customer_id: 'customer-1', environment: 'production' }])
    );
    const { PATCH } = await import('@/app/api/orders/[id]/route');

    const res = await PATCH(...patch('o1', { status: 'in_progress' }));
    expect(res.status).toBe(403);
  });

  it('preserves the existing response shape', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient([{ ...BASE_ORDER, environment: 'production' }]));
    const { PATCH } = await import('@/app/api/orders/[id]/route');

    const res = await PATCH(...patch('o1', { notes: 'hi' }));
    const body = await res.json();
    expect(body.id).toBe('o1');
  });
});

describe('DELETE /api/orders/[id] (cancellation)', () => {
  it('cancellation stays within the discovered order workspace and requires admin for sandbox', async () => {
    getAuthUser.mockResolvedValue(EMPLOYEE);
    createServiceClientSafe.mockReturnValue(makeClient([{ ...BASE_ORDER, environment: 'sandbox' }]));
    const { DELETE } = await import('@/app/api/orders/[id]/route');

    const res = await DELETE(req('https://app.test/api/orders/o1'), routeParams('o1'));
    expect(res.status).toBe(403);
  });

  it('allows an admin to cancel a sandbox order', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient([{ ...BASE_ORDER, environment: 'sandbox' }]));
    const { DELETE } = await import('@/app/api/orders/[id]/route');

    const res = await DELETE(req('https://app.test/api/orders/o1'), routeParams('o1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.order.status).toBe('cancelled');
  });

  it('preserves the existing response shape for production cancellation', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient([{ ...BASE_ORDER, environment: 'production' }]));
    const { DELETE } = await import('@/app/api/orders/[id]/route');

    const res = await DELETE(req('https://app.test/api/orders/o1'), routeParams('o1'));
    const body = await res.json();

    expect(Object.keys(body).sort()).toEqual(['message', 'order']);
  });
});
