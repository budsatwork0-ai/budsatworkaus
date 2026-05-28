/**
 * Threshold evaluation for agent quality.
 *
 * Rules (either condition triggers an alert):
 *   - RELATIVE: weeklyFailures > 2 × rolling2WeekAverage
 *   - ABSOLUTE:  weeklyFailures >= ABSOLUTE_FLOOR (3)
 */

import { dispatchAgentAlert, type AgentAlert } from './alerting-config';

const ABSOLUTE_FLOOR = 3;
const RELATIVE_MULTIPLIER = 2;

export interface AgentWeeklyStats {
  agentId: string;
  /** Failure count for the current week */
  weeklyFailureCount: number;
  /** Average weekly failures over the prior two weeks */
  rolling2WeekAverage: number;
  /** ISO timestamp of the first failure in the current window */
  firstFailureTimestamp: string;
}

/**
 * Evaluates each agent's stats against the thresholds and dispatches alerts
 * for any that breach them. Returns the list of alerts that were dispatched.
 */
export async function evaluateAgentThresholds(
  stats: AgentWeeklyStats[],
): Promise<AgentAlert[]> {
  const dispatched: AgentAlert[] = [];

  for (const stat of stats) {
    const relativeThreshold = RELATIVE_MULTIPLIER * stat.rolling2WeekAverage;
    const breachesRelative =
      stat.rolling2WeekAverage > 0 && stat.weeklyFailureCount > relativeThreshold;
    const breachesAbsolute = stat.weeklyFailureCount >= ABSOLUTE_FLOOR;

    if (!breachesRelative && !breachesAbsolute) {
      continue;
    }

    // Prefer the more specific threshold type in the alert label
    const thresholdType: AgentAlert['thresholdType'] = breachesRelative
      ? 'relative'
      : 'absolute';
    const threshold = breachesRelative ? relativeThreshold : ABSOLUTE_FLOOR;

    const alert: AgentAlert = {
      agentId: stat.agentId,
      failureCount: stat.weeklyFailureCount,
      threshold,
      thresholdType,
      firstFailureTimestamp: stat.firstFailureTimestamp,
    };

    await dispatchAgentAlert(alert);
    dispatched.push(alert);
  }

  return dispatched;
}
