/**
 * alerts.config.ts
 * Threshold constants for agent-level observability alerts.
 * Pure data — no runtime side-effects.
 */

/** Number of empty-output events that triggers an alert for a single agent. */
export const EMPTY_OUTPUT_ALERT_THRESHOLD = 3;

/** Rolling time window (milliseconds) over which the threshold is evaluated. */
export const EMPTY_OUTPUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Returns true when the supplied count breaches the alert threshold.
 * Intended to be called after getEmptyOutputCount() from agent-metrics.
 */
export function isEmptyOutputAlertBreached(count: number): boolean {
  return count >= EMPTY_OUTPUT_ALERT_THRESHOLD;
}
