/**
 * Production Monitor — daily cron (6:45am).
 *
 * Flags content_production_cards that have had no movement (updated_at)
 * for 7+ days. Only monitors active statuses: to_film, in_edit, ready_to_publish.
 * Published cards are ignored. Overdue cards (past deadline) are flagged with
 * higher urgency in the metadata.
 *
 * Does NOT:
 *   - Modify production cards, scripts, story arcs, characters, or consent records.
 *   - Auto-archive or re-status any card.
 *
 * Idempotency: skips cards already flagged via production_card_stale_flag in the last 24h.
 * autonomy: review — surfaces a flag_for_review action for Jackson only.
 */
import type { AgentDefinition, AgentContext } from '../types';
import { logPipelineEvent } from '@/lib/growth/pipeline-events';

const STALE_DAYS    = 7;
const RENOTIFY_HOURS = 24;
const ACTIVE_STATUSES = ['to_film', 'in_edit', 'ready_to_publish'] as const;

export const productionMonitorAgent: AgentDefinition = {
  id:          'production-monitor',
  name:        'Production Monitor',
  description: 'Daily review — flags production cards stalled for 7+ days.',
  category:    'sales',
  autonomy:    'review',
  preferredModel: 'claude-haiku-4-5-20251001',

  async run(ctx: AgentContext) {
    const staleThreshold    = new Date(Date.now() - STALE_DAYS    * 86_400_000).toISOString();
    const renotifyThreshold = new Date(Date.now() - RENOTIFY_HOURS * 3_600_000).toISOString();

    // Load stalled production cards
    const { data: staleCards, error } = await ctx.supabase
      .from('content_production_cards')
      .select('id, title, platform, format, status, updated_at, deadline')
      .in('status', ACTIVE_STATUSES as unknown as string[])
      .lt('updated_at', staleThreshold);

    if (error) {
      ctx.log('production_monitor fetch_error', { error: error.message });
      return { summary: `Production Monitor: fetch error — ${error.message}`, output: {}, confidenceScore: 0 };
    }

    if (!staleCards || staleCards.length === 0) {
      return {
        summary: 'Production Monitor: no stalled production cards.',
        output:  { stale: 0, flagged: 0, skipped: 0 },
        confidenceScore: 1,
      };
    }

    // Idempotency: skip cards flagged in the last 24h
    const { data: recentFlags } = await ctx.supabase
      .from('growth_pipeline_events')
      .select('source_id')
      .eq('event_type', 'production_card_stale_flag')
      .gt('created_at', renotifyThreshold);

    const recentlyFlagged = new Set<string>(
      (recentFlags ?? []).map((r: { source_id: string }) => r.source_id),
    );

    const toFlag = staleCards.filter((c: { id: string }) => !recentlyFlagged.has(c.id));
    const skipped = staleCards.length - toFlag.length;

    if (toFlag.length === 0) {
      return {
        summary: `Production Monitor: ${staleCards.length} stalled card(s) — all already flagged in the last 24h.`,
        output:  { stale: staleCards.length, flagged: 0, skipped },
        confidenceScore: 1,
      };
    }

    const now = Date.now();
    for (const card of toFlag) {
      const daysSinceUpdate = Math.floor((now - new Date(card.updated_at).getTime()) / 86_400_000);
      const isOverdue       = card.deadline ? new Date(card.deadline).getTime() < now : false;

      ctx.log(`production_monitor flagging card="${card.title}" status=${card.status} days=${daysSinceUpdate} overdue=${isOverdue}`);

      if (!ctx.dryRun) {
        await logPipelineEvent(ctx.supabase as any, {
          event_type:  'production_card_stale_flag',
          source_type: 'production_card',
          source_id:   card.id,
          metadata:    {
            title:             card.title,
            platform:          card.platform,
            format:            card.format,
            status:            card.status,
            days_since_update: daysSinceUpdate,
            is_overdue:        isOverdue,
            deadline:          card.deadline ?? null,
          },
        });
      }
    }

    if (!ctx.dryRun) {
      await ctx.proposeAction({
        action_type:  'flag_for_review',
        target_table: 'content_production_cards',
        preview:      `${toFlag.length} production card(s) have had no movement for ${STALE_DAYS}+ days. ${skipped} already flagged today.`,
        payload:      {
          flagged: toFlag.length,
          skipped,
          cards: toFlag.map((c: { id: string; title: string; platform: string; status: string; updated_at: string; deadline: string | null }) => ({
            id:               c.id,
            title:            c.title,
            platform:         c.platform,
            status:           c.status,
            days_since_update: Math.floor((now - new Date(c.updated_at).getTime()) / 86_400_000),
            deadline:         c.deadline,
            is_overdue:       c.deadline ? new Date(c.deadline).getTime() < now : false,
          })),
        },
      });
    }

    return {
      summary:         `Production Monitor: ${toFlag.length} card(s) flagged as stalled (${skipped} already reported today).`,
      output:          { stale: staleCards.length, flagged: toFlag.length, skipped },
      confidenceScore: 0.9,
    };
  },
};
