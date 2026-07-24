import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAuthUser = vi.fn();
const createServiceClientSafe = vi.fn();
const listMine = vi.fn();
vi.mock('@/lib/auth', () => ({ getAuthUser }));
vi.mock('@/lib/supabase/server', () => ({ createServiceClientSafe }));
vi.mock('@/lib/crew/repository', () => ({ createCrewRepository: () => ({ listMine }) }));

function client(employee: { id: string } | null = { id: 'employee-1' }) {
  const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: employee }) };
  return { from: vi.fn(() => chain) };
}

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  getAuthUser.mockResolvedValue({ id: 'user-1', role: 'employee' });
  createServiceClientSafe.mockReturnValue(client());
});

describe('GET /api/crew/my-jobs', () => {
  it('returns only production-backed assignments supplied by the repository', async () => {
    listMine.mockResolvedValue({ data: [{ id: 'a-prod', orders: { environment: 'production' } }], error: null });
    const { GET } = await import('@/app/api/crew/my-jobs/route');
    const response = await GET(new Request('https://app.test/api/crew/my-jobs') as never);
    expect((await response.json()).assignments.map((item: { id: string }) => item.id)).toEqual(['a-prod']);
    expect(listMine).toHaveBeenCalledWith('employee-1', ['accepted', 'in_progress', 'completed']);
  });

  it('keeps sandbox assignments out of schedule source data', async () => {
    listMine.mockResolvedValue({ data: [], error: null });
    const { GET } = await import('@/app/api/crew/my-jobs/route');
    const response = await GET(new Request('https://app.test/api/crew/my-jobs?status=completed') as never);
    expect(await response.json()).toEqual({ assignments: [] });
    expect(listMine).toHaveBeenCalledWith('employee-1', ['completed']);
  });
});
