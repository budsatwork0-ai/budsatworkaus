import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { withWorkspaceContext } from '@/lib/workspace/context';
import { createCustomerRepository } from '@/lib/customers/repository';

interface CallRecord {
  method: string;
  args: unknown[];
}

const CHAINABLE = ['select', 'order', 'limit', 'or', 'eq', 'gte', 'not', 'insert'] as const;

function makeChain(result: { data?: unknown; error?: unknown; count?: number | null } = {}) {
  const calls: CallRecord[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = { calls };
  for (const method of CHAINABLE) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return chain;
    };
  }
  chain.single = async () => ({ data: result.data ?? null, error: result.error ?? null });
  chain.maybeSingle = async () => ({ data: result.data ?? null, error: result.error ?? null });
  chain.then = (onfulfilled: (v: unknown) => unknown) =>
    Promise.resolve({
      data: result.data ?? null,
      error: result.error ?? null,
      count: result.count ?? null,
    }).then(onfulfilled);
  return chain;
}

type Chain = ReturnType<typeof makeChain>;

function makeClient(responses: Record<string, Chain | Chain[]>) {
  const callCounts: Record<string, number> = {};
  const from = vi.fn((table: string) => {
    const response = responses[table];
    if (Array.isArray(response)) {
      const index = callCounts[table] ?? 0;
      callCounts[table] = index + 1;
      return response[index] ?? response[response.length - 1];
    }
    return response ?? makeChain();
  });
  return { client: { from } as unknown as SupabaseClient<Database>, from };
}

describe('createCustomerRepository — list()', () => {
  it('binds to production by default (no workspace supplied)', async () => {
    const customersChain = makeChain({ data: [{ id: '1', full_name: 'Sarah' }] });
    const { client } = makeClient({ customers: customersChain });

    const repo = createCustomerRepository({ client });
    expect(repo.workspace).toBe('production');

    await repo.list();
    const eqCall = customersChain.calls.find((c: CallRecord) => c.method === 'eq');
    expect(eqCall?.args).toEqual(['environment', 'production']);
  });

  it('scopes reads to an explicitly ambient sandbox workspace', async () => {
    const customersChain = makeChain({ data: [] });
    const { client } = makeClient({ customers: customersChain });

    await withWorkspaceContext('sandbox', async () => {
      const repo = createCustomerRepository({ client });
      expect(repo.workspace).toBe('sandbox');
      await repo.list();
    });

    const eqCall = customersChain.calls.find((c: CallRecord) => c.method === 'eq');
    expect(eqCall?.args).toEqual(['environment', 'sandbox']);
  });

  it('preserves the existing search filter and pagination behaviour', async () => {
    const customersChain = makeChain({ data: [] });
    const { client } = makeClient({ customers: customersChain });

    const repo = createCustomerRepository({ client, workspace: 'production' });
    await repo.list({ search: 'sarah', limit: 25 });

    const calls = customersChain.calls.map((c: CallRecord) => c.method);
    expect(calls).toEqual(['select', 'order', 'limit', 'or', 'eq']);

    const orCall = customersChain.calls.find((c: CallRecord) => c.method === 'or');
    expect(orCall?.args).toEqual(['full_name.ilike.%sarah%,email.ilike.%sarah%,phone.ilike.%sarah%']);

    const limitCall = customersChain.calls.find((c: CallRecord) => c.method === 'limit');
    expect(limitCall?.args).toEqual([25]);
  });

  it('skips the search filter entirely when no search term is given', async () => {
    const customersChain = makeChain({ data: [] });
    const { client } = makeClient({ customers: customersChain });

    const repo = createCustomerRepository({ client, workspace: 'production' });
    await repo.list();

    expect(customersChain.calls.map((c: CallRecord) => c.method)).toEqual(['select', 'order', 'limit', 'eq']);
  });

  it('surfaces a query error as a plain message', async () => {
    const customersChain = makeChain({ error: { message: 'boom' } });
    const { client } = makeClient({ customers: customersChain });

    const repo = createCustomerRepository({ client, workspace: 'production' });
    const result = await repo.list();
    expect(result.error).toBe('boom');
  });
});

describe('createCustomerRepository — create()', () => {
  it('stamps the create payload with the bound workspace', async () => {
    const customersChain = makeChain({ data: { id: '1', full_name: 'Sarah' } });
    const { client } = makeClient({ customers: customersChain });

    const repo = createCustomerRepository({ client, workspace: 'sandbox' });
    await repo.create({ full_name: 'Sarah Thompson' });

    const insertCall = customersChain.calls.find((c: CallRecord) => c.method === 'insert');
    expect(insertCall?.args[0]).toMatchObject({ full_name: 'Sarah Thompson', environment: 'sandbox' });
  });

  it('cannot have its workspace overridden by a conflicting value on the input', async () => {
    const customersChain = makeChain({ data: { id: '1' } });
    const { client } = makeClient({ customers: customersChain });

    const repo = createCustomerRepository({ client, workspace: 'production' });
    // `environment` isn't part of CreateCustomerInput, but stampWorkspace()
    // discards any same-named key regardless of how it arrived.
    await repo.create({ full_name: 'Sarah', ...({ environment: 'sandbox' } as Record<string, unknown>) });

    const insertCall = customersChain.calls.find((c: CallRecord) => c.method === 'insert');
    expect((insertCall?.args[0] as { environment: string }).environment).toBe('production');
  });
});

describe('createCustomerRepository — getStats()', () => {
  it('scopes the customer count and both order reads to the bound workspace', async () => {
    const customersCountChain = makeChain({ count: 3 });
    const monthlyOrdersChain = makeChain({ data: [{ customer_id: 'a' }, { customer_id: 'a' }, { customer_id: 'b' }] });
    const completedOrdersChain = makeChain({ data: [{ final_price: 100 }, { final_price: 50 }] });
    const { client } = makeClient({
      customers: customersCountChain,
      orders: [monthlyOrdersChain, completedOrdersChain],
    });

    const repo = createCustomerRepository({ client, workspace: 'production' });
    const { data, error } = await repo.getStats();

    expect(error).toBeNull();
    expect(data).toEqual({
      totalCustomers: 3,
      activeThisMonth: 2, // distinct customer_id values: 'a', 'b'
      totalRevenue: 150,
      avgOrderValue: 75,
    });

    for (const chain of [customersCountChain, monthlyOrdersChain, completedOrdersChain]) {
      const eqCall = chain.calls.find((c: CallRecord) => c.method === 'eq' && c.args[0] === 'environment');
      expect(eqCall?.args).toEqual(['environment', 'production']);
    }
  });

  it('preserves the existing zero-orders average behaviour', async () => {
    const { client } = makeClient({
      customers: makeChain({ count: 0 }),
      orders: [makeChain({ data: [] }), makeChain({ data: [] })],
    });

    const repo = createCustomerRepository({ client, workspace: 'production' });
    const { data } = await repo.getStats();
    expect(data.avgOrderValue).toBe(0);
    expect(data.totalRevenue).toBe(0);
    expect(data.activeThisMonth).toBe(0);
  });
});
