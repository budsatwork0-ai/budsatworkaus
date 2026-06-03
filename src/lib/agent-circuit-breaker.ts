import { createServiceClient } from '@/lib/supabase/server';

export type AgentResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; circuitOpen?: boolean };

export interface CircuitBreakerOptions {
  /** Agent name used for querying agent_events and Slack messages */
  agentName: string;
  /** Number of failures in the rolling window before the circuit opens. Default 5 */
  failureThreshold?: number;
  /** Rolling window in minutes. Default 60 */
  windowMinutes?: number;
  /** Slack webhook URL — falls back to SLACK_WEBHOOK_URL env var */
  slackWebhookUrl?: string;
}

async function postSlackAlert(webhookUrl: string, text: string): Promise<void> {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch {
    // Best-effort — never throw from alerting path
  }
}

async function countRecentFailures(
  agentName: string,
  windowMinutes: number,
): Promise<number> {
  const supabase = createServiceClient();
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('agent_events')
    .select('id', { count: 'exact', head: true })
    .eq('agent', agentName)
    .eq('event_type', 'error')
    .gte('created_at', since);
  if (error) return 0;
  return count ?? 0;
}

/**
 * Wraps an async agent function with rolling-window failure detection.
 * When failures exceed `failureThreshold` within `windowMinutes`, the
 * circuit opens, the call is skipped, and a Slack alert is fired.
 */
export async function withCircuitBreaker<T>(
  fn: () => Promise<T>,
  options: CircuitBreakerOptions,
): Promise<AgentResult<T>> {
  const {
    agentName,
    failureThreshold = 5,
    windowMinutes = 60,
    slackWebhookUrl = process.env.SLACK_WEBHOOK_URL,
  } = options;

  // Check rolling failure count before executing
  const recentFailures = await countRecentFailures(agentName, windowMinutes);
  if (recentFailures >= failureThreshold) {
    const msg = `[circuit-breaker] ${agentName}: circuit OPEN — ${recentFailures} failures in the last ${windowMinutes} min. Skipping invocation.`;
    console.error(msg);
    if (slackWebhookUrl) {
      await postSlackAlert(slackWebhookUrl, `:rotating_light: *${agentName}* circuit breaker OPEN — ${recentFailures} failures in ${windowMinutes} min window. Agent calls are being skipped.`);
    }
    return { ok: false, error: msg, circuitOpen: true };
  }

  try {
    const value = await fn();
    return { ok: true, value };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[circuit-breaker] ${agentName} invocation failed:`, message);

    // Record failure event
    try {
      const supabase = createServiceClient();
      await supabase.from('agent_events').insert({
        agent: agentName,
        event_type: 'error',
        payload: { error: message },
      });
    } catch {
      // Best-effort
    }

    // Re-check threshold after recording — may have just tripped the breaker
    const updatedFailures = await countRecentFailures(agentName, windowMinutes);
    if (updatedFailures >= failureThreshold && slackWebhookUrl) {
      await postSlackAlert(
        slackWebhookUrl,
        `:rotating_light: *${agentName}* just tripped the circuit breaker — ${updatedFailures} failures in the last ${windowMinutes} min.`,
      );
    }

    return { ok: false, error: message };
  }
}
