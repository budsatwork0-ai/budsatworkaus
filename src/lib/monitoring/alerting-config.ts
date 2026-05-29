export interface AgentAlert {
  agentId: string;
  errorCount: number;
  windowMinutes: number;
  threshold: number;
  firedAt: string; // ISO timestamp
}

const SLACK_WEBHOOK_URL = process.env.SLACK_ALERT_WEBHOOK_URL ?? '';

export async function dispatchAlert(alert: AgentAlert): Promise<void> {
  if (!SLACK_WEBHOOK_URL) {
    console.warn('[alerting] SLACK_ALERT_WEBHOOK_URL not configured — skipping alert dispatch');
    return;
  }

  const text =
    `:rotating_light: *Agent health alert*\n` +
    `Agent *${alert.agentId}* exceeded error threshold: ` +
    `${alert.errorCount} errors in the last ${alert.windowMinutes} min ` +
    `(threshold: ${alert.threshold}).\n` +
    `Fired at: ${alert.firedAt}`;

  try {
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      console.error(`[alerting] Slack webhook returned ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.error('[alerting] Failed to dispatch alert:', err);
  }
}
