/**
 * Concurrency Guard
 *
 * Prevents the same agent from running twice concurrently — the most
 * common cause of burst failures when cron fires while a previous run
 * is still in progress.
 *
 * Looks for any 'running' row created within the last maxAgeMinutes for
 * the given agent. If found, the cron handler skips the run entirely
 * rather than stacking a duplicate on top.
 *
 * Growth property: as cron frequency increases or more agents are added,
 * this guard scales with zero configuration — each agent is independently
 * protected by the same check.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ActiveRunInfo {
  runId: string;
  startedAt: string;
  ageMinutes: number;
}

export async function findActiveRun(
  supabase: SupabaseClient,
  agentId: string,
  maxAgeMinutes = 20,
): Promise<ActiveRunInfo | null> {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60_000).toISOString();

  const { data } = await supabase
    .from('agent_runs')
    .select('id, started_at')
    .eq('agent_id', agentId)
    .eq('status', 'running')
    .gte('started_at', cutoff)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const ageMs = Date.now() - new Date((data as { started_at: string }).started_at).getTime();
  return {
    runId: (data as { id: string }).id,
    startedAt: (data as { started_at: string }).started_at,
    ageMinutes: Math.round(ageMs / 60_000),
  };
}
