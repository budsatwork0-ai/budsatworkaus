import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ────────────────────────────────────────────────────────────
const insertMock = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: () => ({ insert: insertMock }),
  }),
}));

import { runBudObserver } from '../../../src/agents/bud-observer/index';

const VALID_SNAPSHOT = {
  agent_id: 'agent-abc',
  captured_at: '2025-01-01T00:00:00Z',
  metrics: { cpu: 0.4 },
  errors: [],
  meta: { version: '1.0' },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('bud-observer agent', () => {
  it('happy-path: inserts valid snapshot and returns ok', async () => {
    insertMock.mockResolvedValueOnce({ error: null });
    const result = await runBudObserver(VALID_SNAPSHOT);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.agent_id).toBe('agent-abc');
    }
    expect(insertMock).toHaveBeenCalledOnce();
  });

  it('validation-failure: returns unable_to_analyse for missing agent_id', async () => {
    const bad = { captured_at: '2025-01-01T00:00:00Z' };
    const result = await runBudObserver(bad);
    expect(result.status).toBe('unable_to_analyse');
    if (result.status === 'unable_to_analyse') {
      expect(result.error_code).toBe('SchemaValidationError');
    }
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('validation-failure: returns unable_to_analyse for null input', async () => {
    const result = await runBudObserver(null);
    expect(result.status).toBe('unable_to_analyse');
    if (result.status === 'unable_to_analyse') {
      expect(result.error_code).toBe('SchemaValidationError');
    }
  });

  it('db-error: returns db_error when Supabase insert fails', async () => {
    insertMock.mockResolvedValueOnce({ error: { message: 'connection refused' } });
    const result = await runBudObserver(VALID_SNAPSHOT);
    expect(result.status).toBe('db_error');
    if (result.status === 'db_error') {
      expect(result.reason).toBe('connection refused');
    }
  });

  it('log-truncation: does not throw for a very large raw input', async () => {
    const huge = { not_agent_id: 'x'.repeat(10_000), captured_at: '2025-01-01T00:00:00Z' };
    const result = await runBudObserver(huge);
    // Should still return validation failure gracefully
    expect(result.status).toBe('unable_to_analyse');
  });

  it('happy-path: optional fields can be omitted', async () => {
    insertMock.mockResolvedValueOnce({ error: null });
    const minimal = { agent_id: 'agent-xyz', captured_at: '2025-06-01T12:00:00Z' };
    const result = await runBudObserver(minimal);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.agent_id).toBe('agent-xyz');
    }
  });
});
