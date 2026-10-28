import { getAgentMonitor } from '@/lib/monitoring/agent-monitor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentRunOptions {
  agentId: string;
  /** The async function that contains the agent logic. */
  run: () => Promise<void>;
  /** Skip the post-execution monitor check (useful in tests). */
  skipMonitor?: boolean;
}

export interface AgentRunResult {
  agentId: string;
  success: boolean;
  error?: unknown;
}

// ---------------------------------------------------------------------------
// Core runner
// ---------------------------------------------------------------------------

/**
 * Executes an agent invocation and — after execution — triggers the
 * AgentMonitor to check error thresholds for that agent.
 *
 * No per-agent boilerplate is required; callers simply pass `agentId` and the
 * async `run` function.
 */
export async function runAgent(options: AgentRunOptions): Promise<AgentRunResult> {
  const { agentId, run, skipMonitor = false } = options;

  let success = false;
  let error: unknown;

  try {
    await run();
    success = true;
  } catch (err) {
    error = err;
    // Error persistence is handled by the existing persistAgentError utility
    // that callers (or the run fn itself) should invoke. We intentionally do
    // NOT swallow or re-throw here so callers can decide handling.
    console.error(`[agent-runner] Agent "${agentId}" threw an unhandled error:`, err);
  } finally {
    if (!skipMonitor) {
      // Post-execution monitor check — fire-and-forget; never blocks the caller.
      getAgentMonitor()
        .check(agentId)
        .catch((monitorErr) =>
          console.error(`[agent-runner] AgentMonitor check failed for "${agentId}":`, monitorErr),
        );
    }
  }

  return { agentId, success, error };
}
