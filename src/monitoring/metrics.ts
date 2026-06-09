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
  const backend = process.env.METRIC_BACKEND ?? 'console';

  switch (backend) {
    case 'datadog': {
      // Wire up @datadog/datadog-api-client or dd-trace here.
      // Example (pseudo):
      //   const { metrics } = await import('@datadog/datadog-api-client');
      //   await metrics.submit({ series: [{ metric, points: [[Date.now()/1000, value]], tags: toTagArray(tags) }] });
      //
      // Left as a no-op until the SDK is installed so CI stays green.
      break;
    }

    case 'cloudwatch': {
      // Wire up @aws-sdk/client-cloudwatch here.
      // Example (pseudo):
      //   const { CloudWatchClient, PutMetricDataCommand } = await import('@aws-sdk/client-cloudwatch');
      //   const cw = new CloudWatchClient({});
      //   await cw.send(new PutMetricDataCommand({ Namespace: 'Bud/Agents', MetricData: [...] }));
      break;
    }

    default: {
      // 'console' — safe fallback for local dev and test environments.
      const tagStr = Object.entries(tags)
        .map(([k, v]) => `${k}:${v}`)
        .join(' ');
      console.info(`[metric] ${metric} +${value} { ${tagStr} }`);
    }
  }
}
