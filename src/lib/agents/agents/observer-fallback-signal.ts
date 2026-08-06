/**
 * Typed fallback payload emitted when the bud-observer agent degrades.
 * Purely additive — no existing code is touched.
 */

export const OBSERVER_DEGRADED_CHANNEL = 'agent_alerts' as const;

export type ObserverDegradedReason =
  | 'json_parse_error'
  | 'empty_signals_on_non_empty_input'
  | 'unexpected_error';

export interface ObserverDegradedPayload {
  /** Discriminant so consumers can narrow on signal type. */
  type: 'observer_degraded';
  /** ISO-8601 timestamp of when degradation was detected. */
  detectedAt: string;
  /** Machine-readable reason code. */
  reason: ObserverDegradedReason;
  /** Human-readable description forwarded from the caught error. */
  message: string;
  /** Raw input length (chars) that triggered the degradation, if available. */
  inputLength?: number;
}

/**
 * Builds a typed ObserverDegradedPayload.
 */
export function buildDegradedPayload(
  reason: ObserverDegradedReason,
  message: string,
  inputLength?: number,
): ObserverDegradedPayload {
  return {
    type: 'observer_degraded',
    detectedAt: new Date().toISOString(),
    reason,
    message,
    ...(inputLength !== undefined ? { inputLength } : {}),
  };
}
