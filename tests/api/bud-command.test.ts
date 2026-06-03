import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAuthUser = vi.fn();
const createBudTask = vi.fn();
const queueApproval = vi.fn();
const writeBudActivity = vi.fn();

vi.mock('@/lib/auth', () => ({ getAuthUser }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ from: vi.fn() })) }));
vi.mock('@/lib/bud/orchestrator', () => ({ createBudTask, queueApproval, writeBudActivity }));

// Proxy-based chainable Supabase mock. Returns itself for every chain call
// (select, eq, in, gte, order, limit, update, …). Terminal methods
// (maybeSingle, single) resolve to { data: terminalData }.
function chain(terminalData: unknown = null) {
  // eslint-disable-next-line prefer-const
  let p: object;
  p = new Proxy({}, {
    get(_, key: string): unknown {
      // Must return undefined for 'then' so that `await chain()` resolves
      // immediately (proxy value) rather than hanging as an infinite thenable.
      if (key === 'then') return undefined;
      if (key === 'maybeSingle') return vi.fn().mockResolvedValue({ data: terminalData });
      if (key === 'single') return vi.fn().mockResolvedValue({ data: terminalData, error: null });
      return (..._args: unknown[]) => p;
    },
  });
  return p;
}

// Returns a from() spy for a specific test scenario.
//   taskDedup     — value returned by the first from('bud_tasks') → maybeSingle()
//   approvalDedup — value returned by the first from('bud_approval_queue') → maybeSingle()
// All other calls (system context reads, update) return empty chains.
function makeFrom(opts: {
  taskDedup?: { id: string; status: string } | null;
  approvalDedup?: { id: string } | null;
} = {}) {
  const { taskDedup = null, approvalDedup = null } = opts;
  let taskCalls = 0;
  return vi.fn((table: string) => {
    if (table === 'bud_tasks') {
      taskCalls++;
      if (taskCalls === 1) return chain(taskDedup);
    }
    if (table === 'bud_approval_queue') return chain(approvalDedup);
    return chain();
  });
}

const ADMIN = { id: 'user-1', role: 'admin', email: 'admin@test.local' };

function post(command: string) {
  return new Request('https://bud.test/api/bud/command', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ command }),
  }) as never;
}

describe('POST /api/bud/command', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.ANTHROPIC_API_KEY = 'test-key';
    createBudTask.mockResolvedValue({ id: 'task-new' });
    queueApproval.mockResolvedValue('approval-new');
    writeBudActivity.mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [{ text: '{"message":"done","plan":[],"bud_state":"thinking"}' }],
      }),
    }));
  });

  it('rejects unauthenticated users', async () => {
    getAuthUser.mockResolvedValue(null);
    const { POST } = await import('@/app/api/bud/command/route');
    const res = await POST(post('Fix broken agents'));
    expect(res.status).toBe(401);
  });

  it('returns 400 when command is empty', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    const { POST } = await import('@/app/api/bud/command/route');
    const res = await POST(post('   '));
    expect(res.status).toBe(400);
  });

  // ── Phase 8B: dedup ──────────────────────────────────────────────────────────

  it('duplicate investigate command returns existing task without creating a new one', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue({
      from: makeFrom({ taskDedup: { id: 'task-existing', status: 'pending' } }),
    } as never);
    const { POST } = await import('@/app/api/bud/command/route');

    const res = await POST(post('Investigate stalled agents'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.deduplicated).toBe(true);
    expect(body.task_id).toBe('task-existing');
    expect(createBudTask).not.toHaveBeenCalled();
  });

  it('command casing does not bypass dedup — description is normalized before storage', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue({ from: makeFrom() } as never);
    const { POST } = await import('@/app/api/bud/command/route');

    // Uppercase + extra spaces: user portion normalizes to 'investigate stalled agents'
    // The stored description is 'Bud command: investigate stalled agents' (prefix is a constant).
    await POST(post('  INVESTIGATE   STALLED  AGENTS  '));

    expect(createBudTask).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ description: 'Bud command: investigate stalled agents' }),
    );
  });

  it('uppercase duplicate deduplicates against the existing normalized key', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue({
      from: makeFrom({ taskDedup: { id: 'task-existing', status: 'pending' } }),
    } as never);
    const { POST } = await import('@/app/api/bud/command/route');

    const res = await POST(post('INVESTIGATE STALLED AGENTS'));
    const body = await res.json();

    expect(body.deduplicated).toBe(true);
    expect(createBudTask).not.toHaveBeenCalled();
  });

  it('duplicate command does not call the Anthropic API', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue({
      from: makeFrom({ taskDedup: { id: 'task-existing', status: 'pending' } }),
    } as never);
    const { POST } = await import('@/app/api/bud/command/route');

    await POST(post('Review pending approvals'));

    // fetch is only used for the Anthropic API — must not be called on a dedup hit
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  // ── Phase 8B: approval gate unchanged ───────────────────────────────────────

  it('improve command creates an approval-gated task', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue({ from: makeFrom() } as never);
    const { POST } = await import('@/app/api/bud/command/route');

    const res = await POST(post('Improve Mission Control UX'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.intent).toBe('improve');
    expect(body.approval_id).toBe('approval-new');
    expect(createBudTask).toHaveBeenCalled();
    expect(queueApproval).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action_type: 'approve_ux_evolution_plan' }),
    );
  });

  it('fix command creates an approval-gated task', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue({ from: makeFrom() } as never);
    const { POST } = await import('@/app/api/bud/command/route');

    const res = await POST(post('Fix broken agents'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.intent).toBe('fix');
    expect(body.approval_id).toBe('approval-new');
    expect(createBudTask).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ description: 'Bud command: fix broken agents', risk_level: 'medium' }),
    );
    expect(queueApproval).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action_type: 'approve_repair_plan' }),
    );
  });

  it('investigate command creates a pending task without queueing an approval', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue({ from: makeFrom() } as never);
    const { POST } = await import('@/app/api/bud/command/route');

    const res = await POST(post('Investigate customer reply failures'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.intent).toBe('investigate');
    expect(body.approval_id).toBeNull();
    expect(body.status).toBe('pending');
    expect(queueApproval).not.toHaveBeenCalled();
  });
});
