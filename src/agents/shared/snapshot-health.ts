/**
 * snapshot-health.ts
 * Utility that warns when all signal arrays are simultaneously empty,
 * preventing false-green snapshots from masking real pipeline failures.
 */

import type { DegradedSignalEntry } from './degraded-signal';

export interface SnapshotHealthInput {
  ux_proposals: unknown[];
  design_insights: unknown[];
  conversion_signals: unknown[];
  degraded_signals?: DegradedSignalEntry[];
}

export type SnapshotHealthStatus = 'healthy' | 'warn' | 'critical';

export interface SnapshotHealthResult {
  status: SnapshotHealthStatus;
  warnings: string[];
  checked_at: string;
}

/**
 * Evaluates a snapshot payload and returns a health verdict.
 *
 * Rules:
 *  - CRITICAL : all three primary arrays are empty AND there are no
 *               degraded_signals — the snapshot is a silent false-green.
 *  - WARN      : all three primary arrays are empty BUT degraded_signals
 *               exist — pipeline ran but produced no output.
 *  - HEALTHY   : at least one primary array has entries.
 */
export function snapshotHealthCheck(
  snapshot: SnapshotHealthInput,
): SnapshotHealthResult {
  const warnings: string[] = [];
  const checked_at = new Date().toISOString();

  const allEmpty =
    snapshot.ux_proposals.length === 0 &&
    snapshot.design_insights.length === 0 &&
    snapshot.conversion_signals.length === 0;

  if (!allEmpty) {
    return { status: 'healthy', warnings, checked_at };
  }

  const hasDegradedSignals =
    Array.isArray(snapshot.degraded_signals) &&
    snapshot.degraded_signals.length > 0;

  if (hasDegradedSignals) {
    warnings.push(
      'All primary signal arrays (ux_proposals, design_insights, conversion_signals) are empty. ' +
        'Degraded signals present — upstream agents ran but produced no output.',
    );
    return { status: 'warn', warnings, checked_at };
  }

  warnings.push(
    'CRITICAL: All primary signal arrays are empty and no degraded signals were recorded. ' +
      'This snapshot may be a false-green masking a pipeline failure.',
  );
  return { status: 'critical', warnings, checked_at };
}
