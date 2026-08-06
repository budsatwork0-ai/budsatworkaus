import { QuoteTriageInputSchema, QuoteTriageLLMOutputSchema, type QuoteTriageInput, type QuoteTriageLLMOutput, type FailureReason } from './schema';
import { reportError } from '@/lib/error-reporting';
import { createClient } from '@/lib/supabase/server';

const AREA = 'agent/quote-triage';
const LLM_TIMEOUT_MS = 30_000;

async function callLLM(input: QuoteTriageInput): Promise<QuoteTriageLLMOutput> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const response = await fetch(process.env.LLM_ENDPOINT_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const reason: FailureReason = response.status >= 500 ? '5xx' : 'unknown';
      throw Object.assign(new Error(`LLM responded with ${response.status}`), { failureReason: reason });
    }

    const raw: unknown = await response.json();
    const parsed = QuoteTriageLLMOutputSchema.safeParse(raw);
    if (!parsed.success) {
      throw Object.assign(
        new Error(`LLM output did not match schema: ${parsed.error.message}`),
        { failureReason: 'llm_schema' as FailureReason }
      );
    }

    return parsed.data;
  } finally {
    clearTimeout(timer);
  }
}

async function enqueueForHumanReview(input: QuoteTriageInput, reason: FailureReason): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from('quote_triage_review_queue').insert({
      quote_id: input.quoteId,
      customer_id: input.customerId,
      failure_reason: reason,
      queued_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[quote-triage] Failed to enqueue for human review:', err);
  }
}

export async function triageQuote(rawInput: unknown): Promise<QuoteTriageLLMOutput | null> {
  // 1. Validate input upfront
  const parsed = QuoteTriageInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const inputShape = typeof rawInput === 'object' && rawInput !== null
      ? Object.fromEntries(Object.keys(rawInput as Record<string, unknown>).map(k => [k, typeof (rawInput as Record<string, unknown>)[k]]))
      : {};

    await reportError({
      area: AREA,
      reason: 'schema_validation',
      message: parsed.error.message,
      inputShape,
    });

    return null;
  }

  const input = parsed.data;

  // 2. Call LLM with structured error handling
  try {
    return await callLLM(input);
  } catch (err: unknown) {
    let reason: FailureReason = 'unknown';
    let message = 'Unexpected error in quote-triage agent';

    if (err instanceof Error) {
      message = err.message;
      if (err.name === 'AbortError') {
        reason = 'timeout';
      } else if ('failureReason' in err) {
        reason = (err as Error & { failureReason: FailureReason }).failureReason;
      }
    }

    await reportError({
      area: AREA,
      reason,
      message,
      inputShape: {
        quoteId: input.quoteId,
        customerId: input.customerId,
        lineItemCount: input.lineItems.length,
      },
    });

    await enqueueForHumanReview(input, reason);

    return null;
  }
}
