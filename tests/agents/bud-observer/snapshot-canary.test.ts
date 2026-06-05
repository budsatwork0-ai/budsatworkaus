/**
 * Tests for the snapshot canary assertion.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { assertSnapshotHasSignals, type SnapshotSignalCounts } from '@/agents/bud-observer/snapshot-canary';

describe('assertSnapshotHasSignals', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('does NOT warn when at least one signal bucket is non-zero (ux_proposals)', () => {
    const counts: SnapshotSignalCounts = { ux_proposals: 2, conversion_signals: 0, design_insights: 0 };
    assertSnapshotHasSignals(counts);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does NOT warn when at least one signal bucket is non-zero (conversion_signals)', () => {
    const counts: SnapshotSignalCounts = { ux_proposals: 0, conversion_signals: 1, design_insights: 0 };
    assertSnapshotHasSignals(counts);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does NOT warn when at least one signal bucket is non-zero (design_insights)', () => {
    const counts: SnapshotSignalCounts = { ux_proposals: 0, conversion_signals: 0, design_insights: 5 };
    assertSnapshotHasSignals(counts);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does NOT warn when all buckets are populated', () => {
    const counts: SnapshotSignalCounts = { ux_proposals: 3, conversion_signals: 2, design_insights: 1 };
    assertSnapshotHasSignals(counts);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('WARNS when ALL three buckets are simultaneously zero — the canary condition', () => {
    const counts: SnapshotSignalCounts = { ux_proposals: 0, conversion_signals: 0, design_insights: 0 };
    assertSnapshotHasSignals(counts);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain('[bud-observer] Canary warning');
  });

  it('warning message mentions all three bucket names for debuggability', () => {
    const counts: SnapshotSignalCounts = { ux_proposals: 0, conversion_signals: 0, design_insights: 0 };
    assertSnapshotHasSignals(counts);
    const msg: string = warnSpy.mock.calls[0][0] as string;
    expect(msg).toContain('ux_proposals');
    expect(msg).toContain('conversion_signals');
    expect(msg).toContain('design_insights');
  });

  it('is non-blocking — does not throw even on the canary condition', () => {
    const counts: SnapshotSignalCounts = { ux_proposals: 0, conversion_signals: 0, design_insights: 0 };
    expect(() => assertSnapshotHasSignals(counts)).not.toThrow();
  });
});
