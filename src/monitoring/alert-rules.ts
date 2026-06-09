/**
 * Alert rule definitions for agent lifecycle metrics.
 *
 * Import SUCCEEDED_NO_OUTPUT_THRESHOLD and SUCCEEDED_NO_OUTPUT_WINDOW_SECONDS
 * to tune the alert without hunting for magic numbers.
 */

import type { AgentMetricName } from './metrics';

// ─── Tunable constants ────────────────────────────────────────────────────────

/** Maximum allowed count of succeeded_no_output within the rolling window before alerting. */
export const SUCCEEDED_NO_OUTPUT_THRESHOLD = 10;

/** Rolling window size in seconds (default: 1 hour). */
export const SUCCEEDED_NO_OUTPUT_WINDOW_SECONDS = 3600;

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type NotificationChannel = 'oncall' | 'slack' | 'email';

export interface AlertRule {
  /** Human-readable rule identifier. */
  id: string;
  /** The metric this rule monitors. */
  metric: AgentMetricName;
  /** Rolling window in seconds over which the count is evaluated. */
  windowSeconds: number;
  /** Alert fires when the rolling count exceeds this value for any single agent. */
  threshold: number;
  /** Grouping dimension — alert fires per distinct value of this tag key. */
  groupByTag: 'agentId';
  severity: AlertSeverity;
  /** Notification channels to invoke when the rule fires. */
  channels: NotificationChannel[];
  /** Human-readable description shown in the alert notification. */
  description: string;
}

// ─── Rules ───────────────────────────────────────────────────────────────────

/**
 * Fires to the on-call channel when any single agent accumulates more than
 * SUCCEEDED_NO_OUTPUT_THRESHOLD empty-output successes within a 1-hour window.
 *
 * Background: 417 silent failures accumulated undetected because empty-output
 * successes were not treated as alertable conditions. This rule closes that gap.
 */
export const succeededNoOutputAlertRule: AlertRule = {
  id: 'agent.run.succeeded_no_output.spike',
  metric: 'agent.run.succeeded_no_output',
  windowSeconds: SUCCEEDED_NO_OUTPUT_WINDOW_SECONDS,
  threshold: SUCCEEDED_NO_OUTPUT_THRESHOLD,
  groupByTag: 'agentId',
  severity: 'critical',
  channels: ['oncall'],
  description:
    `Alert fires when a single agent records more than ${SUCCEEDED_NO_OUTPUT_THRESHOLD} ` +
    `succeeded_no_output events in a ${SUCCEEDED_NO_OUTPUT_WINDOW_SECONDS / 60}-minute window. ` +
    'Investigate for prompt/schema regressions or upstream data issues.',
};

/** All active alert rules — iterate this list to register rules with your alerting backend. */
export const ALL_ALERT_RULES: AlertRule[] = [succeededNoOutputAlertRule];
