/**
 * agent-runner.ts
 * Typed scaffold for executing an agent function and performing
 * post-run validation, including empty-output metric emission.
 */

import {
  emitEmptyOutputMetric,
  getEmptyOutputCount,
} from '@/observability/agent-metrics';
import {
  EMPTY_OUTPUT_WINDOW_MS,
  isEmptyOutputAlertBreached,
} from '@/observability/alerts.config';

export interface AgentRunOptions {
  /** Stable identifier for the agent being executed. */
  agent_id: string;
  /** Whether to log alert breaches to the console (default: true). */
  logAlerts?: boolean;
}

export interface AgentRunResult<T> {
  agent_id: string;
  output: T | null;
  emptyOutput: boolean;
  alertBreached: boolean;
}

/**
 * Execute `fn` and run post-run validation:
 *  1. Treat `null`, `undefined`, and empty-string output as "empty".
 *  2. Emit the metric counter when output is empty.
 *  3. Check whether the rolling threshold has been breached.
 *
 * @param fn      The agent logic to execute. Must return T or null/undefined.
 * @param options Runner configuration.
 */
export async function runAgent<T>(
  fn: () => Promise<T | null | undefined>,
  options: AgentRunOptions
): Promise<AgentRunResult<T>> {
  const { agent_id, logAlerts = true } = options;

  const raw = await fn();

  // Post-run validation: detect empty output
  const isEmpty =
    raw === null ||
    raw === undefined ||
    (typeof raw === 'string' && raw.trim() === '');

  if (isEmpty) {
    emitEmptyOutputMetric(agent_id);
  }

  const currentCount = getEmptyOutputCount(agent_id, EMPTY_OUTPUT_WINDOW_MS);
  const alertBreached = isEmptyOutputAlertBreached(currentCount);

  if (alertBreached && logAlerts) {
    console.warn(
      `[agent-runner] ALERT: agent "${agent_id}" has produced ${
        currentCount
      } empty outputs in the last 15 minutes.`
    );
  }

  return {
    agent_id,
    output: isEmpty ? null : (raw as T),
    emptyOutput: isEmpty,
    alertBreached,
  };
}
