/**
 * Thread Progress — daily cron (6:30am).
 *
 * Flags open story threads with no updated_at activity in 7+ days.
 * Also checks for indirect arc activity (recent opportunities linked to the
 * same arc) so Jackson can see whether related pipeline work is progressing
 * even if the thread itself hasn't been directly touched.
 *
 * Does NOT:
 *   - Modify open threads, story arcs, characters, story bible, or consent records.
 *   - Auto-close or resolve any thread.
 *   - Create content ideas or opportunities.
 *
 * Idempotency: skips threads already flagged via thread_stale_flag in the last 24h.
 * autonomy: review — surfaces a flag_for_review action for Jackson only.
 */
import type { AgentDefinition, AgentContext } from '../types';
import { logPipelineEvent } from '@/lib/growth/pipeline-events';

const STALE_DAYS       = 7;
const RENOTIFY_HOURS   = 24;
const EVIDENCE_DAYS    = 30;

export const threadProgressAgent: AgentDefinition = {
  id:          'thread-progress',
  name:        'Thread Progress',
  description: 'Daily review — flags open story threads with no progress in 7+ days.',
  category:    'sales',
  autonomy:    'review',
  preferredModel: 'claude-haiku-4-5-20251001',

  async run(ctx: AgentContext) {
    const staleThreshold    = new Date(Date.now() - STALE_DAYS    * 86_400_000).toISOString();
    const renotifyThreshold = new Date(Date.now() - RENOTIFY_HOURS * 3_600_000).toISOString();
    const evidenceWindow    = new Date(Date.now() - EVIDENCE_DAYS  * 86_400_000).toISOString();

    // Load stale open threads
    const { data: staleThreads, error } = await ctx.supabase
      .from('story_open_threads')
      .select('id, title, status, updated_at, progress_notes, related_arc_id')
      .eq('status', 'open')
      .lt('updated_at', staleThreshold);

    if (error) {
      ctx.log('thread_progress fetch_error', { error: error.message });
      return { summary: `Thread Progress: fetch error — ${error.message}`, output: {}, confidenceScore: 0 };
    }

    if (!staleThreads || staleThreads.length === 0) {
      return {
        summary: 'Thread Progress: all open threads have recent activity.',
        output:  { stale: 0, flagged: 0, skipped: 0 },
        confidenceScore: 1,
      };
    }

    // Idempotency: skip threads flagged in the last 24h
    const { data: recentFlags } = await ctx.supabase
      .from('growth_pipeline_events')
      .select('source_id')
      .eq('event_type', 'thread_stale_flag')
      .gt('created_at', renotifyThreshold);

    const recentlyFlagged = new Set<string>(
      (recentFlags ?? []).map((r: { source_id: string }) => r.source_id),
    );

    const toFlag = staleThreads.filter((t: { id: string }) => !recentlyFlagged.has(t.id));
    const skipped = staleThreads.length - toFlag.length;

    if (toFlag.length === 0) {
      return {
        summary: `Thread Progress: ${staleThreads.length} stale thread(s) — all already flagged in the last 24h.`,
        output:  { stale: staleThreads.length, flagged: 0, skipped },
        confidenceScore: 1,
      };
    }

    // Arc activity evidence: find arcs that have recent opportunities (progress signal)
    const arcIds = [
      ...new Set(
        toFlag
          .map((t: { related_arc_id: string | null }) => t.related_arc_id)
          .filter((id: string | null): id is string => Boolean(id)),
      ),
    ];

    const arcWithRecentActivity = new Set<string>();
    if (arcIds.length > 0) {
      const { data: recentOpps } = await ctx.supabase
        .from('story_opportunities')
        .select('related_arc_id')
        .in('related_arc_id', arcIds)
        .gt('created_at', evidenceWindow);

      for (const opp of (recentOpps ?? [])) {
        if (opp.related_arc_id) arcWithRecentActivity.add(opp.related_arc_id);
      }
    }

    const now = Date.now();
    for (const thread of toFlag) {
      const daysSinceUpdate = Math.floor((now - new Date(thread.updated_at).getTime()) / 86_400_000);
      const hasArcActivity  = thread.related_arc_id
        ? arcWithRecentActivity.has(thread.related_arc_id)
        : false;

      ctx.log(`thread_progress flagging thread="${thread.title}" days=${daysSinceUpdate} arc_activity=${hasArcActivity}`);

      if (!ctx.dryRun) {
        await logPipelineEvent(ctx.supabase as any, {
          event_type:  'thread_stale_flag',
          source_type: 'open_thread',
          source_id:   thread.id,
          metadata:    {
            title:              thread.title,
            days_since_update:  daysSinceUpdate,
            has_progress_notes: Boolean((thread.progress_notes as string | null)?.trim()),
            has_arc_activity:   hasArcActivity,
            related_arc_id:     thread.related_arc_id ?? null,
          },
        });
      }
    }

    if (!ctx.dryRun) {
      await ctx.proposeAction({
        action_type:  'flag_for_review',
        target_table: 'story_open_threads',
        preview:      `${toFlag.length} open thread(s) have had no progress for ${STALE_DAYS}+ days. ${skipped} already flagged today.`,
        payload:      {
          flagged: toFlag.length,
          skipped,
          threads: toFlag.map((t: { id: string; title: string; updated_at: string; related_arc_id: string | null }) => ({
            id:               t.id,
            title:            t.title,
            days_since_update: Math.floor((now - new Date(t.updated_at).getTime()) / 86_400_000),
            related_arc_id:   t.related_arc_id,
            has_arc_activity: t.related_arc_id ? arcWithRecentActivity.has(t.related_arc_id) : false,
          })),
        },
      });
    }

    return {
      summary:         `Thread Progress: ${toFlag.length} thread(s) flagged as stale (${skipped} already reported today).`,
      output:          { stale: staleThreads.length, flagged: toFlag.length, skipped },
      confidenceScore: 0.9,
    };
  },
};
