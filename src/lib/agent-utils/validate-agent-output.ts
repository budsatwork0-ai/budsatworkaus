/**
 * Thin integration shim consumed by agent-runner.ts.
 *
 * Looks up the agent's registered schema and, if found, calls assertAgentOutput.
 * Returns `{ valid: true }` when the agent has no registered schema (opt-in model).
 * Returns `{ valid: false, error }` on contract violation so the caller can write
 * a `validation_error` run status instead of `succeeded`.
 */
import { assertAgentOutput, OutputContractError } from './agent-output-guard';
import { getAgentOutputSchema } from './agent-output-schemas';

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: OutputContractError };

export function validateAgentOutput(
  agentId: string,
  output: unknown
): ValidationResult {
  const schema = getAgentOutputSchema(agentId);
  if (!schema) {
    // No registered schema — skip validation (opt-in)
    return { valid: true };
  }

  try {
    assertAgentOutput(agentId, schema, output);
    return { valid: true };
  } catch (err) {
    if (err instanceof OutputContractError) {
      return { valid: false, error: err };
    }
    // Re-throw unexpected errors — they are not contract violations
    throw err;
  }
}
