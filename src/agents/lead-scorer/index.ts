/**
 * lead-scorer agent
 *
 * Scores inbound leads for prioritisation based on quote-triage output events.
 *
 * Resilience features:
 *  1. Null-input guard — throws a descriptive error immediately rather than stalling.
 *  2. Output-validation guard — asserts non-empty scoring result before resolving.
 *  3. withCircuitBreaker — rolling-window failure detection + Slack alerting.
 *  4. Queue-staleness detector — opens the circuit if quote-triage has produced
 *     no output events for more than one hour, preventing collateral-damage stalls.
 */

import { createServiceClient } from '@/lib/supabase/server';
import { withCircuitBreaker, type AgentResult } from '@/lib/agent-circuit-breaker';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LeadInput {
  quoteId: string;
  /** Parsed service type forwarded from quote-triage */
  serviceType: string;
  /** Estimated job value in AUD cents */
  estimatedValueCents: number;
  /** ISO timestamp of the original quote submission */
  submittedAt: string;
  /** Any additional metadata forwarded by quote-triage */
  metadata?: Record<string, unknown>;
}

export interface LeadScore {
  quoteId: string;
  score: number;          // 0–100
  tier: 'high' | 'medium' | 'low';
  scoredAt: string;       // ISO timestamp
  signals: string[];      // Human-readable scoring rationale
}

// ─── Constants ───────────────────────────────────────────────────────────────

const AGENT_NAME = 'lead-scorer';
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_WINDOW_MINUTES = 60;
/** If quote-triage has produced no events for this many minutes, raise a stale-queue alert */
const STALE_QUEUE_THRESHOLD_MINUTES = 60;

// ─── Queue-staleness detector ─────────────────────────────────────────────────

/**
 * Queries agent_events for the most recent quote-triage output event.
 * Returns true if the queue appears stale (no output in the last hour).
 */
async function isQuoteTriageQueueStale(): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    const since = new Date(
      Date.now() - STALE_QUEUE_THRESHOLD_MINUTES * 60 * 1000,
    ).toISOString();

    const { count, error } = await supabase
      .from('agent_events')
      .select('id', { count: 'exact', head: true })
      .eq('agent', 'quote-triage')
      .eq('event_type', 'output')
      .gte('created_at', since);

    if (error) {
      console.warn('[lead-scorer] staleness-check query failed:', error.message);
      // Fail open — don't block lead scoring on a monitoring query failure
      return false;
    }

    return (count ?? 0) === 0;
  } catch (err) {
    console.warn('[lead-scorer] staleness-check threw:', err);
    return false;
  }
}

/**
 * Records a circuit-open event for lead-scorer so the rolling-window counter
 * will trip the breaker on subsequent calls during a stale-queue episode.
 */
async function recordStalenessFailures(): Promise<void> {
  try {
    const supabase = createServiceClient();
    // Insert enough synthetic error events to trip the circuit breaker immediately.
    const events = Array.from({ length: CIRCUIT_BREAKER_THRESHOLD }, () => ({
      agent: AGENT_NAME,
      event_type: 'error' as const,
      payload: {
        error: `Stale input queue: quote-triage produced no output events in the last ${STALE_QUEUE_THRESHOLD_MINUTES} min`,
        synthetic: true,
      },
    }));
    await supabase.from('agent_events').insert(events);
  } catch (err) {
    console.error('[lead-scorer] failed to record staleness failures:', err);
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `:warning: *lead-scorer* stale-queue alert — quote-triage has produced no output events in the last ${STALE_QUEUE_THRESHOLD_MINUTES} min. Lead-scorer circuit breaker has been opened to prevent silent stalls.`,
        }),
      });
    } catch {
      // Best-effort
    }
  }
}

// ─── Scoring logic ────────────────────────────────────────────────────────────

/**
 * Core scoring function — pure business logic, no I/O.
 * Exported for unit testing.
 */
export function computeLeadScore(input: LeadInput): LeadScore {
  const signals: string[] = [];
  let score = 0;

  // Value signal (up to 50 points)
  if (input.estimatedValueCents >= 100_000) {
    score += 50;
    signals.push('High-value job (≥$1,000)');
  } else if (input.estimatedValueCents >= 30_000) {
    score += 30;
    signals.push('Medium-value job ($300–$999)');
  } else {
    score += 10;
    signals.push('Standard-value job (<$300)');
  }

  // Recency signal (up to 30 points)
  const ageMinutes =
    (Date.now() - new Date(input.submittedAt).getTime()) / 60_000;
  if (ageMinutes < 30) {
    score += 30;
    signals.push('Very recent submission (<30 min)');
  } else if (ageMinutes < 120) {
    score += 20;
    signals.push('Recent submission (30–120 min)');
  } else {
    score += 5;
    signals.push('Older submission (>2 hr)');
  }

  // Service-type signal (up to 20 points)
  const premiumServices = ['cleaning', 'windows', 'auto'];
  if (premiumServices.includes(input.serviceType)) {
    score += 20;
    signals.push(`Premium service type: ${input.serviceType}`);
  } else {
    score += 10;
    signals.push(`Standard service type: ${input.serviceType}`);
  }

  const tier: LeadScore['tier'] =
    score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';

  return {
    quoteId: input.quoteId,
    score,
    tier,
    scoredAt: new Date().toISOString(),
    signals,
  };
}

// ─── Guarded scorer ───────────────────────────────────────────────────────────

/**
 * Validates input and output, then persists the score to agent_events.
 * Throws descriptive errors rather than stalling silently.
 */
async function runLeadScorer(input: LeadInput): Promise<LeadScore> {
  // ── Guard 1: null/undefined input ────────────────────────────────────────
  if (input == null) {
    throw new Error(
      '[lead-scorer] received null/undefined input — cannot score lead. ' +
      'Ensure quote-triage is forwarding a valid LeadInput payload.',
    );
  }

  // ── Guard 2: required fields ──────────────────────────────────────────────
  if (!input.quoteId || typeof input.quoteId !== 'string') {
    throw new Error('[lead-scorer] input.quoteId is missing or not a string');
  }
  if (!input.serviceType || typeof input.serviceType !== 'string') {
    throw new Error('[lead-scorer] input.serviceType is missing or not a string');
  }
  if (typeof input.estimatedValueCents !== 'number' || input.estimatedValueCents < 0) {
    throw new Error('[lead-scorer] input.estimatedValueCents must be a non-negative number');
  }
  if (!input.submittedAt || Number.isNaN(Date.parse(input.submittedAt))) {
    throw new Error('[lead-scorer] input.submittedAt must be a valid ISO date string');
  }

  // ── Score ─────────────────────────────────────────────────────────────────
  const result = computeLeadScore(input);

  // ── Guard 3: output validation ────────────────────────────────────────────
  if (!result || typeof result.score !== 'number' || !result.tier || !result.scoredAt) {
    throw new Error(
      `[lead-scorer] scoring produced an empty or malformed result for quoteId=${input.quoteId}`,
    );
  }
  if (result.signals.length === 0) {
    throw new Error(
      `[lead-scorer] scoring produced no signals for quoteId=${input.quoteId} — output rejected`,
    );
  }

  // ── Persist output event ──────────────────────────────────────────────────
  try {
    const supabase = createServiceClient();
    await supabase.from('agent_events').insert({
      agent: AGENT_NAME,
      event_type: 'output',
      payload: result,
    });
  } catch (err) {
    // Persistence failure should not mask the scoring result
    console.error('[lead-scorer] failed to persist output event:', err);
  }

  return result;
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Score a lead with full resilience: staleness detection, circuit breaker,
 * input validation, and output validation.
 *
 * @param input - The lead payload forwarded from quote-triage.
 * @returns An AgentResult discriminated union — always check `.ok` before using `.value`.
 */
export async function scoreLead(
  input: LeadInput,
): Promise<AgentResult<LeadScore>> {
  // ── Staleness pre-check ───────────────────────────────────────────────────
  const stale = await isQuoteTriageQueueStale();
  if (stale) {
    console.error(
      `[lead-scorer] quote-triage queue is stale — no output events in the last ${STALE_QUEUE_THRESHOLD_MINUTES} min. Opening circuit breaker.`,
    );
    await recordStalenessFailures();
    return {
      ok: false,
      error: `Lead-scorer halted: quote-triage input queue has been empty for >${STALE_QUEUE_THRESHOLD_MINUTES} min`,
      circuitOpen: true,
    };
  }

  // ── Circuit-breaker-wrapped execution ─────────────────────────────────────
  return withCircuitBreaker(() => runLeadScorer(input), {
    agentName: AGENT_NAME,
    failureThreshold: CIRCUIT_BREAKER_THRESHOLD,
    windowMinutes: CIRCUIT_BREAKER_WINDOW_MINUTES,
  });
}
