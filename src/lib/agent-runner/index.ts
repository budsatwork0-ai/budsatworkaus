import { recordAgentFailure } from '../monitoring/threshold-evaluator';

export interface AgentRunOptions {
  agentName: string;
  run: () => Promise<void>;
}

/**
 * Executes an agent function and emits structured failure events to the
 * threshold evaluator on any uncaught error, closing the detection gap
 * between agent execution and the monitoring pipeline.
 */
export async function runAgent({ agentName, run }: AgentRunOptions): Promise<void> {
  try {
    await run();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    recordAgentFailure({
      agentName,
      timestamp: new Date(),
      error: errorMessage,
    });

    // Re-throw so callers can still handle the error normally
    throw err;
  }
}
