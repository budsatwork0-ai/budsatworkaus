import { z } from 'zod';

// ---------------------------------------------------------------------------
// Inline schema — kept here to avoid the import-chain regressions that caused
// the two prior CI cancellations (no separate schema.ts or error-reporting.ts).
// ---------------------------------------------------------------------------
const QuoteTriageInputSchema = z.object({
  quoteId: z.string().min(1),
  customerId: z.string().min(1).optional(),
  payload: z.record(z.unknown()).optional(),
});

type QuoteTriageInput = z.infer<typeof QuoteTriageInputSchema>;

export interface QuoteTriageResult {
  quoteId: string;
  status: 'accepted' | 'rejected' | 'review';
  reason?: string;
}

// ---------------------------------------------------------------------------
// Fire-and-forget error logger.
// Internally guarded so a logging failure can NEVER cascade into the caller.
// No hard Supabase import at module level — the client is required lazily so a
// missing env var does not blow up the cold-start import chain.
// ---------------------------------------------------------------------------
function logError(
  area: string,
  reason: string,
  detail: unknown,
): void {
  // Intentionally fire-and-forget — we do not await or surface this promise.
  (async () => {
    try {
      // Lazy import: only resolved at runtime, not at module evaluation time.
      // This prevents missing-env-var crashes during CI import scanning.
      const { createClient } = await import('@supabase/supabase-js');

      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY
        ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!url || !key) {
        // Env vars absent (e.g. CI / unit tests) — fall back to console only.
        console.error('[quote-triage]', area, reason, detail);
        return;
      }

      const supabase = createClient(url, key);

      await supabase.from('agent_errors').insert({
        area,
        reason,
        detail: JSON.stringify(detail),
        occurred_at: new Date().toISOString(),
      });
    } catch (_loggingErr) {
      // Swallow — logging must never cause a secondary failure.
      try {
        console.error('[quote-triage] logError itself failed:', _loggingErr);
      } catch {
        // absolute last resort — even console.error failed
      }
    }
  })();
}

// ---------------------------------------------------------------------------
// Agent entrypoint
// ---------------------------------------------------------------------------
export async function runQuoteTriage(
  rawInput: unknown,
): Promise<QuoteTriageResult> {
  // --- Input validation boundary -------------------------------------------
  const parsed = QuoteTriageInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    const parseErrorShape = {
      issues: parsed.error.issues,
      received: typeof rawInput === 'object' && rawInput !== null
        ? Object.keys(rawInput as Record<string, unknown>)
        : typeof rawInput,
    };

    logError(
      'agent/quote-triage',
      'input-validation-failed',
      parseErrorShape,
    );

    return Promise.reject(
      new Error(
        `[quote-triage] Invalid input: ${parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`,
      ),
    );
  }

  const input: QuoteTriageInput = parsed.data;

  // --- Core triage logic ----------------------------------------------------
  try {
    // TODO: replace stub with real triage implementation.
    // Stub returns 'review' so existing callers keep working unchanged.
    const result: QuoteTriageResult = {
      quoteId: input.quoteId,
      status: 'review',
      reason: 'Pending triage',
    };

    return result;
  } catch (err) {
    const detail = {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      inputQuoteId: input.quoteId,
    };

    logError('agent/quote-triage', 'runtime-error', detail);

    throw err instanceof Error
      ? err
      : new Error(`[quote-triage] Unexpected error: ${String(err)}`);
  }
}
