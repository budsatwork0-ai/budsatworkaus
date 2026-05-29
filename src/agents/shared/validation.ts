import { ZodSchema, ZodError } from 'zod';
import { AgentPayloadSchemas, AgentPayloadType } from './schemas';

export class AgentValidationError extends Error {
  public readonly agentType: AgentPayloadType;
  public readonly issues: ZodError['issues'];

  constructor(agentType: AgentPayloadType, zodError: ZodError) {
    const summary = zodError.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    super(`Invalid payload for agent "${agentType}": ${summary}`);
    this.name = 'AgentValidationError';
    this.agentType = agentType;
    this.issues = zodError.issues;
  }
}

export function validateAgentPayload<T extends AgentPayloadType>(
  agentType: T,
  raw: unknown
): (typeof AgentPayloadSchemas)[T]['_output'] {
  const schema: ZodSchema = AgentPayloadSchemas[agentType];
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new AgentValidationError(agentType, result.error);
  }
  return result.data as (typeof AgentPayloadSchemas)[T]['_output'];
}
