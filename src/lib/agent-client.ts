/**
 * agent-client.ts
 *
 * Shared utilities for invoking agents with retry + circuit-breaker logic.
 *
 * - retryWithBackoff: max 2 retries, 500 ms / 1000 ms exponential back-off.
 * - withQuoteTriageCircuitBreaker: rolling-window circuit breaker backed by
 *   agent_events (Supabase), short-circuits at >50 % failure rate in 60 s.
 */

import { createServiceClient } from '@/lib/supabase/server';

// ─── Retry ────────────────────────────────────────────────────────────────────

const RETRY_DELAYS_MS = [500, 1000] as const;

/**
 * Invokes `fn` up to 1 + RETRY_DELAYS_MS.length times.
 * Waits RETRY_DELAYS_MS[attempt] ms between attempts.
 */
export async function retryWithBackoff<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < RETRY_DELAYS_MS.length) {
        await new Promise<void>((resolve) =>
          setTimeout(resolve, RETRY_DELAYS_MS[attempt]),
        );
      }
    }
  }
  throw lastError;
}

// ─── Circuit breaker for quote-triage ─────────────────────────────────────────

const CIRCUIT_WINDOW_SECONDS = 60;
const CIRCUIT_FAILURE_THRESHOLD = 0.5; // >50 % failure rate opens circuit
const CIRCUIT_MIN_EVENTS = 2; // need at least this many events to open
const GRACEFUL_FALLBACK =
  'We are having trouble processing your quote right now. ' +
  'Please try again in a moment or contact us directly.';

type CircuitResult<T> =
  | { ok: true; value: T }
  | { ok: false; fallback: string; reason: 'circuit_open' | 'error' };

/**
 * Wraps an async call with a rolling-window circuit breaker that reads from
 * the `agent_events` Supabase table.
 *
 * If >50 % of quote-triage events in the last 60 seconds are failures the
 * circuit is open and the caller receives a graceful fallback string instead
 * of a hard throw.
 *
 * On success / failure the outcome is written back to agent_events so the
 * window stays current.
 */
export async function withQuoteTriageCircuitBreaker<T>(
  fn: () => Promise<T>,
): Promise<CircuitResult<T>> {
  const supabase = createServiceClient();
  const windowStart = new Date(
    Date.now() - CIRCUIT_WINDOW_SECONDS * 1000,
  ).toISOString();

  // --- Read recent events ---------------------------------------------------
  const { data: recentEvents } = await supabase
    .from('agent_events')
    .select('status')
    .eq('agent_name', 'quote-triage')
    .gte('created_at', windowStart);

  if (recentEvents && recentEvents.length >= CIRCUIT_MIN_EVENTS) {
    const failures = recentEvents.filter(
      (e: { status: string }) => e.status === 'error' || e.status === 'failure',
    ).length;
    const rate = failures / recentEvents.length;
    if (rate > CIRCUIT_FAILURE_THRESHOLD) {
      // Circuit is open — emit a circuit_open event and return fallback
      await supabase.from('agent_events').insert({
        agent_name: 'quote-triage',
        status: 'circuit_open',
        metadata: { failure_rate: rate, window_seconds: CIRCUIT_WINDOW_SECONDS },
        created_at: new Date().toISOString(),
      });
      return { ok: false, fallback: GRACEFUL_FALLBACK, reason: 'circuit_open' };
    }
  }

  // --- Invoke with retry ----------------------------------------------------
  try {
    const value = await retryWithBackoff(fn);
    await supabase.from('agent_events').insert({
      agent_name: 'quote-triage',
      status: 'success',
      created_at: new Date().toISOString(),
    });
    return { ok: true, value };
  } catch (err) {
    await supabase.from('agent_events').insert({
      agent_name: 'quote-triage',
      status: 'error',
      metadata: { error: String(err) },
      created_at: new Date().toISOString(),
    });
    return { ok: false, fallback: GRACEFUL_FALLBACK, reason: 'error' };
  }
}
