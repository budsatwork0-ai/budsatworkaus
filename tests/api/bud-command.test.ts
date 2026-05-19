import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAuthUser = vi.fn();
const createBudTask = vi.fn();
const queueApproval = vi.fn();
const writeBudActivity = vi.fn();

vi.mock('@/lib/auth', () => ({ getAuthUser }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ from: vi.fn() })) }));
vi.mock('@/lib/bud/orchestrator', () => ({ createBudTask, queueApproval, writeBudActivity }));

describe('POST /api/bud/command', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    createBudTask.mockResolvedValue({ id: 'task-1' });
    queueApproval.mockResolvedValue('approval-1');
    writeBudActivity.mockResolvedValue(undefined);
  });

  it('rejects unauthenticated users', async () => {
    getAuthUser.mockResolvedValue(null);
    const { POST } = await import('@/app/api/bud/command/route');

    const res = await POST(new Request('https://bud.test/api/bud/command', {
      method: 'POST',
      body: JSON.stringify({ command: 'Fix broken agents' }),
    }) as never);

    expect(res.status).toBe(401);
  });

  it('creates an approval-gated task for fix commands', async () => {
    getAuthUser.mockResolvedValue({ id: 'user-1', role: 'admin', email: 'admin@test.local' });
    const update = vi.fn(() => ({ eq: vi.fn() }));
    const from = vi.fn(() => ({ update }));
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue({ from } as never);
    const { POST } = await import('@/app/api/bud/command/route');

    const res = await POST(new Request('https://bud.test/api/bud/command', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ command: 'Fix broken agents' }),
    }) as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ task_id: 'task-1', intent: 'fix', approval_id: 'approval-1' });
    expect(createBudTask).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      description: 'Bud command: Fix broken agents',
      risk_level: 'medium',
    }));
    expect(queueApproval).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action_type: 'approve_repair_plan',
    }));
  });
});
