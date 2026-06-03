/**
 * agent-output-guard.ts
 *
 * Inspects a nominally successful AgentResult and re-classifies it as
 * 'failed_no_output' when the output is empty, so silent successes are
 * surfaced as real failures in dashboards and circuit-breaker logic.
 */

export type AgentStatus = 'success' | 'failed' | 'failed_no_output';

export interface AgentResult {
  status: AgentStatus;
  output?: unknown;
  error?: string;
  [key: string]: unknown;
}

/**
 * Returns true when a value should be considered "empty output".
 */
function isEmptyOutput(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value as object).length === 0
  ) {
    return true;
  }
  return false;
}

/**
 * If the result is nominally 'success' but has no meaningful output,
 * re-classifies it as 'failed_no_output'.
 *
 * All other results are returned unchanged.
 */
export function guardAgentOutput(result: AgentResult): AgentResult {
  if (result.status === 'success' && isEmptyOutput(result.output)) {
    return {
      ...result,
      status: 'failed_no_output',
      error: result.error ?? 'Agent resolved successfully but produced no output.',
    };
  }
  return result;
}
