import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ────────────────────────────────────────────────────────────
const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle }));
const mockInsert = vi.fn(() => ({ select: mockSelect }));
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}));

import { runBudObserver } from '@/agents/bud-observer/index';

// ─── Fixtures ────────────────────────────────────────────────────────────────
const validSnapshot = {
  id: 'snap-1',
  agent_name: 'bud-observer',
  period_start: '2024-01-01T00:00:00.000Z',
  period_end: '2024-01-02T00:00:00.000Z',
  success_count: 10,
  failure_count: 2,
  error_messages: ['timeout on run 3'],
  metadata: { version: '1.0' },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runBudObserver', () => {
  it('happy path — inserts and returns ok', async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: 'obs-abc' }, error: null });
    const result = await runBudObserver(validSnapshot);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.agent_name).toBe('bud-observer');
      expect(result.inserted_id).toBe('obs-abc');
    }
    expect(mockFrom).toHaveBeenCalledWith('agent_observations');
  });

  it('validation failure — returns unable_to_analyse with truncatedInput', async () => {
    const malformed = { not: 'a snapshot' };
    const result = await runBudObserver(malformed);
    expect(result.status).toBe('unable_to_analyse');
    if (result.status === 'unable_to_analyse') {
      expect(result.truncatedInput).toBeDefined();
      expect(result.reason).toMatch(/schema validation/);
    }
    // DB should never be called for invalid input
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('DB error — returns db_error with message', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'connection refused' } });
    const result = await runBudObserver(validSnapshot);
    expect(result.status).toBe('db_error');
    if (result.status === 'db_error') {
      expect(result.message).toContain('connection refused');
    }
  });

  it('log truncation — truncatedInput is at most ~510 chars', async () => {
    const longString = 'x'.repeat(2000);
    const malformed = { garbage: longString };
    const result = await runBudObserver(malformed);
    expect(result.status).toBe('unable_to_analyse');
    if (result.status === 'unable_to_analyse' && result.truncatedInput) {
      expect(result.truncatedInput.length).toBeLessThanOrEqual(520);
      expect(result.truncatedInput).toContain('[truncated]');
    }
  });

  it('optional fields default correctly — missing error_messages and metadata', async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: 'obs-def' }, error: null });
    const minimal = {
      id: 'snap-min',
      agent_name: 'test-agent',
      period_start: '2024-01-01T00:00:00.000Z',
      period_end: '2024-01-02T00:00:00.000Z',
      success_count: 5,
      failure_count: 0,
      // error_messages and metadata omitted
    };
    const result = await runBudObserver(minimal);
    expect(result.status).toBe('ok');
    // Verify defaults were applied (insert was called with arrays/objects)
    const insertCall = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertCall.error_messages).toEqual([]);
    expect(insertCall.metadata).toEqual({});
  });
});
