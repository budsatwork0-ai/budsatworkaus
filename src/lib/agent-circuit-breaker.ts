import { createServiceClient } from '@/lib/supabase/server';

export type AgentResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'error'; error: unknown }
  | { status: 'degraded'; reason: string };

export interface CircuitBreakerOptions {
  /** Max errors in the rolling window before opening the circuit. Default: 20 */
  threshold?: number;
  /** Rolling window in milliseconds. Default: 3_600_000 (1 hour) */
  windowMs?: number;
  /** Slack webhook URL. Falls back to process.env.SLACK_ALERT_WEBHOOK */
  slackWebhook?: string;
}

async function getRollingErrorCount(
  agentId: string,
  windowMs: number
): Promise<number> {
  try {
    const supabase = createServiceClient();
    const since = new Date(Date.now() - windowMs).toISOString();
    const { count, error } = await supabase
      .from('agent_events')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('event_type', 'error')
      .gte('created_at', since);
    if (error) {
      console.error('[circuit-breaker] count query error', error);
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    console.error('[circuit-breaker] getRollingErrorCount threw', err);
    return 0;
  }
}

async function recordError(agentId: string): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from('agent_events').insert({
      agent_id: agentId,
      event_type: 'error',
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[circuit-breaker] recordError threw', err);
  }
}

async function fireSlackAlert(
  agentId: string,
  count: number,
  threshold: number,
  webhook: string
): Promise<void> {
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 *Circuit breaker OPEN* for agent \`${agentId}\`\n${count} errors in the last hour (threshold: ${threshold}). Requests will return \`degraded\` until error rate drops.`,
      }),
    });
  } catch (err) {
    console.error('[circuit-breaker] Slack alert failed', err);
  }
}

/**
 * Wraps an agent entry-point function with a rolling-window circuit breaker
 * backed by Supabase `agent_events`. When the error count exceeds `threshold`
 * within `windowMs` the circuit opens and the wrapper resolves with
 * `{ status: 'degraded' }` without calling `fn`, and fires a Slack alert.
 */
export async function withCircuitBreaker<T>(
  agentId: string,
  fn: () => Promise<T>,
  options?: CircuitBreakerOptions
): Promise<AgentResult<T>> {
  const threshold = options?.threshold ?? 20;
  const windowMs = options?.windowMs ?? 3_600_000;
  const slackWebhook =
    options?.slackWebhook ??
    process.env.SLACK_ALERT_WEBHOOK ??
    '';

  const rollingCount = await getRollingErrorCount(agentId, windowMs);

  if (rollingCount >= threshold) {
    if (slackWebhook) {
      await fireSlackAlert(agentId, rollingCount, threshold, slackWebhook);
    }
    console.warn(
      `[circuit-breaker] OPEN for ${agentId}: ${rollingCount} errors >= ${threshold}`
    );
    return {
      status: 'degraded',
      reason: `Circuit open: ${rollingCount} errors in the last hour (threshold ${threshold}).`,
    };
  }

  try {
    const data = await fn();
    return { status: 'ok', data };
  } catch (error) {
    await recordError(agentId);
    console.error(`[circuit-breaker] error recorded for ${agentId}`, error);
    return { status: 'error', error };
  }
}
