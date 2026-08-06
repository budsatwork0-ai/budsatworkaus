import { validateAgentPayload, AgentValidationError } from './validation';
import { AgentPayloadType } from './schemas';

export type AgentHandler<T> = (payload: T) => Promise<unknown>;

const registry: Partial<Record<AgentPayloadType, AgentHandler<unknown>>> = {};

export function registerAgent<T extends AgentPayloadType>(
  agentType: T,
  handler: AgentHandler<(typeof import('./schemas').AgentPayloadSchemas)[T]['_output']>
): void {
  registry[agentType] = handler as AgentHandler<unknown>;
}

export async function dispatchAgent(
  agentType: AgentPayloadType,
  raw: unknown
): Promise<unknown> {
  // Validate input strictly before any agent logic or LLM call.
  let payload: unknown;
  try {
    payload = validateAgentPayload(agentType, raw);
  } catch (err) {
    if (err instanceof AgentValidationError) {
      // Re-throw as a structured error so callers get actionable context.
      throw err;
    }
    throw err;
  }

  const handler = registry[agentType];
  if (!handler) {
    throw new Error(`No handler registered for agent type "${agentType}"`);
  }

  return handler(payload);
}
