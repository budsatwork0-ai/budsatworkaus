import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase before importing the handler so the lazy init is intercepted.
const mockInsert = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: () => ({ insert: mockInsert }),
  }),
}));

import { handleBudObserver } from '@/agents/bud-observer/index';

describe('handleBudObserver', () => {
  beforeEach(() => {
    mockInsert.mockReset();
  });

  it('returns unable_to_analyse for a missing quote_id', async () => {
    const result = await handleBudObserver({ status: 'pending' });
    expect(result.outcome).toBe('unable_to_analyse');
  });

  it('returns unable_to_analyse for a completely invalid payload', async () => {
    const result = await handleBudObserver(null);
    expect(result.outcome).toBe('unable_to_analyse');
  });

  it('returns unable_to_analyse for an empty object', async () => {
    const result = await handleBudObserver({});
    expect(result.outcome).toBe('unable_to_analyse');
  });

  it('returns analysed on a valid snapshot', async () => {
    mockInsert.mockResolvedValue({ error: null });
    const result = await handleBudObserver({
      quote_id: 'q-123',
      status: 'pending',
      service_type: 'cleaning',
    });
    expect(result.outcome).toBe('analysed');
    if (result.outcome === 'analysed') {
      expect(result.quote_id).toBe('q-123');
    }
  });

  it('returns unable_to_analyse when DB insert fails', async () => {
    mockInsert.mockResolvedValue({ error: { message: 'connection timeout' } });
    const result = await handleBudObserver({
      quote_id: 'q-456',
      status: 'new',
    });
    expect(result.outcome).toBe('unable_to_analyse');
    if (result.outcome === 'unable_to_analyse') {
      expect(result.reason).toContain('connection timeout');
    }
  });

  it('logs truncated raw input on validation failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await handleBudObserver({ unexpected_field: true });
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid snapshot shape'),
      expect.objectContaining({ rawTruncated: expect.any(String) }),
    );
    consoleSpy.mockRestore();
  });
});
