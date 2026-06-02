/**
 * Quote lifecycle event emitters.
 *
 * These are intentionally DECOUPLED from quote-triage processing:
 * a triage failure cannot suppress quote-viewed or quote-completed
 * conversion signal emission.
 */
import { ingestConversionSignal } from './signal-collector';

/**
 * Emit a quote-viewed conversion signal.
 * Safe to call independently of triage — errors are caught internally.
 */
export async function emitQuoteViewed(params: {
  quoteId: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await ingestConversionSignal({
    event_type: 'quote_viewed',
    quote_id: params.quoteId,
    session_id: params.sessionId,
    metadata: params.metadata,
  });
}

/**
 * Emit a quote-completed conversion signal.
 * Safe to call independently of triage — errors are caught internally.
 */
export async function emitQuoteCompleted(params: {
  quoteId: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await ingestConversionSignal({
    event_type: 'quote_completed',
    quote_id: params.quoteId,
    session_id: params.sessionId,
    metadata: params.metadata,
  });
}
