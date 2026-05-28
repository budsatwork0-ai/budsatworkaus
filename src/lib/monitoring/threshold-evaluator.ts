/**
 * threshold-evaluator.ts
 * Evaluates agent failure counts over a rolling 60-minute window and
 * fires alerts via alerting-config when failures exceed the threshold.
 */

import { dispatchAlert, type AgentAlert } from './alerting-config';

export interface AgentFailureRecord {
  agentId: string;
  /** ISO timestamp of the failure event */
  occurredAt: string;
}

const WINDOW_MINUTES = 60;
const FAILURE_THRESHOLD = 3;

/**
 * Filters records to those within the rolling window ending at `now`.
 */
function withinWindow(records: AgentFailureRecord[], now: Date): AgentFailureRecord[] {
  const cutoff = new Date(now.getTime() - WINDOW_MINUTES * 60 * 1000);
  return records.filter((r) => new Date(r.occurredAt) >= cutoff);
}

/**
 * Groups failure records by agentId.
 */
function groupByAgent(records: AgentFailureRecord[]): Map<string, AgentFailureRecord[]> {
  const map = new Map<string, AgentFailureRecord[]>();
  for (const record of records) {
    const existing = map.get(record.agentId) ?? [];
    existing.push(record);
    map.set(record.agentId, existing);
  }
  return map;
}

/**
 * Evaluates a batch of failure records against the rolling-window threshold.
 * Dispatches an alert for each agent whose failure count exceeds FAILURE_THRESHOLD
 * within the last WINDOW_MINUTES minutes.
 *
 * @param records - All failure records to evaluate (may span multiple agents).
 * @param now     - Reference timestamp (defaults to current time); injectable for testing.
 */
export async function evaluateThresholds(
  records: AgentFailureRecord[],
  now: Date = new Date(),
): Promise<void> {
  const recent = withinWindow(records, now);
  const byAgent = groupByAgent(recent);

  const dispatches: Promise<void>[] = [];

  for (const [agentId, agentRecords] of byAgent.entries()) {
    if (agentRecords.length > FAILURE_THRESHOLD) {
      const alert: AgentAlert = {
        agentId,
        failureCount: agentRecords.length,
        windowMinutes: WINDOW_MINUTES,
        thresholdExceeded: FAILURE_THRESHOLD,
        firedAt: now.toISOString(),
        message: `Agent "${agentId}" recorded ${agentRecords.length} failures in the last ${WINDOW_MINUTES} minutes (threshold: ${FAILURE_THRESHOLD}).`,
      };
      dispatches.push(dispatchAlert(alert));
    }
  }

  await Promise.allSettled(dispatches);
}
