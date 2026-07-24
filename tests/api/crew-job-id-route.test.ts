/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAuthUser = vi.fn();
const createServiceClientSafe = vi.fn();
const getOwnedDetail = vi.fn();
const getOwnedAssignmentContext = vi.fn();
vi.mock('@/lib/auth', () => ({ getAuthUser }));
vi.mock('@/lib/supabase/server', () => ({ createServiceClientSafe }));
vi.mock('@/lib/crew/repository', () => ({
  createCrewRepository: () => ({ getOwnedDetail, getOwnedAssignmentContext }),
}));

function makeClient() {
  const calls: Array<{ table: string; method: string; value?: unknown }> = [];
  const from = vi.fn((table: string) => {
    const chain: any = {};
    for (const method of ['select', 'eq', 'update', 'in']) {
      chain[method] = (value?: unknown) => {
        calls.push({ table, method, value });
        return chain;
      };
    }
    chain.maybeSingle = async () => ({ data: table === 'employees' ? { id: 'employee-1' } : null });
    chain.single = async () => ({ data: table === 'job_assignments' ? { id: 'a1', status: 'accepted' } : null, error: null });
    return chain;
  });
  return { from, calls };
}

function patch(status: string) {
  return new Request('https://app.test/api/crew/jobs/a1', {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }),
  }) as never;
}

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  getAuthUser.mockResolvedValue({ id: 'user-1', role: 'employee' });
});

describe('GET /api/crew/jobs/[id]', () => {
  it('returns production detail with the existing response shape', async () => {
    const client = makeClient();
    createServiceClientSafe.mockReturnValue(client);
    getOwnedDetail.mockResolvedValue({ data: { id: 'a1', orders: { id: 'o1', customer_name: 'Real Customer' } }, error: null });
    const { GET } = await import('@/app/api/crew/jobs/[id]/route');
    const response = await GET(new Request('https://app.test') as never, { params: Promise.resolve({ id: 'a1' }) });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.assignment.orders.customer_name).toBe('Real Customer');
  });

  it('returns non-disclosing 404 for a sandbox assignment UUID', async () => {
    createServiceClientSafe.mockReturnValue(makeClient());
    getOwnedDetail.mockResolvedValue({ data: null, error: 'Assignment not found' });
    const { GET } = await import('@/app/api/crew/jobs/[id]/route');
    const response = await GET(new Request('https://app.test') as never, { params: Promise.resolve({ id: 'sandbox-a' }) });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Assignment not found' });
  });
});

describe('PATCH /api/crew/jobs/[id]', () => {
  it.each(['accepted', 'declined', 'in_progress', 'completed'])('performs no %s mutation when the parent is sandbox', async (status) => {
    const client = makeClient();
    createServiceClientSafe.mockReturnValue(client);
    getOwnedAssignmentContext.mockResolvedValue({ data: null, error: 'Assignment not found' });
    const { PATCH } = await import('@/app/api/crew/jobs/[id]/route');
    const response = await PATCH(patch(status), { params: Promise.resolve({ id: 'sandbox-a' }) });
    expect(response.status).toBe(404);
    expect(client.calls.some((call) => call.method === 'update')).toBe(false);
  });

  it('keeps production assignments usable and preserves transition rules', async () => {
    const client = makeClient();
    createServiceClientSafe.mockReturnValue(client);
    getOwnedAssignmentContext.mockResolvedValue({
      data: { assignment: { id: 'a1', order_id: 'o1', employee_id: 'employee-1', status: 'available' }, order: { id: 'o1', environment: 'production' } },
      error: null,
    });
    const { PATCH } = await import('@/app/api/crew/jobs/[id]/route');
    const response = await PATCH(patch('accepted'), { params: Promise.resolve({ id: 'a1' }) });
    expect(response.status).toBe(200);
    expect(client.calls).toContainEqual(expect.objectContaining({ table: 'job_assignments', method: 'update' }));
    expect(client.calls).toContainEqual(expect.objectContaining({ table: 'orders', method: 'update' }));
  });

  it('keeps another employee assignment unavailable', async () => {
    createServiceClientSafe.mockReturnValue(makeClient());
    getOwnedAssignmentContext.mockResolvedValue({ data: null, error: 'Assignment not found' });
    const { PATCH } = await import('@/app/api/crew/jobs/[id]/route');
    expect((await PATCH(patch('accepted'), { params: Promise.resolve({ id: 'other-a' }) })).status).toBe(404);
    expect(getOwnedAssignmentContext).toHaveBeenCalledWith('other-a', 'employee-1');
  });
});
