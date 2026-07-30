/**
 * Agent lifecycle metric helpers.
 *
 * Centralises all agent-run counters so every current and future agent
 * can record the same lifecycle events through a single typed surface.
 *
 * Usage:
 *   import { incrementAgentMetric } from '@/monitoring/metrics';
 *   incrementAgentMetric('quote-triage', 'succeeded_no_output');
 */

export type AgentMetricEvent =
  | 'started'
  | 'succeeded'
  | 'succeeded_no_output'
  | 'failed'
  | 'skipped'
  | 'timeout';

export interface AgentMetricPayload {
  agentId: string;
  event: AgentMetricEvent;
  timestamp: string; // ISO-8601
  meta?: Record<string, string>;
}

/**
 * Emit a named lifecycle counter for an agent run.
 *
 * The function writes a structured JSON line to stdout so that any
 * log-scraping / metrics pipeline (Datadog, CloudWatch Logs Insights,
 * Supabase Edge Functions logs, etc.) can aggregate it with a single
 * filter on `metric.name`.
 *
 * Replace the `console.log` body with your SDK call
 * (e.g. `datadogMetrics.increment(...)`) when you adopt a richer
 * metrics backend — the call-sites remain unchanged.
 */
export function incrementAgentMetric(
  agentId: string,
  event: AgentMetricEvent,
  meta?: Record<string, string>,
): void {
  const payload: AgentMetricPayload = {
    agentId,
    event,
    timestamp: new Date().toISOString(),
    ...(meta !== undefined ? { meta } : {}),
  };

  // Structured log line — parseable by every common log-aggregation platform.
  console.log(
    JSON.stringify({
      metric: {
        name: `agent.run.${event}`,
        agentId,
        timestamp: payload.timestamp,
        ...(meta !== undefined ? { meta } : {}),
      },
    }),
  );
}
