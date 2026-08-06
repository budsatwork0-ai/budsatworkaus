import { ZodError } from 'zod';
import { AgentPayloadSchemas, AgentType } from './schemas';

// ── Typed validation error ────────────────────────────────────────────────────
export class AgentValidationError extends Error {
  readonly agentType: AgentType;
  readonly issues: ZodError['issues'];

  constructor(agentType: AgentType, zodError: ZodError) {
    super(
      `AgentValidationError [${agentType}]: ${
        zodError.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')
      }`
    );
    this.name = 'AgentValidationError';
    this.agentType = agentType;
    this.issues = zodError.issues;
  }
}

// ── Pre-dispatch validation gate ──────────────────────────────────────────────
/**
 * Validates `payload` against the schema registered for `agentType`.
 * Returns the parsed (typed) payload on success.
 * Throws `AgentValidationError` on failure — the dispatcher should catch this
 * and surface it to the monitoring layer before the LLM is invoked.
 */
export function validateAgentPayload<T extends AgentType>(
  agentType: T,
  payload: unknown
): ReturnType<(typeof AgentPayloadSchemas)[T]['parse']> {
  const schema = AgentPayloadSchemas[agentType];

  const result = schema.safeParse(payload);

  if (!result.success) {
    throw new AgentValidationError(agentType, result.error);
  }

  // Cast is safe: safeParse success guarantees the shape matches the schema.
  return result.data as ReturnType<(typeof AgentPayloadSchemas)[T]['parse']>;
}
