/**
 * Agent lifecycle metric helpers.
 *
 * Provides a single typed entry-point for recording agent run events so that
 * every current and future agent can emit the same metric names without
 * per-agent boilerplate.
 *
 * Usage:
 *   import { incrementAgentMetric } from '@/monitoring/metrics';
 *   incrementAgentMetric('my-agent', 'succeeded_no_output');
 */

export type AgentLifecycleEvent =
  | 'run.started'
  | 'run.succeeded'
  | 'run.succeeded_no_output'
  | 'run.failed'
  | 'run.skipped';

export interface AgentMetricPayload {
  agentId: string;
  event: AgentLifecycleEvent;
  /** ISO-8601 timestamp; defaults to now. */
  timestamp?: string;
  /** Arbitrary key/value dimensions (e.g. trigger, jobId). */
  dimensions?: Record<string, string>;
}

/**
 * Increment a lifecycle counter for the given agent.
 *
 * The function is intentionally fire-and-forget: it logs to the console in
 * development and emits a structured JSON line in production so that log-based
 * metric pipelines (Datadog, CloudWatch Logs Insights, etc.) can parse it
 * without an SDK dependency.
 */
export function incrementAgentMetric(
  agentId: string,
  event: AgentLifecycleEvent,
  dimensions?: Record<string, string>,
): void {
  const payload: AgentMetricPayload = {
    agentId,
    event,
    timestamp: new Date().toISOString(),
    ...(dimensions !== undefined ? { dimensions } : {}),
  };

  const metricName = `agent.${event}`;

  if (process.env.NODE_ENV === 'development') {
    // Human-readable output in local dev.
    console.info(`[metric] ${metricName}`, payload);
  } else {
    // Structured JSON — parse with log-based metrics in production.
    process.stdout.write(
      JSON.stringify({ metric: metricName, ...payload }) + '\n',
    );
  }
}
