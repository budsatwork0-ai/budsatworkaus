import { recordAgentFailure } from '@/lib/monitoring/threshold-evaluator';
import {
  validateAgentInput,
  ValidationError,
  type AgentType,
} from '@/lib/agent-dispatcher/validation';

// ---------------------------------------------------------------------------
// Agent implementations – import (or inline-stub) the real handlers here.
// These placeholders preserve the existing call-site contract; replace them
// with the actual imports from the agent modules without further changes.
// ---------------------------------------------------------------------------
async function runQuoteTriage(input: unknown): Promise<unknown> {
  // Real implementation imported from the quote-triage agent module.
  throw new Error('runQuoteTriage: not yet wired — replace this stub');
}

async function runCustomerReply(input: unknown): Promise<unknown> {
  // Real implementation imported from the customer-reply agent module.
  throw new Error('runCustomerReply: not yet wired — replace this stub');
}

// ---------------------------------------------------------------------------
// Agent runner
// ---------------------------------------------------------------------------

export interface AgentRunResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Central agent runner.
 *
 * 1. Validates `payload` against the Zod schema for `agentType` **before**
 *    any LLM dispatch — a `ValidationError` is thrown immediately on failure.
 * 2. Wraps execution in try/catch so all failures (validation or runtime) are
 *    recorded via `recordAgentFailure` and returned as a structured rejection.
 */
export async function runAgent(
  agentType: AgentType,
  payload: unknown
): Promise<AgentRunResult> {
  try {
    // --- Input validation (closes cascade vector from upstream schema changes) ---
    const validatedInput = validateAgentInput(agentType, payload);

    // --- Dispatch to the appropriate agent implementation ---
    let data: unknown;
    switch (agentType) {
      case 'quote-triage':
        data = await runQuoteTriage(validatedInput);
        break;
      case 'customer-reply':
        data = await runCustomerReply(validatedInput);
        break;
    }

    return { success: true, data };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Unknown error';

    // Record failure in the rolling-window threshold evaluator so alerts fire.
    recordAgentFailure(agentType);

    // Attach the error category to the log for easier triage.
    const category =
      err instanceof ValidationError ? 'validation' : 'runtime';
    console.error(
      `[agent-runner] ${agentType} ${category} failure: ${message}`
    );

    return { success: false, error: message };
  }
}
