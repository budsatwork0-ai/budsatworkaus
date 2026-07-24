import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { withWorkspaceContext } from '@/lib/workspace/context';
import { createQuoteRepository } from '@/lib/quotes/repository';

interface CallRecord {
  method: string;
  args: unknown[];
}

const CHAINABLE = ['select', 'order', 'limit', 'eq', 'in', 'ilike', 'is', 'insert', 'update'] as const;

function makeChain(result: { data?: unknown; error?: unknown } = {}) {
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
    Promise.resolve({ data: result.data ?? null, error: result.error ?? null }).then(onfulfilled);
  return chain;
}

type Chain = ReturnType<typeof makeChain>;

function makeClient(responses: Record<string, Chain>) {
  const from = vi.fn((table: string) => responses[table] ?? makeChain());
  return { client: { from } as unknown as SupabaseClient<Database>, from };
}

describe('createQuoteRepository — list()', () => {
  it('binds to production by default and scopes reads to it', async () => {
    const chain = makeChain({ data: [{ id: 'q1', status: 'submitted', environment: 'production' }] });
    const { client } = makeClient({ quotes: chain });

    const repo = createQuoteRepository({ client });
    expect(repo.workspace).toBe('production');

    await repo.list();
    const eqCall = chain.calls.find((c) => c.method === 'eq' && c.args[0] === 'environment');
    expect(eqCall?.args).toEqual(['environment', 'production']);
  });

  it('scopes to an ambient sandbox workspace when bound to one', async () => {
    const chain = makeChain({ data: [] });
    const { client } = makeClient({ quotes: chain });

    await withWorkspaceContext('sandbox', async () => {
      const repo = createQuoteRepository({ client });
      expect(repo.workspace).toBe('sandbox');
      await repo.list();
    });

    const eqCall = chain.calls.find((c) => c.method === 'eq' && c.args[0] === 'environment');
    expect(eqCall?.args).toEqual(['environment', 'sandbox']);
  });

  it('preserves the existing single-status filter', async () => {
    const chain = makeChain({ data: [] });
    const { client } = makeClient({ quotes: chain });
    const repo = createQuoteRepository({ client, workspace: 'production' });

    await repo.list({ status: 'finalized' });

    const statusEq = chain.calls.find((c) => c.method === 'eq' && c.args[0] === 'status');
    expect(statusEq?.args).toEqual(['status', 'finalized']);
    expect(chain.calls.some((c) => c.method === 'in')).toBe(false);
  });

  it('preserves the existing multi-status filter (comma-separated → .in)', async () => {
    const chain = makeChain({ data: [] });
    const { client } = makeClient({ quotes: chain });
    const repo = createQuoteRepository({ client, workspace: 'production' });

    await repo.list({ status: 'submitted, in_review' });

    const inCall = chain.calls.find((c) => c.method === 'in');
    expect(inCall?.args).toEqual(['status', ['submitted', 'in_review']]);
  });

  it('treats status=all as no filter, matching current behaviour', async () => {
    const chain = makeChain({ data: [] });
    const { client } = makeClient({ quotes: chain });
    const repo = createQuoteRepository({ client, workspace: 'production' });

    await repo.list({ status: 'all' });

    expect(chain.calls.some((c) => c.method === 'eq' && c.args[0] === 'status')).toBe(false);
    expect(chain.calls.some((c) => c.method === 'in')).toBe(false);
  });

  it('filters by customerId when supplied (the customer-role path)', async () => {
    const chain = makeChain({ data: [] });
    const { client } = makeClient({ quotes: chain });
    const repo = createQuoteRepository({ client, workspace: 'production' });

    await repo.list({ customerId: 'user-1' });

    const customerEq = chain.calls.find((c) => c.method === 'eq' && c.args[0] === 'customer_id');
    expect(customerEq?.args).toEqual(['customer_id', 'user-1']);
  });
});

describe('createQuoteRepository — listOrphanedByEmail()', () => {
  it('scopes the orphan-by-email lookup to the bound workspace', async () => {
    const chain = makeChain({ data: [] });
    const { client } = makeClient({ quotes: chain });
    const repo = createQuoteRepository({ client, workspace: 'production' });

    await repo.listOrphanedByEmail('sarah@example.com');

    expect(chain.calls.find((c) => c.method === 'ilike')?.args).toEqual(['customer_email', 'sarah@example.com']);
    expect(chain.calls.find((c) => c.method === 'is')?.args).toEqual(['customer_id', null]);
    expect(chain.calls.find((c) => c.method === 'eq' && c.args[0] === 'environment')?.args).toEqual([
      'environment',
      'production',
    ]);
  });
});

describe('createQuoteRepository — getById()', () => {
  it('is NOT workspace-scoped by design — it finds a quote purely by id', async () => {
    const chain = makeChain({ data: { id: 'q1', environment: 'sandbox' } });
    const { client } = makeClient({ quotes: chain });

    // Bound to production, but a sandbox row is still returned — the caller
    // (the route) is responsible for authorization once it knows the
    // record's actual workspace.
    const repo = createQuoteRepository({ client, workspace: 'production' });
    const { data } = await repo.getById('q1');

    expect(data).toEqual({ id: 'q1', environment: 'sandbox' });
    expect(chain.calls.some((c) => c.method === 'eq' && c.args[0] === 'environment')).toBe(false);
    expect(chain.calls.find((c) => c.method === 'eq' && c.args[0] === 'id')?.args).toEqual(['id', 'q1']);
  });
});

describe('createQuoteRepository — create()', () => {
  it('stamps the create payload with the bound workspace', async () => {
    const chain = makeChain({ data: { id: 'q1' } });
    const { client } = makeClient({ quotes: chain });
    const repo = createQuoteRepository({ client, workspace: 'sandbox' });

    await repo.create({
      customer_id: null,
      customer_name: 'Sarah Thompson',
      customer_email: 'sarah@example.com',
      customer_phone: null,
      service_type: 'cleaning',
      context: 'home',
      scope: null,
      frequency: 'none',
      analytics_session_id: null,
      total: 220,
      submitted_total: 220,
      reviewed_total: null,
      status: 'submitted',
      payment_status: 'not_requested',
      service_address: null,
      notes: null,
      source: 'website',
      ndis_management_type: null,
      ndis_forward_contact: null,
      ndis_forward_email: null,
      ndis_estimated_hours: null,
      ndis_hourly_rate: null,
    });

    const insertCall = chain.calls.find((c) => c.method === 'insert');
    expect((insertCall?.args[0] as { environment: string }).environment).toBe('sandbox');
  });

  it('cannot have its workspace overridden by a conflicting value on the input', async () => {
    const chain = makeChain({ data: { id: 'q1' } });
    const { client } = makeClient({ quotes: chain });
    const repo = createQuoteRepository({ client, workspace: 'production' });

    await repo.create({
      customer_id: null,
      customer_name: 'Sarah',
      customer_email: null,
      customer_phone: null,
      service_type: 'cleaning',
      context: 'home',
      scope: null,
      frequency: 'none',
      analytics_session_id: null,
      total: 100,
      submitted_total: 100,
      reviewed_total: null,
      status: 'submitted',
      payment_status: 'not_requested',
      service_address: null,
      notes: null,
      source: 'website',
      ndis_management_type: null,
      ndis_forward_contact: null,
      ndis_forward_email: null,
      ndis_estimated_hours: null,
      ndis_hourly_rate: null,
      // @ts-expect-error — simulating an untrusted/extra field arriving despite not being part of CreateQuoteInput
      environment: 'sandbox',
    });

    const insertCall = chain.calls.find((c) => c.method === 'insert');
    expect((insertCall?.args[0] as { environment: string }).environment).toBe('production');
  });
});

describe('createQuoteRepository — update()', () => {
  it('updates by id only, with no workspace re-check', async () => {
    const chain = makeChain({ data: { id: 'q1', status: 'finalized' } });
    const { client } = makeClient({ quotes: chain });
    const repo = createQuoteRepository({ client, workspace: 'production' });

    await repo.update('q1', { status: 'finalized' });

    expect(chain.calls.find((c) => c.method === 'update')?.args).toEqual([{ status: 'finalized' }]);
    expect(chain.calls.find((c) => c.method === 'eq')?.args).toEqual(['id', 'q1']);
    expect(chain.calls.some((c) => c.args[0] === 'environment')).toBe(false);
  });
});
