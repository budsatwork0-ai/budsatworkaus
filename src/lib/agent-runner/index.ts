import { recordAgentFailure } from '@/lib/monitoring/threshold-evaluator';

export interface AgentRunInput {
  agentId: string;
  payload: unknown;
}

export interface AgentRunResult {
  success: boolean;
  output?: unknown;
  error?: string;
}

// Registry of agent handler functions keyed by agentId.
// Extend this map as new agents are added.
const agentHandlers: Record<string, (payload: unknown) => Promise<unknown>> = {};

export async function runAgent(input: AgentRunInput): Promise<AgentRunResult> {
  const { agentId, payload } = input;

  try {
    const handler = agentHandlers[agentId];
    if (!handler) {
      throw new Error(`No handler registered for agent "${agentId}"`);
    }
    const output = await handler(payload);
    return { success: true, output };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[agent-runner] Agent "${agentId}" failed:`, message);

    // Count the failure and alert operators if the threshold is breached
    await recordAgentFailure(agentId);

    return { success: false, error: message };
  }
}

export function registerAgentHandler(
  agentId: string,
  handler: (payload: unknown) => Promise<unknown>
): void {
  agentHandlers[agentId] = handler;
}
