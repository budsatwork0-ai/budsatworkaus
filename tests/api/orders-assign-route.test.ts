import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAuthUser = vi.fn();
const createServiceClientSafe = vi.fn();
const getResendClient = vi.fn();

vi.mock('@/lib/auth', () => ({ getAuthUser }));
vi.mock('@/lib/supabase/server', () => ({ createServiceClientSafe }));
vi.mock('@/lib/email/resend', () => ({ getResendClient, FROM_ADDRESS: 'admin@budsatwork.com' }));

const ADMIN = { id: 'admin-1', role: 'admin', email: 'admin@test.local' };
const EMPLOYEE = { id: 'employee-1', role: 'employee', email: 'employee@test.local' };

interface Row {
  [key: string]: unknown;
}

function makeTableChain(rows: Row[]) {
  let filtered = rows;
  let updatePatch: Row | null = null;
  let inserted: Row[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  chain.select = (...args: unknown[]) => chain;
  chain.eq = (column: string, value: unknown) => {
    filtered = filtered.filter((row) => row[column] === value);
    return chain;
  };
  chain.update = (patch: Row) => {
    updatePatch = patch;
    return chain;
  };
  chain.insert = (payload: Row[]) => {
    inserted = payload.map((row, i) => ({ id: `assignment-${i}`, employees: { first_name: 'Jordan' }, ...row }));
    return chain;
  };
  chain.single = async () => ({ data: updatePatch ? { ...filtered[0], ...updatePatch } : filtered[0] ?? null, error: null });
  chain.then = (onfulfilled: (value: unknown) => unknown) =>
    Promise.resolve({ data: inserted.length ? inserted : filtered, error: null }).then(onfulfilled);
  return chain;
}

function makeClient(rowsByTable: Record<string, Row[]>) {
  return { from: vi.fn((table: string) => makeTableChain(rowsByTable[table] ?? [])) };
}

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function post(body: Record<string, unknown>) {
  return new Request('https://app.test/api/orders/o1/assign', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as never;
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

const ASSIGN_BODY = { employee_ids: ['emp-1'], scheduled_date: '2026-08-01', scheduled_time: '9am' };

describe('POST /api/orders/[id]/assign', () => {
  it('preserves production assignment email behaviour unchanged', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    const send = vi.fn(async () => ({ data: { id: 'email-1' }, error: null }));
    getResendClient.mockReturnValue({ emails: { send } });
    createServiceClientSafe.mockReturnValue(
      makeClient({
        orders: [{ id: 'o1', customer_email: 'sarah@example.com', customer_name: 'Sarah', service_type: 'cleaning', notes: null, final_price: 200, environment: 'production' }],
      })
    );
    const { POST } = await import('@/app/api/orders/[id]/assign/route');

    const res = await POST(post(ASSIGN_BODY), routeParams('o1'));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.email_blocked).toBeUndefined();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('blocks the real assignment email for a sandbox order and reports it clearly', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    const send = vi.fn(async () => ({ data: { id: 'email-1' }, error: null }));
    getResendClient.mockReturnValue({ emails: { send } });
    createServiceClientSafe.mockReturnValue(
      makeClient({
        orders: [{ id: 'o1', customer_email: 'sarah@example.com', customer_name: 'Sarah', service_type: 'cleaning', notes: null, final_price: 200, environment: 'sandbox' }],
      })
    );
    const { POST } = await import('@/app/api/orders/[id]/assign/route');

    const res = await POST(post(ASSIGN_BODY), routeParams('o1'));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.email_blocked).toBe(true);
    expect(send).not.toHaveBeenCalled();
  });

  it('still persists the DB-only scheduling/assignment write for a sandbox order', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    getResendClient.mockReturnValue(null);
    createServiceClientSafe.mockReturnValue(
      makeClient({
        orders: [{ id: 'o1', customer_email: 'sarah@example.com', customer_name: 'Sarah', service_type: 'cleaning', notes: null, final_price: 200, environment: 'sandbox' }],
      })
    );
    const { POST } = await import('@/app/api/orders/[id]/assign/route');

    const res = await POST(post(ASSIGN_BODY), routeParams('o1'));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.assignments).toHaveLength(1);
  });

  it('forbids an employee from assigning a sandbox order', async () => {
    getAuthUser.mockResolvedValue(EMPLOYEE);
    createServiceClientSafe.mockReturnValue(
      makeClient({
        orders: [{ id: 'o1', customer_email: 'sarah@example.com', customer_name: 'Sarah', service_type: 'cleaning', notes: null, final_price: 200, environment: 'sandbox' }],
      })
    );
    const { POST } = await import('@/app/api/orders/[id]/assign/route');

    const res = await POST(post(ASSIGN_BODY), routeParams('o1'));
    expect(res.status).toBe(403);
  });

  it('still allows an employee to assign a production order', async () => {
    getAuthUser.mockResolvedValue(EMPLOYEE);
    getResendClient.mockReturnValue(null);
    createServiceClientSafe.mockReturnValue(
      makeClient({
        orders: [{ id: 'o1', customer_email: 'sarah@example.com', customer_name: 'Sarah', service_type: 'cleaning', notes: null, final_price: 200, environment: 'production' }],
      })
    );
    const { POST } = await import('@/app/api/orders/[id]/assign/route');

    const res = await POST(post(ASSIGN_BODY), routeParams('o1'));
    expect(res.status).toBe(201);
  });
});
