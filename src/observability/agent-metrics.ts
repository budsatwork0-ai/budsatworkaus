/**
 * agent-metrics.ts
 * Lightweight in-process counter for empty-output events emitted by agents.
 * No external dependencies — safe to import anywhere in the codebase.
 */

export interface EmptyOutputEvent {
  agent_id: string;
  timestamp: number; // Unix ms
}

// Module-private store
let _events: EmptyOutputEvent[] = [];

/**
 * Record one empty-output occurrence for the given agent.
 * Call this in the post-run validation step of any agent runner.
 */
export function emitEmptyOutputMetric(agent_id: string): void {
  _events.push({ agent_id, timestamp: Date.now() });
}

/**
 * Return a read-only snapshot of all recorded events.
 * Useful for alerting checks and integration tests.
 */
export function getEmptyOutputEvents(): ReadonlyArray<EmptyOutputEvent> {
  return _events;
}

/**
 * Return the count of empty-output events for a specific agent
 * within the supplied time window (milliseconds, counting back from now).
 */
export function getEmptyOutputCount(
  agent_id: string,
  windowMs: number
): number {
  const cutoff = Date.now() - windowMs;
  return _events.filter(
    (e) => e.agent_id === agent_id && e.timestamp >= cutoff
  ).length;
}

/**
 * TEST-ONLY: reset all recorded events so each test starts from a clean state.
 * Do not call this in production code.
 */
export function _resetEmptyOutputMetrics_testOnly(): void {
  _events = [];
}
