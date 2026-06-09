/**
 * Alert rule: agentSilentSuccessAlert
 *
 * Fires when an agent resolves as 'succeeded' but produces no output payload.
 * Consumes structured warning events emitted by runner-output-middleware.
 */

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  /** Signal / event type this rule matches against. */
  eventType: string;
  /** Minimum number of occurrences within windowMs before the alert fires. */
  threshold: number;
  /** Rolling window in milliseconds. */
  windowMs: number;
  severity: 'info' | 'warning' | 'critical';
}

export const agentSilentSuccessAlert: AlertRule = {
  id: 'agent-silent-success',
  name: 'Agent Silent Success',
  description:
    'An agent run resolved as succeeded but produced an empty output payload. ' +
    'This indicates a potential silent failure in agent logic.',
  eventType: 'agent_silent_success',
  threshold: 1,
  windowMs: 5 * 60 * 1000, // 5 minutes
  severity: 'warning',
};
