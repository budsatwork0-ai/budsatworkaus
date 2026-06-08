/**
 * Shared output validation guard for agents.
 *
 * Usage:
 *   import { validateAgentOutput } from '@/lib/agents/shared/output-validator';
 *   const valid = validateAgentOutput(agentId, output);
 */

export interface AgentOutput {
  content?: string | null;
  [key: string]: unknown;
}

let noOutputFailures = 0;

/** Returns the current value of the no_output_failures counter (useful for tests / metrics export). */
export function getNoOutputFailureCount(): number {
  return noOutputFailures;
}

/** Resets the counter — intended for use in tests only. */
export function resetNoOutputFailureCount(): void {
  noOutputFailures = 0;
}

/**
 * Validates that an agent produced a non-null, non-empty output.
 *
 * - Returns `true`  when output is valid.
 * - Returns `false` when output is null/undefined/empty, logs a structured
 *   warning, and increments the `no_output_failures` counter.
 */
export function validateAgentOutput(
  agentId: string,
  output: AgentOutput | null | undefined
): output is AgentOutput {
  if (output == null) {
    noOutputFailures += 1;
    console.warn(JSON.stringify({
      level: 'warn',
      event: 'agent_no_output',
      agentId,
      reason: 'output is null or undefined',
      no_output_failures: noOutputFailures,
      ts: new Date().toISOString(),
    }));
    return false;
  }

  const content = output.content;
  if (content == null || (typeof content === 'string' && content.trim() === '')) {
    noOutputFailures += 1;
    console.warn(JSON.stringify({
      level: 'warn',
      event: 'agent_no_output',
      agentId,
      reason: 'output.content is null, undefined, or empty string',
      no_output_failures: noOutputFailures,
      ts: new Date().toISOString(),
    }));
    return false;
  }

  return true;
}
