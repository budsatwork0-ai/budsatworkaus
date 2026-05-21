/**
 * POST /api/agents/cron/fleet
 *
 * Runs a batch of agents in parallel within a single serverless invocation.
 * Each agent still passes through the full three-guard resilience stack
 * (zombie reaper, circuit breaker, concurrency guard) — parallelism only
 * reduces wall-clock time; it does not bypass safety rails.
 *
 * Body: { "agent_ids": ["scheduling", "crew-briefing", ...] }
 *
 * Use this for agents that are independent of each other and can safely
 * run at the same time. Don't include Bud here — Bud has its own cron entry
 * and orchestrates the fleet after the other agents have run.
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
export const maxDuration = 300;

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

type AgentResult = {
  agentId: string;
  status: 'ran' | 'skipped' | 'failed';
  reason?: string;
  runId?: string;
  summary?: string;
};

export async function POST(req: NextRequest) {
  const provided = req.headers.get('authorization');
  if (provided !== `Bearer ${process.env.CRON_SECRET}` && provided !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let agentIds: string[];
  try {
    const body = await req.json() as { agent_ids?: unknown };
    if (!Array.isArray(body.agent_ids) || body.agent_ids.length === 0) {
      return NextResponse.json({ error: 'agent_ids array required' }, { status: 400 });
    }
    agentIds = body.agent_ids as string[];
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const supabase = adminClient();

  // Zombie reaper runs once for the whole fleet batch
  let reaped = 0;
  try {
    const result = await reapZombieRuns(supabase);
    reaped = result.reaped;
    if (reaped > 0) {
      await supabase.from('resilience_events').insert({
        guard: 'zombie_reaper',
        event_type: 'runs_reaped',
        payload: { reaped_count: reaped, run_ids: result.runIds, triggered_by: 'fleet_cron' },
      });
    }
  } catch {
    // Non-fatal
  }

  // Circuit check — if open, skip the whole batch
  const { state: circuitState, resetsAt } = await getCircuitState();
  if (circuitState === 'open') {
    return NextResponse.json({
      skipped: true,
      reason: 'circuit_open',
      resetsAt,
      reaped,
      agents: agentIds.map((id) => ({ agentId: id, status: 'skipped', reason: 'circuit_open' })),
    });
  }

  // Run each agent concurrently; each independently checks its own concurrency guard.
  const results = await Promise.allSettled(
    agentIds.map(async (agentId): Promise<AgentResult> => {
      // Per-agent concurrency guard
      const activeRun = await findActiveRun(supabase, agentId);
      if (activeRun) {
        return { agentId, status: 'skipped', reason: `already_running (${activeRun.ageMinutes}m)` };
      }

      try {
        const result = await runAgent({ agentId, trigger: 'cron' });
        return { agentId, status: 'ran', runId: result.runId, summary: result.summary };
      } catch (err) {
        return {
          agentId,
          status: 'failed',
          reason: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  const agents: AgentResult[] = results.map((r) =>
    r.status === 'fulfilled'
      ? r.value
      : { agentId: 'unknown', status: 'failed', reason: String(r.reason) },
  );

  const ran     = agents.filter((a) => a.status === 'ran').length;
  const skipped = agents.filter((a) => a.status === 'skipped').length;
  const failed  = agents.filter((a) => a.status === 'failed').length;

  return NextResponse.json({ ran, skipped, failed, reaped, agents });
}
