/**
 * Agent Output Guard
 * Provides utilities to assert that agent runs produce non-empty output payloads.
 * Called from the shared agent runner post-execution middleware.
 */

export type AgentOutput = Record<string, unknown> | unknown[] | null | undefined;

/** Returns true if the payload is considered empty (null, undefined, {}, []). */
export function isEmptyPayload(output: AgentOutput): boolean {
  if (output === null || output === undefined) return true;
  if (Array.isArray(output)) return output.length === 0;
  if (typeof output === 'object') return Object.keys(output).length === 0;
  return false;
}

/** Typed error thrown when an agent resolves as succeeded with no output. */
export class AgentOutputMissingError extends Error {
  readonly agentId: string;
  readonly runId: string;

  constructor(agentId: string, runId: string) {
    super(`Agent '${agentId}' (run ${runId}) resolved as succeeded but produced no output.`);
    this.name = 'AgentOutputMissingError';
    this.agentId = agentId;
    this.runId = runId;
  }
}

/**
 * Asserts that the output payload is non-empty.
 * Throws AgentOutputMissingError if the payload is empty.
 */
export function assertAgentOutput(
  output: AgentOutput,
  agentId: string,
  runId: string,
): void {
  if (isEmptyPayload(output)) {
    throw new AgentOutputMissingError(agentId, runId);
  }
}
