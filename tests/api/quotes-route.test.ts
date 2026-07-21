import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const getAuthUser = vi.fn();
const createServiceClientSafe = vi.fn();
const recordAnalyticsEvent = vi.fn();
const getResendClient = vi.fn(() => null);

vi.mock('@/lib/auth', () => ({ getAuthUser }));
vi.mock('@/lib/supabase/server', () => ({ createServiceClientSafe }));
vi.mock('@/lib/analytics/server', () => ({ recordAnalyticsEvent }));
vi.mock('@/lib/email/resend', () => ({ getResendClient, FROM_ADDRESS: 'admin@budsatwork.com' }));

const ADMIN = { id: 'admin-1', role: 'admin', email: 'admin@test.local' };
const EMPLOYEE = { id: 'employee-1', role: 'employee', email: 'employee@test.local' };
const CUSTOMER_USER = { id: 'customer-1', role: 'customer', email: 'sarah@example.com' };
// Must be UUID-shaped: the route validates lead_id against a UUID regex before using it.
const LEAD_UUID = '11111111-1111-1111-1111-111111111111';

interface Row {
  [key: string]: unknown;
}

/** Generic per-table fake query: `.eq()`/`.in()`/`.ilike()`/`.is()` narrow an
 * in-memory row set; `.insert()`/`.update()` capture the payload and echo it
 * back (merged onto the matched row for update) from `.single()`. `calls` is
 * shared across every `.from(table)` invocation for the same table (each
 * call still gets its own fresh `filtered` row set, matching real Supabase
 * semantics) so a test can inspect the full sequence of calls made against
 * a table even when the route calls `.from()` on it more than once. */
function makeTableChain(rows: Row[], calls: Array<{ method: string; args: unknown[] }> = []) {
  let filtered = rows;
  let inserted: Row | null = null;
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
  chain.in = (column: string, values: unknown[]) => {
    calls.push({ method: 'in', args: [column, values] });
    filtered = filtered.filter((row) => values.includes(row[column]));
    return chain;
  };
  chain.ilike = (column: string, pattern: string) => {
    calls.push({ method: 'ilike', args: [column, pattern] });
    const needle = pattern.replace(/%/g, '').toLowerCase();
    filtered = filtered.filter((row) => String(row[column] ?? '').toLowerCase() === needle);
    return chain;
  };
  chain.is = (column: string, value: unknown) => {
    calls.push({ method: 'is', args: [column, value] });
    filtered = filtered.filter((row) => (row[column] ?? null) === value);
    return chain;
  };
  chain.insert = (payload: Row | Row[]) => {
    calls.push({ method: 'insert', args: [payload] });
    const row = Array.isArray(payload) ? payload[0] : payload;
    // Real Postgres generates the id by default; simulate that here so
    // downstream code that reads back `data.id` after an insert works.
    inserted = { id: `generated-${Math.random().toString(36).slice(2)}`, ...row };
    return chain;
  };
  chain.update = (patch: Row) => {
    calls.push({ method: 'update', args: [patch] });
    updatePatch = patch;
    return chain;
  };
  chain.single = async () => {
    if (inserted) return { data: inserted, error: null };
    if (updatePatch) return { data: { ...filtered[0], ...updatePatch }, error: null };
    return { data: filtered[0] ?? null, error: null };
  };
  chain.maybeSingle = async () => ({ data: filtered[0] ?? null, error: null });
  chain.then = (onfulfilled: (value: unknown) => unknown) =>
    Promise.resolve({ data: filtered, error: null }).then(onfulfilled);
  return chain;
}

function makeClient(rowsByTable: Record<string, Row[]>) {
  const callsByTable: Record<string, Array<{ method: string; args: unknown[] }>> = {};
  const from = vi.fn((table: string) => {
    callsByTable[table] = callsByTable[table] ?? [];
    return makeTableChain(rowsByTable[table] ?? [], callsByTable[table]);
  });
  const rpc = vi.fn(async () => ({ data: null, error: null }));
  return { from, rpc, callsByTable };
}

const QUOTES: Row[] = [
  { id: 'q-prod-1', status: 'submitted', customer_id: null, customer_email: 'prod@x.com', environment: 'production' },
  { id: 'q-sandbox-1', status: 'submitted', customer_id: null, customer_email: 'sandbox@x.com', environment: 'sandbox' },
];

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  getResendClient.mockReturnValue(null);
});

describe('GET /api/quotes', () => {
  it('defaults to production and excludes sandbox quotes', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient({ quotes: QUOTES }));
    const { GET } = await import('@/app/api/quotes/route');

    const res = await GET(new Request('https://app.test/api/quotes') as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.quotes).toHaveLength(1);
    expect(body.quotes[0].id).toBe('q-prod-1');
  });

  it('returns sandbox quotes for an authorized admin request', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient({ quotes: QUOTES }));
    const { GET } = await import('@/app/api/quotes/route');

    const res = await GET(new Request('https://app.test/api/quotes?workspace=sandbox') as never);
    const body = await res.json();

    expect(body.quotes).toHaveLength(1);
    expect(body.quotes[0].id).toBe('q-sandbox-1');
  });

  it('forces a non-admin-requested sandbox workspace back to production', async () => {
    getAuthUser.mockResolvedValue(EMPLOYEE);
    createServiceClientSafe.mockReturnValue(makeClient({ quotes: QUOTES }));
    const { GET } = await import('@/app/api/quotes/route');

    const res = await GET(new Request('https://app.test/api/quotes?workspace=sandbox') as never);
    const body = await res.json();

    expect(body.quotes).toHaveLength(1);
    expect(body.quotes[0].id).toBe('q-prod-1');
  });

  it('resolves an invalid workspace value safely to production', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient({ quotes: QUOTES }));
    const { GET } = await import('@/app/api/quotes/route');

    const res = await GET(new Request('https://app.test/api/quotes?workspace=not-real') as never);
    const body = await res.json();

    expect(body.quotes).toHaveLength(1);
    expect(body.quotes[0].id).toBe('q-prod-1');
  });

  it('preserves status filtering, limit, and the response shape within the resolved workspace', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    const client = makeClient({ quotes: QUOTES });
    createServiceClientSafe.mockReturnValue(client);
    const { GET } = await import('@/app/api/quotes/route');

    await GET(new Request('https://app.test/api/quotes?status=submitted&limit=10') as never);

    const chain = client.from.mock.results[0].value;
    expect(chain.calls.find((c: { method: string }) => c.method === 'limit')?.args[0]).toBe(10);
    expect(chain.calls.find((c: { method: string }) => c.method === 'eq' && c.args[0] === 'status')?.args).toEqual([
      'status',
      'submitted',
    ]);
    expect(chain.calls.find((c: { method: string }) => c.method === 'eq' && c.args[0] === 'environment')?.args).toEqual(
      ['environment', 'production']
    );
  });

  it('preserves the existing response shape', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient({ quotes: QUOTES }));
    const { GET } = await import('@/app/api/quotes/route');

    const res = await GET(new Request('https://app.test/api/quotes') as never);
    const body = await res.json();

    expect(Object.keys(body)).toEqual(['quotes']);
  });

  it('restricts a customer-role caller to their own production quotes, ignoring workspace entirely', async () => {
    getAuthUser.mockResolvedValue(CUSTOMER_USER);
    const ownQuotes: Row[] = [
      { id: 'q-mine', status: 'submitted', customer_id: 'customer-1', customer_email: 'sarah@example.com', environment: 'production' },
      { id: 'q-not-mine', status: 'submitted', customer_id: 'someone-else', customer_email: 'other@x.com', environment: 'production' },
    ];
    createServiceClientSafe.mockReturnValue(makeClient({ quotes: ownQuotes }));
    const { GET } = await import('@/app/api/quotes/route');

    const res = await GET(new Request('https://app.test/api/quotes?workspace=sandbox') as never);
    const body = await res.json();

    expect(body.quotes.map((q: Row) => q.id)).toEqual(['q-mine']);
  });

  it('does not leak workspace context between concurrent requests', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient({ quotes: QUOTES }));
    const { GET } = await import('@/app/api/quotes/route');

    const [prodRes, sandboxRes] = await Promise.all([
      GET(new Request('https://app.test/api/quotes') as never),
      GET(new Request('https://app.test/api/quotes?workspace=sandbox') as never),
    ]);
    const [prodBody, sandboxBody] = await Promise.all([prodRes.json(), sandboxRes.json()]);

    expect(prodBody.quotes.map((q: Row) => q.id)).toEqual(['q-prod-1']);
    expect(sandboxBody.quotes.map((q: Row) => q.id)).toEqual(['q-sandbox-1']);
  });
});

describe('POST /api/quotes', () => {
  function post(body: Record<string, unknown>, url = 'https://app.test/api/quotes') {
    return new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }) as never;
  }

  const VALID_QUOTE_BODY = {
    customer_name: 'Sarah Thompson',
    customer_email: 'sarah@example.com',
    service_type: 'cleaning',
    context: 'home',
    total: 220,
  };

  it('stamps a public (anonymous) submission with production, regardless of any workspace param', async () => {
    getAuthUser.mockResolvedValue(null);
    createServiceClientSafe.mockReturnValue(makeClient({ quotes: [] }));
    const { POST } = await import('@/app/api/quotes/route');

    const res = await POST(post(VALID_QUOTE_BODY, 'https://app.test/api/quotes?workspace=sandbox'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.quote.environment).toBe('production');
  });

  it('ignores an environment/workspace value supplied in the request body', async () => {
    getAuthUser.mockResolvedValue(null);
    createServiceClientSafe.mockReturnValue(makeClient({ quotes: [] }));
    const { POST } = await import('@/app/api/quotes/route');

    const res = await POST(post({ ...VALID_QUOTE_BODY, environment: 'sandbox' }));
    const body = await res.json();

    expect(body.quote.environment).toBe('production');
  });

  it('stamps sandbox only when an admin explicitly requests the sandbox workspace', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(makeClient({ quotes: [] }));
    const { POST } = await import('@/app/api/quotes/route');

    const res = await POST(post(VALID_QUOTE_BODY, 'https://app.test/api/quotes?workspace=sandbox'));
    const body = await res.json();

    expect(body.quote.environment).toBe('sandbox');
  });

  it('an employee cannot elevate quote creation into sandbox', async () => {
    getAuthUser.mockResolvedValue(EMPLOYEE);
    createServiceClientSafe.mockReturnValue(makeClient({ quotes: [] }));
    const { POST } = await import('@/app/api/quotes/route');

    const res = await POST(post(VALID_QUOTE_BODY, 'https://app.test/api/quotes?workspace=sandbox'));
    const body = await res.json();

    expect(body.quote.environment).toBe('production');
  });

  it('links a compatible (same-workspace) lead to the new quote', async () => {
    getAuthUser.mockResolvedValue(null);
    const leads: Row[] = [{ id: LEAD_UUID, environment: 'production', quote_id: null, response_status: 'awaiting_response' }];
    const client = makeClient({ quotes: [], leads });
    createServiceClientSafe.mockReturnValue(client);
    const { POST } = await import('@/app/api/quotes/route');

    await POST(post({ ...VALID_QUOTE_BODY, lead_id: LEAD_UUID }));
    // Lead linking is fire-and-forget; flush microtasks so the async IIFE completes.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const updateCall = client.callsByTable.leads?.find((c) => c.method === 'update');
    expect(updateCall?.args[0]).toMatchObject({ quote_id: expect.any(String), response_status: 'quoted' });
  });

  it('skips (does not force) linking a workspace-incompatible lead', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    const leads: Row[] = [{ id: LEAD_UUID, environment: 'sandbox', quote_id: null }];
    const client = makeClient({ quotes: [], leads });
    createServiceClientSafe.mockReturnValue(client);
    const { POST } = await import('@/app/api/quotes/route');

    // Admin creates a *production* quote (no ?workspace=sandbox) referencing a sandbox lead.
    await POST(post({ ...VALID_QUOTE_BODY, lead_id: LEAD_UUID }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(client.callsByTable.leads?.some((c) => c.method === 'update')).toBe(false);
  });

  it('preserves existing validation behaviour', async () => {
    getAuthUser.mockResolvedValue(null);
    createServiceClientSafe.mockReturnValue(makeClient({ quotes: [] }));
    const { POST } = await import('@/app/api/quotes/route');

    const res = await POST(post({ customer_name: 'Sarah' })); // missing service_type/context
    expect(res.status).toBe(400);
  });
});

describe('quotes routes source hygiene', () => {
  it('route.ts no longer references the raw environment column or ad hoc filters', () => {
    const source = readFileSync(path.resolve(__dirname, '../../src/app/api/quotes/route.ts'), 'utf8');
    expect(source).not.toMatch(/\.eq\(\s*['"`]environment['"`]/);
    expect(source).not.toMatch(/\.or\(\s*['"`]environment/);
  });
});
