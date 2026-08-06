import { writeDeadLetter } from './dead-letter';
import { dispatchSlackAlert } from '../monitoring/alerting-config';
import { globalCircuitBreaker } from './circuit-breaker';
import { assertLLMConfig } from './config-validation';
import { validateAgentInput } from '../agent-dispatcher/validation';
import { recordAgentFailure } from '../monitoring/threshold-evaluator';

// Validate LLM credentials eagerly at module load.
assertLLMConfig();

export interface AgentRunnerPayload {
  agentName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: Record<string, any>;
}

export interface AgentRunnerResult {
  success: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  output?: Record<string, any>;
  error?: string;
  circuitOpen?: boolean;
}

/**
 * Runs the named agent with the supplied input.
 *
 * For `quote-triage` (and any other agent) the circuit-breaker is checked
 * before invocation.  When the circuit is open the payload is routed to
 * writeDeadLetter and a Slack alert is fired; no LLM call is attempted.
 * A successful probe in HALF_OPEN state resets the circuit to CLOSED.
 */
export async function runAgent(
  payload: AgentRunnerPayload,
): Promise<AgentRunnerResult> {
  const { agentName, input } = payload;

  // ------------------------------------------------------------------
  // 1. Circuit-breaker guard
  // ------------------------------------------------------------------
  if (globalCircuitBreaker.isOpen(agentName)) {
    const reason = `Circuit is OPEN for agent "${agentName}" — routing to dead-letter.`;

    await writeDeadLetter({
      agentName,
      payload: input,
      error: reason,
    });

    await dispatchSlackAlert({
      agentName,
      errorCount: globalCircuitBreaker.getConsecutiveFailures(agentName),
      message: reason,
      timestamp: new Date().toISOString(),
    });

    return { success: false, error: reason, circuitOpen: true };
  }

  // ------------------------------------------------------------------
  // 2. Input validation
  // ------------------------------------------------------------------
  try {
    validateAgentInput(agentName, input);
  } catch (validationErr) {
    const message =
      validationErr instanceof Error
        ? validationErr.message
        : 'Validation failed';
    recordAgentFailure(agentName);
    return { success: false, error: message };
  }

  // ------------------------------------------------------------------
  // 3. Agent invocation
  // ------------------------------------------------------------------
  try {
    const output = await invokeAgent(agentName, input);

    // Successful call – reset circuit.
    globalCircuitBreaker.recordSuccess(agentName);

    return { success: true, output };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown agent error';

    // Record failure in circuit-breaker and error-rate monitor.
    globalCircuitBreaker.recordFailure(agentName);
    recordAgentFailure(agentName);

    await writeDeadLetter({
      agentName,
      payload: input,
      error: message,
    });

    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Internal dispatcher — replace with your real agent invocation logic.
// ---------------------------------------------------------------------------
async function invokeAgent(
  agentName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any>> {
  // TODO: route to the correct agent implementation.
  throw new Error(`No implementation found for agent "${agentName}"`);
  // Suppress TS unreachable warning:
  // eslint-disable-next-line no-unreachable
  return {};
}
