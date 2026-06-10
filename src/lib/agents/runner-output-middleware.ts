/**
 * Runner output middleware — wraps any agent execution result and
 * enforces the invariant that a 'succeeded' run must have non-empty output.
 *
 * Usage (in your agent runner, after awaiting the agent function):
 *
 *   const result = await runWithOutputGuard(agentId, runId, rawResult);
 *
 * If output is missing the status is re-classified as 'succeeded_no_output'
 * and a structured warning is emitted.  After MAX_OUTPUT_RETRIES consecutive
 * empty outputs a hard AgentOutputMissingError is thrown so the caller can
 * surface it as a true failure.
 */

import { AgentOutputMissingError, isEmptyPayload } from './agent-output-guard';

export const MAX_OUTPUT_RETRIES = 3;

export type AgentRunStatus =
  | 'succeeded'
  | 'succeeded_no_output'
  | 'failed'
  | 'retrying';

export interface AgentRunResult {
  status: AgentRunStatus;
  output: unknown;
  agentId: string;
  runId: string;
  /** ISO-8601 timestamp set by this middleware */
  guardedAt: string;
  /** Present when status === 'succeeded_no_output' */
  warning?: string;
}

export interface RawAgentResult {
  /** Original status string from the agent executor */
  status: string;
  output: unknown;
}

/**
 * Emits a structured warning event to stderr (and any registered
 * listeners).  Structured so log aggregators can parse it.
 */
function emitOutputWarning(agentId: string, runId: string): void {
  const event = JSON.stringify({
    level: 'warn',
    event: 'agent_succeeded_no_output',
    agentId,
    runId,
    ts: new Date().toISOString(),
  });
  // Write to stderr so it surfaces in both local dev and cloud log streams
  // without requiring a specific logger import.
  process.stderr.write(event + '\n');
}

/**
 * Guards a single agent run result.  Returns an AgentRunResult with the
 * status adjusted when output is missing on a nominally successful run.
 *
 * @param agentId  The agent identifier string
 * @param runId    A unique identifier for this particular execution
 * @param raw      The raw result from the agent executor
 * @param emptyCount  How many consecutive empty outputs have been seen
 *                    (caller must track this; resets on non-empty output)
 */
export function applyOutputGuard(
  agentId: string,
  runId: string,
  raw: RawAgentResult,
  emptyCount = 0,
): AgentRunResult {
  const base: Omit<AgentRunResult, 'status' | 'warning'> = {
    agentId,
    runId,
    output: raw.output,
    guardedAt: new Date().toISOString(),
  };

  // Non-success statuses pass through untouched
  if (raw.status !== 'succeeded') {
    return { ...base, status: raw.status as AgentRunStatus };
  }

  // Success with output — all good
  if (!isEmptyPayload(raw.output)) {
    return { ...base, status: 'succeeded' };
  }

  // Success but no output — re-classify and warn
  emitOutputWarning(agentId, runId);

  // After exhausting retries, throw so callers treat it as a real failure
  if (emptyCount >= MAX_OUTPUT_RETRIES) {
    throw new AgentOutputMissingError(
      agentId,
      runId,
      `empty output persisted after ${MAX_OUTPUT_RETRIES} retries`,
    );
  }

  return {
    ...base,
    status: 'succeeded_no_output',
    warning: `Agent succeeded but returned no output (attempt ${emptyCount + 1}/${MAX_OUTPUT_RETRIES})`,
  };
}
