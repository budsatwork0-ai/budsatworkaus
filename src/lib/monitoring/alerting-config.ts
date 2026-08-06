export interface AgentAlert {
  agentName: string;
  errorCount: number;
  timestamp: string;
}

export async function dispatchSlackAlert(alert: AgentAlert): Promise<void> {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('[alerting] ALERT_WEBHOOK_URL is not set — skipping Slack alert');
    return;
  }

  const payload = {
    text: `🚨 Agent alert: *${alert.agentName}* has exceeded the error threshold with *${alert.errorCount} errors* as of ${alert.timestamp}`,
  };

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
