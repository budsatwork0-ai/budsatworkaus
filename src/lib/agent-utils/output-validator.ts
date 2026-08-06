import { z, ZodSchema } from 'zod';

/**
 * Thrown when an agent's output is empty or fails schema validation.
 */
export class AgentOutputError extends Error {
  constructor(
    public readonly agentId: string,
    public readonly reason: string,
    public readonly cause?: unknown,
  ) {
    super(`[AgentOutputError] Agent "${agentId}" produced invalid output: ${reason}`);
    this.name = 'AgentOutputError';
  }
}

/**
 * Validates an agent's output payload against a Zod schema.
 *
 * - Throws `AgentOutputError` if `payload` is null, undefined, or an empty object/array.
 * - Throws `AgentOutputError` if `payload` fails schema validation.
 * - Returns the parsed (typed) value on success.
 */
export function validateOutput<T>(
  agentId: string,
  schema: ZodSchema<T>,
  payload: unknown,
): T {
  // Guard: null / undefined
  if (payload === null || payload === undefined) {
    throw new AgentOutputError(agentId, 'output is null or undefined');
  }

  // Guard: empty object
  if (
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    Object.keys(payload as object).length === 0
  ) {
    throw new AgentOutputError(agentId, 'output is an empty object {}');
  }

  // Guard: empty array
  if (Array.isArray(payload) && (payload as unknown[]).length === 0) {
    throw new AgentOutputError(agentId, 'output is an empty array []');
  }

  // Schema validation
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new AgentOutputError(
      agentId,
      `schema validation failed: ${result.error.message}`,
      result.error,
    );
  }

  return result.data;
}
