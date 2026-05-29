import { ZodError } from 'zod';
import {
  QuoteTriageInputSchema,
  QuoteTriageResult,
  type QuoteTriageInput,
} from './schema';
import { reportError } from '@/lib/error-reporting';

const AREA = 'agent/quote-triage';

/** Core triage logic — kept separate so it can be unit-tested in isolation. */
async function runTriage(input: QuoteTriageInput): Promise<QuoteTriageResult> {
  // Determine priority based on total order value.
  const totalCents = input.lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceCents,
    0
  );

  let priority: QuoteTriageResult['priority'];
  if (totalCents >= 1_000_000) {
    priority = 'urgent';
  } else if (totalCents >= 500_000) {
    priority = 'high';
  } else if (totalCents >= 100_000) {
    priority = 'medium';
  } else {
    priority = 'low';
  }

  return {
    quoteId: input.quoteId,
    priority,
    assignedTo: null,
    triageNotes: undefined,
    processedAt: new Date().toISOString(),
  };
}

/** Public entrypoint: validates input, runs triage, reports any failure. */
export async function triageQuote(
  rawInput: unknown
): Promise<QuoteTriageResult | null> {
  // --- Upfront validation ---
  const parseResult = QuoteTriageInputSchema.safeParse(rawInput);

  if (!parseResult.success) {
    const zodErr = parseResult.error as ZodError;
    reportError(AREA, `Validation failed: ${zodErr.message}`, {
      issues: zodErr.issues,
      receivedKeys:
        rawInput !== null && typeof rawInput === 'object'
          ? Object.keys(rawInput as Record<string, unknown>)
          : String(rawInput),
    });
    return null;
  }

  const input = parseResult.data;

  // --- Execution with structured error boundary ---
  try {
    return await runTriage(input);
  } catch (err) {
    const reason =
      err instanceof Error ? err.message : 'Unknown error during triage';
    reportError(AREA, reason, {
      quoteId: input.quoteId,
      customerId: input.customerId,
      lineItemCount: input.lineItems.length,
    });
    return null;
  }
}
