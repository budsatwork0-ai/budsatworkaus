import { z, ZodTypeAny } from 'zod';

/**
 * Thrown when an agent output fails validation.
 */
export class AgentOutputError extends Error {
  constructor(
    message: string,
    public readonly details?: z.ZodError | string,
  ) {
    super(message);
    this.name = 'AgentOutputError';
  }
}

export interface ValidateOutputOptions<T> {
  /** When true, the output must be non-null and non-empty (for strings/arrays). */
  hasOutput?: boolean;
  /** Optional Zod schema to validate the output shape. */
  schema?: ZodTypeAny;
  /** Human-readable label used in error messages (e.g. the agent id). */
  label?: string;
}

/**
 * Validates an agent output value.
 *
 * @param output  - The raw output produced by an agent run.
 * @param options - Validation options.
 * @returns       The output, cast to T after successful validation.
 * @throws {AgentOutputError} When validation fails.
 */
export function validateOutput<T = unknown>(
  output: unknown,
  options: ValidateOutputOptions<T> = {},
): T {
  const { hasOutput = false, schema, label = 'agent' } = options;

  if (hasOutput) {
    if (output === null || output === undefined) {
      throw new AgentOutputError(
        `${label}: expected non-null output but received ${String(output)}`,
      );
    }
    if (typeof output === 'string' && output.trim().length === 0) {
      throw new AgentOutputError(
        `${label}: expected non-empty string output but received an empty string`,
      );
    }
    if (Array.isArray(output) && output.length === 0) {
      throw new AgentOutputError(
        `${label}: expected non-empty array output but received an empty array`,
      );
    }
  }

  if (schema !== undefined) {
    const result = schema.safeParse(output);
    if (!result.success) {
      throw new AgentOutputError(
        `${label}: output failed schema validation`,
        result.error,
      );
    }
    return result.data as T;
  }

  return output as T;
}
