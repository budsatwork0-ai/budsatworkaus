import { z } from 'zod';

/**
 * Thrown when an agent produces null, undefined, or an empty-object result,
 * or when the result fails the declared Zod output schema.
 */
export class AgentEmptyOutputError extends Error {
  constructor(
    public readonly agentName: string,
    public readonly reason: string,
  ) {
    super(`[${agentName}] Invalid output: ${reason}`);
    this.name = 'AgentEmptyOutputError';
  }
}

/**
 * Wraps an agent run-function with output validation.
 *
 * - Throws AgentEmptyOutputError if the result is null / undefined.
 * - Throws AgentEmptyOutputError if the result is a plain object with no keys.
 * - Throws AgentEmptyOutputError if the result does not satisfy `schema` (when provided).
 */
export function withOutputGuard<TInput, TOutput>(
  agentName: string,
  schema: z.ZodType<TOutput> | null,
  fn: (input: TInput) => Promise<TOutput>,
): (input: TInput) => Promise<TOutput> {
  return async (input: TInput): Promise<TOutput> => {
    const result = await fn(input);

    // 1. Null / undefined check
    if (result === null || result === undefined) {
      throw new AgentEmptyOutputError(agentName, 'result was null or undefined');
    }

    // 2. Empty-object check (catches {} but not arrays or class instances)
    if (
      typeof result === 'object' &&
      !Array.isArray(result) &&
      Object.keys(result as object).length === 0
    ) {
      throw new AgentEmptyOutputError(agentName, 'result was an empty object {}');
    }

    // 3. Zod schema validation
    if (schema !== null) {
      const parsed = schema.safeParse(result);
      if (!parsed.success) {
        throw new AgentEmptyOutputError(
          agentName,
          `schema validation failed: ${parsed.error.message}`,
        );
      }
      return parsed.data;
    }

    return result;
  };
}
