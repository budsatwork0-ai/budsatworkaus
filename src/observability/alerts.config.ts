/**
 * alerts.config.ts
 *
 * Threshold rules for agent observability alerts.
 *
 * These definitions are intentionally data-only so they can be consumed
 * by any alerting backend (PagerDuty, Slack webhook, Prometheus
 * Alertmanager rules, etc.) without coupling to a specific transport.
 *
 * Rule: if an agent emits ≥ EMPTY_OUTPUT_THRESHOLD empty outputs
 * within EMPTY_OUTPUT_WINDOW_MS milliseconds, an alert should fire.
 */

/** A single threshold rule for an agent metric alert. */
export interface AlertThresholdRule {
  /** Human-readable name for this alert rule. */
  readonly name: string;
  /** The metric this rule applies to. */
  readonly metric: 'empty_output_count';
  /**
   * Alert fires when the counter increment rate meets or exceeds this
   * value within `windowMs`.
   */
  readonly threshold: number;
  /** Sliding-window duration in milliseconds. */
  readonly windowMs: number;
  /** Severity communicated to the alerting backend. */
  readonly severity: 'warning' | 'critical';
  /** Optional human-readable description. */
  readonly description?: string;
}

/**
 * All agent-level alert threshold rules.
 *
 * Consumers should iterate this array and register each rule with
 * their alerting backend of choice.
 */
export const AGENT_ALERT_RULES: readonly AlertThresholdRule[] = [
  {
    name: 'agent_empty_output_burst',
    metric: 'empty_output_count',
    // 3 or more empty outputs from the same agent within 15 minutes
    // indicates a systemic failure worth paging on.
    threshold: 3,
    windowMs: 15 * 60 * 1000, // 15 minutes
    severity: 'warning',
    description:
      'Fires when a single agent produces ≥3 empty outputs within a 15-minute window. ' +
      'Investigate the agent prompt, upstream data, or LLM connectivity.',
  },
] as const;
