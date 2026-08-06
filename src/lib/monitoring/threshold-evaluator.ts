import { dispatchSlackAlert } from './alerting-config';

/** Number of failures within the rolling window that triggers an alert + pause. */
export const AGENT_ERROR_THRESHOLD = Number(process.env.AGENT_ERROR_THRESHOLD ?? 10);

/** Rolling window duration in milliseconds (default 1 hour). */
const WINDOW_MS = 60 * 60 * 1_000;

/** Per-agent list of failure timestamps within the current window. */
const errorWindows = new Map<string, number[]>();

/**
 * Record one failure for `agentName`.
 * Returns `true` when the threshold has been reached so the caller can pause
 * execution and route the payload to the human fallback queue.
 */
export async function recordAgentFailure(agentName: string): Promise<boolean> {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  // Prune timestamps outside the rolling window.
  const timestamps = (errorWindows.get(agentName) ?? []).filter((t) => t > cutoff);
  timestamps.push(now);
  errorWindows.set(agentName, timestamps);

  const count = timestamps.length;

  if (count >= AGENT_ERROR_THRESHOLD) {
    await dispatchSlackAlert({
      agentName,
      errorCount: count,
      windowMinutes: 60,
      timestamp: new Date(now).toISOString(),
    });
    return true;
  }

  return false;
}

/** Returns the current failure count within the rolling window for `agentName`. */
export function getAgentErrorCount(agentName: string): number {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  return (errorWindows.get(agentName) ?? []).filter((t) => t > cutoff).length;
}

/** Resets the error window for `agentName` (e.g. after a successful HALF_OPEN probe). */
export function resetAgentErrorCount(agentName: string): void {
  errorWindows.delete(agentName);
}
