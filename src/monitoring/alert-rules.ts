/**
 * Per-agent alert-rule definitions for agent lifecycle events.
 *
 * Import ALERT_RULES into your alerting bootstrap / cron evaluator to
 * configure thresholds without touching individual agent files.
 *
 * Thresholds (per agent, per 1-hour rolling window):
 *   > WARNING_THRESHOLD_PER_HOUR  → warning  (investigate)
 *   > CRITICAL_THRESHOLD_PER_HOUR → critical (page on-call)
 */

import type { AgentMetricEvent } from './metrics';

// ─── Threshold constants ───────────────────────────────────────────────────────

/** Raise a WARNING when this many events occur within a 1-hour window. */
export const WARNING_THRESHOLD_PER_HOUR = 10;

/** Raise a CRITICAL alert when this many events occur within a 1-hour window. */
export const CRITICAL_THRESHOLD_PER_HOUR = 50;

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlertSeverity = 'warning' | 'critical';

export interface AlertThreshold {
  count: number;
  severity: AlertSeverity;
  /** Human-readable description forwarded to the on-call notification. */
  message: string;
}

export interface AlertRule {
  /** Metric name as emitted by incrementAgentMetric, e.g. "agent.run.succeeded_no_output" */
  metricName: string;
  event: AgentMetricEvent;
  /** Rolling window in seconds over which `count` is evaluated. */
  windowSeconds: number;
  thresholds: [AlertThreshold, ...AlertThreshold[]];
}

// ─── Rule definitions ─────────────────────────────────────────────────────────

/**
 * Alert rules evaluated by the monitoring pipeline.
 * Add a new entry here to monitor any additional AgentMetricEvent.
 */
export const ALERT_RULES: AlertRule[] = [
  {
    metricName: 'agent.run.succeeded_no_output',
    event: 'succeeded_no_output',
    windowSeconds: 3600,
    thresholds: [
      {
        count: WARNING_THRESHOLD_PER_HOUR,
        severity: 'warning',
        message:
          'Agent succeeded but produced no output more than ' +
          `${WARNING_THRESHOLD_PER_HOUR} times in the last hour — investigate upstream data quality.`,
      },
      {
        count: CRITICAL_THRESHOLD_PER_HOUR,
        severity: 'critical',
        message:
          'Agent succeeded_no_output rate is critically high (>' +
          `${CRITICAL_THRESHOLD_PER_HOUR}/hour) — page on-call immediately.`,
      },
    ],
  },
  {
    metricName: 'agent.run.failed',
    event: 'failed',
    windowSeconds: 3600,
    thresholds: [
      {
        count: WARNING_THRESHOLD_PER_HOUR,
        severity: 'warning',
        message: `Agent failure rate exceeded ${WARNING_THRESHOLD_PER_HOUR}/hour.`,
      },
      {
        count: CRITICAL_THRESHOLD_PER_HOUR,
        severity: 'critical',
        message: `Agent failure rate critically high (>${CRITICAL_THRESHOLD_PER_HOUR}/hour) — page on-call.`,
      },
    ],
  },
  {
    metricName: 'agent.run.timeout',
    event: 'timeout',
    windowSeconds: 3600,
    thresholds: [
      {
        count: WARNING_THRESHOLD_PER_HOUR,
        severity: 'warning',
        message: `Agent timeout rate exceeded ${WARNING_THRESHOLD_PER_HOUR}/hour.`,
      },
      {
        count: CRITICAL_THRESHOLD_PER_HOUR,
        severity: 'critical',
        message: `Agent timeout rate critically high (>${CRITICAL_THRESHOLD_PER_HOUR}/hour) — page on-call.`,
      },
    ],
  },
];
