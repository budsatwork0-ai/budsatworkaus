/**
 * Anthropic API Circuit Breaker
 *
 * Tracks API health across ALL agent runs fleet-wide via a single
 * Supabase row. Prevents cascade failures when the API is overloaded:
 *
 *   CLOSED    — normal operation, calls go through
 *   OPEN      — 5+ consecutive failures; all LLM calls blocked for 5 min
 *   HALF_OPEN — cooldown elapsed; one probe batch allowed through.
 *               2 successes → CLOSED. Any failure → back to OPEN.
 *
 * Growth property: as the agent fleet scales, one circuit protects all of
 * them simultaneously. 50 agents under load = 50× the protection value.
 *
 * Each Vercel instance caches state for 20s to avoid a DB round-trip on
 * every LLM call. The circuit is eventually consistent across instances —
 * acceptable because the worst case is a few extra calls during the window
 * the circuit is transitioning.
 */

import { createClient } from '@supabase/supabase-js';

export type CircuitState = 'closed' | 'open' | 'half_open';

export class CircuitOpenError extends Error {
  readonly resetsAt: string | null;
  constructor(resetsAt: string | null) {
    const when = resetsAt
      ? ` Cooldown ends ${new Date(resetsAt).toLocaleTimeString()}.`
      : '';
    super(`Anthropic API circuit is OPEN — LLM calls paused.${when}`);
    this.name = 'CircuitOpenError';
    this.resetsAt = resetsAt;
  }
}

const FAILURE_THRESHOLD = 5;
const PROBE_THRESHOLD   = 2;
const RECOVERY_MS       = 5 * 60_000;
const CACHE_TTL_MS      = 20_000;

let _cache: { state: CircuitState; resetsAt: string | null; expiresAt: number } | null = null;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function getCircuitState(): Promise<{ state: CircuitState; resetsAt: string | null }> {
  const now = Date.now();
  if (_cache && _cache.expiresAt > now) {
    return { state: _cache.state, resetsAt: _cache.resetsAt };
  }

  const { data } = await db()
    .from('bud_circuit_states')
    .select('state, resets_at')
    .eq('id', 'anthropic_api')
    .maybeSingle();

  if (!data) {
    _cache = { state: 'closed', resetsAt: null, expiresAt: now + CACHE_TTL_MS };
    return { state: 'closed', resetsAt: null };
  }

  let state = data.state as CircuitState;
  const resetsAt = data.resets_at as string | null;

  // Auto-advance open → half_open once the cooldown has elapsed
  if (state === 'open' && resetsAt && new Date(resetsAt).getTime() <= now) {
    await db()
      .from('bud_circuit_states')
      .update({ state: 'half_open', probe_successes: 0, updated_at: new Date().toISOString() })
      .eq('id', 'anthropic_api');
    state = 'half_open';
  }

  _cache = { state, resetsAt, expiresAt: now + CACHE_TTL_MS };
  return { state, resetsAt };
}

export async function recordLlmSuccess(): Promise<void> {
  // Do not invalidate _cache unconditionally — the cached state is still
  // accurate unless the circuit actually transitions (half_open → closed).
  // Busting the cache on every success forces a DB read before every LLM
  // call on multi-LLM agents, defeating the 20s TTL entirely.
  const { data } = await db()
    .from('bud_circuit_states')
    .select('state, probe_successes')
    .eq('id', 'anthropic_api')
    .maybeSingle();

  if (!data) return;

  const probeSuccesses = (data.probe_successes as number ?? 0) + 1;
  const shouldClose = data.state === 'half_open' && probeSuccesses >= PROBE_THRESHOLD;

  const updates: Record<string, unknown> = {
    state: shouldClose ? 'closed' : data.state,
    probe_successes: shouldClose ? 0 : probeSuccesses,
    last_success_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (shouldClose) {
    updates.failure_streak = 0;
    updates.opens_at = null;
    updates.resets_at = null;
    // State changed — bust the cache so the next getCircuitState() call
    // returns 'closed' immediately rather than serving a stale 'half_open'.
    _cache = null;
  }

  await db().from('bud_circuit_states').update(updates).eq('id', 'anthropic_api');
}

export async function recordLlmFailure(): Promise<void> {
  _cache = null;
  const { data } = await db()
    .from('bud_circuit_states')
    .select('state, failure_streak')
    .eq('id', 'anthropic_api')
    .maybeSingle();

  const streak = (data?.failure_streak as number ?? 0) + 1;
  const shouldOpen = streak >= FAILURE_THRESHOLD;
  const now = new Date();

  const payload: Record<string, unknown> = {
    id: 'anthropic_api',
    state: shouldOpen ? 'open' : (data?.state ?? 'closed'),
    failure_streak: streak,
    probe_successes: 0,
    last_failure_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
  if (shouldOpen) {
    payload.opens_at = now.toISOString();
    payload.resets_at = new Date(now.getTime() + RECOVERY_MS).toISOString();
  }

  await db().from('bud_circuit_states').upsert(payload, { onConflict: 'id' });
}

/** Returns a human-readable summary for Mission Control. */
export async function getCircuitSummary(): Promise<{
  state: CircuitState;
  resetsAt: string | null;
  failureStreak: number;
  label: string;
}> {
  const { data } = await db()
    .from('bud_circuit_states')
    .select('state, resets_at, failure_streak')
    .eq('id', 'anthropic_api')
    .maybeSingle();

  const state  = (data?.state as CircuitState) ?? 'closed';
  const streak = (data?.failure_streak as number) ?? 0;
  const resetsAt = (data?.resets_at as string | null) ?? null;

  const label =
    state === 'closed'    ? 'API healthy'
    : state === 'half_open' ? 'API probing — recovering'
    : `API paused — ${streak} consecutive failures`;

  return { state, resetsAt, failureStreak: streak, label };
}
