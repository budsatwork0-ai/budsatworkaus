/**
 * Alert rule: agent_silent_success
 *
 * Pages on-call when the rolling 1-hour count of 'succeeded_no_output'
 * runs for a single agent exceeds the THRESHOLD.
 *
 * This module is intentionally side-effect-free; it exports a plain
 * AlertRule object consumed by the alert evaluation loop in index.ts.
 */

export interface AlertRule {
  /** Unique machine-readable identifier for this rule */
  id: string;
  /** Human-readable description */
  description: string;
  /** How often the evaluator should check this rule (ms) */
  intervalMs: number;
  evaluate: (ctx: AlertEvalContext) => AlertEvalResult | Promise<AlertEvalResult>;
}

export interface AlertEvalContext {
  /**
   * Returns the count of events with the given name for the given agent
   * within the rolling window (milliseconds).
   *
   * The concrete implementation is supplied by the evaluation harness so
   * this module stays free of any DB / telemetry imports.
   */
  countEvents: (eventName: string, agentId: string, windowMs: number) => number | Promise<number>;
}

export interface AlertEvalResult {
  firing: boolean;
  message?: string;
}

/** Number of succeeded_no_output events in 1 h that triggers an alert */
export const SILENT_SUCCESS_THRESHOLD = 5;

/** Rolling window in milliseconds (1 hour) */
export const ROLLING_WINDOW_MS = 60 * 60 * 1000;

/** Agent IDs to monitor — extend as needed */
export const MONITORED_AGENTS = ['quote-triage'] as const;

export const agentSilentSuccessAlert: AlertRule = {
  id: 'agent_silent_success',
  description:
    `Page on-call when any monitored agent emits more than ${SILENT_SUCCESS_THRESHOLD} ` +
    `succeeded_no_output events in a rolling 1-hour window.`,
  intervalMs: 5 * 60 * 1000, // evaluate every 5 minutes

  async evaluate(ctx: AlertEvalContext): Promise<AlertEvalResult> {
    for (const agentId of MONITORED_AGENTS) {
      const count = await ctx.countEvents(
        'agent_succeeded_no_output',
        agentId,
        ROLLING_WINDOW_MS,
      );

      if (count > SILENT_SUCCESS_THRESHOLD) {
        return {
          firing: true,
          message:
            `[ALERT] ${agentId} had ${count} silent successes in the last hour ` +
            `(threshold: ${SILENT_SUCCESS_THRESHOLD}). Investigate agent output path immediately.`,
        };
      }
    }

    return { firing: false };
  },
};
