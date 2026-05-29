export interface AgentAlert {
  agentName: string;
  errorCount: number;
  windowMinutes: number;
  timestamp: string;
  message: string;
}

const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL;

export async function dispatchSlackAlert(alert: AgentAlert): Promise<void> {
  if (!ALERT_WEBHOOK_URL) {
    console.warn('[alerting-config] ALERT_WEBHOOK_URL is not set; skipping Slack alert.');
    return;
  }

  const body = JSON.stringify({
    text: `:warning: *Agent Error Alert*\nAgent: *${alert.agentName}*\nErrors in last ${alert.windowMinutes} min: *${alert.errorCount}*\nTime: ${alert.timestamp}\n${alert.message}`,
  });

  try {
    const res = await fetch(ALERT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (!res.ok) {
      console.error(`[alerting-config] Slack webhook returned ${res.status}`);
    }
  } catch (err) {
    console.error('[alerting-config] Failed to dispatch Slack alert:', err);
  }
}
