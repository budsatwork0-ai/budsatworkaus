/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAuthUser = vi.fn();
const createServiceClientSafe = vi.fn();
const getOwnedAssignmentContext = vi.fn();
vi.mock('@/lib/auth', () => ({ getAuthUser }));
vi.mock('@/lib/supabase/server', () => ({ createServiceClientSafe }));
vi.mock('@/lib/crew/repository', () => ({ createCrewRepository: () => ({ getOwnedAssignmentContext }) }));

function makeClient() {
  const writes: Array<{ table: string; method: string }> = [];
  const from = vi.fn((table: string) => {
    const chain: any = {};
    for (const method of ['select', 'eq', 'insert', 'update']) {
      chain[method] = () => {
        if (method === 'insert' || method === 'update') writes.push({ table, method });
        return chain;
      };
    }
    chain.maybeSingle = async () => ({ data: table === 'employees' ? { id: 'employee-1' } : null });
    chain.single = async () => ({ data: table === 'job_completions' ? { id: 'completion-1' } : null, error: null });
    return chain;
  });
  return { from, writes };
}

function request() {
  return new Request('https://app.test/api/crew/jobs/a1/complete', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ notes: 'Done' }),
  }) as never;
}

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  getAuthUser.mockResolvedValue({ id: 'user-1', role: 'employee' });
});

describe('POST /api/crew/jobs/[id]/complete', () => {
  it('rejects a sandbox parent before every completion write', async () => {
    const client = makeClient();
    createServiceClientSafe.mockReturnValue(client);
    getOwnedAssignmentContext.mockResolvedValue({ data: null, error: 'Assignment not found' });
    const { POST } = await import('@/app/api/crew/jobs/[id]/complete/route');
    const response = await POST(request(), { params: Promise.resolve({ id: 'sandbox-a' }) });
    expect(response.status).toBe(404);
    expect(client.writes).toEqual([]);
  });

  it('creates evidence and updates assignment and order for an owned production job', async () => {
    const client = makeClient();
    createServiceClientSafe.mockReturnValue(client);
    getOwnedAssignmentContext.mockResolvedValue({
      data: { assignment: { id: 'a1', order_id: 'o1', employee_id: 'employee-1', status: 'in_progress' }, order: { id: 'o1', environment: 'production' } },
      error: null,
    });
    const { POST } = await import('@/app/api/crew/jobs/[id]/complete/route');
    const response = await POST(request(), { params: Promise.resolve({ id: 'a1' }) });
    expect(response.status).toBe(201);
    expect(client.writes).toEqual([
      { table: 'job_completions', method: 'insert' },
      { table: 'job_assignments', method: 'update' },
      { table: 'orders', method: 'update' },
    ]);
  });

  it('preserves the in-progress requirement without writing', async () => {
    const client = makeClient();
    createServiceClientSafe.mockReturnValue(client);
    getOwnedAssignmentContext.mockResolvedValue({
      data: { assignment: { id: 'a1', order_id: 'o1', employee_id: 'employee-1', status: 'accepted' }, order: { id: 'o1', environment: 'production' } },
      error: null,
    });
    const { POST } = await import('@/app/api/crew/jobs/[id]/complete/route');
    expect((await POST(request(), { params: Promise.resolve({ id: 'a1' }) })).status).toBe(400);
    expect(client.writes).toEqual([]);
  });
});
