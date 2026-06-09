/**
 * Agent output presence guardrail.
 *
 * Provides:
 *  - isEmptyPayload  — detects null / undefined / {} / []
 *  - AgentOutputMissingError — typed error for monitoring
 *  - assertAgentOutput — throws AgentOutputMissingError when output is empty
 */

export function isEmptyPayload(output: unknown): boolean {
  if (output === null || output === undefined) return true;
  if (Array.isArray(output)) return output.length === 0;
  if (typeof output === 'object') return Object.keys(output as object).length === 0;
  return false;
}

export class AgentOutputMissingError extends Error {
  readonly agentId: string;
  readonly runId: string;

  constructor(agentId: string, runId: string) {
    super(`Agent "${agentId}" run "${runId}" completed with empty output`);
    this.name = 'AgentOutputMissingError';
    this.agentId = agentId;
    this.runId = runId;
    // Maintain proper prototype chain in transpiled ES5
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Call after each agent execution. Throws AgentOutputMissingError when the
 * output is null, undefined, an empty object, or an empty array so the run
 * is never recorded as 'succeeded' with no meaningful payload.
 */
export function assertAgentOutput(output: unknown, agentId: string, runId: string): void {
  if (isEmptyPayload(output)) {
    throw new AgentOutputMissingError(agentId, runId);
  }
}
