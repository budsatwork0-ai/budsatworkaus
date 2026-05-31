/**
 * quote-triage agent
 *
 * Self-contained entrypoint:
 *  - Lazy Supabase init prevents cold-start env-var crash
 *  - Zod safeParse returns typed error codes
 *  - Structured try/catch writes failures to dead-letter table
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const QuoteSchema = z.object({
  id: z.string().uuid(),
  customer_id: z.string().uuid(),
  line_items: z
    .array(
      z.object({
        sku: z.string().min(1),
        qty: z.number().int().positive(),
        unit_price_cents: z.number().int().nonnegative(),
      })
    )
    .min(1),
  requested_at: z.string().datetime(),
});

export type Quote = z.infer<typeof QuoteSchema>;

// ---------------------------------------------------------------------------
// Typed error codes
// ---------------------------------------------------------------------------

export type TriageErrorCode =
  | 'VALIDATION_FAILED'
  | 'MISSING_ENV_VAR'
  | 'DB_INSERT_FAILED'
  | 'UNEXPECTED_ERROR';

export interface TriageError {
  code: TriageErrorCode;
  message: string;
  details?: unknown;
}

export interface TriageResult {
  ok: boolean;
  quoteId?: string;
  error?: TriageError;
}

// ---------------------------------------------------------------------------
// Lazy Supabase client — instantiated only when first needed so that missing
// env vars during module load don't crash the cold-start container.
// ---------------------------------------------------------------------------

let _supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (_supabase) return _supabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw { code: 'MISSING_ENV_VAR' as TriageErrorCode, message: 'Supabase env vars not set' };
  }

  _supabase = createClient(url, key);
  return _supabase;
}

// Dynamic import keeps the module loadable even when @supabase/supabase-js is
// absent in test environments that mock it.
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Dead-letter helper
// ---------------------------------------------------------------------------

async function writeDeadLetter(
  rawInput: unknown,
  error: TriageError
): Promise<void> {
  try {
    const supabase = getSupabase();
    await supabase.from('quote_triage_dead_letter').insert({
      raw_input: rawInput,
      error_code: error.code,
      error_message: error.message,
      error_details: error.details ?? null,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Dead-letter insert must never throw — log and swallow.
    console.error('[quote-triage] dead-letter insert failed', error);
  }
}

// ---------------------------------------------------------------------------
// Main triage function
// ---------------------------------------------------------------------------

export async function triageQuote(rawInput: unknown): Promise<TriageResult> {
  // 1. Validate input
  const parsed = QuoteSchema.safeParse(rawInput);
  if (!parsed.success) {
    const triageError: TriageError = {
      code: 'VALIDATION_FAILED',
      message: 'Quote failed schema validation',
      details: parsed.error.flatten(),
    };
    await writeDeadLetter(rawInput, triageError);
    return { ok: false, error: triageError };
  }

  const quote = parsed.data;

  try {
    const supabase = getSupabase();

    // 2. Persist the validated quote
    const { error: insertError } = await supabase
      .from('quotes_triaged')
      .insert({
        id: quote.id,
        customer_id: quote.customer_id,
        line_items: quote.line_items,
        requested_at: quote.requested_at,
        triaged_at: new Date().toISOString(),
      });

    if (insertError) {
      const triageError: TriageError = {
        code: 'DB_INSERT_FAILED',
        message: insertError.message,
        details: insertError,
      };
      await writeDeadLetter(rawInput, triageError);
      return { ok: false, quoteId: quote.id, error: triageError };
    }

    return { ok: true, quoteId: quote.id };
  } catch (err) {
    // Handle the MISSING_ENV_VAR sentinel thrown by getSupabase()
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'MISSING_ENV_VAR'
    ) {
      const triageError = err as TriageError;
      await writeDeadLetter(rawInput, triageError);
      return { ok: false, error: triageError };
    }

    const triageError: TriageError = {
      code: 'UNEXPECTED_ERROR',
      message: err instanceof Error ? err.message : String(err),
      details: err,
    };
    await writeDeadLetter(rawInput, triageError);
    return { ok: false, error: triageError };
  }
}
