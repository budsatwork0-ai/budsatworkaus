import { createClient } from '@/lib/supabase/server';
import { reportError } from '@/lib/error-reporting';
import { QuoteTriageInputSchema, QuoteTriageLLMOutputSchema, type QuoteTriageInput, type QuoteTriageLLMOutput } from './schema';

// ---------------------------------------------------------------------------
// Internal: call your LLM / downstream service here.
// Replace this stub with the real implementation.
// ---------------------------------------------------------------------------
async function runTriageLLM(_input: QuoteTriageInput): Promise<unknown> {
  throw new Error('runTriageLLM not yet implemented — replace this stub');
}

// ---------------------------------------------------------------------------
// Internal: push a failed job to the dead-letter queue.
// ---------------------------------------------------------------------------
async function sendToDeadLetterQueue(
  raw: unknown,
  reason: string,
): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from('quote_triage_dlq').insert({
      payload: raw,
      reason,
      failed_at: new Date().toISOString(),
    });
  } catch (dlqErr) {
    console.error('[quote-triage] dead-letter queue insert failed', dlqErr);
  }
}

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------
export async function triageQuote(
  rawInput: unknown,
): Promise<QuoteTriageLLMOutput | null> {
  const area = 'agent/quote-triage';
  const timestamp = new Date().toISOString();

  // 1. Validate input upfront — reject malformed payloads immediately.
  const parsed = QuoteTriageInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const reason = parsed.error.message;
    await reportError({
      timestamp,
      area,
      reason: `Input validation failed: ${reason}`,
      inputShape: typeof rawInput === 'object' && rawInput !== null
        ? (rawInput as Record<string, unknown>)
        : { raw: String(rawInput) },
      raw: rawInput,
    });
    await sendToDeadLetterQueue(rawInput, `input validation: ${reason}`);
    return null;
  }

  const input = parsed.data;

  // 2. Run core triage logic with structured error handling.
  try {
    const llmRaw = await runTriageLLM(input);

    const resultParsed = QuoteTriageLLMOutputSchema.safeParse(llmRaw);
    if (!resultParsed.success) {
      const reason = resultParsed.error.message;
      await reportError({
        timestamp: new Date().toISOString(),
        area,
        reason: `LLM output validation failed: ${reason}`,
        inputShape: { quoteId: input.quoteId, customerId: input.customerId },
        raw: llmRaw,
      });
      await sendToDeadLetterQueue(rawInput, `llm output validation: ${reason}`);
      return null;
    }

    return resultParsed.data;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await reportError({
      timestamp: new Date().toISOString(),
      area,
      reason: `Unexpected error: ${reason}`,
      inputShape: { quoteId: input.quoteId, customerId: input.customerId },
      raw: err,
    });
    await sendToDeadLetterQueue(rawInput, `unexpected error: ${reason}`);
    return null;
  }
}
