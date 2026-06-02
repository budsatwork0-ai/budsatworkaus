import { CircuitBreaker } from '@/lib/circuit-breaker';

// ─── Circuit breaker (module-level singleton) ─────────────────────────────────
// Opens after 5 consecutive failures; probes again after 60 s.
const breaker = new CircuitBreaker({
  name: 'quote-triage',
  failureThreshold: 5,
  recoveryTimeoutMs: 60_000,
});

// ─── Public types ─────────────────────────────────────────────────────────────
export interface QuoteTriageInput {
  /** Raw quote payload forwarded from the API route. */
  [key: string]: unknown;
}

export interface QuoteTriageSuccess {
  ok: true;
  /** Human-readable confirmation shown to the user. */
  message: string;
}

export interface QuoteTriageDegraded {
  ok: false;
  /** Human-readable fallback message shown to the user. */
  message: string;
  degraded: true;
}

export type QuoteTriageResult = QuoteTriageSuccess | QuoteTriageDegraded;

// ─── Core triage logic (extracted for testability) ────────────────────────────
async function runTriage(input: QuoteTriageInput): Promise<QuoteTriageSuccess> {
  // TODO: replace with real agent implementation.
  // This stub intentionally validates that the input is non-empty so the
  // surrounding circuit-breaker wiring can be exercised in tests.
  if (!input || Object.keys(input).length === 0) {
    throw new Error('quote-triage: received empty input');
  }

  // Placeholder: real implementation will call an LLM / Supabase insert here.
  return {
    ok: true,
    message: 'Quote received — we will be in touch within 2–4 hours.',
  };
}

// ─── Public entry point ───────────────────────────────────────────────────────
/**
 * Triages an incoming quote request.
 *
 * When the circuit is open (too many consecutive failures), this function
 * returns a degraded-but-friendly response instead of throwing so the UI
 * can display a meaningful message rather than an unhandled exception.
 */
export async function triageQuote(
  input: QuoteTriageInput
): Promise<QuoteTriageResult> {
  const result = await breaker.run(() => runTriage(input));

  if (!result.ok && result.circuitOpen) {
    // Structured log for alerting pipelines (e.g. bud-observer / Datadog).
    console.error('[quote-triage] circuit open — manual follow-up required', {
      circuitOpen: true,
      agent: 'quote-triage',
      inputKeys: Object.keys(input),
      timestamp: new Date().toISOString(),
    });

    return {
      ok: false,
      degraded: true,
      message: 'Quote received — our team will follow up manually.',
    };
  }

  // result.ok === true here; TypeScript narrows accordingly.
  return result.value;
}
