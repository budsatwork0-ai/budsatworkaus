import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAuthUser = vi.fn();
const writeBudActivity = vi.fn();

vi.mock('@/lib/auth', () => ({ getAuthUser }));
vi.mock('@/lib/bud/orchestrator', () => ({ writeBudActivity }));

function makeTable() {
  const eq = vi.fn(() => Promise.resolve({ data: null, error: null }));
  const update = vi.fn(() => ({ eq }));
  return { update, eq };
}

describe('POST /api/bud/actions/dismiss', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    writeBudActivity.mockResolvedValue(undefined);
  });

  it('resolves Bud insights instead of deleting them', async () => {
    getAuthUser.mockResolvedValue({ id: 'user-1', role: 'admin', email: 'admin@test.local' });
    const table = makeTable();
    const from = vi.fn(() => table);
    vi.doMock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ from })) }));
    const { POST } = await import('@/app/api/bud/actions/dismiss/route');

    const res = await POST(new Request('https://bud.test/api/bud/actions/dismiss', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'bud_insight', id: 'insight-1' }),
    }) as never);

    expect(res.status).toBe(200);
    expect(from).toHaveBeenCalledWith('bud_insights');
    expect(table.update).toHaveBeenCalledWith(expect.objectContaining({ resolved_at: expect.any(String) }));
    expect(writeBudActivity).toHaveBeenCalledWith(expect.anything(), 'Bud dismissed bud_insight', expect.any(Object));
  });
});
