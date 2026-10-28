import { ZodTypeAny, ZodError } from 'zod';

/**
 * Thrown when an agent produces null, undefined, empty string, or
 * schema-invalid output. Treated as a failed run (reason: 'empty_output').
 */
export class AgentEmptyOutputError extends Error {
  constructor(
    public readonly agentName: string,
    public readonly detail: string,
  ) {
    super(`[${agentName}] empty or invalid output: ${detail}`);
    this.name = 'AgentEmptyOutputError';
  }
}

/**
 * Higher-order function that wraps an agent function and rejects:
 *   - null / undefined output
 *   - empty string output
 *   - output that fails the optional Zod schema
 *
 * @param agentName  Human-readable name used in error messages.
 * @param fn         The agent function to wrap.
 * @param schema     Optional Zod schema to validate the output shape.
 */
export function withOutputGuard<TInput, TOutput>(
  agentName: string,
  fn: (input: TInput) => Promise<TOutput>,
  schema?: ZodTypeAny,
): (input: TInput) => Promise<TOutput> {
  return async (input: TInput): Promise<TOutput> => {
    const result = await fn(input);

    // Null / undefined check
    if (result === null || result === undefined) {
      throw new AgentEmptyOutputError(agentName, 'output was null or undefined');
    }

    // Empty-string check
    if (typeof result === 'string' && result.trim() === '') {
      throw new AgentEmptyOutputError(agentName, 'output was an empty string');
    }

    // Schema validation
    if (schema) {
      try {
        schema.parse(result);
      } catch (err) {
        const detail =
          err instanceof ZodError
            ? err.issues.map((i) => i.message).join('; ')
            : String(err);
        throw new AgentEmptyOutputError(agentName, `schema validation failed: ${detail}`);
      }
    }

    return result;
  };
}
