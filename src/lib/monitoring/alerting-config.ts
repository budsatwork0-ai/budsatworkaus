export interface AgentAlert {
  agentId: string;
  errorCount: number;
  threshold: number;
  windowMinutes: number;
  timestamp: string;
}

export async function dispatchSlackAlert(alert: AgentAlert): Promise<void> {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('[alerting] ALERT_WEBHOOK_URL is not set — skipping Slack alert', alert);
    return;
  }

  const text =
    `:rotating_light: *Agent Error Threshold Breached*\n` +
    `• Agent: \`${alert.agentId}\`\n` +
    `• Errors in last ${alert.windowMinutes} min: *${alert.errorCount}* (threshold: ${alert.threshold})\n` +
    `• Time: ${alert.timestamp}`;

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    console.error(
      `[alerting] Failed to dispatch Slack alert: ${response.status} ${response.statusText}`
    );
  }
}
