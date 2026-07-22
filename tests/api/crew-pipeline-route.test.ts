import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAuthUser = vi.fn();
const createServiceClientSafe = vi.fn();
const listForPipeline = vi.fn();
vi.mock('@/lib/auth', () => ({ getAuthUser }));
vi.mock('@/lib/supabase/server', () => ({ createServiceClientSafe }));
vi.mock('@/lib/crew/repository', () => ({ createCrewRepository: () => ({ listForPipeline }) }));

function chain(data: unknown[]) {
  const value = { select: () => value, in: () => value, order: async () => ({ data, error: null }) };
  return value;
}

function client() {
  return { from: vi.fn((table: string) => {
    if (table === 'applicants') return chain([]);
    if (table === 'employees') return chain([{ id: 'e1', user_id: null, full_name: 'Crew One', email: 'crew@test', availability: [], services: [], status: 'active', crew_access_approved: true, roster_active: true }]);
    return chain([]);
  }) };
}

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  getAuthUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
  createServiceClientSafe.mockReturnValue(client());
});

describe('GET /api/crew/pipeline', () => {
  it('derives staffing only from production-scoped assignments', async () => {
    listForPipeline.mockResolvedValue({ data: [{
      employee_id: 'e1', order_id: 'o-prod', status: 'in_progress',
      orders: { id: 'o-prod', customer_name: 'Real', scheduled_date: '2026-08-01', environment: 'production' },
    }], error: null });
    const { GET } = await import('@/app/api/crew/pipeline/route');
    const body = await (await GET()).json();
    expect(body.pipeline[0].staffing).toMatchObject({ assignedJobs: 1, inProgressJobs: 1, nextJobDate: '2026-08-01' });
  });

  it('excludes sandbox assignments from counts and next-job data', async () => {
    listForPipeline.mockResolvedValue({ data: [], error: null });
    const { GET } = await import('@/app/api/crew/pipeline/route');
    const body = await (await GET()).json();
    expect(body.pipeline[0].staffing).toMatchObject({ assignedJobs: 0, inProgressJobs: 0, nextJobDate: null });
  });

  it('preserves employee/admin authorization', async () => {
    getAuthUser.mockResolvedValueOnce({ id: 'customer-1', role: 'customer' });
    const { GET } = await import('@/app/api/crew/pipeline/route');
    expect((await GET()).status).toBe(403);
  });
});
