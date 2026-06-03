/**
 * agent-circuit-breaker.ts
 *
 * Rolling-window circuit breaker backed by Supabase agent_events.
 * Treats 'failed_no_output' identically to 'failed' for threshold
 * counting and Slack alerting.
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { AgentResult } from '@/lib/agent-output-guard';

export interface CircuitBreakerOptions {
  /** Agent name used when querying agent_events. */
  agentName: string;
  /** Number of failures in the window before the circuit opens. Default: 5 */
  failureThreshold?: number;
  /** Rolling window in minutes. Default: 10 */
  windowMinutes?: number;
  /** Slack webhook URL — if absent, alerting is skipped. */
  slackWebhookUrl?: string;
}

export type CircuitBreakerResult =
  | { circuitOpen: false; result: AgentResult }
  | { circuitOpen: true; result: AgentResult };

/** Status values that count as a failure for circuit-breaking purposes. */
const FAILURE_STATUSES = new Set<string>(['failed', 'failed_no_output']);

async function countRecentFailures(
  agentName: string,
  windowMinutes: number,
): Promise<number> {
  try {
    const supabase = createServiceClient();
    const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from('agent_events')
      .select('id', { count: 'exact', head: true })
      .eq('agent_name', agentName)
      .in('status', ['failed', 'failed_no_output'])
      .gte('created_at', since);

    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function writeAgentEvent(
  agentName: string,
  result: AgentResult,
): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from('agent_events').insert({
      agent_name: agentName,
      status: result.status,
      error: result.error ?? null,
      output: result.output ?? null,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Non-fatal — never throw from event recording.
  }
}

async function sendSlackAlert(
  webhookUrl: string,
  agentName: string,
  failureCount: number,
  windowMinutes: number,
): Promise<void> {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 Circuit breaker OPEN for agent *${agentName}*: ${failureCount} failures (including no-output) in the last ${windowMinutes} minutes.`,
      }),
    });
  } catch {
    // Non-fatal.
  }
}

/**
 * Wraps an agent invocation with circuit-breaker semantics.
 *
 * - Counts recent 'failed' and 'failed_no_output' events.
 * - If the threshold is exceeded, returns immediately with circuitOpen: true.
 * - Otherwise, runs the agent, writes the event, and alerts on threshold breach.
 */
export async function withCircuitBreaker(
  options: CircuitBreakerOptions,
  run: () => Promise<AgentResult>,
): Promise<CircuitBreakerResult> {
  const {
    agentName,
    failureThreshold = 5,
    windowMinutes = 10,
    slackWebhookUrl,
  } = options;

  const recentFailures = await countRecentFailures(agentName, windowMinutes);

  if (recentFailures >= failureThreshold) {
    if (slackWebhookUrl) {
      await sendSlackAlert(slackWebhookUrl, agentName, recentFailures, windowMinutes);
    }
    const openResult: AgentResult = {
      status: 'failed',
      error: `Circuit open: ${recentFailures} failures in last ${windowMinutes} min.`,
    };
    return { circuitOpen: true, result: openResult };
  }

  const result = await run();

  await writeAgentEvent(agentName, result);

  if (FAILURE_STATUSES.has(result.status)) {
    const newCount = recentFailures + 1;
    if (newCount >= failureThreshold && slackWebhookUrl) {
      await sendSlackAlert(slackWebhookUrl, agentName, newCount, windowMinutes);
    }
  }

  return { circuitOpen: false, result };
}
