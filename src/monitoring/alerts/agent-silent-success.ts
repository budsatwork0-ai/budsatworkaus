/**
 * Alert rule: agent-silent-success
 *
 * Fires a high-severity notification when any agent's `succeeded_no_output`
 * metric increases by more than 5 within a 15-minute rolling window.
 *
 * This file is pure monitoring-as-code — no database access, no schema
 * references, no changes to existing application files.
 */

export interface AlertRule {
  /** Unique identifier for this rule. */
  id: string;
  /** Human-readable name shown in alert notifications. */
  name: string;
  /** Description of what the alert detects. */
  description: string;
  /** Severity level forwarded to notification channels. */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** The metric name this rule watches. */
  metricName: string;
  /** How many occurrences within the window trigger the alert. */
  threshold: number;
  /** Rolling evaluation window in minutes. */
  windowMinutes: number;
  /** Notification channels to notify when the alert fires. */
  channels: Array<'slack' | 'pagerduty' | 'email'>;
  /** Optional runbook URL to include in the notification. */
  runbookUrl?: string;
}

/**
 * Alert fires when `succeeded_no_output` increases by more than 5 in any
 * 15-minute window for any single agent.  A high rate of silent successes
 * means the agent is completing without producing actionable output, which
 * is indistinguishable from a real success to downstream consumers.
 */
export const agentSilentSuccessAlert: AlertRule = {
  id: 'agent-silent-success',
  name: 'Agent Silent Success Rate Elevated',
  description:
    'One or more agents emitted more than 5 succeeded_no_output events ' +
    'within a 15-minute rolling window.  Silent successes are failures ' +
    'that are invisible to callers — investigate agent output contracts.',
  severity: 'high',
  metricName: 'succeeded_no_output',
  threshold: 5,
  windowMinutes: 15,
  channels: ['slack', 'pagerduty'],
  runbookUrl: 'https://github.com/your-org/your-repo/wiki/runbooks/agent-silent-success',
};
