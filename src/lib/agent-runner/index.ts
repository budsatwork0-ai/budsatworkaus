import { recordAgentFailure } from '@/lib/monitoring/threshold-evaluator';

export type AgentFn = (context: unknown) => Promise<unknown>;

export interface AgentDescriptor {
  name: string;
  fn: AgentFn;
}

export async function runAgent(
  agent: AgentDescriptor,
  context: unknown
): Promise<{ success: boolean; result?: unknown; error?: unknown }> {
  try {
    const result = await agent.fn(context);
    return { success: true, result };
  } catch (err) {
    await recordAgentFailure(agent.name);
    return { success: false, error: err };
  }
}
