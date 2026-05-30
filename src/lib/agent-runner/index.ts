import { recordAgentFailure } from '@/lib/monitoring/threshold-evaluator';
import { validateAgentInput } from '@/lib/agent-dispatcher/validation';
import { assertLLMConfig, ConfigurationError } from './config-validation';

// ---------------------------------------------------------------------------
// Eager startup validation — runs once when the module is first imported.
// If required LLM env vars are absent or malformed the process will surface a
// descriptive ConfigurationError immediately rather than producing ambiguous
// failures that are silently counted by recordAgentFailure.
// ---------------------------------------------------------------------------
assertLLMConfig();

export { ConfigurationError };

export interface AgentRunnerOptions {
  agentId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>;
}

export interface AgentRunnerResult {
  success: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  error?: string;
}

/**
 * Central agent runner entry point.
 *
 * Execution order:
 *   1. assertLLMConfig  (module-level, runs once)
 *   2. validateAgentInput
 *   3. LLM call (delegated to the concrete agent implementation)
 *   4. Error recording via recordAgentFailure on any failure
 */
export async function runAgent(
  options: AgentRunnerOptions,
): Promise<AgentRunnerResult> {
  const { agentId, payload } = options;

  try {
    // Input validation — throws ValidationError for malformed payloads.
    validateAgentInput(payload);

    // TODO: dispatch to the concrete agent implementation.
    // Placeholder so TypeScript is satisfied while the real dispatcher is wired.
    throw new Error('Agent dispatcher not yet implemented for agentId: ' + agentId);
  } catch (err: unknown) {
    // ConfigurationError should propagate unmodified — it indicates a
    // deployment-time problem, not a per-request failure worth counting.
    if (err instanceof ConfigurationError) {
      throw err;
    }

    const message = err instanceof Error ? err.message : String(err);
    recordAgentFailure(agentId);

    return {
      success: false,
      error: message,
    };
  }
}
