import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Typed error codes ────────────────────────────────────────────────────────
export type TriageErrorCode = 'VALIDATION_ERROR' | 'DB_ERROR' | 'UNKNOWN_ERROR';

// ─── Schema ───────────────────────────────────────────────────────────────────
const QuotePayloadSchema = z.object({
  id: z.string().uuid(),
  service: z.string().min(1),
  customer_email: z.string().email(),
  amount_cents: z.number().int().positive(),
  created_at: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type QuotePayload = z.infer<typeof QuotePayloadSchema>;

// ─── Dead-letter record ───────────────────────────────────────────────────────
interface DeadLetterRecord {
  error_code: TriageErrorCode;
  error_message: string;
  raw_payload: unknown;
  created_at: string;
}

// ─── Lazy Supabase init ───────────────────────────────────────────────────────
function getSupabase() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error(
      'Missing required env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    );
  }
  return createServiceClient();
}

// ─── Dead-letter insert ───────────────────────────────────────────────────────
async function writeDeadLetter(
  code: TriageErrorCode,
  message: string,
  rawPayload: unknown
): Promise<void> {
  try {
    const supabase = getSupabase();
    const record: DeadLetterRecord = {
      error_code: code,
      error_message: message,
      raw_payload: rawPayload,
      created_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from('quote_triage_dead_letters')
      .insert(record);
    if (error) {
      console.error('[quote-triage] dead-letter insert failed:', error.message);
    }
  } catch (err) {
    console.error('[quote-triage] dead-letter insert threw:', err);
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────
export async function triageQuote(rawPayload: unknown): Promise<void> {
  // 1. Validate
  const parsed = QuotePayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    console.error('[quote-triage] VALIDATION_ERROR:', message);
    await writeDeadLetter('VALIDATION_ERROR', message, rawPayload);
    return;
  }

  const quote = parsed.data;

  // 2. Get Supabase client (lazy — throws if env vars missing)
  let supabase: ReturnType<typeof createServiceClient>;
  try {
    supabase = getSupabase();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[quote-triage] UNKNOWN_ERROR (env):', message);
    await writeDeadLetter('UNKNOWN_ERROR', message, rawPayload);
    return;
  }

  // 3. Upsert into quotes table
  try {
    const { error } = await supabase
      .from('quotes_triaged')
      .upsert({
        id: quote.id,
        service: quote.service,
        customer_email: quote.customer_email,
        amount_cents: quote.amount_cents,
        metadata: quote.metadata ?? null,
        triaged_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[quote-triage] DB_ERROR:', error.message);
      await writeDeadLetter('DB_ERROR', error.message, rawPayload);
      return;
    }

    console.info('[quote-triage] successfully triaged quote', quote.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[quote-triage] UNKNOWN_ERROR:', message);
    await writeDeadLetter('UNKNOWN_ERROR', message, rawPayload);
  }
}
