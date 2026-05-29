import { evaluateThresholds, type ErrorRecord, type ThresholdConfig } from './threshold-evaluator';

// ---------------------------------------------------------------------------
// Minimal health-check runner — extend with real aggregation logic as needed.
// ---------------------------------------------------------------------------

export interface HealthCheckResult {
  checkedAt: string;
  alertedAgents: string[];
}

/**
 * Runs health checks over the provided error records, then evaluates thresholds
 * as a post-aggregation step so agent-level code requires no changes.
 */
export async function runHealthChecks(
  records: ErrorRecord[],
  thresholdConfig?: ThresholdConfig,
): Promise<HealthCheckResult> {
  // --- existing aggregation logic would run here ---

  // Post-aggregation: evaluate alert thresholds
  const alertedSet = await evaluateThresholds(records, thresholdConfig);

  return {
    checkedAt: new Date().toISOString(),
    alertedAgents: Array.from(alertedSet),
  };
}
