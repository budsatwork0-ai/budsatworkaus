/**
 * Post-execution output middleware for the shared agent runner.
 *
 * Usage: call `applyOutputGuard` immediately after any agent run resolves as
 * 'succeeded'. If the output payload is empty the run is downgraded to
 * 'succeeded_no_output', a structured warning event is emitted to the
 * observability pipeline (triggering agentSilentSuccessAlert), and the
 * operation is retried up to MAX_OUTPUT_RETRIES times before giving up.
 */

import { assertAgentOutput, AgentOutputMissingError, type AgentOutput } from './agent-output-guard';

// ─── Config ────────────────────────────────────────────────────────────────────
export const MAX_OUTPUT_RETRIES = 3;

// ─── Run result types ─────────────────────────────────────────────────────────
export type RunStatus =
  | 'succeeded'
  | 'succeeded_no_output'
  | 'failed'
  | 'retrying';

export interface AgentRunResult {
  runId: string;
  agentId: string;
  status: RunStatus;
  output: AgentOutput;
  attempt: number;
}

// ─── Observability hook ───────────────────────────────────────────────────────
/**
 * Structured warning event shape consumed by the observability pipeline.
 * The agentSilentSuccessAlert rule filters on eventType === 'agent_silent_success'.
 */
export interface AgentSilentSuccessEvent {
  eventType: 'agent_silent_success';
  agentId: string;
  runId: string;
  attempt: number;
  timestamp: string;
  message: string;
}

/** Emit to console.warn as structured JSON so log aggregators can parse it. */
function emitSilentSuccessWarning(event: AgentSilentSuccessEvent): void {
  console.warn(JSON.stringify(event));
}

// ─── Core middleware ──────────────────────────────────────────────────────────

/**
 * Executor callback type — the caller supplies a function that (re-)runs the
 * agent and returns a raw output payload.
 */
export type AgentExecutor = () => Promise<AgentOutput>;

/**
 * Applies the output guard to a completed agent run.
 *
 * - If output is non-empty: returns the result unchanged with status 'succeeded'.
 * - If output is empty: emits a warning, downgrades to 'succeeded_no_output',
 *   and retries via `executor` up to MAX_OUTPUT_RETRIES times.
 * - After exhausting retries: returns with status 'succeeded_no_output'.
 *
 * @param result   The completed run result (status must already be 'succeeded').
 * @param executor Optional re-run callback used for retries.
 */
export async function applyOutputGuard(
  result: AgentRunResult,
  executor?: AgentExecutor,
): Promise<AgentRunResult> {
  // Fast path — non-empty output, nothing to do.
  try {
    assertAgentOutput(result.output, result.agentId, result.runId);
    return result;
  } catch (err) {
    if (!(err instanceof AgentOutputMissingError)) throw err;
  }

  // Emit initial warning.
  const buildEvent = (attempt: number): AgentSilentSuccessEvent => ({
    eventType: 'agent_silent_success',
    agentId: result.agentId,
    runId: result.runId,
    attempt,
    timestamp: new Date().toISOString(),
    message: `Agent '${result.agentId}' succeeded with no output (attempt ${attempt}/${MAX_OUTPUT_RETRIES}).`,
  });

  emitSilentSuccessWarning(buildEvent(result.attempt));

  // Retry loop.
  if (executor) {
    for (let attempt = result.attempt + 1; attempt <= MAX_OUTPUT_RETRIES; attempt++) {
      const retryOutput = await executor();
      try {
        assertAgentOutput(retryOutput, result.agentId, result.runId);
        // Retry succeeded with output.
        return {
          ...result,
          status: 'succeeded',
          output: retryOutput,
          attempt,
        };
      } catch (err) {
        if (!(err instanceof AgentOutputMissingError)) throw err;
        emitSilentSuccessWarning(buildEvent(attempt));
      }
    }
  }

  // Exhausted retries — downgrade status.
  return {
    ...result,
    status: 'succeeded_no_output',
  };
}
