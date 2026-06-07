/**
 * Tests for snapshot-signal-validator.ts
 *
 * Mocks Supabase and the dead-letter queue so no real I/O occurs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock dead-letter queue ────────────────────────────────────────────────────
const mockEnqueueDeadLetter = vi.fn().mockResolvedValue(true);
vi.mock('@/infrastructure/queues/dead-letter-queue', () => ({
  enqueueDeadLetter: mockEnqueueDeadLetter,
}));

// ── Mock Supabase ─────────────────────────────────────────────────────────────
const mockSelect = vi.fn();
const mockGte = vi.fn();
const mockOrder = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: () => ({
      select: mockSelect,
    }),
  }),
}));

// Chain: select → gte → order
function setupChain(result: { data: unknown[] | null; error: null | { message: string } }) {
  mockOrder.mockResolvedValue(result);
  mockGte.mockReturnValue({ order: mockOrder });
  mockSelect.mockReturnValue({ gte: mockGte });
}

import { validateSnapshotSignals } from '@/agents/bud-observer/snapshot-signal-validator';

describe('validateSnapshotSignals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false and does NOT dead-letter when a snapshot has non-empty ux_proposals', async () => {
    setupChain({
      data: [
        { id: '1', created_at: new Date().toISOString(), ux_proposals: [{ id: 'p1' }], design_insights: [] },
      ],
      error: null,
    });

    const result = await validateSnapshotSignals({ starvationWindowMs: 1000 });
    expect(result).toBe(false);
    expect(mockEnqueueDeadLetter).not.toHaveBeenCalled();
  });

  it('returns false and does NOT dead-letter when a snapshot has non-empty design_insights', async () => {
    setupChain({
      data: [
        { id: '2', created_at: new Date().toISOString(), ux_proposals: [], design_insights: [{ id: 'i1' }] },
      ],
      error: null,
    });

    const result = await validateSnapshotSignals({ starvationWindowMs: 1000 });
    expect(result).toBe(false);
    expect(mockEnqueueDeadLetter).not.toHaveBeenCalled();
  });

  it('returns true and dead-letters signal_starvation when all snapshots have empty arrays', async () => {
    setupChain({
      data: [
        { id: '3', created_at: new Date().toISOString(), ux_proposals: [], design_insights: [] },
        { id: '4', created_at: new Date(Date.now() - 1000).toISOString(), ux_proposals: [], design_insights: [] },
      ],
      error: null,
    });

    const result = await validateSnapshotSignals({ starvationWindowMs: 1000 });
    expect(result).toBe(true);
    expect(mockEnqueueDeadLetter).toHaveBeenCalledOnce();
    expect(mockEnqueueDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'signal_starvation', agent_name: 'bud-observer' }),
    );
  });

  it('returns true and dead-letters when no snapshots exist in the window', async () => {
    setupChain({ data: [], error: null });

    const result = await validateSnapshotSignals({ starvationWindowMs: 1000 });
    expect(result).toBe(true);
    expect(mockEnqueueDeadLetter).toHaveBeenCalledOnce();
    expect(mockEnqueueDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'signal_starvation' }),
    );
  });

  it('returns false and does NOT dead-letter when Supabase returns an error', async () => {
    setupChain({ data: null, error: { message: 'DB unavailable' } });

    const result = await validateSnapshotSignals({ starvationWindowMs: 1000 });
    expect(result).toBe(false);
    expect(mockEnqueueDeadLetter).not.toHaveBeenCalled();
  });
});
