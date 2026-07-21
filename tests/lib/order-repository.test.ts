import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { withWorkspaceContext } from '@/lib/workspace/context';
import { createOrderRepository } from '@/lib/orders/repository';

interface CallRecord {
  method: string;
  args: unknown[];
}

const CHAINABLE = ['select', 'order', 'range', 'eq', 'gte', 'lte', 'is', 'not', 'or', 'insert', 'update'] as const;

function makeChain(result: { data?: unknown; count?: number | null; error?: unknown } = {}) {
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
    Promise.resolve({ data: result.data ?? null, count: result.count ?? null, error: result.error ?? null }).then(
      onfulfilled
    );
  return chain;
}

type Chain = ReturnType<typeof makeChain>;

function makeClient(responses: Record<string, Chain>) {
  const from = vi.fn((table: string) => responses[table] ?? makeChain());
  return { client: { from } as unknown as SupabaseClient<Database>, from };
}

describe('createOrderRepository — list()', () => {
  it('binds to production by default and scopes reads to it', async () => {
    const chain = makeChain({ data: [{ id: 'o1', status: 'pending', environment: 'production' }], count: 1 });
    const { client } = makeClient({ orders: chain });

    const repo = createOrderRepository({ client });
    expect(repo.workspace).toBe('production');

    await repo.list();
    const eqCall = chain.calls.find((c: CallRecord) => c.method === 'eq' && c.args[0] === 'environment');
    expect(eqCall?.args).toEqual(['environment', 'production']);
  });

  it('scopes to an ambient sandbox workspace when bound to one', async () => {
    const chain = makeChain({ data: [], count: 0 });
    const { client } = makeClient({ orders: chain });

    await withWorkspaceContext('sandbox', async () => {
      const repo = createOrderRepository({ client });
      expect(repo.workspace).toBe('sandbox');
      await repo.list();
    });

    const eqCall = chain.calls.find((c: CallRecord) => c.method === 'eq' && c.args[0] === 'environment');
    expect(eqCall?.args).toEqual(['environment', 'sandbox']);
  });

  it('preserves the existing status filter, ignoring status=all', async () => {
    const chain = makeChain({ data: [], count: 0 });
    const { client } = makeClient({ orders: chain });
    const repo = createOrderRepository({ client, workspace: 'production' });

    await repo.list({ status: 'confirmed' });
    expect(chain.calls.find((c: CallRecord) => c.method === 'eq' && c.args[0] === 'status')?.args).toEqual([
      'status',
      'confirmed',
    ]);

    const chain2 = makeChain({ data: [], count: 0 });
    const { client: client2 } = makeClient({ orders: chain2 });
    const repo2 = createOrderRepository({ client: client2, workspace: 'production' });
    await repo2.list({ status: 'all' });
    expect(chain2.calls.some((c: CallRecord) => c.method === 'eq' && c.args[0] === 'status')).toBe(false);
  });

  it('preserves service_type filtering', async () => {
    const chain = makeChain({ data: [], count: 0 });
    const { client } = makeClient({ orders: chain });
    const repo = createOrderRepository({ client, workspace: 'production' });

    await repo.list({ serviceType: 'cleaning' });
    expect(chain.calls.find((c: CallRecord) => c.method === 'eq' && c.args[0] === 'service_type')?.args).toEqual([
      'service_type',
      'cleaning',
    ]);
  });

  it('preserves search (customer_name/customer_email ilike or)', async () => {
    const chain = makeChain({ data: [], count: 0 });
    const { client } = makeClient({ orders: chain });
    const repo = createOrderRepository({ client, workspace: 'production' });

    await repo.list({ search: 'sarah' });
    const orCall = chain.calls.find((c: CallRecord) => c.method === 'or');
    expect(orCall?.args[0]).toContain('sarah');
  });

  it('preserves date-range filtering (scheduled_date gte/lte)', async () => {
    const chain = makeChain({ data: [], count: 0 });
    const { client } = makeClient({ orders: chain });
    const repo = createOrderRepository({ client, workspace: 'production' });

    await repo.list({ dateFrom: '2026-07-01', dateTo: '2026-07-31' });
    expect(chain.calls.find((c: CallRecord) => c.method === 'gte')?.args).toEqual(['scheduled_date', '2026-07-01']);
    expect(chain.calls.find((c: CallRecord) => c.method === 'lte')?.args).toEqual(['scheduled_date', '2026-07-31']);
  });

  it('preserves unscheduled semantics (replaces status/date filters entirely)', async () => {
    const chain = makeChain({ data: [], count: 0 });
    const { client } = makeClient({ orders: chain });
    const repo = createOrderRepository({ client, workspace: 'production' });

    await repo.list({ unscheduled: true, status: 'confirmed', dateFrom: '2026-07-01' });

    expect(chain.calls.find((c: CallRecord) => c.method === 'is')?.args).toEqual(['scheduled_date', null]);
    expect(chain.calls.some((c: CallRecord) => c.method === 'gte')).toBe(false);
    expect(chain.calls.some((c: CallRecord) => c.method === 'eq' && c.args[0] === 'status')).toBe(false);
  });

  it('preserves customerId ownership filtering', async () => {
    const chain = makeChain({ data: [], count: 0 });
    const { client } = makeClient({ orders: chain });
    const repo = createOrderRepository({ client, workspace: 'production' });

    await repo.list({ customerId: 'user-1' });
    expect(chain.calls.find((c: CallRecord) => c.method === 'eq' && c.args[0] === 'customer_id')?.args).toEqual([
      'customer_id',
      'user-1',
    ]);
  });

  it('preserves pagination (limit/offset → range)', async () => {
    const chain = makeChain({ data: [], count: 42 });
    const { client } = makeClient({ orders: chain });
    const repo = createOrderRepository({ client, workspace: 'production' });

    const result = await repo.list({ limit: 20, offset: 40 });
    expect(chain.calls.find((c: CallRecord) => c.method === 'range')?.args).toEqual([40, 59]);
    expect(result.count).toBe(42);
  });
});

describe('createOrderRepository — getById()', () => {
  it('is NOT workspace-scoped by design — it finds an order purely by id', async () => {
    const chain = makeChain({ data: { id: 'o1', environment: 'sandbox' } });
    const { client } = makeClient({ orders: chain });

    const repo = createOrderRepository({ client, workspace: 'production' });
    const { data } = await repo.getById('o1');

    expect(data).toEqual({ id: 'o1', environment: 'sandbox' });
    expect(chain.calls.some((c: CallRecord) => c.method === 'eq' && c.args[0] === 'environment')).toBe(false);
    expect(chain.calls.find((c: CallRecord) => c.method === 'eq' && c.args[0] === 'id')?.args).toEqual(['id', 'o1']);
  });
});

describe('createOrderRepository — create()', () => {
  const BASE_INPUT = {
    quote_id: null,
    customer_id: null,
    customer_name: 'Sarah Thompson',
    customer_email: 'sarah@example.com',
    customer_phone: null,
    service_type: 'cleaning',
    context: 'home',
    scope: null,
    frequency: 'none',
    analytics_session_id: null,
    base_price: 200,
    discount_percent: 0,
    final_price: 200,
    scheduled_date: null,
    scheduled_time: null,
    status: 'pending',
    notes: null,
  };

  it('stamps the create payload with the bound workspace', async () => {
    const chain = makeChain({ data: { id: 'o1' } });
    const { client } = makeClient({ orders: chain });
    const repo = createOrderRepository({ client, workspace: 'sandbox' });

    await repo.create(BASE_INPUT);

    const insertCall = chain.calls.find((c: CallRecord) => c.method === 'insert');
    expect((insertCall?.args[0] as { environment: string }).environment).toBe('sandbox');
  });

  it('cannot have its workspace overridden by a conflicting value on the input', async () => {
    const chain = makeChain({ data: { id: 'o1' } });
    const { client } = makeClient({ orders: chain });
    const repo = createOrderRepository({ client, workspace: 'production' });

    await repo.create({
      ...BASE_INPUT,
      // @ts-expect-error — simulating an untrusted/extra field arriving despite not being part of CreateOrderInput
      environment: 'sandbox',
    });

    const insertCall = chain.calls.find((c: CallRecord) => c.method === 'insert');
    expect((insertCall?.args[0] as { environment: string }).environment).toBe('production');
  });
});

describe('createOrderRepository — update()', () => {
  it('updates by id only, with no workspace re-check', async () => {
    const chain = makeChain({ data: { id: 'o1', status: 'confirmed' } });
    const { client } = makeClient({ orders: chain });
    const repo = createOrderRepository({ client, workspace: 'production' });

    await repo.update('o1', { status: 'confirmed' });

    expect(chain.calls.find((c: CallRecord) => c.method === 'update')?.args).toEqual([{ status: 'confirmed' }]);
    expect(chain.calls.find((c: CallRecord) => c.method === 'eq')?.args).toEqual(['id', 'o1']);
    expect(chain.calls.some((c: CallRecord) => c.args[0] === 'environment')).toBe(false);
  });
});
