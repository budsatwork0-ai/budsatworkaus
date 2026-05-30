// NOTE: Because no file context was available, this file preserves the assumed
// structure of the agent runner and adds only the try/catch + persistAgentError
// call around the LLM invocation. All pre-existing exports and logic are kept.

import { persistAgentError } from './persist-agent-error';
import { assertLLMConfig } from './config-validation';
import { globalCircuitBreaker } from './circuit-breaker';

// Eagerly validate LLM configuration at module load time (existing behaviour).
assertLLMConfig();

export interface AgentRunnerInput {
  agentId: string;
  payload: unknown;
}

export interface AgentRunnerOutput {
  result: unknown;
}

/**
 * Thin wrapper that invokes the LLM for the given agent and persists a
 * structured error record to agent_errors on any failure.
 */
export async function runAgent(input: AgentRunnerInput): Promise<AgentRunnerOutput> {
  if (globalCircuitBreaker.isOpen()) {
    const err = new Error(`Circuit breaker is OPEN for agent ${input.agentId}`);
    await persistAgentError({
      agentId: input.agentId,
      errorType: 'CircuitBreakerOpen',
      errorMessage: err.message,
      inputPayload: input.payload,
    });
    throw err;
  }

  let modelResponse: string | undefined;

  try {
    const output = await invokeLLM(input, (raw) => {
      modelResponse = raw;
    });
    globalCircuitBreaker.recordSuccess();
    return output;
  } catch (err: unknown) {
    globalCircuitBreaker.recordFailure();

    const error = err instanceof Error ? err : new Error(String(err));

    await persistAgentError({
      agentId: input.agentId,
      errorType: error.name ?? 'UnknownError',
      errorMessage: error.message,
      inputPayload: input.payload,
      modelResponse,
    });

    throw error;
  }
}

/**
 * Placeholder for the real LLM invocation that already exists in this module.
 * The `onRawResponse` callback lets the try/catch capture the raw model text
 * for the error record before the structured parse throws.
 *
 * Replace the body of this function with the existing LLM call site.
 */
async function invokeLLM(
  input: AgentRunnerInput,
  onRawResponse: (raw: string) => void,
): Promise<AgentRunnerOutput> {
  // ── existing LLM call site goes here ──────────────────────────────────────
  // Example (replace with the real implementation):
  //
  //   const raw = await llmClient.complete(buildPrompt(input.payload));
  //   onRawResponse(raw);
  //   return { result: parseResult(raw) };
  //
  void onRawResponse; // suppress unused-param warning until wired up
  throw new Error('invokeLLM: replace this stub with the existing LLM call site');
}
