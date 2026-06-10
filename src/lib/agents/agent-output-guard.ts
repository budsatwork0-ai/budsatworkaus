import { z } from 'zod';

/**
 * Returns true when a payload should be considered "empty" —
 * i.e. the agent produced no meaningful output.
 */
export function isEmptyPayload(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

/**
 * Thrown when an agent resolves as 'succeeded' but returns an empty payload.
 */
export class AgentOutputMissingError extends Error {
  public readonly agentId: string;
  public readonly output: unknown;

  constructor(agentId: string, output: unknown) {
    super(
      `Agent "${agentId}" resolved as succeeded but returned an empty or invalid output.`
    );
    this.name = 'AgentOutputMissingError';
    this.agentId = agentId;
    this.output = output;
  }
}

/**
 * Validates agent output against an optional Zod schema.
 *
 * - If no schema is provided, falls back to the isEmptyPayload heuristic.
 * - Throws AgentOutputMissingError when validation fails.
 */
export function assertAgentOutput(
  agentId: string,
  output: unknown,
  schema?: z.ZodTypeAny
): void {
  if (schema) {
    const result = schema.safeParse(output);
    if (!result.success) {
      throw new AgentOutputMissingError(agentId, output);
    }
    return;
  }

  if (isEmptyPayload(output)) {
    throw new AgentOutputMissingError(agentId, output);
  }
}
