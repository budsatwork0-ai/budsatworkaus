/**
 * assertAgentOutput — shared guard for agent runners.
 *
 * Throws AgentOutputMissingError when an agent produces null, undefined,
 * or an empty string so the bug is surfaced immediately rather than silently
 * succeeding with no-op output.
 */

export class AgentOutputMissingError extends Error {
  public readonly agentId: string;
  public readonly runId: string;

  constructor(agentId: string, runId: string) {
    super(
      `Agent "${agentId}" produced no output (runId: ${runId}). ` +
        'Check the upstream LLM call and input data.',
    );
    this.name = 'AgentOutputMissingError';
    this.agentId = agentId;
    this.runId = runId;
  }
}

/**
 * Assert that `output` is a non-null, non-empty value before the agent runner
 * marks the run as succeeded.
 *
 * @param output  - The value returned by the agent (any type).
 * @param agentId - Stable identifier for the agent (e.g. 'quote-triage').
 * @param runId   - Unique run / job id for log correlation.
 *
 * @throws {AgentOutputMissingError} when output is null, undefined, or an
 *   empty string.
 */
export function assertAgentOutput(
  output: unknown,
  agentId: string,
  runId: string,
): void {
  const isEmpty =
    output === null ||
    output === undefined ||
    (typeof output === 'string' && output.trim() === '');

  if (isEmpty) {
    const err = new AgentOutputMissingError(agentId, runId);
    // Always log so the error is traceable even if the caller swallows the throw.
    console.error(
      `[assertAgentOutput] MISSING OUTPUT agentId=${agentId} runId=${runId}`,
    );
    throw err;
  }
}
