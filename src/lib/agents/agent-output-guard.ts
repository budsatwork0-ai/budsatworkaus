/**
 * Agent output guard — enforces that a 'succeeded' agent run always
 * produces a non-empty, structurally valid output payload.
 *
 * This module is intentionally dependency-free so it can be imported
 * from both agent runners and monitoring code without circular refs.
 */

export class AgentOutputMissingError extends Error {
  constructor(
    public readonly agentId: string,
    public readonly runId: string,
    public readonly detail: string,
  ) {
    super(`[${agentId}] run ${runId} succeeded with no usable output: ${detail}`);
    this.name = 'AgentOutputMissingError';
  }
}

/**
 * Returns true when the payload is null, undefined, an empty object,
 * an empty array, or an empty string — i.e. carries no information.
 */
export function isEmptyPayload(payload: unknown): boolean {
  if (payload === null || payload === undefined) return true;
  if (typeof payload === 'string') return payload.trim().length === 0;
  if (Array.isArray(payload)) return payload.length === 0;
  if (typeof payload === 'object') return Object.keys(payload as object).length === 0;
  return false;
}

/**
 * Throws AgentOutputMissingError when the payload is empty.
 * Call this inside the agent runner immediately after a run resolves
 * as 'succeeded'.
 */
export function assertAgentOutput(
  payload: unknown,
  agentId: string,
  runId: string,
): void {
  if (isEmptyPayload(payload)) {
    throw new AgentOutputMissingError(agentId, runId, 'payload is null/empty');
  }
}

/**
 * Quote-triage-specific assertion: validates that the minimum required
 * fields (triage_category and priority) are present and non-empty.
 */
export function assertQuoteTriageOutput(
  payload: unknown,
  runId: string,
): void {
  const agentId = 'quote-triage';

  assertAgentOutput(payload, agentId, runId);

  const p = payload as Record<string, unknown>;

  if (!p['triage_category'] || typeof p['triage_category'] !== 'string') {
    throw new AgentOutputMissingError(
      agentId,
      runId,
      'missing or invalid triage_category field',
    );
  }

  if (!p['priority'] || typeof p['priority'] !== 'string') {
    throw new AgentOutputMissingError(
      agentId,
      runId,
      'missing or invalid priority field',
    );
  }
}
