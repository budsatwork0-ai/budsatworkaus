/**
 * degraded-signal.ts
 * Emits a minimal structured fallback entry when an agent run partially fails.
 * Import and call `emitDegradedSignal` inside catch blocks so the pipeline
 * never silently drops a run — consumers can filter on `status: 'degraded'`.
 */

export type DegradedSignalType =
  | 'ux_proposal'
  | 'design_insight'
  | 'conversion_signal';

export interface DegradedSignalEntry {
  status: 'degraded';
  signal_type: DegradedSignalType;
  agent: string;
  reason: string;
  partial_output: Record<string, unknown> | null;
  emitted_at: string; // ISO-8601
}

/**
 * Builds a minimal degraded entry without throwing.
 * Safe to call from a catch block — never throws itself.
 */
export function buildDegradedSignal(
  agent: string,
  signalType: DegradedSignalType,
  reason: string,
  partialOutput: Record<string, unknown> | null = null,
): DegradedSignalEntry {
  return {
    status: 'degraded',
    signal_type: signalType,
    agent,
    reason,
    partial_output: partialOutput,
    emitted_at: new Date().toISOString(),
  };
}
