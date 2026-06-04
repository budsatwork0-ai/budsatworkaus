import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Input schema ─────────────────────────────────────────────────────────────
const QuoteInputSchema = z.object({
  id: z.string(),
  service: z.string(),
  customer_email: z.string().email(),
  customer_name: z.string().optional(),
  price_cents: z.number().int().nonnegative(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type QuoteInput = z.infer<typeof QuoteInputSchema>;

// ─── Output types ─────────────────────────────────────────────────────────────
export type TriageSuccess = {
  ok: true;
  quoteId: string;
  tier: 'auto_approve' | 'manual_review' | 'reject';
};

export type TriageError = {
  ok: false;
  errorCode:
    | 'MISSING_ENV_VAR'
    | 'SCHEMA_VALIDATION_ERROR'
    | 'TRIAGE_LOGIC_ERROR'
    | 'DEAD_LETTER_INSERT_FAILED';
  message: string;
  quoteId?: string;
};

export type TriageResult = TriageSuccess | TriageError;

// ─── Required env vars ────────────────────────────────────────────────────────
const REQUIRED_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

function checkEnv(): string | null {
  for (const key of REQUIRED_ENV) {
    if (!process.env[key]) return key;
  }
  return null;
}

// ─── Dead-letter insert ───────────────────────────────────────────────────────
async function insertDeadLetter(
  raw: unknown,
  errorCode: TriageError['errorCode'],
  message: string,
): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from('quote_triage_dead_letters').insert({
      raw_input: JSON.stringify(raw),
      error_code: errorCode,
      error_message: message,
      created_at: new Date().toISOString(),
    });
  } catch (dbErr) {
    console.error('[quote-triage] dead-letter insert failed:', dbErr);
  }
}

// ─── Triage logic ─────────────────────────────────────────────────────────────
function triageQuote(quote: QuoteInput): TriageSuccess['tier'] {
  if (quote.price_cents > 100_000) return 'manual_review';
  if (quote.price_cents === 0) return 'reject';
  return 'auto_approve';
}

// ─── Entry point ──────────────────────────────────────────────────────────────
export async function run(rawInput: unknown): Promise<TriageResult> {
  try {
    // 1. Guard: required env vars
    const missingEnv = checkEnv();
    if (missingEnv) {
      const message = `[quote-triage] Missing required environment variable: ${missingEnv}`;
      console.error(message);
      const result: TriageError = {
        ok: false,
        errorCode: 'MISSING_ENV_VAR',
        message,
      };
      await insertDeadLetter(rawInput, 'MISSING_ENV_VAR', message);
      return result;
    }

    // 2. Guard: input schema validation
    const parsed = QuoteInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const message = `[quote-triage] Schema validation failed: ${parsed.error.message}`;
      console.error(message, { issues: parsed.error.issues });
      const result: TriageError = {
        ok: false,
        errorCode: 'SCHEMA_VALIDATION_ERROR',
        message,
      };
      await insertDeadLetter(rawInput, 'SCHEMA_VALIDATION_ERROR', message);
      return result;
    }

    const quote = parsed.data;

    // 3. Core triage logic
    const tier = triageQuote(quote);

    // 4. Persist triage outcome
    const supabase = createServiceClient();
    const { error: dbError } = await supabase.from('quote_triage_results').insert({
      quote_id: quote.id,
      tier,
      triaged_at: new Date().toISOString(),
    });

    if (dbError) {
      const message = `[quote-triage] DB insert failed: ${dbError.message}`;
      console.error(message);
      const result: TriageError = {
        ok: false,
        errorCode: 'TRIAGE_LOGIC_ERROR',
        message,
        quoteId: quote.id,
      };
      await insertDeadLetter(rawInput, 'TRIAGE_LOGIC_ERROR', message);
      return result;
    }

    return { ok: true, quoteId: quote.id, tier };
  } catch (err) {
    const message =
      err instanceof Error
        ? `[quote-triage] Unhandled error: ${err.message}`
        : '[quote-triage] Unhandled unknown error';
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(message, stack);
    const result: TriageError = {
      ok: false,
      errorCode: 'TRIAGE_LOGIC_ERROR',
      message,
    };
    await insertDeadLetter(rawInput, 'TRIAGE_LOGIC_ERROR', message);
    return result;
  }
}
