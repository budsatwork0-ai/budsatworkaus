/**
 * Snapshot canary assertion.
 *
 * Emits a non-blocking console warning when ux_proposals,
 * conversion_signals, and design_insights are ALL simultaneously
 * empty — an improbable healthy state that almost always indicates
 * broken instrumentation in the observer pipeline.
 */

export interface SnapshotSignalCounts {
  ux_proposals: number;
  conversion_signals: number;
  design_insights: number;
}

/**
 * Call this in the snapshot-assembly layer after collecting all
 * signal buckets but before persisting the snapshot.
 *
 * Non-blocking: never throws, only warns.
 */
export function assertSnapshotHasSignals(counts: SnapshotSignalCounts): void {
  const { ux_proposals, conversion_signals, design_insights } = counts;

  if (ux_proposals === 0 && conversion_signals === 0 && design_insights === 0) {
    console.warn(
      '[bud-observer] Canary warning: ux_proposals, conversion_signals, and ' +
        'design_insights are ALL empty in this snapshot. ' +
        'This is highly improbable in a healthy system — ' +
        'check observer instrumentation wiring.',
    );
  }
}
