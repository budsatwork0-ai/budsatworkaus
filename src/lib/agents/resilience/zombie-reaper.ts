/**
 * Zombie Run Reaper
 *
 * Finds agent_runs stuck in 'running' past their expected wall-clock
 * deadline and marks them failed. Keeps health scores accurate so
 * Mission Control's trust/authority calculations reflect reality.
 *
 * Called from the cron handler on every tick — cheap because the query
 * is indexed on (status, started_at) and usually matches zero rows.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ReapResult {
  reaped: number;
  runIds: string[];
}

export async function reapZombieRuns(
  supabase: SupabaseClient,
  maxAgeMinutes = 20,
): Promise<ReapResult> {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60_000).toISOString();

  const { data, error } = await supabase
    .from('agent_runs')
    .update({
      status: 'failed',
      error: `Run exceeded ${maxAgeMinutes}m wall-clock limit — auto-reaped by resilience engine`,
      summary: 'Run did not complete (auto-reaped)',
      finished_at: new Date().toISOString(),
    })
    .eq('status', 'running')
    .lt('started_at', cutoff)
    .select('id');

  if (error) throw new Error(`zombie-reaper: ${error.message}`);

  return {
    reaped: data?.length ?? 0,
    runIds: (data ?? []).map((r: { id: string }) => r.id),
  };
}
