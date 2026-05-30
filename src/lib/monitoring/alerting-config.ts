export interface AgentAlert {
  agentName: string;
  errorCount: number;
  windowMinutes: number;
  timestamp: string;
}

export async function dispatchSlackAlert(alert: AgentAlert): Promise<void> {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('[alerting] ALERT_WEBHOOK_URL not set — skipping Slack alert', alert);
    return;
  }

  const text =
    `:rotating_light: *Agent Error-Rate Alert*\n` +
    `Agent: \`${alert.agentName}\`\n` +
    `Errors: ${alert.errorCount} in the last ${alert.windowMinutes} minutes\n` +
    `Time: ${alert.timestamp}`;

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error('[alerting] Slack webhook returned', res.status, await res.text());
    }
  } catch (err) {
    console.error('[alerting] Failed to dispatch Slack alert', err);
  }
}
