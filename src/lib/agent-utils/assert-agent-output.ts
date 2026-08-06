/**
 * assert-agent-output.ts
 *
 * Typed guard that ensures an agent produced meaningful output before its run
 * is marked as succeeded. Import and call `assertAgentOutput` in the base
 * agent runner immediately before any "succeeded" status transition.
 */

export class AgentNoOutputError extends Error {
  readonly agentId: string;

  constructor(agentId: string, detail?: string) {
    super(
      `Agent "${agentId}" completed without producing output.${
        detail ? ` ${detail}` : ''
      }`
    );
    this.name = 'AgentNoOutputError';
    this.agentId = agentId;
  }
}

/**
 * Throws `AgentNoOutputError` when `output` is null, undefined, an empty
 * string, or an empty array.  All other values (including `false`, `0`, and
 * empty plain objects) are considered valid output and pass through.
 *
 * @param output  The value returned by the agent.
 * @param agentId A stable identifier used in the error message and on the
 *                thrown error instance.
 */
export function assertAgentOutput(
  output: unknown,
  agentId: string
): asserts output is NonNullable<unknown> {
  if (output === null || output === undefined) {
    throw new AgentNoOutputError(agentId, 'Output was null or undefined.');
  }

  if (typeof output === 'string' && output.trim().length === 0) {
    throw new AgentNoOutputError(agentId, 'Output was an empty or whitespace-only string.');
  }

  if (Array.isArray(output) && output.length === 0) {
    throw new AgentNoOutputError(agentId, 'Output was an empty array.');
  }
}
