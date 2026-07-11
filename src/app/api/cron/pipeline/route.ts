/**
 * GET /api/cron/pipeline
 *
 * Scheduled cron (every 6 hours) that:
 *   1. Finds queued improvement signals that haven't started a pipeline run yet
 *      and fires them through triggerImprovement.
 *   2. Marks pipeline runs that have been in_progress > 60 min as failed
 *      (safety net for stalled serverless function executions).
 *
 * Vercel cron schedule: "0 1,7,13,19 * * *"  (offset from bud-observer at :00)
 *
 * This endpoint is the primary autonomous driver. The /api/pipeline/start
 * endpoint is for manual triggers from the dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron/auth';
import { createClient } from '@supabase/supabase-js';

const STALL_THRESHOLD_MS = 60 * 60_000; // 60 minutes
const MAX_RUNS_PER_CRON = 3;

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // 1. Mark stalled in_progress runs as failed
  const stallCutoff = new Date(Date.now() - STALL_THRESHOLD_MS).toISOString();
  const { data: stalledRuns } = await supabase
    .from('pipeline_runs')
    .select('id')
    .eq('status', 'in_progress')
    .lt('started_at', stallCutoff);

  const stalledCount = stalledRuns?.length ?? 0;
  for (const run of stalledRuns ?? []) {
    await supabase.from('pipeline_runs').update({
      status: 'rejected',
      verdict: 'rejected',
      rollback_reason: 'stalled: no completion after 60 min',
      ended_at: new Date().toISOString(),
    }).eq('id', run.id);
    await supabase.from('pipeline_stage_events').insert({
      run_id: run.id,
      stage: 'observe',
      status: 'rejected',
      payload: { reason: 'run stalled and was terminated by cron' },
    });
  }

  // 2. Find queued signals with no active pipeline run → trigger them
  const { data: queuedSignals } = await supabase
    .from('bud_improvement_signals')
    .select('id, signal_type, severity, title, description, affected_area, proposed_approach, reference_files, source')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(MAX_RUNS_PER_CRON);

  // Check kill-switch before firing anything
  let ksData: { paused: boolean } | null = null;
  try {
    const { data } = await supabase
      .from('pipeline_kill_switch').select('paused').eq('id', 1).single();
    ksData = data as { paused: boolean } | null;
  } catch { /* non-fatal */ }

  const triggered: string[] = [];

  if (!ksData?.paused && queuedSignals && queuedSignals.length > 0) {
    const { triggerImprovement } = await import('@/lib/bud/orchestrator');

    for (const signal of queuedSignals) {
      try {
        // Mark as executing to prevent double-fire
        await supabase
          .from('bud_improvement_signals')
          .update({ status: 'executing' })
          .eq('id', signal.id);

        const result = await triggerImprovement(supabase, {
          source: (signal.source as string | null) ?? 'cron',
          signalType: signal.signal_type as string,
          severity: signal.severity as string,
          title: signal.title as string,
          description: signal.description as string | undefined,
          affectedArea: signal.affected_area as string | undefined,
          proposedApproach: signal.proposed_approach as string | undefined,
          referenceFiles: signal.reference_files as string[] | undefined,
          requestedBy: 'cron',
          metadata: { trigger: 'cron', signal_id: signal.id },
        });

        triggered.push(`${signal.title} → ${result.status}`);
      } catch (err) {
        await supabase
          .from('bud_improvement_signals')
          .update({ status: 'queued' })
          .eq('id', signal.id);
        triggered.push(`${signal.title} → error: ${err}`);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    stalled_cleaned: stalledCount,
    triggered,
    kill_switch_active: !!ksData?.paused,
  });
}
