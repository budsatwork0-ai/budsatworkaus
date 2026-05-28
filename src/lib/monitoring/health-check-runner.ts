/**
 * health-check-runner.ts
 * Runs periodic health checks and aggregates results.
 * Wired to threshold-evaluator so alerts fire automatically after each aggregation.
 */

import { evaluateThresholds, type AgentFailureRecord } from './threshold-evaluator';

export interface HealthCheckResult {
  agentId: string;
  success: boolean;
  checkedAt: string; // ISO timestamp
  detail?: string;
}

export interface AggregationSummary {
  totalChecks: number;
  totalFailures: number;
  checkedAt: string;
}

/**
 * Aggregates an array of health-check results into a summary and
 * automatically evaluates failure thresholds, dispatching alerts as needed.
 *
 * @param results - Results from the current health-check run.
 * @returns       - Aggregation summary for the caller.
 */
export async function aggregateAndEvaluate(
  results: HealthCheckResult[],
): Promise<AggregationSummary> {
  const now = new Date();

  const failures = results.filter((r) => !r.success);

  const summary: AggregationSummary = {
    totalChecks: results.length,
    totalFailures: failures.length,
    checkedAt: now.toISOString(),
  };

  // Convert failures to AgentFailureRecord shape for threshold evaluation.
  const failureRecords: AgentFailureRecord[] = failures.map((r) => ({
    agentId: r.agentId,
    occurredAt: r.checkedAt,
  }));

  // Fire-and-forget threshold evaluation; errors are swallowed so the
  // health-check pipeline is never blocked by alerting failures.
  evaluateThresholds(failureRecords, now).catch((err: unknown) => {
    console.error('[health-check-runner] threshold evaluation error:', err);
  });

  return summary;
}
