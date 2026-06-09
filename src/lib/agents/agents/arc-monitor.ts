/**
 * Arc Monitor — weekly cron (Monday 6am).
 *
 * Flags story arcs (status: active or planted) that have had no updated_at
 * activity in 14+ days. Writes arc_stale_flag events to growth_pipeline_events.
 *
 * Does NOT:
 *   - Modify story arcs, story bible, characters, chapter, or consent records.
 *   - Auto-close or re-status any arc.
 *   - Create content ideas or opportunities.
 *
 * Idempotency: skips arcs already flagged via arc_stale_flag in the last 7 days.
 * autonomy: review — surfaces a flag_for_review action for Jackson only.
 */
import type { AgentDefinition, AgentContext } from '../types';
import { logPipelineEvent } from '@/lib/growth/pipeline-events';

const STALE_DAYS    = 14;
const RENOTIFY_DAYS = 7;

export const arcMonitorAgent: AgentDefinition = {
  id:          'arc-monitor',
  name:        'Arc Monitor',
  description: 'Weekly review — flags story arcs with no activity in 14+ days.',
  category:    'sales',
  autonomy:    'review',
  preferredModel: 'claude-haiku-4-5-20251001',

  async run(ctx: AgentContext) {
    const staleThreshold    = new Date(Date.now() - STALE_DAYS    * 86_400_000).toISOString();
    const renotifyThreshold = new Date(Date.now() - RENOTIFY_DAYS * 86_400_000).toISOString();

    // Load stale active/planted arcs
    const { data: staleArcs, error } = await ctx.supabase
      .from('story_arcs')
      .select('id, title, status, updated_at, progress_notes')
      .in('status', ['active', 'planted'])
      .lt('updated_at', staleThreshold);

    if (error) {
      ctx.log('arc_monitor fetch_error', { error: error.message });
      return { summary: `Arc Monitor: fetch error — ${error.message}`, output: {}, confidenceScore: 0 };
    }

    if (!staleArcs || staleArcs.length === 0) {
      return {
        summary: 'Arc Monitor: all active arcs have recent activity.',
        output:  { stale: 0, flagged: 0, skipped: 0 },
        confidenceScore: 1,
      };
    }

    // Idempotency: which arcs were already flagged this week?
    const { data: recentFlags } = await ctx.supabase
      .from('growth_pipeline_events')
      .select('source_id')
      .eq('event_type', 'arc_stale_flag')
      .gt('created_at', renotifyThreshold);

    const recentlyFlagged = new Set<string>(
      (recentFlags ?? []).map((r: { source_id: string }) => r.source_id),
    );

    const toFlag = staleArcs.filter((arc: { id: string }) => !recentlyFlagged.has(arc.id));
    const skipped = staleArcs.length - toFlag.length;

    if (toFlag.length === 0) {
      return {
        summary: `Arc Monitor: ${staleArcs.length} stale arc(s) found — all already flagged this week.`,
        output:  { stale: staleArcs.length, flagged: 0, skipped },
        confidenceScore: 1,
      };
    }

    const now = Date.now();
    for (const arc of toFlag) {
      const daysSinceUpdate = Math.floor((now - new Date(arc.updated_at).getTime()) / 86_400_000);
      ctx.log(`arc_monitor flagging arc="${arc.title}" days=${daysSinceUpdate}`);

      if (!ctx.dryRun) {
        await logPipelineEvent(ctx.supabase as any, {
          event_type:  'arc_stale_flag',
          source_type: 'story_arc',
          source_id:   arc.id,
          metadata:    {
            title:              arc.title,
            status:             arc.status,
            days_since_update:  daysSinceUpdate,
            has_progress_notes: Boolean((arc.progress_notes as string | null)?.trim()),
          },
        });
      }
    }

    if (!ctx.dryRun) {
      await ctx.proposeAction({
        action_type:  'flag_for_review',
        target_table: 'story_arcs',
        preview:      `${toFlag.length} story arc(s) have had no activity for ${STALE_DAYS}+ days. ${skipped} already reported this week.`,
        payload:      {
          flagged: toFlag.length,
          skipped,
          arcs: toFlag.map((a: { id: string; title: string; status: string; updated_at: string }) => ({
            id:         a.id,
            title:      a.title,
            status:     a.status,
            updated_at: a.updated_at,
            days_since_update: Math.floor((now - new Date(a.updated_at).getTime()) / 86_400_000),
          })),
        },
      });
    }

    return {
      summary:         `Arc Monitor: ${toFlag.length} arc(s) flagged as stale (${skipped} already reported this week).`,
      output:          { stale: staleArcs.length, flagged: toFlag.length, skipped },
      confidenceScore: 0.9,
    };
  },
};
