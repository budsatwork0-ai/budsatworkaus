import { persistAgentError } from './persist-agent-error';
import { agentMonitor } from '@/lib/monitoring/agent-monitor';

export async function runAgent(
  agentId: string,
  input: unknown
): Promise<unknown> {
  try {
    // Existing agent invocation logic (preserved as-is)
    const { getLLMClient } = await import('@/lib/llm/client');
    const client = getLLMClient();
    const result = await client.run(agentId, input);
    return result;
  } catch (err) {
    await persistAgentError(agentId, err);
    await agentMonitor.recordError(agentId);
    throw err;
  }
}
