import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { createCrewRepository } from '@/lib/crew/repository';

type Result = { data?: unknown; count?: number | null; error?: { message: string } | null };
type Call = { method: string; args: unknown[] };

function chain(result: Result = {}) {
  const calls: Call[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value: any = { calls };
  for (const method of ['select', 'eq', 'in', 'order', 'range']) {
    value[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return value;
    };
  }
  value.single = async () => ({ data: result.data ?? null, error: result.error ?? null });
  value.then = (resolve: (input: unknown) => unknown) => Promise.resolve({
    data: result.data ?? null,
    count: result.count ?? null,
    error: result.error ?? null,
  }).then(resolve);
  return value;
}

function clientFor(...chains: ReturnType<typeof chain>[]) {
  let index = 0;
  const from = vi.fn(() => chains[index++] ?? chain());
  return { client: { from } as unknown as SupabaseClient<Database>, from };
}

describe('createCrewRepository collection scoping', () => {
  it.each([
    ['available', (repo: ReturnType<typeof createCrewRepository>) => repo.listAvailable('employee-1')],
    ['my jobs', (repo: ReturnType<typeof createCrewRepository>) => repo.listMine('employee-1', ['accepted'])],
    ['earnings', (repo: ReturnType<typeof createCrewRepository>) => repo.listCompletedForEarnings('employee-1')],
    ['pipeline', (repo: ReturnType<typeof createCrewRepository>) => repo.listForPipeline(['employee-1'])],
  ])('scopes %s to production parent orders with an inner relationship', async (_label, run) => {
    const assignments = chain({ data: [], count: 0 });
    const { client } = clientFor(assignments);
    await run(createCrewRepository({ client }));

    expect(assignments.calls.find((call) => call.method === 'select')?.args[0]).toContain('orders!inner');
    expect(assignments.calls).toContainEqual({ method: 'eq', args: ['orders.environment', 'production'] });
  });
});

describe('createCrewRepository ID-first authorization', () => {
  it('fetches minimal owned assignment fields before resolving its parent order', async () => {
    const assignment = chain({ data: { id: 'a1', order_id: 'o1', employee_id: 'e1', status: 'available' } });
    const order = chain({ data: { id: 'o1', environment: 'production' } });
    const { client, from } = clientFor(assignment, order);

    const result = await createCrewRepository({ client }).getOwnedAssignmentContext('a1', 'e1');

    expect(result.data?.order.id).toBe('o1');
    expect(from.mock.calls.map(([table]) => table)).toEqual(['job_assignments', 'orders']);
    expect(assignment.calls.find((call) => call.method === 'select')?.args).toEqual([
      'id, order_id, employee_id, status',
    ]);
    expect(assignment.calls).toContainEqual({ method: 'eq', args: ['employee_id', 'e1'] });
  });

  it('collapses a sandbox parent to not found', async () => {
    const assignment = chain({ data: { id: 'a1', order_id: 'o1', employee_id: 'e1', status: 'available' } });
    const order = chain({ data: { id: 'o1', environment: 'sandbox' } });
    const { client } = clientFor(assignment, order);

    const result = await createCrewRepository({ client }).getOwnedAssignmentContext('a1', 'e1');

    expect(result.data).toBeNull();
    expect(result.error).toBe('Assignment not found');
  });

  it('does not resolve an order when the assignment is not owned or missing', async () => {
    const assignment = chain({ error: { message: 'not found' } });
    const { client, from } = clientFor(assignment);

    const result = await createCrewRepository({ client }).getOwnedAssignmentContext('a1', 'other');

    expect(result.data).toBeNull();
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('loads full detail only after production authorization', async () => {
    const minimal = chain({ data: { id: 'a1', order_id: 'o1', employee_id: 'e1', status: 'available' } });
    const order = chain({ data: { id: 'o1', environment: 'production' } });
    const detail = chain({ data: { id: 'a1', orders: { id: 'o1', environment: 'production' } } });
    const { client, from } = clientFor(minimal, order, detail);

    const result = await createCrewRepository({ client }).getOwnedDetail('a1', 'e1');

    expect(result.data?.id).toBe('a1');
    expect(from.mock.calls.map(([table]) => table)).toEqual(['job_assignments', 'orders', 'job_assignments']);
  });
});
