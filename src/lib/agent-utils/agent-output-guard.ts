import { z, ZodSchema } from 'zod';

/**
 * Thrown when an agent's output fails the declared output contract.
 */
export class OutputContractError extends Error {
  constructor(
    public readonly agentId: string,
    public readonly issues: string[],
  ) {
    super(
      `[OutputContractError] Agent "${agentId}" output failed contract: ${issues.join('; ')}`,
    );
    this.name = 'OutputContractError';
  }
}

/**
 * Asserts that `output` satisfies the given Zod schema.
 *
 * - Throws `OutputContractError` if `output` is null / undefined.
 * - Throws `OutputContractError` if the Zod parse fails.
 * - Returns the parsed (typed) output on success.
 */
export function assertAgentOutput<T>(
  agentId: string,
  schema: ZodSchema<T>,
  output: unknown,
): T {
  if (output === null || output === undefined) {
    throw new OutputContractError(agentId, ['output was null or undefined']);
  }

  const result = schema.safeParse(output);

  if (!result.success) {
    const issues = result.error.issues.map(
      (i) => `${i.path.join('.') || '(root)'}: ${i.message}`,
    );
    throw new OutputContractError(agentId, issues);
  }

  return result.data;
}
