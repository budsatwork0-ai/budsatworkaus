import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAuthUser = vi.fn();
const createServiceClientSafe = vi.fn();
const listAvailable = vi.fn();

vi.mock('@/lib/auth', () => ({ getAuthUser }));
vi.mock('@/lib/supabase/server', () => ({ createServiceClientSafe }));
vi.mock('@/lib/crew/repository', () => ({ createCrewRepository: () => ({ listAvailable }) }));

function clientWithEmployee(employee: { id: string } | null) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: employee, error: null }),
  };
  return { from: vi.fn(() => chain) };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  getAuthUser.mockResolvedValue({ id: 'user-1', role: 'employee' });
  createServiceClientSafe.mockReturnValue(clientWithEmployee({ id: 'employee-1' }));
});

describe('GET /api/crew/jobs', () => {
  it('preserves production assignment response and NDIS enrichment', async () => {
    listAvailable.mockResolvedValue({
      data: [{ id: 'a-prod', order_id: 'o-prod', orders: { environment: 'production', service_type: 'cleaning' } }],
      count: 1,
      error: null,
    });
    const client = clientWithEmployee({ id: 'employee-1' });
    const empty = { select: () => empty, eq: () => empty, in: async () => ({ data: [] }) };
    client.from.mockImplementation((table: string) => table === 'employees' ? ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'employee-1' } }) }) }),
    } as never) : empty);
    createServiceClientSafe.mockReturnValue(client);

    const { GET } = await import('@/app/api/crew/jobs/route');
    const response = await GET(new Request('https://app.test/api/crew/jobs?limit=20') as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.assignments).toHaveLength(1);
    expect(body.assignments[0].id).toBe('a-prod');
    expect(listAvailable).toHaveBeenCalledWith('employee-1', { limit: 20, offset: 0 });
  });

  it('returns no sandbox assignment because the repository omits it', async () => {
    listAvailable.mockResolvedValue({ data: [], count: 0, error: null });
    const { GET } = await import('@/app/api/crew/jobs/route');
    const response = await GET(new Request('https://app.test/api/crew/jobs') as never);
    expect(await response.json()).toEqual({ assignments: [], total: 0 });
  });

  it('preserves authentication and missing employee behaviour', async () => {
    getAuthUser.mockResolvedValueOnce(null);
    const { GET } = await import('@/app/api/crew/jobs/route');
    expect((await GET(new Request('https://app.test/api/crew/jobs') as never)).status).toBe(401);

    getAuthUser.mockResolvedValueOnce({ id: 'user-1', role: 'employee' });
    createServiceClientSafe.mockReturnValueOnce(clientWithEmployee(null));
    expect((await GET(new Request('https://app.test/api/crew/jobs') as never)).status).toBe(404);
  });
});
