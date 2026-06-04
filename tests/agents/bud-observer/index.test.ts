import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ────────────────────────────────────────────────────────────
const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}));

// Import AFTER mocks are registered
import { runBudObserver } from '../../../src/agents/bud-observer/index';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const validSnapshot = {
  agent: 'bud-observer',
  week_start: '2025-01-13',
  error_count: 6,
  prev_error_count: 0,
  total_errors: 19,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runBudObserver', () => {
  it('returns unable_to_analyse with SCHEMA_VALIDATION_ERROR for invalid input', async () => {
    const result = await runBudObserver({ not: 'a snapshot' });
    expect(result.status).toBe('unable_to_analyse');
    expect(result.error_code).toBe('SCHEMA_VALIDATION_ERROR');
  });

  it('returns unable_to_analyse for null input', async () => {
    const result = await runBudObserver(null);
    expect(result.status).toBe('unable_to_analyse');
    expect(result.error_code).toBe('SCHEMA_VALIDATION_ERROR');
  });

  it('returns ok on happy path and writes to DB', async () => {
    mockInsert.mockResolvedValueOnce({ error: null });
    const result = await runBudObserver(validSnapshot);
    expect(result.status).toBe('ok');
    expect(result.agent).toBe('bud-observer');
    expect(result.week_start).toBe('2025-01-13');
    expect(result.error_count).toBe(6);
    expect(mockFrom).toHaveBeenCalledWith('bud_observer_snapshots');
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it('returns db_error when Supabase insert fails', async () => {
    mockInsert.mockResolvedValueOnce({ error: { message: 'duplicate key' } });
    const result = await runBudObserver(validSnapshot);
    expect(result.status).toBe('db_error');
    expect(result.error_code).toBe('DB_INSERT_ERROR');
    expect(result.error).toBe('duplicate key');
  });

  it('truncates long raw input in validation error logs', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bigPayload = { x: 'a'.repeat(2000) };
    await runBudObserver(bigPayload);
    const loggedArg = consoleSpy.mock.calls[0]?.[1] as { raw_truncated?: string } | undefined;
    expect(loggedArg?.raw_truncated?.length).toBeLessThanOrEqual(500);
    consoleSpy.mockRestore();
  });

  it('accepts snapshot with only required fields', async () => {
    mockInsert.mockResolvedValueOnce({ error: null });
    const minimal = { agent: 'test-agent', week_start: '2025-01-01', error_count: 0 };
    const result = await runBudObserver(minimal);
    expect(result.status).toBe('ok');
  });
});
