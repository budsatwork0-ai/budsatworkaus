import { QuoteTriageInputSchema, QuoteTriageInput, QuoteTriageResult, TriageCategory } from './schema';
import { reportError } from '@/lib/error-reporting';

const AREA = 'agent/quote-triage';

/**
 * Core triage logic — pure function so it is independently testable.
 * Replace / extend this with your real model/rule calls.
 */
export function computeTriageCategory(input: QuoteTriageInput): { category: TriageCategory; reason: string } {
  if (input.totalValue <= 1000) {
    return { category: 'auto-approve', reason: 'Total value within auto-approve threshold.' };
  }
  if (input.totalValue <= 10000) {
    return { category: 'review-required', reason: 'Total value requires manual review.' };
  }
  return { category: 'reject', reason: 'Total value exceeds maximum permitted limit.' };
}

/**
 * Public entrypoint for the quote-triage agent.
 * Validates input with Zod and wraps execution in a structured try/catch.
 */
export async function triageQuote(rawInput: unknown): Promise<QuoteTriageResult> {
  // --- 1. Validate input ---
  const parseResult = QuoteTriageInputSchema.safeParse(rawInput);

  if (!parseResult.success) {
    const inputShape: Record<string, unknown> =
      rawInput !== null && typeof rawInput === 'object'
        ? (rawInput as Record<string, unknown>)
        : { raw: String(rawInput) };

    reportError({
      timestamp: new Date().toISOString(),
      area: AREA,
      reason: `Input validation failed: ${parseResult.error.message}`,
      inputShape,
    });

    throw new Error(`[${AREA}] Invalid input: ${parseResult.error.message}`);
  }

  const input: QuoteTriageInput = parseResult.data;

  // --- 2. Run triage ---
  try {
    const { category, reason } = computeTriageCategory(input);

    const result: QuoteTriageResult = {
      quoteId: input.quoteId,
      category,
      reason,
      triageAt: new Date().toISOString(),
    };

    return result;
  } catch (err) {
    reportError({
      timestamp: new Date().toISOString(),
      area: AREA,
      reason: err instanceof Error ? err.message : String(err),
      inputShape: {
        quoteId: input.quoteId,
        customerId: input.customerId,
        totalValue: input.totalValue,
        lineItemCount: input.lineItems.length,
      },
      originalError: err,
    });

    throw err;
  }
}
