/**
 * quote-triage agent — self-contained, lazy Supabase init, dead-letter on failure.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const QuotePayloadSchema = z.object({
  id: z.string().uuid(),
  customer_id: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  line_items: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number().int().positive(),
        unit_price: z.number().nonnegative(),
      })
    )
    .min(1),
  created_at: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type QuotePayload = z.infer<typeof QuotePayloadSchema>;

export type TriageResult =
  | { ok: true; quote_id: string }
  | { ok: false; error_code: string; detail: string };

// ---------------------------------------------------------------------------
// Lazy Supabase client — created on first call so missing env vars crash at
// invocation time (surfaced in dead-letter) rather than at module import time.
// ---------------------------------------------------------------------------
let _supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (_supabase) return _supabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) must be set.'
    );
  }

  // Dynamic import kept synchronous via require so we avoid top-level await
  // requirements; the heavy @supabase/supabase-js bundle is only loaded once.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createClient: _createClient } = require('@supabase/supabase-js') as {
    createClient: typeof import('@supabase/supabase-js').createClient;
  };

  _supabase = _createClient(url, key);
  return _supabase;
}

// Keep the type reference available for the lazy getter above.
type createClient = typeof import('@supabase/supabase-js').createClient;

// ---------------------------------------------------------------------------
// Dead-letter helper
// ---------------------------------------------------------------------------
async function writeDeadLetter(
  rawPayload: unknown,
  errorCode: string,
  detail: string
): Promise<void> {
  try {
    const db = getSupabase();
    await db.from('quote_triage_dead_letter').insert({
      raw_payload: rawPayload,
      error_code: errorCode,
      detail,
      created_at: new Date().toISOString(),
    });
  } catch (dlErr) {
    // Dead-letter write itself failed — log and continue; do not re-throw.
    console.error('[quote-triage] dead-letter insert failed:', dlErr);
  }
}

// ---------------------------------------------------------------------------
// Core triage logic — called after validation passes
// ---------------------------------------------------------------------------
async function triageQuote(quote: QuotePayload): Promise<void> {
  const db = getSupabase();

  const { error } = await db.from('quotes').upsert(
    {
      id: quote.id,
      customer_id: quote.customer_id,
      amount: quote.amount,
      currency: quote.currency,
      line_items: quote.line_items,
      metadata: quote.metadata ?? null,
      triaged_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (error) {
    throw Object.assign(new Error(error.message), { code: 'DB_UPSERT_FAILED' });
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------
export async function handleQuoteTriage(
  rawPayload: unknown
): Promise<TriageResult> {
  // 1. Validate input
  const parsed = QuotePayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    await writeDeadLetter(rawPayload, 'VALIDATION_FAILED', detail);
    return { ok: false, error_code: 'VALIDATION_FAILED', detail };
  }

  const quote = parsed.data;

  // 2. Run triage
  try {
    await triageQuote(quote);
    return { ok: true, quote_id: quote.id };
  } catch (err: unknown) {
    const code =
      err instanceof Error && 'code' in err
        ? String((err as { code?: string }).code)
        : 'UNKNOWN_ERROR';
    const detail = err instanceof Error ? err.message : String(err);

    if (code === 'Missing Supabase env vars' || detail.includes('env vars')) {
      await writeDeadLetter(rawPayload, 'ENV_VAR_MISSING', detail);
      return { ok: false, error_code: 'ENV_VAR_MISSING', detail };
    }

    await writeDeadLetter(rawPayload, code, detail);
    return { ok: false, error_code: code, detail };
  }
}
