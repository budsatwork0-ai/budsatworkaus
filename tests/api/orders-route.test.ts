import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

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

/** Fake per-table query builder covering everything the Orders collection
 * route/repository issue: select/order/range/eq/gte/lte/is/not/or/insert.
 * `.then()` resolves with `count` = the filtered-but-pre-range row count,
 * matching Postgrest's `{ count: 'exact' }` semantics. */
function makeTableChain(rows: Row[], calls: Array<{ method: string; args: unknown[] }> = []) {
  let filtered = rows;
  let rangeFrom: number | null = null;
  let rangeTo: number | null = null;
  let inserted: Row | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = { calls };
  for (const method of ['select', 'order'] as const) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return chain;
    };
  }
  chain.range = (from: number, to: number) => {
    calls.push({ method: 'range', args: [from, to] });
    rangeFrom = from;
    rangeTo = to;
    return chain;
  };
  chain.eq = (column: string, value: unknown) => {
    calls.push({ method: 'eq', args: [column, value] });
    filtered = filtered.filter((row) => row[column] === value);
    return chain;
  };
  chain.gte = (column: string, value: unknown) => {
    calls.push({ method: 'gte', args: [column, value] });
    filtered = filtered.filter((row) => String(row[column] ?? '') >= String(value));
    return chain;
  };
  chain.lte = (column: string, value: unknown) => {
    calls.push({ method: 'lte', args: [column, value] });
    filtered = filtered.filter((row) => String(row[column] ?? '') <= String(value));
    return chain;
  };
  chain.is = (column: string, value: unknown) => {
    calls.push({ method: 'is', args: [column, value] });
    filtered = filtered.filter((row) => (row[column] ?? null) === value);
    return chain;
  };
  chain.not = (column: string, _op: string, value: string) => {
    calls.push({ method: 'not', args: [column, _op, value] });
    const excluded = value.replace(/[()"]/g, '').split(',');
    filtered = filtered.filter((row) => !excluded.includes(String(row[column])));
    return chain;
  };
  chain.or = (expr: string) => {
    calls.push({ method: 'or', args: [expr] });
    const needle = expr.match(/%([^%]*)%/)?.[1]?.toLowerCase() ?? '';
    const columns = expr.split(',').map((c) => c.split('.')[0]);
    filtered = filtered.filter((row) =>
      columns.some((col) => String(row[col] ?? '').toLowerCase().includes(needle))
    );
    return chain;
  };
  chain.insert = (payload: Row | Row[]) => {
    calls.push({ method: 'insert', args: [payload] });
    const row = Array.isArray(payload) ? payload[0] : payload;
    inserted = { id: `generated-${Math.random().toString(36).slice(2)}`, ...row };
    return chain;
  };
  chain.maybeSingle = async () => ({ data: filtered[0] ?? null, error: null });
  chain.single = async () => ({ data: inserted ?? filtered[0] ?? null, error: null });
  chain.then = (onfulfilled: (value: unknown) => unknown) => {
    const total = filtered.length;
    const paged = rangeFrom !== null ? filtered.slice(rangeFrom, (rangeTo ?? filtered.length) + 1) : filtered;
    return Promise.resolve({ data: paged, count: total, error: null }).then(onfulfilled);
  };
  return chain;
}

function makeClient(rowsByTable: Record<string, Row[]>) {
  const callsByTable: Record<string, Array<{ method: string; args: unknown[] }>> = {};
  const from = vi.fn((table: string) => {
    callsByTable[table] = callsByTable[table] ?? [];
    return makeTableChain(rowsByTable[table] ?? [], callsByTable[table]);
  });
  return { from, callsByTable };
}

const ORDERS: Row[] = [
  {
    id: 'o-prod-1',
    status: 'confirmed',
    service_type: 'cleaning',
    customer_id: null,
    customer_name: 'Prod Person',
    customer_email: 'prod@x.com',
    scheduled_date: '2026-07-25',
    created_at: '2026-07-20T00:00:00.000Z',
    environment: 'production',
  },
  {
    id: 'o-sandbox-1',
    status: 'confirmed',
    service_type: 'cleaning',
    customer_id: null,
    customer_name: 'Sandbox Person',
    customer_email: 'sandbox@x.com',
    scheduled_date: '2026-07-25',
    created_at: '2026-07-20T00:00:00.000Z',
    environment: 'sandbox',
  },
];

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

function get(url: string) {
  return new Request(url) as never;
}

describe('GET /api/orders', () => {
  it('defaults to production and excludes sandbox orders', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient({ orders: ORDERS }));
    const { GET } = await import('@/app/api/orders/route');

    const res = await GET(get('https://app.test/api/orders'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.orders).toHaveLength(1);
    expect(body.orders[0].id).toBe('o-prod-1');
  });

  it('returns sandbox orders for an authorized admin request', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient({ orders: ORDERS }));
    const { GET } = await import('@/app/api/orders/route');

    const res = await GET(get('https://app.test/api/orders?workspace=sandbox'));
    const body = await res.json();

    expect(body.orders).toHaveLength(1);
    expect(body.orders[0].id).toBe('o-sandbox-1');
  });

  it('forces a non-admin-requested sandbox workspace back to production', async () => {
    getAuthUser.mockResolvedValue(EMPLOYEE);
    createServiceClientSafe.mockReturnValue(makeClient({ orders: ORDERS }));
    const { GET } = await import('@/app/api/orders/route');

    const res = await GET(get('https://app.test/api/orders?workspace=sandbox'));
    const body = await res.json();

    expect(body.orders.map((o: Row) => o.id)).toEqual(['o-prod-1']);
  });

  it('resolves an invalid workspace value safely to production', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient({ orders: ORDERS }));
    const { GET } = await import('@/app/api/orders/route');

    const res = await GET(get('https://app.test/api/orders?workspace=not-real'));
    const body = await res.json();

    expect(body.orders.map((o: Row) => o.id)).toEqual(['o-prod-1']);
  });

  it('keeps search scoped to the resolved workspace', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    const rows: Row[] = [
      ...ORDERS,
      { id: 'o-sandbox-2', status: 'confirmed', service_type: 'cleaning', customer_id: null, customer_name: 'Prod Person', customer_email: 'x@x.com', scheduled_date: '2026-07-25', created_at: '2026-07-20T00:00:00.000Z', environment: 'sandbox' },
    ];
    createServiceClientSafe.mockReturnValue(makeClient({ orders: rows }));
    const { GET } = await import('@/app/api/orders/route');

    const res = await GET(get('https://app.test/api/orders?search=Prod'));
    const body = await res.json();

    expect(body.orders.map((o: Row) => o.id)).toEqual(['o-prod-1']);
  });

  it('keeps status filtering scoped to the resolved workspace', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    const rows: Row[] = [
      ...ORDERS,
      { id: 'o-sandbox-2', status: 'pending', service_type: 'cleaning', customer_id: null, customer_name: 'X', customer_email: 'x@x.com', scheduled_date: '2026-07-25', created_at: '2026-07-20T00:00:00.000Z', environment: 'sandbox' },
    ];
    createServiceClientSafe.mockReturnValue(makeClient({ orders: rows }));
    const { GET } = await import('@/app/api/orders/route');

    const res = await GET(get('https://app.test/api/orders?status=confirmed'));
    const body = await res.json();

    expect(body.orders.map((o: Row) => o.id)).toEqual(['o-prod-1']);
  });

  it('keeps date-range filtering (schedule views) scoped to the resolved workspace', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient({ orders: ORDERS }));
    const { GET } = await import('@/app/api/orders/route');

    const res = await GET(get('https://app.test/api/orders?date_from=2026-07-01&date_to=2026-07-31'));
    const body = await res.json();

    expect(body.orders.map((o: Row) => o.id)).toEqual(['o-prod-1']);
  });

  it('keeps unscheduled queries scoped to the resolved workspace', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    const rows: Row[] = [
      { id: 'o-prod-unsched', status: 'pending', service_type: 'cleaning', customer_id: null, customer_name: 'P', customer_email: null, scheduled_date: null, created_at: '2026-07-20T00:00:00.000Z', environment: 'production' },
      { id: 'o-sandbox-unsched', status: 'pending', service_type: 'cleaning', customer_id: null, customer_name: 'S', customer_email: null, scheduled_date: null, created_at: '2026-07-20T00:00:00.000Z', environment: 'sandbox' },
    ];
    createServiceClientSafe.mockReturnValue(makeClient({ orders: rows }));
    const { GET } = await import('@/app/api/orders/route');

    const res = await GET(get('https://app.test/api/orders?unscheduled=true'));
    const body = await res.json();

    expect(body.orders.map((o: Row) => o.id)).toEqual(['o-prod-unsched']);
  });

  it('reports pagination totals matching the selected workspace only', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient({ orders: ORDERS }));
    const { GET } = await import('@/app/api/orders/route');

    const res = await GET(get('https://app.test/api/orders'));
    const body = await res.json();

    expect(body.total).toBe(1);
  });

  it('restricts a customer-role caller to their own production orders, ignoring workspace entirely', async () => {
    getAuthUser.mockResolvedValue(CUSTOMER_USER);
    const ownOrders: Row[] = [
      { id: 'o-mine', status: 'confirmed', service_type: 'cleaning', customer_id: 'customer-1', customer_name: 'Sarah', customer_email: 'sarah@example.com', scheduled_date: '2026-07-25', created_at: '2026-07-20T00:00:00.000Z', environment: 'production' },
      { id: 'o-not-mine', status: 'confirmed', service_type: 'cleaning', customer_id: 'someone-else', customer_name: 'Other', customer_email: 'other@x.com', scheduled_date: '2026-07-25', created_at: '2026-07-20T00:00:00.000Z', environment: 'production' },
    ];
    createServiceClientSafe.mockReturnValue(makeClient({ orders: ownOrders }));
    const { GET } = await import('@/app/api/orders/route');

    const res = await GET(get('https://app.test/api/orders?workspace=sandbox'));
    const body = await res.json();

    expect(body.orders.map((o: Row) => o.id)).toEqual(['o-mine']);
  });

  it('does not leak workspace context between concurrent requests', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient({ orders: ORDERS }));
    const { GET } = await import('@/app/api/orders/route');

    const [prodRes, sandboxRes] = await Promise.all([
      GET(get('https://app.test/api/orders')),
      GET(get('https://app.test/api/orders?workspace=sandbox')),
    ]);
    const [prodBody, sandboxBody] = await Promise.all([prodRes.json(), sandboxRes.json()]);

    expect(prodBody.orders.map((o: Row) => o.id)).toEqual(['o-prod-1']);
    expect(sandboxBody.orders.map((o: Row) => o.id)).toEqual(['o-sandbox-1']);
  });

  it('preserves the existing response shape', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient({ orders: ORDERS }));
    const { GET } = await import('@/app/api/orders/route');

    const res = await GET(get('https://app.test/api/orders'));
    const body = await res.json();

    expect(Object.keys(body).sort()).toEqual(['orders', 'total']);
  });
});

describe('POST /api/orders', () => {
  function post(body: Record<string, unknown>, url = 'https://app.test/api/orders') {
    return new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }) as never;
  }

  const VALID_ORDER_BODY = {
    customer_name: 'Sarah Thompson',
    customer_email: 'sarah@example.com',
    service_type: 'cleaning',
    context: 'home',
    base_price: 200,
    final_price: 200,
  };

  it('stamps a direct admin creation with the active (production) workspace', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient({ orders: [] }));
    const { POST } = await import('@/app/api/orders/route');

    const res = await POST(post(VALID_ORDER_BODY));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.environment).toBe('production');
  });

  it('stamps sandbox only when an admin explicitly requests the sandbox workspace', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient({ orders: [] }));
    const { POST } = await import('@/app/api/orders/route');

    const res = await POST(post(VALID_ORDER_BODY, 'https://app.test/api/orders?workspace=sandbox'));
    const body = await res.json();

    expect(body.environment).toBe('sandbox');
  });

  it('an employee cannot elevate order creation into sandbox', async () => {
    getAuthUser.mockResolvedValue(EMPLOYEE);
    createServiceClientSafe.mockReturnValue(makeClient({ orders: [] }));
    const { POST } = await import('@/app/api/orders/route');

    const res = await POST(post(VALID_ORDER_BODY, 'https://app.test/api/orders?workspace=sandbox'));
    const body = await res.json();

    expect(body.environment).toBe('production');
  });

  it('ignores an environment/workspace value supplied in the request body', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient({ orders: [] }));
    const { POST } = await import('@/app/api/orders/route');

    const res = await POST(post({ ...VALID_ORDER_BODY, environment: 'sandbox' }));
    const body = await res.json();

    expect(body.environment).toBe('production');
  });

  it('rejects a customer_id from a different workspace than the order being created', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    const customers: Row[] = [{ id: 'cust-1', environment: 'sandbox' }];
    createServiceClientSafe.mockReturnValue(makeClient({ orders: [], customers }));
    const { POST } = await import('@/app/api/orders/route');

    const res = await POST(post({ ...VALID_ORDER_BODY, customer_id: 'cust-1' }));
    expect(res.status).toBe(409);
  });

  it('accepts a customer_id from the same workspace as the order being created', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    const customers: Row[] = [{ id: 'cust-1', environment: 'production' }];
    createServiceClientSafe.mockReturnValue(makeClient({ orders: [], customers }));
    const { POST } = await import('@/app/api/orders/route');

    const res = await POST(post({ ...VALID_ORDER_BODY, customer_id: 'cust-1' }));
    expect(res.status).toBe(201);
  });

  it('rejects a quote_id from a different workspace than the order being created', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    const quotes: Row[] = [{ id: 'quote-1', environment: 'production' }];
    createServiceClientSafe.mockReturnValue(makeClient({ orders: [], quotes }));
    const { POST } = await import('@/app/api/orders/route');

    const res = await POST(post({ ...VALID_ORDER_BODY, quote_id: 'quote-1' }, 'https://app.test/api/orders?workspace=sandbox'));
    expect(res.status).toBe(409);
  });

  it('rejects a quote_id / customer_id that does not exist', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient({ orders: [], quotes: [] }));
    const { POST } = await import('@/app/api/orders/route');

    const res = await POST(post({ ...VALID_ORDER_BODY, quote_id: 'nonexistent' }));
    expect(res.status).toBe(400);
  });

  it('detects a simulated propagation mismatch on the inserted row and fails loudly rather than returning a misplaced order', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    // Simulate a broken stamp/trigger: the row that comes back from the
    // insert disagrees with the workspace that was actually requested.
    const client = makeClient({ orders: [] });
    const originalFrom = client.from.getMockImplementation()!;
    client.from.mockImplementation((table: string) => {
      const chain = originalFrom(table);
      if (table === 'orders') {
        const originalSingle = chain.single;
        chain.single = async () => {
          const result = await originalSingle();
          if (result.data) return { data: { ...result.data, environment: 'sandbox' }, error: null };
          return result;
        };
      }
      return chain;
    });
    createServiceClientSafe.mockReturnValue(client);
    const { POST } = await import('@/app/api/orders/route');

    const res = await POST(post(VALID_ORDER_BODY)); // production request
    expect(res.status).toBe(500);
  });

  it('preserves existing validation behaviour', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient({ orders: [] }));
    const { POST } = await import('@/app/api/orders/route');

    const res = await POST(post({ customer_name: 'Sarah' })); // missing service_type/context
    expect(res.status).toBe(400);
  });

  it('rejects a customer-role caller entirely, unrelated to workspace', async () => {
    getAuthUser.mockResolvedValue(CUSTOMER_USER);
    createServiceClientSafe.mockReturnValue(makeClient({ orders: [] }));
    const { POST } = await import('@/app/api/orders/route');

    const res = await POST(post(VALID_ORDER_BODY));
    expect(res.status).toBe(403);
  });

  it('preserves the existing response shape (raw order object, not wrapped)', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient({ orders: [] }));
    const { POST } = await import('@/app/api/orders/route');

    const res = await POST(post(VALID_ORDER_BODY));
    const body = await res.json();

    expect(body.id).toBeDefined();
    expect(body.customer_name).toBe('Sarah Thompson');
  });
});

describe('orders routes source hygiene', () => {
  it('collection route.ts contains no raw environment filtering outside the shared workspace infrastructure', () => {
    const source = readFileSync(path.resolve(__dirname, '../../src/app/api/orders/route.ts'), 'utf8');
    expect(source).not.toMatch(/\.eq\(\s*['"`]environment['"`]/);
    expect(source).not.toMatch(/\.or\(\s*['"`]environment/);
  });
});
