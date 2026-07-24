import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const getAuthUser = vi.fn();
const createServiceClientSafe = vi.fn();

vi.mock('@/lib/auth', () => ({ getAuthUser }));
vi.mock('@/lib/supabase/server', () => ({ createServiceClientSafe }));

const ADMIN = { id: 'admin-1', role: 'admin', email: 'admin@test.local' };
const EMPLOYEE = { id: 'employee-1', role: 'employee', email: 'employee@test.local' };

interface Row {
  [key: string]: unknown;
}

/** A chainable, table-scoped fake query: `.eq()`/`.or() `narrow an in-memory
 * row set, any chain terminates as a thenable resolving to `{data, error, count}`,
 * and `.insert()` + `.single()` echoes back the stamped payload — enough to
 * exercise real workspace scoping and creation without a real database. */
function makeTableChain(rows: Row[]) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  let filtered = rows;
  let inserted: Row | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = { calls };
  for (const method of ['select', 'order', 'limit', 'gte', 'not'] as const) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return chain;
    };
  }
  chain.or = (...args: unknown[]) => {
    calls.push({ method: 'or', args });
    return chain; // search filtering itself is covered at the repository level; here we assert the call shape
  };
  chain.eq = (column: string, value: unknown) => {
    calls.push({ method: 'eq', args: [column, value] });
    filtered = filtered.filter((row) => row[column] === value);
    return chain;
  };
  chain.insert = (payload: Row) => {
    calls.push({ method: 'insert', args: [payload] });
    inserted = payload;
    return chain;
  };
  chain.single = async () => ({ data: inserted, error: null });
  chain.then = (onfulfilled: (value: unknown) => unknown) =>
    Promise.resolve({ data: filtered, error: null, count: filtered.length }).then(onfulfilled);
  return chain;
}

function makeClient(rowsByTable: Record<string, Row[]>) {
  const from = vi.fn((table: string) => makeTableChain(rowsByTable[table] ?? []));
  return { from };
}

const CUSTOMERS: Row[] = [
  { id: 'c-prod-1', full_name: 'Prod Customer', email: 'prod@x.com', phone: '1', environment: 'production' },
  { id: 'c-sandbox-1', full_name: 'Sandbox Customer', email: 'sandbox@x.com', phone: '2', environment: 'sandbox' },
];

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('GET /api/customers', () => {
  it('defaults to production and excludes sandbox customers', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient({ customers: CUSTOMERS }));
    const { GET } = await import('@/app/api/customers/route');

    const res = await GET(new Request('https://app.test/api/customers') as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.customers).toHaveLength(1);
    expect(body.customers[0].id).toBe('c-prod-1');
  });

  it('returns sandbox customers for an authorized admin request', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient({ customers: CUSTOMERS }));
    const { GET } = await import('@/app/api/customers/route');

    const res = await GET(new Request('https://app.test/api/customers?workspace=sandbox') as never);
    const body = await res.json();

    expect(body.customers).toHaveLength(1);
    expect(body.customers[0].id).toBe('c-sandbox-1');
  });

  it('forces a non-admin-requested sandbox workspace back to production', async () => {
    getAuthUser.mockResolvedValue(EMPLOYEE);
    createServiceClientSafe.mockReturnValue(makeClient({ customers: CUSTOMERS }));
    const { GET } = await import('@/app/api/customers/route');

    const res = await GET(new Request('https://app.test/api/customers?workspace=sandbox') as never);
    const body = await res.json();

    expect(body.customers).toHaveLength(1);
    expect(body.customers[0].id).toBe('c-prod-1');
  });

  it('resolves an invalid workspace value safely to production', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient({ customers: CUSTOMERS }));
    const { GET } = await import('@/app/api/customers/route');

    const res = await GET(new Request('https://app.test/api/customers?workspace=not-real') as never);
    const body = await res.json();

    expect(body.customers).toHaveLength(1);
    expect(body.customers[0].id).toBe('c-prod-1');
  });

  it('applies search and pagination within the resolved workspace', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    const client = makeClient({ customers: CUSTOMERS });
    createServiceClientSafe.mockReturnValue(client);
    const { GET } = await import('@/app/api/customers/route');

    await GET(new Request('https://app.test/api/customers?search=sarah&limit=10') as never);

    const chain = client.from.mock.results[0].value;
    const orCall = chain.calls.find((c: { method: string }) => c.method === 'or');
    const limitCall = chain.calls.find((c: { method: string }) => c.method === 'limit');
    const eqCall = chain.calls.find((c: { method: string }) => c.method === 'eq');

    expect(orCall?.args[0]).toBe('full_name.ilike.%sarah%,email.ilike.%sarah%,phone.ilike.%sarah%');
    expect(limitCall?.args[0]).toBe(10);
    expect(eqCall?.args).toEqual(['environment', 'production']);
  });

  it('preserves the existing response shape', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient({ customers: CUSTOMERS }));
    const { GET } = await import('@/app/api/customers/route');

    const res = await GET(new Request('https://app.test/api/customers') as never);
    const body = await res.json();

    expect(Object.keys(body)).toEqual(['customers']);
    expect(body.customers[0]).toMatchObject({ id: 'c-prod-1', full_name: 'Prod Customer' });
  });

  it('does not leak workspace context between concurrent requests', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient({ customers: CUSTOMERS }));
    const { GET } = await import('@/app/api/customers/route');

    const [prodRes, sandboxRes] = await Promise.all([
      GET(new Request('https://app.test/api/customers') as never),
      GET(new Request('https://app.test/api/customers?workspace=sandbox') as never),
    ]);
    const [prodBody, sandboxBody] = await Promise.all([prodRes.json(), sandboxRes.json()]);

    expect(prodBody.customers.map((c: Row) => c.id)).toEqual(['c-prod-1']);
    expect(sandboxBody.customers.map((c: Row) => c.id)).toEqual(['c-sandbox-1']);
  });
});

describe('POST /api/customers', () => {
  function post(body: Record<string, unknown>, url = 'https://app.test/api/customers') {
    return new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }) as never;
  }

  it('stamps a newly created customer with the active (default production) workspace', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient({ customers: [] }));
    const { POST } = await import('@/app/api/customers/route');

    const res = await POST(post({ full_name: 'New Customer' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.customer).toMatchObject({ full_name: 'New Customer', environment: 'production' });
  });

  it('ignores an environment/workspace value supplied in the request body', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient({ customers: [] }));
    const { POST } = await import('@/app/api/customers/route');

    const res = await POST(post({ full_name: 'New Customer', environment: 'sandbox', workspace: 'sandbox' }));
    const body = await res.json();

    expect(body.customer.environment).toBe('production');
  });

  it('stamps sandbox when an admin explicitly requests the sandbox workspace', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient({ customers: [] }));
    const { POST } = await import('@/app/api/customers/route');

    const res = await POST(post({ full_name: 'New Customer' }, 'https://app.test/api/customers?workspace=sandbox'));
    const body = await res.json();

    expect(body.customer.environment).toBe('sandbox');
  });
});

describe('GET /api/customers/stats', () => {
  it('scopes customer and order-derived statistics to the resolved workspace', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    const orders: Row[] = [
      { customer_id: 'c-prod-1', final_price: 100, status: 'completed', environment: 'production' },
      { customer_id: 'c-sandbox-1', final_price: 999, status: 'completed', environment: 'sandbox' },
    ];
    createServiceClientSafe.mockReturnValue(makeClient({ customers: CUSTOMERS, orders }));
    const { GET } = await import('@/app/api/customers/stats/route');

    const res = await GET(new Request('https://app.test/api/customers/stats') as never);
    const body = await res.json();

    expect(body.totalCustomers).toBe(1);
    expect(body.totalRevenue).toBe(100);
  });

  it('preserves the existing response shape', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient({ customers: CUSTOMERS, orders: [] }));
    const { GET } = await import('@/app/api/customers/stats/route');

    const res = await GET(new Request('https://app.test/api/customers/stats') as never);
    const body = await res.json();

    expect(Object.keys(body).sort()).toEqual(
      ['activeThisMonth', 'avgOrderValue', 'totalCustomers', 'totalRevenue'].sort()
    );
  });
});

describe('customers routes source hygiene', () => {
  it('route.ts no longer references the raw environment column or ad hoc filters', () => {
    const source = readFileSync(
      path.resolve(__dirname, '../../src/app/api/customers/route.ts'),
      'utf8'
    );
    expect(source).not.toMatch(/['"]environment['"]/);
    expect(source).not.toMatch(/\.or\(\s*['"`]environment/);
  });

  it('stats/route.ts no longer references the raw environment column or ad hoc filters', () => {
    const source = readFileSync(
      path.resolve(__dirname, '../../src/app/api/customers/stats/route.ts'),
      'utf8'
    );
    expect(source).not.toMatch(/['"]environment['"]/);
    expect(source).not.toMatch(/\.or\(\s*['"`]environment/);
  });
});
