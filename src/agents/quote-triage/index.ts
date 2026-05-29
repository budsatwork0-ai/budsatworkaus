import { ZodError } from 'zod';
import { QuoteTriageInputSchema, QuoteTriageResult } from './schema';
import { reportError } from '@/lib/error-reporting';

const AREA = 'agent/quote-triage';

/** Core triage logic — implement / import your actual LLM call here. */
async function runTriage(
  input: ReturnType<typeof QuoteTriageInputSchema.parse>
): Promise<QuoteTriageResult> {
  // TODO: replace with real LLM / downstream call.
  throw new Error('runTriage: not yet implemented');
}

/** Human-review queue — replace with your actual queue client. */
async function enqueueForHumanReview(
  rawInput: unknown,
  reason: string
): Promise<void> {
  // TODO: push to your review queue (e.g. Supabase table, SQS, etc.).
  console.warn('[quote-triage] enqueued for human review', { reason, rawInput });
}

/**
 * Public entrypoint for the quote-triage agent.
 * Validates input upfront and wraps all execution in a structured try/catch
 * so no failure is silently dropped.
 */
export async function triageQuote(
  rawInput: unknown
): Promise<QuoteTriageResult | null> {
  // 1. Upfront schema validation.
  let input: ReturnType<typeof QuoteTriageInputSchema.parse>;
  try {
    input = QuoteTriageInputSchema.parse(rawInput);
  } catch (err) {
    const reason =
      err instanceof ZodError
        ? `Validation failed: ${err.errors.map((e) => e.message).join('; ')}`
        : 'Unexpected validation error';

    reportError(AREA, reason, { rawInput }, err);
    await enqueueForHumanReview(rawInput, reason);
    return null;
  }

  // 2. Execute triage with structured error handling.
  try {
    const result = await runTriage(input);
    return result;
  } catch (err) {
    const reason =
      err instanceof Error ? err.message : 'Unknown triage error';

    reportError(
      AREA,
      reason,
      {
        quoteId: input.quoteId,
        customerId: input.customerId,
        lineItemCount: input.lineItems.length,
      },
      err
    );
    await enqueueForHumanReview(input, reason);
    return null;
  }
}
