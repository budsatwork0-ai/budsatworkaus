/**
 * output-validator.ts
 *
 * Shared utility for validating agent output objects against a minimal
 * presence contract. Optionally accepts a Zod schema for full structural
 * validation.
 *
 * Designed to be imported by any agent runner — no agent-specific logic here.
 */

import { z, ZodTypeAny } from 'zod';

// ─── Field presence descriptor ────────────────────────────────────────────────

export interface OutputFieldSpec {
  /** The top-level key that must be present on the output object */
  field: string;
  /** Expected typeof value — used for a lightweight presence + type check */
  type: 'string' | 'number' | 'boolean' | 'object';
}

// ─── Custom error class ───────────────────────────────────────────────────────

export class AgentOutputError extends Error {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message);
    this.name = 'AgentOutputError';
  }
}

// ─── Validator ────────────────────────────────────────────────────────────────

/**
 * validateAgentOutput
 *
 * Throws `AgentOutputError` if:
 *  - `output` is not a non-null object
 *  - any field listed in `requiredFields` is missing or has the wrong typeof
 *  - `schema` is provided and `schema.safeParse(output)` fails
 *
 * Returns void on success so callers can use it as a guard assertion.
 *
 * @param output        - The value returned by the agent core.
 * @param requiredFields - Minimal presence + type checks (no Zod dependency required).
 * @param schema        - Optional Zod schema for full structural validation.
 */
export function validateAgentOutput(
  output: unknown,
  requiredFields: OutputFieldSpec[] = [],
  schema?: ZodTypeAny
): void {
  if (output === null || typeof output !== 'object') {
    throw new AgentOutputError(
      `Agent output must be a non-null object, received: ${output === null ? 'null' : typeof output}`
    );
  }

  const record = output as Record<string, unknown>;

  for (const { field, type } of requiredFields) {
    if (!(field in record)) {
      throw new AgentOutputError(
        `Agent output is missing required field: "${field}"`,
        field
      );
    }
    // eslint-disable-next-line valid-typeof
    if (typeof record[field] !== type) {
      throw new AgentOutputError(
        `Agent output field "${field}" expected typeof ${type}, got ${typeof record[field]}`,
        field
      );
    }
  }

  if (schema) {
    const result = schema.safeParse(output);
    if (!result.success) {
      const issues = (result as z.SafeParseError<unknown>).error.issues
        .map((i) => `${i.path.join('.') || '_root'}: ${i.message}`)
        .join('; ');
      throw new AgentOutputError(`Agent output failed schema validation: ${issues}`);
    }
  }
}
