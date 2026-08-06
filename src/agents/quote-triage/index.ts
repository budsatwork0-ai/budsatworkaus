import { QuoteTriageInputSchema, QuoteTriageResponse } from './schema';
import { reportError } from '@/lib/error-reporting';

/**
 * Core business logic — kept separate so it can be unit-tested without the
 * validation/error wrapper.
 */
async function processQuoteTriage(
  input: import('./schema').QuoteTriageInput
): Promise<QuoteTriageResponse> {
  // TODO: replace with real triage logic
  return { success: true, quoteId: input.quoteId };
}

/**
 * Public entrypoint for the quote-triage agent.
 * Validates input with Zod, emits structured errors on failure.
 */
export async function runQuoteTriageAgent(
  rawInput: unknown
): Promise<QuoteTriageResponse> {
  const timestamp = new Date().toISOString();

  // Build a lightweight snapshot of the incoming shape for diagnostics
  const inputShape: Record<string, unknown> =
    rawInput !== null && typeof rawInput === 'object' && !Array.isArray(rawInput)
      ? Object.fromEntries(
          Object.entries(rawInput as Record<string, unknown>).map(([k, v]) => [
            k,
            Array.isArray(v) ? `Array(${(v as unknown[]).length})` : typeof v,
          ])
        )
      : { _raw: typeof rawInput };

  // --- Zod validation ---
  const parseResult = QuoteTriageInputSchema.safeParse(rawInput);

  if (!parseResult.success) {
    const errorResponse: QuoteTriageResponse = {
      success: false,
      error: 'quote-triage: invalid input payload',
      issues: parseResult.error.issues,
      timestamp,
      inputShape,
    };

    reportError({
      label: 'quote-triage:validation-failure',
      timestamp,
      inputShape,
      reason: parseResult.error.message,
      issues: parseResult.error.issues,
    });

    return errorResponse;
  }

  // --- Main handler wrapped in structured try/catch ---
  try {
    return await processQuoteTriage(parseResult.data);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);

    const errorResponse: QuoteTriageResponse = {
      success: false,
      error: 'quote-triage: unexpected processing failure',
      timestamp,
      inputShape,
    };

    reportError({
      label: 'quote-triage:processing-failure',
      timestamp,
      inputShape,
      reason,
    });

    return errorResponse;
  }
}
