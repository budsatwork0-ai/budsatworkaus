/**
 * GET /api/cron/vercel-repair
 *
 * Runs every 10 minutes. Finds queued vercel_build_failure signals and fires
 * the improvement pipeline immediately — much faster than the 6-hour general
 * pipeline cron. This is the primary responder to Vercel webhook build errors.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron/auth';
import { createClient } from '@supabase/supabase-js';
import { checkQuarantine } from '@/lib/bud/repair-quarantine';

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // Kill-switch check
  try {
    const { data: ks } = await supabase
      .from('pipeline_kill_switch').select('paused').eq('id', 1).single();
    if ((ks as { paused: boolean } | null)?.paused) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'kill switch active' });
    }
  } catch { /* non-fatal */ }

  // Pick up queued vercel_build_failure signals — max 2 per tick to stay within function timeout
  const { data: signals } = await supabase
    .from('bud_improvement_signals')
    .select('id, signal_type, severity, title, description, affected_area, proposed_approach, reference_files, source')
    .eq('signal_type', 'vercel_build_failure')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(2);

  if (!signals || signals.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  const { triggerImprovement } = await import('@/lib/bud/orchestrator');
  const results: string[] = [];

  for (const signal of signals) {
    // Skip signals with no actionable error content — Bud cannot generate patches without real error lines.
    // These exist because older webhook invocations created signals before the "No error lines" guard was added.
    const signalText = `${signal.title ?? ''} ${signal.description ?? ''}`.toLowerCase();
    const isUnactionable =
      signalText.includes('no error lines found') ||
      signalText.includes('failed to fetch logs') ||
      signalText.includes('vercel_api_token not set');

    if (isUnactionable) {
      await supabase.from('bud_improvement_signals').update({ status: 'stale' }).eq('id', signal.id);
      results.push(`${signal.title} → stale (no actionable error content)`);
      continue;
    }

    // Quarantine check: if this branch has already failed repair recently, skip execution.
    // The affected_area field stores the branch name for vercel_build_failure signals.
    const branch = signal.affected_area as string | null;
    if (branch) {
      const quarantine = await checkQuarantine(supabase, branch);
      if (quarantine.blocked) {
        if (quarantine.abandoned) {
          await supabase.from('bud_improvement_signals').update({ status: 'stale' }).eq('id', signal.id);
          try {
            await supabase.from('bud_activity_feed').insert({
              event_type: 'error',
              narrative: `Branch ${branch} abandoned after ${quarantine.attemptCount} failed repair attempts — signal marked stale. Fresh branch from main required.`,
              actor: 'vercel_repair_cron',
              target: branch,
              metadata: { signal_id: signal.id, quarantine_status: 'abandoned', attempt_count: quarantine.attemptCount },
            });
          } catch { /* non-fatal */ }
          results.push(`${signal.title} → stale (branch abandoned after ${quarantine.attemptCount} attempts)`);
          continue;
        }
        // blocked_for_repair — leave as queued, retry after window expires
        const until = quarantine.blockedUntil;
        results.push(`${signal.title} → skipped (branch quarantined until ${until})`);
        continue;
      }
    }

    try {
      await supabase
        .from('bud_improvement_signals')
        .update({ status: 'executing' })
        .eq('id', signal.id);

      const result = await triggerImprovement(supabase, {
        source: 'vercel_repair_cron',
        signalType: signal.signal_type as string,
        severity: signal.severity as string,
        title: signal.title as string,
        description: signal.description as string | undefined,
        affectedArea: signal.affected_area as string | undefined,
        proposedApproach: signal.proposed_approach as string | undefined,
        referenceFiles: signal.reference_files as string[] | undefined,
        requestedBy: 'vercel_repair_cron',
        metadata: { trigger: 'vercel_repair_cron', signal_id: signal.id },
      });

      results.push(`${signal.title} → ${result.status}`);
    } catch (err) {
      await supabase
        .from('bud_improvement_signals')
        .update({ status: 'queued' })
        .eq('id', signal.id);
      results.push(`${signal.title} → error: ${err}`);
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
