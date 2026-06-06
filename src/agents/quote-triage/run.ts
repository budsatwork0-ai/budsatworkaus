import { ZodError } from 'zod';
import { QuoteTriageInputSchema, CONFIDENCE_THRESHOLD } from './schema';
import { AgentEmptyOutputError, withOutputGuard } from '@/agents/shared/withOutputGuard';

// ─── Structured log helpers ───────────────────────────────────────────────────

type TriageLogEvent =
  | { event: 'quote_triage_routed';  quoteId: string; routing: string; confidence?: number }
  | { event: 'quote_triage_failed';  quoteId: string; reason: string; detail?: string }
  | { event: 'quote_triage_human_review'; quoteId: string; confidence: number };

function emitEvent(payload: TriageLogEvent): void {
  // Structured JSON log line — picked up by monitoring/log-drain
  console.log(JSON.stringify({ ...payload, ts: new Date().toISOString() }));
}

// ─── Triage output type ───────────────────────────────────────────────────────

export interface TriageOutput {
  quoteId: string;
  routing: 'auto_approve' | 'manual_review' | 'human_review' | 'reject';
  reason: string;
  confidence?: number;
}

// ─── Core triage logic (stub — replace with real LLM/rules call) ─────────────

async function triageQuote(
  input: ReturnType<typeof QuoteTriageInputSchema.parse>,
): Promise<TriageOutput | null> {
  // TODO: replace this stub with the real triage LLM call / rules engine.
  // Returning null here simulates the "no output" case that was previously silent.
  const confidence = input.confidence ?? 1;

  if (confidence < CONFIDENCE_THRESHOLD) {
    // Low-confidence: route to human review immediately
    return {
      quoteId: input.quoteId,
      routing: 'human_review',
      reason: 'confidence below threshold',
      confidence,
    };
  }

  // Placeholder routing based on service type
  const routing: TriageOutput['routing'] =
    input.serviceType === 'cleaning' ? 'auto_approve' : 'manual_review';

  return {
    quoteId: input.quoteId,
    routing,
    reason: `service_type=${input.serviceType}`,
    confidence,
  };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * run() is the public entry point for the quote-triage agent.
 *
 * Every exit path emits a structured log event so all runs are visible
 * in monitoring — including the 352 previously silent/failed runs.
 */
export async function run(rawInput: unknown): Promise<TriageOutput> {
  // 1. Zod input validation — rejects malformed payloads early
  let input: ReturnType<typeof QuoteTriageInputSchema.parse>;
  try {
    input = QuoteTriageInputSchema.parse(rawInput);
  } catch (err) {
    const detail = err instanceof ZodError ? err.message : String(err);
    const quoteId =
      rawInput !== null &&
      typeof rawInput === 'object' &&
      'quoteId' in (rawInput as Record<string, unknown>)
        ? String((rawInput as Record<string, unknown>).quoteId)
        : 'unknown';
    emitEvent({ event: 'quote_triage_failed', quoteId, reason: 'invalid_input', detail });
    throw err;
  }

  // 2. Run triage with output guard — null/empty output throws AgentEmptyOutputError
  let output: TriageOutput;
  try {
    output = await withOutputGuard(() => triageQuote(input), (r) => r === null);
  } catch (err) {
    const reason =
      err instanceof AgentEmptyOutputError ? 'empty_output' : 'triage_error';
    const detail = err instanceof Error ? err.message : String(err);
    emitEvent({ event: 'quote_triage_failed', quoteId: input.quoteId, reason, detail });
    throw err;
  }

  // 3. Low-confidence fallback — emit human_review routing event
  if (
    output.routing === 'human_review' ||
    (typeof output.confidence === 'number' && output.confidence < CONFIDENCE_THRESHOLD)
  ) {
    emitEvent({
      event: 'quote_triage_human_review',
      quoteId: output.quoteId,
      confidence: output.confidence ?? 0,
    });
  }

  // 4. Success — emit structured routing event on every happy-path exit
  emitEvent({
    event: 'quote_triage_routed',
    quoteId: output.quoteId,
    routing: output.routing,
    confidence: output.confidence,
  });

  return output;
}
