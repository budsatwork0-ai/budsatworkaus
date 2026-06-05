/**
 * Conversion Signal Collector
 *
 * Responsible for emitting conversion_signal entries into the observer
 * pipeline. Signals are fired on quote-triage ENTRY (not only on
 * successful completion) so that agent failures do not suppress
 * signal capture entirely.
 */

export type ConversionSignalKind =
  | 'quote_triage_entered'
  | 'quote_triage_completed'
  | 'quote_triage_failed';

export interface ConversionSignal {
  kind: ConversionSignalKind;
  quoteId: string;
  /** ISO-8601 timestamp */
  recordedAt: string;
  metadata?: Record<string, unknown>;
}

/** In-memory store — replace with your DB/event-bus write as needed. */
const _signals: ConversionSignal[] = [];

/**
 * Emit a conversion signal into the collector.
 *
 * Safe to call from try/catch blocks — never throws.
 */
export function emitConversionSignal(
  kind: ConversionSignalKind,
  quoteId: string,
  metadata?: Record<string, unknown>,
): void {
  try {
    _signals.push({
      kind,
      quoteId,
      recordedAt: new Date().toISOString(),
      ...(metadata !== undefined ? { metadata } : {}),
    });
  } catch {
    // Collector must never crash the caller.
    console.error('[conversion-signal.collector] Failed to emit signal', kind, quoteId);
  }
}

/**
 * Return all collected signals since the last flush (or process start).
 * Called by the observer snapshot-assembly layer.
 */
export function drainConversionSignals(): ConversionSignal[] {
  return _signals.splice(0, _signals.length);
}

/**
 * Convenience: emit the entry-point signal at the top of a quote-triage
 * handler, before any async work that could fail.
 *
 * Usage:
 *   emitQuoteTriageEntered(quoteId);
 *   // ... rest of triage logic ...
 */
export function emitQuoteTriageEntered(
  quoteId: string,
  metadata?: Record<string, unknown>,
): void {
  emitConversionSignal('quote_triage_entered', quoteId, metadata);
}

/**
 * Convenience: emit on successful triage completion.
 */
export function emitQuoteTriageCompleted(
  quoteId: string,
  metadata?: Record<string, unknown>,
): void {
  emitConversionSignal('quote_triage_completed', quoteId, metadata);
}

/**
 * Convenience: emit when triage fails so the failure is still captured.
 */
export function emitQuoteTriageFailed(
  quoteId: string,
  error?: unknown,
): void {
  const metadata: Record<string, unknown> =
    error instanceof Error
      ? { errorMessage: error.message, errorName: error.name }
      : {};
  emitConversionSignal('quote_triage_failed', quoteId, metadata);
}
