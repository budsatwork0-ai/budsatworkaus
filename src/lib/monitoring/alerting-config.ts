/**
 * Alerting configuration for agent quality monitoring.
 * Dispatches structured webhook/Slack alerts when thresholds are breached.
 */

export interface AgentAlert {
  agentId: string;
  failureCount: number;
  threshold: number;
  thresholdType: 'relative' | 'absolute';
  firstFailureTimestamp: string;
}

const WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL ?? '';

export async function dispatchAgentAlert(alert: AgentAlert): Promise<void> {
  if (!WEBHOOK_URL) {
    console.warn('[alerting] ALERT_WEBHOOK_URL not configured — skipping alert dispatch', alert);
    return;
  }

  const payload = {
    text: [
      `🚨 *Agent Quality Alert*`,
      `• Agent ID: \`${alert.agentId}\``,
      `• Failure Count (this week): ${alert.failureCount}`,
      `• Threshold (${alert.thresholdType}): ${alert.threshold}`,
      `• First Failure: ${alert.firstFailureTimestamp}`,
    ].join('\n'),
    agent_id: alert.agentId,
    failure_count: alert.failureCount,
    threshold: alert.threshold,
    threshold_type: alert.thresholdType,
    first_failure_timestamp: alert.firstFailureTimestamp,
  };

  const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.error(
      `[alerting] Webhook dispatch failed: ${response.status} ${response.statusText}`,
    );
  }
}
