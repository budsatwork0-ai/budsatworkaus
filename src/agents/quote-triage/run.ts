import crypto from 'crypto';
import { QuoteTriageInputSchema, type QuoteTriageInput } from './schema';

// ─── Structured output type ───────────────────────────────────────────────────
export interface QuoteTriageOutput {
  quoteId: string;
  decision: 'approve' | 'reject' | 'escalate';
  reason: string;
}

// ─── Core triage logic (replace with real implementation) ─────────────────────
function triageQuote(input: QuoteTriageInput): QuoteTriageOutput | null {
  // Placeholder: in production this calls the LLM / rules engine.
  // Returns null to simulate the no-output paths we are making observable.
  if (!input.payload || Object.keys(input.payload).length === 0) {
    return null;
  }
  return {
    quoteId: input.quoteId,
    decision: 'escalate',
    reason: 'Requires manual review',
  };
}

// ─── Stable hash of raw input for correlation ─────────────────────────────────
function hashInput(raw: unknown): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(raw))
    .digest('hex')
    .slice(0, 16);
}

// ─── Agent entry point ────────────────────────────────────────────────────────
export function runQuoteTriage(raw: unknown): QuoteTriageOutput {
  // 1. Validate input — throws ZodError on malformed payloads.
  const input = QuoteTriageInputSchema.parse(raw);

  // 2. Run core triage logic.
  const result = triageQuote(input);

  // 3. Guard against no-output paths — emit structured log and throw.
  if (result === null || result === undefined) {
    const inputHash = hashInput(raw);
    // Structured log line: makes the 310 previously-silent paths observable.
    console.error(
      JSON.stringify({
        event: 'quote_triage_output_missing',
        quote_triage_output_missing: true,
        quoteId: input.quoteId,
        inputHash,
        ts: new Date().toISOString(),
      }),
    );
    throw new Error(
      `quote-triage produced no output for quoteId=${input.quoteId} (inputHash=${inputHash})`,
    );
  }

  return result;
}
