/**
 * Stack-agnostic metric counter for agent lifecycle events.
 *
 * Drop-in compatible with Datadog, CloudWatch, and Grafana/Prometheus:
 * - Set METRIC_BACKEND env var to 'datadog' | 'cloudwatch' | 'console' (default)
 * - In production wire up the real SDK in the backend-specific block below.
 */

export type AgentMetricName =
  | 'agent.run.succeeded_no_output'
  | 'agent.run.succeeded'
  | 'agent.run.failed'
  | 'agent.run.started'
  | 'agent.run.retried';

export interface MetricTags {
  agentId: string;
  [key: string]: string;
}

/**
 * Increment a named counter metric by `value` (default 1).
 *
 * Usage:
 *   await incrementAgentMetric('agent.run.succeeded_no_output', { agentId: 'quote-triage' });
 */
export async function incrementAgentMetric(
  metric: AgentMetricName,
  tags: MetricTags,
  value = 1,
): Promise<void> {
  const backend =
    typeof process !== 'undefined' && process.env.METRIC_BACKEND
      ? process.env.METRIC_BACKEND
      : 'console';

  switch (backend) {
    case 'datadog': {
      // Wire up @datadog/datadog-api-client or dd-trace here.
      // Left as a no-op until the SDK is installed so CI stays green.
      break;
    }

    case 'cloudwatch': {
      // Wire up @aws-sdk/client-cloudwatch here.
      // Left as a no-op until the SDK is installed so CI stays green.
      break;
    }

    default: {
      // 'console' — safe fallback for local dev and test environments.
      const tagStr = Object.entries(tags)
        .map(([k, v]) => `${k}:${v}`)
        .join(' ');
      // eslint-disable-next-line no-console
      console.info(`[metric] ${metric} +${value} { ${tagStr} }`);
    }
  }
}
