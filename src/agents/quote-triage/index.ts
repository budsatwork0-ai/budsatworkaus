import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schemas (inline to avoid circular-import issues)
// ---------------------------------------------------------------------------

const QuoteInputSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

const LLMOutputSchema = z.object({
  category: z.enum([
    'general_liability',
    'workers_comp',
    'commercial_auto',
    'property',
    'professional_liability',
    'unknown',
  ]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
});

export type QuoteInput = z.infer<typeof QuoteInputSchema>;
export type LLMOutput = z.infer<typeof LLMOutputSchema>;

export type TriageResult =
  | { ok: true; category: LLMOutput['category']; confidence: number; reasoning?: string }
  | { ok: false; error: string; code: 'VALIDATION_ERROR' | 'LLM_ERROR' | 'PARSE_ERROR' };

// ---------------------------------------------------------------------------
// Lazy Supabase logger — import happens only on first error, never at cold-start
// ---------------------------------------------------------------------------

async function logErrorToSupabase(
  area: string,
  reason: string,
  inputShape: unknown,
): Promise<void> {
  try {
    // Dynamic import ensures env vars aren't required at module load time
    const { createClient } = await import('@supabase/supabase-js');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return; // silently skip — avoid masking the real error
    const supabase = createClient(url, key);
    await supabase.from('agent_errors').insert({
      area,
      reason,
      input_shape: JSON.stringify(inputShape),
      occurred_at: new Date().toISOString(),
    });
  } catch {
    // Fire-and-forget — never throw from the logger
  }
}

// ---------------------------------------------------------------------------
// LLM classification stub — replace with real provider call
// ---------------------------------------------------------------------------

async function classifyWithLLM(text: string): Promise<unknown> {
  // TODO: replace with actual LLM provider integration
  // Returning a typed unknown so callers must safeParse before use
  throw new Error(`classifyWithLLM not yet implemented for input length ${text.length}`);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function triageQuote(rawInput: unknown): Promise<TriageResult> {
  // 1. Validate input
  const inputParse = QuoteInputSchema.safeParse(rawInput);
  if (!inputParse.success) {
    const reason = inputParse.error.message;
    // Fire-and-forget — do not await
    void logErrorToSupabase('agent/quote-triage', reason, rawInput);
    return { ok: false, error: reason, code: 'VALIDATION_ERROR' };
  }

  const input = inputParse.data;

  // 2. LLM classification with structured error handling
  let rawLLMOutput: unknown;
  try {
    rawLLMOutput = await classifyWithLLM(input.text);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    void logErrorToSupabase('agent/quote-triage', `LLM error: ${reason}`, { id: input.id });
    return { ok: false, error: reason, code: 'LLM_ERROR' };
  }

  // 3. Validate LLM output shape
  const outputParse = LLMOutputSchema.safeParse(rawLLMOutput);
  if (!outputParse.success) {
    const reason = outputParse.error.message;
    void logErrorToSupabase('agent/quote-triage', `LLM parse error: ${reason}`, { id: input.id });
    return { ok: false, error: reason, code: 'PARSE_ERROR' };
  }

  const { category, confidence, reasoning } = outputParse.data;
  return { ok: true, category, confidence, reasoning };
}
