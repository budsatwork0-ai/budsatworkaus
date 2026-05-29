import { dispatchSlackAlert } from './alerting-config';

const WINDOW_MS = 60 * 60 * 1000; // 60 minutes
const AGENT_ERROR_THRESHOLD = parseInt(process.env.AGENT_ERROR_THRESHOLD ?? '5', 10);

interface FailureEvent {
  agentName: string;
  timestamp: number;
  error: string;
}

// In-memory rolling window store (per process; suitable for single-instance or edge functions)
const failureStore = new Map<string, number[]>();

export function recordAgentFailure(event: { agentName: string; timestamp: Date; error: string }): void {
  const now = event.timestamp.getTime();
  const key = event.agentName;

  if (!failureStore.has(key)) {
    failureStore.set(key, []);
  }

  const timestamps = failureStore.get(key)!;
  // Prune events outside the rolling window
  const pruned = timestamps.filter((t) => now - t <= WINDOW_MS);
  pruned.push(now);
  failureStore.set(key, pruned);

  if (pruned.length >= AGENT_ERROR_THRESHOLD) {
    // Fire-and-forget alert
    dispatchSlackAlert({
      agentName: event.agentName,
      errorCount: pruned.length,
      windowMinutes: 60,
      timestamp: event.timestamp.toISOString(),
      message: `Last error: ${event.error}`,
    }).catch((err) => console.error('[threshold-evaluator] Alert dispatch error:', err));

    // Reset to avoid flooding on every subsequent failure
    failureStore.set(key, []);
  }
}

/** Returns the current rolling error count for an agent (used by health-check-runner). */
export function getAgentErrorCount(agentName: string): number {
  const now = Date.now();
  const timestamps = failureStore.get(agentName) ?? [];
  return timestamps.filter((t) => now - t <= WINDOW_MS).length;
}
