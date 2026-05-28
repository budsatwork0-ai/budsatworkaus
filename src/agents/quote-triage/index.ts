import { QuoteTriageInputSchema, QuoteTriageInput, QuoteTriageResult } from './schema';
import { reportError } from '@/lib/error-reporting';

const AREA = 'agent/quote-triage';

async function handleQuoteTriage(input: QuoteTriageInput): Promise<QuoteTriageResult> {
  // Core agent logic — preserved as-is; replace this stub with the real implementation.
  return {
    quoteId: input.quoteId,
    status: 'pending',
  };
}

export async function runQuoteTriage(raw: unknown): Promise<QuoteTriageResult | null> {
  const parsed = QuoteTriageInputSchema.safeParse(raw);

  if (!parsed.success) {
    reportError({
      area: AREA,
      reason: parsed.error.message,
      inputShape: typeof raw === 'object' && raw !== null
        ? Object.fromEntries(Object.keys(raw as object).map((k) => [k, typeof (raw as Record<string, unknown>)[k]]))
        : { raw: typeof raw },
      timestamp: new Date().toISOString(),
      raw,
    });
    return null;
  }

  try {
    return await handleQuoteTriage(parsed.data);
  } catch (err) {
    reportError({
      area: AREA,
      reason: err instanceof Error ? err.message : String(err),
      inputShape: Object.fromEntries(
        Object.keys(parsed.data).map((k) => [k, typeof (parsed.data as Record<string, unknown>)[k]])
      ),
      timestamp: new Date().toISOString(),
      raw: err,
    });
    return null;
  }
}
