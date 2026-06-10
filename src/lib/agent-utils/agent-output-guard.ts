import { z, ZodSchema } from 'zod';

/**
 * Thrown when an agent's output does not satisfy its declared output schema.
 */
export class OutputContractError extends Error {
  readonly agentId: string;
  readonly issues: z.ZodIssue[];

  constructor(agentId: string, issues: z.ZodIssue[]) {
    super(
      `Agent "${agentId}" output failed schema validation: ${
        issues.map((i) => `${i.path.join('.') || '(root)'} — ${i.message}`).join('; ')
      }`
    );
    this.name = 'OutputContractError';
    this.agentId = agentId;
    this.issues = issues;
  }
}

/**
 * Asserts that `output` satisfies the given Zod schema.
 * Throws `OutputContractError` on any violation.
 *
 * @param agentId  — used in the error message for traceability
 * @param schema   — the expected shape of the agent output
 * @param output   — the raw value returned by the agent
 */
export function assertAgentOutput<T>(
  agentId: string,
  schema: ZodSchema<T>,
  output: unknown
): asserts output is T {
  if (output === null || output === undefined) {
    throw new OutputContractError(agentId, [
      {
        code: z.ZodIssueCode.custom,
        path: [],
        message: `Output must not be ${output === null ? 'null' : 'undefined'}`,
      },
    ]);
  }

  const result = schema.safeParse(output);
  if (!result.success) {
    throw new OutputContractError(agentId, result.error.issues);
  }
}
