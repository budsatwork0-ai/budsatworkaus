/**
 * snapshot-signal-validator.ts
 *
 * After each observer snapshot write this validator inspects
 * ux_proposals and design_insights. When both arrays have been
 * empty for more than 24 hours it emits a 'signal_starvation'
 * dead-letter record so the gap is surfaced in the ops queue
 * rather than silently disappearing.
 */

import { createServiceClient } from '@/lib/supabase/server';
import { enqueueDeadLetter } from '@/infrastructure/queues/dead-letter-queue';

const STARVATION_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const AGENT_NAME = 'bud-observer';

export interface SnapshotSignalValidatorOptions {
  /** Override the starvation window for testing. Defaults to 24 hours. */
  starvationWindowMs?: number;
}

/**
 * Queries the most recent observer snapshots and emits a signal_starvation
 * dead-letter record when ux_proposals AND design_insights have been
 * continuously empty for longer than `starvationWindowMs`.
 *
 * Returns `true` if starvation was detected and dead-lettered, `false` otherwise.
 */
export async function validateSnapshotSignals(
  opts: SnapshotSignalValidatorOptions = {},
): Promise<boolean> {
  const windowMs = opts.starvationWindowMs ?? STARVATION_WINDOW_MS;
  const cutoff = new Date(Date.now() - windowMs).toISOString();

  try {
    const supabase = createServiceClient();

    // Fetch snapshots created within the starvation window.
    // We need at least one snapshot with non-empty arrays to break starvation.
    const { data, error } = await supabase
      .from('observer_snapshots')
      .select('id, created_at, ux_proposals, design_insights')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[snapshot-signal-validator] Query error:', error.message);
      return false;
    }

    // If no snapshots exist in the window, that itself is starvation.
    if (!data || data.length === 0) {
      await enqueueDeadLetter({
        agent_name: AGENT_NAME,
        reason: 'signal_starvation',
        detail:
          `No observer snapshots found in the last ${windowMs / 3600000}h. ` +
          'ux_proposals and design_insights are producing no signal.',
        payload: { cutoff, snapshot_count: 0 },
      });
      return true;
    }

    // Check whether ANY snapshot in the window has non-empty arrays.
    const hasSignal = data.some(
      (row) =>
        (Array.isArray(row.ux_proposals) && (row.ux_proposals as unknown[]).length > 0) ||
        (Array.isArray(row.design_insights) && (row.design_insights as unknown[]).length > 0),
    );

    if (!hasSignal) {
      await enqueueDeadLetter({
        agent_name: AGENT_NAME,
        reason: 'signal_starvation',
        detail:
          `All ${data.length} observer snapshot(s) in the last ${windowMs / 3600000}h ` +
          'have empty ux_proposals and design_insights arrays.',
        payload: {
          cutoff,
          snapshot_count: data.length,
          oldest_in_window: data[data.length - 1]?.created_at,
          newest_in_window: data[0]?.created_at,
        },
      });
      return true;
    }

    return false;
  } catch (err) {
    console.error('[snapshot-signal-validator] Unexpected error:', err);
    return false;
  }
}
