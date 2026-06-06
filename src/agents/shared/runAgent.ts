import { withOutputGuard, AgentEmptyOutputError } from './withOutputGuard';
import { ZodTypeAny } from 'zod';

export interface AgentRunResult<TOutput> {
  success: boolean;
  output?: TOutput;
  /** Populated on failure */
  reason?: 'empty_output' | 'runtime_error';
  error?: Error;
}

export interface RunAgentOptions<TInput, TOutput> {
  /** Human-readable agent identifier used in logs and error messages. */
  agentName: string;
  /** The agent function to execute. */
  fn: (input: TInput) => Promise<TOutput>;
  /** Input to pass to the agent. */
  input: TInput;
  /** Optional Zod schema to validate the agent's output. */
  outputSchema?: ZodTypeAny;
}

/**
 * Canonical runner for all agents.
 *
 * Wires withOutputGuard automatically so every agent benefits from the
 * empty-output check without any per-agent boilerplate.
 *
 * Returns a typed AgentRunResult so callers can handle failure modes
 * without catching raw exceptions.
 */
export async function runAgent<TInput, TOutput>(
  options: RunAgentOptions<TInput, TOutput>,
): Promise<AgentRunResult<TOutput>> {
  const { agentName, fn, input, outputSchema } = options;

  const guardedFn = withOutputGuard(agentName, fn, outputSchema);

  try {
    const output = await guardedFn(input);
    return { success: true, output };
  } catch (err) {
    if (err instanceof AgentEmptyOutputError) {
      console.error(
        JSON.stringify({
          level: 'error',
          agent: agentName,
          event: 'agent_empty_output',
          message: err.message,
        }),
      );
      return {
        success: false,
        reason: 'empty_output',
        error: err,
      };
    }

    const runtimeErr = err instanceof Error ? err : new Error(String(err));
    console.error(
      JSON.stringify({
        level: 'error',
        agent: agentName,
        event: 'agent_runtime_error',
        message: runtimeErr.message,
      }),
    );
    return {
      success: false,
      reason: 'runtime_error',
      error: runtimeErr,
    };
  }
}
