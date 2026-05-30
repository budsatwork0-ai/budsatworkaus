import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Supabase client (service-role so we can write from a server context)
// ---------------------------------------------------------------------------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ---------------------------------------------------------------------------
// Ops webhook URL for structured alerts
// ---------------------------------------------------------------------------
const OPS_WEBHOOK_URL = process.env.OPS_WEBHOOK_URL ?? '';

// ---------------------------------------------------------------------------
// Fallback: persist failed quote and notify ops
// ---------------------------------------------------------------------------
async function handleTriageFailure(
  rawQuote: unknown,
  error: unknown
): Promise<void> {
  const errorMessage =
    error instanceof Error ? error.message : String(error);

  // 1. Persist to pending_manual_triage
  const { error: dbError } = await supabase
    .from('pending_manual_triage')
    .insert({
      raw_quote: rawQuote,
      status: 'failed',
      error_message: errorMessage,
    });

  if (dbError) {
    console.error('[quote-triage] Failed to insert into pending_manual_triage:', dbError);
  }

  // 2. POST structured alert to ops webhook
  if (OPS_WEBHOOK_URL) {
    try {
      await fetch(OPS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert: 'quote-triage-failure',
          error_message: errorMessage,
          timestamp: new Date().toISOString(),
          raw_quote: rawQuote,
        }),
      });
    } catch (webhookError) {
      console.error('[quote-triage] Failed to POST ops webhook alert:', webhookError);
    }
  }
}

// ---------------------------------------------------------------------------
// Core triage logic (placeholder — replace with actual implementation)
// ---------------------------------------------------------------------------
async function runTriage(rawQuote: unknown): Promise<unknown> {
  // TODO: replace this stub with the real quote-triage logic
  throw new Error('runTriage: not yet implemented');
}

// ---------------------------------------------------------------------------
// Exported entry point — wraps runTriage with a try/catch fallback
// ---------------------------------------------------------------------------
export async function triageQuote(rawQuote: unknown): Promise<unknown> {
  try {
    return await runTriage(rawQuote);
  } catch (error) {
    console.error('[quote-triage] Unhandled error during triage — routing to manual review:', error);
    await handleTriageFailure(rawQuote, error);
    return null;
  }
}
