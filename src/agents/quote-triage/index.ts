/**
 * quote-triage agent — single self-contained file
 *
 * Design goals:
 *  - Lazy Supabase initialisation (prevents cold-start env-var crash)
 *  - Inline Zod safeParse on every incoming quote payload
 *  - Structured try/catch that writes typed error records to
 *    quote_triage_dead_letter and flags the quote for manual review
 *  - Zero internal cross-file imports
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const QuotePayloadSchema = z.object({
  id: z.string().uuid(),
  customer_id: z.string().uuid(),
  items: z
    .array(
      z.object({
        sku: z.string().min(1),
        quantity: z.number().int().positive(),
        unit_price_cents: z.number().int().nonnegative(),
      })
    )
    .min(1),
  currency: z.string().length(3),
  created_at: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export type QuotePayload = z.infer<typeof QuotePayloadSchema>;

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export type TriageErrorCode =
  | 'VALIDATION_FAILED'
  | 'MISSING_ENV_VAR'
  | 'SUPABASE_INSERT_FAILED'
  | 'UNEXPECTED_ERROR';

export interface TriageError {
  code: TriageErrorCode;
  message: string;
  details?: unknown;
}

export type TriageResult =
  | { success: true; quoteId: string }
  | { success: false; error: TriageError };

// ---------------------------------------------------------------------------
// Lazy Supabase client
// ---------------------------------------------------------------------------

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    const missing = [
      !url && 'NEXT_PUBLIC_SUPABASE_URL',
      !key && 'SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)',
    ]
      .filter(Boolean)
      .join(', ');

    const err: TriageError = {
      code: 'MISSING_ENV_VAR',
      message: `Required environment variable(s) missing: ${missing}`,
    };
    throw err;
  }

  // Dynamic require so the module can be loaded in test environments
  // without NEXT_PUBLIC_SUPABASE_URL being set at import time.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// Dead-letter writer
// ---------------------------------------------------------------------------

async function writeDeadLetter(
  rawPayload: unknown,
  error: TriageError
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase.from('quote_triage_dead_letter').insert({
      raw_payload: rawPayload,
      error_code: error.code,
      error_message: error.message,
      error_details: error.details ?? null,
      created_at: new Date().toISOString(),
      needs_manual_review: true,
    });
  } catch (dlErr) {
    // Best-effort — log but never throw from the dead-letter writer itself.
    console.error('[quote-triage] dead-letter write failed:', dlErr);
  }
}

// ---------------------------------------------------------------------------
// Core triage logic
// ---------------------------------------------------------------------------

async function processValidQuote(
  supabase: ReturnType<typeof getSupabaseClient>,
  quote: QuotePayload
): Promise<void> {
  // Business logic placeholder — extend without changing the outer contract.
  const { error } = await supabase
    .from('quotes')
    .update({ triage_status: 'reviewed', triage_at: new Date().toISOString() })
    .eq('id', quote.id);

  if (error) {
    const triageErr: TriageError = {
      code: 'SUPABASE_INSERT_FAILED',
      message: error.message,
      details: error,
    };
    throw triageErr;
  }
}

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

export async function triageQuote(rawPayload: unknown): Promise<TriageResult> {
  // 1. Validate
  const parsed = QuotePayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const error: TriageError = {
      code: 'VALIDATION_FAILED',
      message: 'Quote payload failed schema validation',
      details: parsed.error.flatten(),
    };
    await writeDeadLetter(rawPayload, error);
    return { success: false, error };
  }

  const quote = parsed.data;

  // 2. Initialise Supabase (lazy — catches missing env vars at call time)
  let supabase: ReturnType<typeof getSupabaseClient>;
  try {
    supabase = getSupabaseClient();
  } catch (envErr) {
    const error = envErr as TriageError;
    await writeDeadLetter(rawPayload, error);
    return { success: false, error };
  }

  // 3. Process with structured error capture
  try {
    await processValidQuote(supabase, quote);
    return { success: true, quoteId: quote.id };
  } catch (procErr) {
    const isTypedError =
      procErr !== null &&
      typeof procErr === 'object' &&
      'code' in (procErr as object);

    const error: TriageError = isTypedError
      ? (procErr as TriageError)
      : {
          code: 'UNEXPECTED_ERROR',
          message:
            procErr instanceof Error ? procErr.message : String(procErr),
          details: procErr,
        };

    await writeDeadLetter(rawPayload, error);
    return { success: false, error };
  }
}
