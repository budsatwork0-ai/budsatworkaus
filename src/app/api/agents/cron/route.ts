/**
 * GET /api/agents/cron?agent_id=...
 *
 * Triggered by Vercel Cron. Two resilience guards fire before every run:
 *
 *  1. Circuit Breaker — if the Anthropic API circuit is OPEN (≥5 consecutive
 *                       failures fleet-wide), skip the run entirely and log
 *                       when the cooldown expires. No wasted API calls.
 *
 *  2. Concurrency Guard — if this specific agent already has an active run
 *                         in progress, skip to prevent stacked duplicates.
 *
 * Zombie reaping runs on its own dedicated cron (/api/agents/reap-zombies)
 * so it is not duplicated across every agent invocation.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { runAgent } from '@/lib/agents/runtime';
import {
  getCircuitState,
  findActiveRun,
} from '@/lib/agents/resilience';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let _client: SupabaseClient | null = null;

function adminClient() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
  }
  return _client;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const provided = req.headers.get('authorization') ?? url.searchParams.get('secret');
  if (provided !== `Bearer ${process.env.CRON_SECRET}` && provided !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const agentId = url.searchParams.get('agent_id');
  if (!agentId) return NextResponse.json({ error: 'agent_id required' }, { status: 400 });

  const supabase = adminClient();

  // --- Guards 1 & 2: Circuit Breaker + Concurrency — run in parallel ---
  // Both queries are independent; fetching them together saves one round-trip
  // on every cron tick. Circuit open takes priority in the checks below.
  const [{ state: circuitState, resetsAt }, activeRun] = await Promise.all([
    getCircuitState(),
    findActiveRun(supabase, agentId),
  ]);

  if (circuitState === 'open') {
    const when = resetsAt ? ` Probing resumes at ${new Date(resetsAt).toISOString()}.` : '';
    console.log(`[cron:${agentId}] circuit OPEN — skipping run.${when}`);
    await supabase.from('resilience_events').insert({
      guard: 'circuit_breaker',
      event_type: 'run_blocked',
      payload: { state: circuitState, resets_at: resetsAt, blocked_agent: agentId },
    }).then(() => {/* fire-and-forget */});
    return NextResponse.json({
      skipped: true,
      reason: 'circuit_open',
      resetsAt,
    });
  }

  if (activeRun) {
    console.log(
      `[cron:${agentId}] already running (run ${activeRun.runId}, ${activeRun.ageMinutes}m ago) — skipping`,
    );
    await supabase.from('resilience_events').insert({
      guard: 'concurrency_guard',
      event_type: 'run_skipped',
      payload: { agent_id: agentId, active_run_id: activeRun.runId, age_minutes: activeRun.ageMinutes },
    }).then(() => {/* fire-and-forget */});
    return NextResponse.json({
      skipped: true,
      reason: 'already_running',
      activeRunId: activeRun.runId,
      ageMinutes: activeRun.ageMinutes,
    });
  }

  // --- All clear: run the agent, reusing the guard's client ---
  try {
    const result = await runAgent({ agentId, trigger: 'cron', supabase });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
