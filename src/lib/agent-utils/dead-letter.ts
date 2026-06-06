import { insertDeadLetter } from '@/infrastructure/queues/dead-letter-queue';

export interface AgentRunContext {
  agentId: string;
  runId: string;
  /** Arbitrary metadata about the run — will be stored as-is in the dead-letter table. */
  payload?: Record<string, unknown>;
}

type AgentRunFn<T> = () => Promise<T>;

/**
 * Wraps an agent run function.  If the run resolves to `null`, `undefined`,
 * an empty string, or an empty array, a dead-letter record is written to
 * Supabase so the silent failure becomes observable.  The original (empty)
 * result is still returned so downstream code is never broken.
 */
export async function agentOutputGuard<T>(
  ctx: AgentRunContext,
  fn: AgentRunFn<T>,
): Promise<T> {
  const result = await fn();

  if (isEmpty(result)) {
    await insertDeadLetter({
      agent_id: ctx.agentId,
      run_id: ctx.runId,
      payload: ctx.payload ?? {},
      timestamp: new Date().toISOString(),
    });
  }

  return result;
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}
