/**
 * output-validator.ts
 * Shared utility for validating agent output contracts.
 * Throws AgentOutputError when a required field is null/empty.
 */

export class AgentOutputError extends Error {
  readonly field: string;
  readonly agentId: string;

  constructor(agentId: string, field: string, detail?: string) {
    super(
      `[${agentId}] Output validation failed: field "${field}" is null or empty.${
        detail ? ` ${detail}` : ''
      }`
    );
    this.name = 'AgentOutputError';
    this.field = field;
    this.agentId = agentId;
  }
}

/**
 * Validate that every required field in `output` is non-null and non-empty.
 * Throws AgentOutputError on the first violation found.
 */
export function validateAgentOutput(
  agentId: string,
  output: Record<string, unknown>,
  requiredFields: string[]
): void {
  for (const field of requiredFields) {
    const value = output[field];
    if (value === null || value === undefined || value === '') {
      throw new AgentOutputError(agentId, field);
    }
    if (typeof value === 'string' && value.trim() === '') {
      throw new AgentOutputError(agentId, field, 'Value is blank/whitespace only.');
    }
  }
}
