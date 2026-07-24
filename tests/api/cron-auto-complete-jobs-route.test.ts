import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireCronAuth = vi.fn(() => null);
const createServiceClientSafe = vi.fn();
const getAutomationSettings = vi.fn(async () => ({ autoCompleteJobs: true }));
const getRelativeDateString = vi.fn(() => '2026-07-20');

vi.mock('@/lib/cron/auth', () => ({ requireCronAuth }));
vi.mock('@/lib/supabase/server', () => ({ createServiceClientSafe }));
vi.mock('@/lib/automations', () => ({ getAutomationSettings, getRelativeDateString }));

interface Row {
  [key: string]: unknown;
}

/** Fresh per-`.from()`-call chain (matching the established convention in
 * tests/api/quotes-route.test.ts) — `orders` is queried twice in this route
 * (the main auto-completion query, then the stale-detection query), and
 * each call must get its own independent filtered row set while still
 * recording every call into a shared, inspectable `calls` array. */
function makeTableChain(rows: Row[], calls: Array<{ method: string; args: unknown[] }> = []) {
  let filtered = rows;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = { calls };
  for (const method of ['select', 'limit'] as const) {
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
  chain.lte = (column: string, value: unknown) => {
    calls.push({ method: 'lte', args: [column, value] });
    filtered = filtered.filter((row) => String(row[column] ?? '') <= String(value));
    return chain;
  };
  chain.lt = (column: string, value: unknown) => {
    calls.push({ method: 'lt', args: [column, value] });
    filtered = filtered.filter((row) => String(row[column] ?? '') < String(value));
    return chain;
  };
  chain.is = (column: string, value: unknown) => {
    calls.push({ method: 'is', args: [column, value] });
    filtered = filtered.filter((row) => (row[column] ?? null) === value);
    return chain;
  };
  chain.neq = (...args: unknown[]) => {
    calls.push({ method: 'neq', args });
    return chain;
  };
  chain.update = (patch: Row) => {
    calls.push({ method: 'update', args: [patch] });
    return chain;
  };
  chain.insert = (payload: Row) => {
    calls.push({ method: 'insert', args: [payload] });
    return Promise.resolve({ data: null, error: null });
  };
  chain.maybeSingle = async () => ({ data: null, error: null });
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
  return { from, callsByTable };
}

function req() {
  return new Request('https://app.test/api/cron/auto-complete-jobs') as never;
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  requireCronAuth.mockReturnValue(null);
  getAutomationSettings.mockResolvedValue({ autoCompleteJobs: true });
  getRelativeDateString.mockReturnValue('2026-07-20');
});

describe('GET /api/cron/auto-complete-jobs — production scoping', () => {
  it('scopes the main auto-completion query to production only', async () => {
    const orders: Row[] = [
      { id: 'o-prod', status: 'confirmed', scheduled_date: '2026-07-18', environment: 'production', job_assignments: [] },
      { id: 'o-sandbox', status: 'confirmed', scheduled_date: '2026-07-18', environment: 'sandbox', job_assignments: [] },
    ];
    const client = makeClient({ orders });
    createServiceClientSafe.mockReturnValue(client);
    const { GET } = await import('@/app/api/cron/auto-complete-jobs/route');

    await GET(req());

    // First call to .from('orders') is the main auto-completion query.
    const mainQueryCalls = client.from.mock.results[0].value.calls as Array<{ method: string; args: unknown[] }>;
    const eqCall = mainQueryCalls.find((c) => c.method === 'eq' && c.args[0] === 'environment');
    expect(eqCall?.args).toEqual(['environment', 'production']);
  });

  it('never completes a sandbox order via this cron', async () => {
    const orders: Row[] = [
      {
        id: 'o-sandbox',
        status: 'confirmed',
        scheduled_date: '2026-07-18',
        environment: 'sandbox',
        job_assignments: [{ id: 'ja-1', status: 'accepted' }],
      },
    ];
    const client = makeClient({ orders });
    createServiceClientSafe.mockReturnValue(client);
    const { GET } = await import('@/app/api/cron/auto-complete-jobs/route');

    const res = await GET(req());
    const body = await res.json();

    // The sandbox row is filtered out by the environment scope before the
    // completion loop ever sees it, so it's neither completed nor skipped.
    expect(body.completed).toBe(0);
    expect(body.skipped).toBe(0);
  });

  it('still auto-completes an eligible production order', async () => {
    const orders: Row[] = [
      {
        id: 'o-prod',
        status: 'confirmed',
        scheduled_date: '2026-07-18',
        environment: 'production',
        job_assignments: [{ id: 'ja-1', status: 'accepted' }],
      },
    ];
    const client = makeClient({ orders });
    createServiceClientSafe.mockReturnValue(client);
    const { GET } = await import('@/app/api/cron/auto-complete-jobs/route');

    const res = await GET(req());
    const body = await res.json();

    expect(body.completed).toBe(1);
  });
});
