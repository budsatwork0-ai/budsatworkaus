/**
 * dead-letter.ts
 *
 * Middleware that wraps any agent run function, detects empty/null output
 * via assertAgentOutput, and enqueues a dead-letter record without
 * touching individual agent implementations.
 */

import { assertAgentOutput, AgentNoOutputError } from '@/lib/agent-utils/assert-agent-output';
import { enqueueDeadLetter } from '@/infrastructure/queues/dead-letter-queue';

type AgentRunFn<T> = () => Promise<T>;

/**
 * Wraps `runFn` so that:
 * 1. If the run throws, the error is re-thrown (not swallowed).
 * 2. If the run succeeds but produces empty output, an AgentNoOutputError
 *    is dead-lettered and re-thrown so the caller knows the run failed.
 */
export async function withDeadLetter<T>(
  agentName: string,
  runFn: AgentRunFn<T>,
): Promise<T> {
  let result: T;
  try {
    result = await runFn();
  } catch (err) {
    // Unexpected runtime error — dead-letter and re-throw
    await enqueueDeadLetter({
      agent_name: agentName,
      reason: 'unexpected_error',
      detail: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  try {
    assertAgentOutput(agentName, result);
  } catch (err) {
    if (err instanceof AgentNoOutputError) {
      await enqueueDeadLetter({
        agent_name: agentName,
        reason: 'empty_output',
        detail: err.message,
      });
    }
    throw err;
  }

  return result;
}
