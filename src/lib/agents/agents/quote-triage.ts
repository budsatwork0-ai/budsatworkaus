/**
 * quote-triage agent
 *
 * Improvements applied:
 * - Output-validation guard: throws AgentOutputError when triaged_quote is null/empty.
 * - Structured logging on every exit path.
 * - Retry loop (max 2 retries) around the LLM call that populates triaged_quote,
 *   converting silent successes-with-empty-output into observable failures and
 *   reducing hard failures via self-healing retries.
 */

import { validateAgentOutput, AgentOutputError } from '@/lib/agent-utils/output-validator';

const AGENT_ID = 'quote-triage';
const MAX_RETRIES = 2;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuoteTriageInput {
  quote_id: string;
  raw_quote: string;
  [key: string]: unknown;
}

export interface QuoteTriageOutput {
  quote_id: string;
  triaged_quote: string;
  confidence: number;
  flags: string[];
}

// ─── Logger ───────────────────────────────────────────────────────────────────

function log(
  level: 'info' | 'warn' | 'error',
  event: string,
  meta: Record<string, unknown> = {}
): void {
  console[level](
    JSON.stringify({
      agent: AGENT_ID,
      level,
      event,
      ts: new Date().toISOString(),
      ...meta,
    })
  );
}

// ─── LLM call (isolated for retry) ───────────────────────────────────────────

/**
 * Calls the LLM/tool to produce a triaged_quote string.
 * Isolated into its own function so the retry loop can call it cleanly.
 */
async function callLlmForTriagedQuote(
  input: QuoteTriageInput
): Promise<string> {
  // In the real agent this would call an LLM SDK or tool-call function.
  // We keep the existing contract by delegating to the internal implementation.
  return await runLlmTriage(input);
}

/**
 * Internal LLM/tool implementation — kept separate from retry scaffolding.
 * Replace the body of this function when the underlying model/tool changes.
 */
async function runLlmTriage(input: QuoteTriageInput): Promise<string> {
  // Placeholder: real implementation calls the LLM and returns the triage text.
  // Returning empty string here would trigger the retry + validation guard.
  const result: string = await Promise.resolve(
    (input as unknown as { _llmResult?: string })._llmResult ?? ''
  );
  return result;
}

// ─── Main agent entry point ───────────────────────────────────────────────────

export async function runQuoteTriage(
  input: QuoteTriageInput
): Promise<QuoteTriageOutput> {
  log('info', 'agent_start', { quote_id: input.quote_id });

  let triaged_quote = '';
  let lastError: unknown = null;

  // Retry loop — max 2 retries (3 total attempts)
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      log('info', 'llm_call_attempt', { quote_id: input.quote_id, attempt });
      triaged_quote = await callLlmForTriagedQuote(input);

      if (!triaged_quote || triaged_quote.trim() === '') {
        log('warn', 'llm_empty_output', {
          quote_id: input.quote_id,
          attempt,
          will_retry: attempt <= MAX_RETRIES,
        });
        lastError = new AgentOutputError(
          AGENT_ID,
          'triaged_quote',
          `LLM returned empty output on attempt ${attempt}.`
        );
        // Continue to next attempt
        continue;
      }

      // Non-empty result — break out of retry loop
      log('info', 'llm_call_success', { quote_id: input.quote_id, attempt });
      lastError = null;
      break;
    } catch (err) {
      lastError = err;
      log('warn', 'llm_call_error', {
        quote_id: input.quote_id,
        attempt,
        will_retry: attempt <= MAX_RETRIES,
        error: err instanceof Error ? err.message : String(err),
      });
      if (attempt > MAX_RETRIES) {
        log('error', 'agent_hard_failure', {
          quote_id: input.quote_id,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    }
  }

  // After retries exhausted, enforce output contract
  if (lastError !== null || !triaged_quote || triaged_quote.trim() === '') {
    const validationError =
      lastError instanceof AgentOutputError
        ? lastError
        : new AgentOutputError(
            AGENT_ID,
            'triaged_quote',
            lastError instanceof Error ? lastError.message : 'All retries exhausted with empty output.'
          );
    log('error', 'agent_output_validation_failed', {
      quote_id: input.quote_id,
      error: validationError.message,
    });
    throw validationError;
  }

  // Final output-contract guard
  const output: QuoteTriageOutput = {
    quote_id: input.quote_id,
    triaged_quote,
    confidence: 1.0,
    flags: [],
  };

  try {
    validateAgentOutput(AGENT_ID, output as unknown as Record<string, unknown>, [
      'triaged_quote',
    ]);
  } catch (err) {
    log('error', 'agent_output_validation_failed', {
      quote_id: input.quote_id,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  log('info', 'agent_success', {
    quote_id: input.quote_id,
    triaged_quote_length: triaged_quote.length,
  });

  return output;
}
