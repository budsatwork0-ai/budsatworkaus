/**
 * agent-metrics.ts
 *
 * Lightweight in-process counter for agent observability.
 * Tracks empty-output events per agent using a Prometheus-compatible
 * label shape so the data can be forwarded to any metrics backend.
 *
 * Usage (in a base runner, at run finalisation):
 *
 *   import { emitEmptyOutputMetric } from '@/observability/agent-metrics';
 *   // ...
 *   if (!output || output.trim() === '') {
 *     emitEmptyOutputMetric(agentId);
 *   }
 */

/** Prometheus-compatible metric label set. */
export interface AgentMetricLabels {
  /** Unique identifier of the agent (e.g. 'quote-triage'). */
  agent_id: string;
}

/** Internal counter storage: agent_id → cumulative count. */
const _emptyCounts = new Map<string, number>();

/**
 * Increments the empty-output counter for the given agent.
 *
 * The counter is intentionally in-process and never reset so it can
 * be scraped as a Prometheus monotonic counter (type: counter).
 *
 * @param agentId - The unique agent identifier (maps to `agent_id` label).
 * @returns        The new cumulative count for this agent.
 */
export function emitEmptyOutputMetric(agentId: string): number {
  const current = _emptyCounts.get(agentId) ?? 0;
  const next = current + 1;
  _emptyCounts.set(agentId, next);
  return next;
}

/**
 * Returns a snapshot of all empty-output counts keyed by agent_id.
 * Useful for exposing a /metrics endpoint or writing tests.
 */
export function getEmptyOutputCounts(): ReadonlyMap<string, number> {
  return _emptyCounts;
}

/**
 * Resets the counter for a specific agent (primarily for test isolation).
 * Not intended for production use.
 */
export function _resetEmptyOutputCount(agentId: string): void {
  _emptyCounts.delete(agentId);
}
