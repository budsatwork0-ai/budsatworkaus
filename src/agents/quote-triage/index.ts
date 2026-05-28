import { ZodError } from 'zod';
import { QuoteTriageInputSchema, QuoteTriageResult } from './schema';
import { reportError } from '@/lib/error-reporting';

/**
 * Internal processing logic — implement/import the real logic here.
 * Kept as a separate function so the try/catch wrapper stays thin.
 */
async function processQuoteTriage(
  input: import('./schema').QuoteTriageInput
): Promise<QuoteTriageResult> {
  // TODO: replace with actual agent logic.
  return {
    quoteId: input.quoteId,
    status: 'pending',
    processedAt: new Date().toISOString(),
  };
}

/**
 * Agent entrypoint.
 * Validates the raw input, delegates to processQuoteTriage, and
 * catches all errors with structured reporting so failures are never
 * silently dropped from the queue.
 */
export async function runQuoteTriage(
  rawInput: unknown
): Promise<QuoteTriageResult> {
  let quoteId = 'unknown';

  try {
    const input = QuoteTriageInputSchema.parse(rawInput);
    quoteId = input.quoteId;
    return await processQuoteTriage(input);
  } catch (err) {
    const isZodError = err instanceof ZodError;
    const failureReason = isZodError
      ? `Validation failed: ${err.errors.map((e) => `${e.path.join('.')} — ${e.message}`).join('; ')}`
      : err instanceof Error
      ? err.message
      : String(err);

    // Derive a safe summary of the incoming shape without sensitive values.
    const inputShape: Record<string, unknown> =
      rawInput !== null && typeof rawInput === 'object'
        ? Object.fromEntries(
            Object.keys(rawInput as object).map((k) => [
              k,
              typeof (rawInput as Record<string, unknown>)[k],
            ])
          )
        : { _type: typeof rawInput };

    reportError({
      area: 'agent/quote-triage',
      failureReason,
      inputShape,
      raw: isZodError ? err.errors : undefined,
    });

    // Graceful fallback — prevents silent queue drops.
    return {
      quoteId,
      status: 'error',
      reason: failureReason,
      processedAt: new Date().toISOString(),
    };
  }
}
