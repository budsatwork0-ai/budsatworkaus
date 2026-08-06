/**
 * quote-triage agent
 * Self-contained – zero cross-file imports from this package.
 * Supabase client is initialised lazily inside the handler so missing
 * env-vars at module load time cannot crash the process on cold start.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const QuoteInputSchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1),
  source: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type QuoteInput = z.infer<typeof QuoteInputSchema>;

export type TriageResult =
  | { ok: true; category: string; confidence: number }
  | { ok: false; errorCode: 'VALIDATION_ERROR'; details: z.ZodIssue[] }
  | { ok: false; errorCode: 'MISSING_ENV'; missing: string[] }
  | { ok: false; errorCode: 'LLM_ERROR'; message: string }
  | { ok: false; errorCode: 'DEAD_LETTER_WRITTEN'; message: string };

// ---------------------------------------------------------------------------
// Lazy Supabase factory
// ---------------------------------------------------------------------------

function getRequiredEnv(): { url: string; key: string } | { missing: string[] } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const missing: string[] = [];
  if (!url) missing.push('SUPABASE_URL');
  if (!key) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length) return { missing };
  return { url, key };
}

async function getSupabaseClient() {
  // Dynamic import keeps the module loadable even when env-vars are absent.
  const { createClient } = await import('@supabase/supabase-js');
  const env = getRequiredEnv();
  if ('missing' in env) throw env; // caller checks shape
  return createClient(env.url, env.key);
}

// ---------------------------------------------------------------------------
// Dead-letter writer (best-effort, never throws)
// ---------------------------------------------------------------------------

async function writeDeadLetter(
  input: unknown,
  reason: string,
): Promise<void> {
  try {
    const client = await getSupabaseClient();
    await client.from('quote_triage_dead_letter').insert({
      payload: input,
      reason,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Intentionally swallowed – dead-letter writes must never surface errors.
  }
}

// ---------------------------------------------------------------------------
// LLM call (stub-friendly — replace body with real implementation)
// ---------------------------------------------------------------------------

async function callLLM(
  quote: QuoteInput,
): Promise<{ category: string; confidence: number }> {
  const llmUrl = process.env.LLM_API_URL;
  if (!llmUrl) {
    throw new Error('LLM_API_URL is not configured');
  }

  const response = await fetch(llmUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: quote.text, source: quote.source }),
  });

  if (!response.ok) {
    throw new Error(`LLM responded with ${response.status}`);
  }

  const data = (await response.json()) as { category?: string; confidence?: number };

  return {
    category: typeof data.category === 'string' ? data.category : 'unknown',
    confidence: typeof data.confidence === 'number' ? data.confidence : 0,
  };
}

// ---------------------------------------------------------------------------
// Public handler
// ---------------------------------------------------------------------------

export async function triageQuote(rawInput: unknown): Promise<TriageResult> {
  // 1. Validate input
  const parsed = QuoteInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, errorCode: 'VALIDATION_ERROR', details: parsed.error.issues };
  }
  const quote = parsed.data;

  // 2. Check env-vars before doing any real work
  const env = getRequiredEnv();
  if ('missing' in env) {
    return { ok: false, errorCode: 'MISSING_ENV', missing: env.missing };
  }

  // 3. Call LLM with structured error handling
  try {
    const result = await callLLM(quote);
    return { ok: true, ...result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // 4. Write to dead-letter table so the quote is not silently dropped
    await writeDeadLetter(rawInput, message);

    return { ok: false, errorCode: 'DEAD_LETTER_WRITTEN', message };
  }
}
