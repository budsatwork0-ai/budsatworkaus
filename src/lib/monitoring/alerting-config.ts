/**
 * alerting-config.ts
 * Holds the AgentAlert type and webhook dispatch logic.
 * Keeps alerting delivery decoupled from threshold evaluation.
 */

export interface AgentAlert {
  agentId: string;
  failureCount: number;
  windowMinutes: number;
  thresholdExceeded: number;
  firedAt: string; // ISO timestamp
  message: string;
}

const SLACK_WEBHOOK_URL = process.env.SLACK_ALERT_WEBHOOK_URL ?? '';
const PAGERDUTY_ROUTING_KEY = process.env.PAGERDUTY_ROUTING_KEY ?? '';

async function dispatchSlack(alert: AgentAlert): Promise<void> {
  if (!SLACK_WEBHOOK_URL) return;
  const body = JSON.stringify({
    text: `🚨 *Agent Quality Alert*\n*Agent:* ${alert.agentId}\n*Failures (last ${alert.windowMinutes} min):* ${alert.failureCount} (threshold: ${alert.thresholdExceeded})\n*Message:* ${alert.message}\n*Time:* ${alert.firedAt}`,
  });
  await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

async function dispatchPagerDuty(alert: AgentAlert): Promise<void> {
  if (!PAGERDUTY_ROUTING_KEY) return;
  const body = JSON.stringify({
    routing_key: PAGERDUTY_ROUTING_KEY,
    event_action: 'trigger',
    payload: {
      summary: alert.message,
      severity: 'error',
      source: `agent:${alert.agentId}`,
      custom_details: {
        failureCount: alert.failureCount,
        windowMinutes: alert.windowMinutes,
        thresholdExceeded: alert.thresholdExceeded,
        firedAt: alert.firedAt,
      },
    },
  });
  await fetch('https://events.pagerduty.com/v2/enqueue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

/**
 * Dispatches an alert to all configured channels (Slack, PagerDuty).
 * Channels that lack environment credentials are silently skipped.
 */
export async function dispatchAlert(alert: AgentAlert): Promise<void> {
  await Promise.allSettled([dispatchSlack(alert), dispatchPagerDuty(alert)]);
}
