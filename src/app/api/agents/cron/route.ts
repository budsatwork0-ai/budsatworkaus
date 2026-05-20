/**
 * GET /api/agents/cron?agent_id=...
 *
 * Triggered by Vercel Cron. Three resilience guards fire before every run:
 *
 *  1. Zombie Reaper  — marks any 'running' run older than 20 min as failed,
 *                      keeping health scores accurate for all agents.
 *
 *  2. Circuit Breaker — if the Anthropic API circuit is OPEN (≥5 consecutive
 *                       failures fleet-wide), skip the run entirely and log
 *                       when the cooldown expires. No wasted API calls.
 *
 *  3. Concurrency Guard — if this specific agent already has an active run
 *                         in progress, skip to prevent stacked duplicates.
 *
 * Growth property: all three guards scale with the fleet. Adding 10 more
 * agents costs zero extra configuration — they are automatically protected.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runAgent } from '@/lib/agents/runtime';
import {
  getCircuitState,
  reapZombieRuns,
  findActiveRun,
} from '@/lib/agents/resilience';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
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

  // --- Guard 1: Zombie Reaper ---
  // Clean up stuck runs across the entire fleet before doing anything else.
  // If this cron is the only thing that runs regularly, it becomes the janitor.
  let reaped = 0;
  try {
    const result = await reapZombieRuns(supabase);
    reaped = result.reaped;
    if (reaped > 0) {
      console.log(`[cron:${agentId}] zombie-reaper: cleared ${reaped} stuck run(s): ${result.runIds.join(', ')}`);
      // Log to resilience_events so Mission Control can surface this
      await supabase.from('resilience_events').insert({
        guard: 'zombie_reaper',
        event_type: 'runs_reaped',
        payload: { reaped_count: reaped, run_ids: result.runIds, triggered_by_agent: agentId },
      }).then(() => {/* fire-and-forget */});
    }
  } catch (err) {
    // Reaper failure should never block the run — log and continue
    console.warn(`[cron:${agentId}] zombie-reaper error (non-fatal):`, err);
  }

  // --- Guard 2: Circuit Breaker ---
  // If the Anthropic API is overloaded, bail early. No point creating a run
  // row that will immediately fail with a 529.
  const { state: circuitState, resetsAt } = await getCircuitState();
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
      reaped,
    });
  }

  // --- Guard 3: Concurrency Guard ---
  // Skip if this agent is already running — prevents burst pile-ups when a
  // slow run outlasts the cron interval.
  const activeRun = await findActiveRun(supabase, agentId);
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
      reaped,
    });
  }

  // --- All clear: run the agent ---
  try {
    const result = await runAgent({ agentId, trigger: 'cron' });
    return NextResponse.json({ ...result, reaped });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err), reaped },
      { status: 500 },
    );
  }
}
