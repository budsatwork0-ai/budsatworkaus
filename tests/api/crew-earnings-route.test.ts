import { beforeEach, describe, expect, it, vi } from 'vitest';

const createAuthServerClient = vi.fn();
const listCompletedForEarnings = vi.fn();
vi.mock('@/lib/supabase/server-client', () => ({ createAuthServerClient }));
vi.mock('@/lib/crew/repository', () => ({ createCrewRepository: () => ({ listCompletedForEarnings }) }));

function authClient(user: { id: string } | null = { id: 'user-1' }) {
  const employee = { select: () => employee, eq: () => employee, single: async () => ({ data: { id: 'employee-1' } }) };
  return { auth: { getUser: async () => ({ data: { user }, error: null }) }, from: vi.fn(() => employee) };
}

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  createAuthServerClient.mockResolvedValue(authClient());
});

describe('GET /api/crew/earnings', () => {
  it('preserves totals and history for production orders', async () => {
    listCompletedForEarnings.mockResolvedValue({ data: [{
      id: 'a-prod', order_id: 'o-prod', completed_at: new Date().toISOString(),
      orders: { service_type: 'cleaning', customer_name: 'Real Customer', final_price: 125, scheduled_date: '2026-07-21' },
    }], error: null });
    const { GET } = await import('@/app/api/crew/earnings/route');
    const response = await GET();
    const body = await response.json();
    expect(body.allTime).toBe(125);
    expect(body.jobs).toHaveLength(1);
    expect(body.jobs[0].customerName).toBe('Real');
  });

  it('gives sandbox orders zero totals and no history', async () => {
    listCompletedForEarnings.mockResolvedValue({ data: [], error: null });
    const { GET } = await import('@/app/api/crew/earnings/route');
    const body = await (await GET()).json();
    expect(body).toMatchObject({ thisWeek: 0, thisFortnight: 0, thisMonth: 0, allTime: 0, jobs: [] });
  });

  it('preserves unauthenticated behaviour', async () => {
    createAuthServerClient.mockResolvedValueOnce(authClient(null));
    const { GET } = await import('@/app/api/crew/earnings/route');
    expect((await GET()).status).toBe(401);
  });
});
