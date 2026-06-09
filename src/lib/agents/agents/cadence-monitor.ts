/**
 * Cadence Monitor — weekly cron (Wednesday 7:00am).
 *
 * For each active social channel with a weekly posting target, counts items
 * published to that platform in the last 7 days. Flags channels that are
 * behind their target cadence.
 *
 * Does NOT:
 *   - Change channel profiles, targets, or status.
 *   - Create content, queue items, or publishing schedules.
 *   - Publish anything.
 *
 * Idempotency: skips channels already flagged via cadence_behind_flag in the last 7 days.
 * autonomy: review — all output goes through proposeAction.
 */
import type { AgentDefinition, AgentContext } from '../types';
import { logPipelineEvent } from '@/lib/growth/pipeline-events';

const RENOTIFY_DAYS   = 7;
const LOOKBACK_DAYS   = 7;

type ChannelRow = {
  id: string;
  platform: string;
  handle: string;
  posting_target_per_week: number;
};


export const cadenceMonitorAgent: AgentDefinition = {
  id:          'cadence-monitor',
  name:        'Cadence Monitor',
  description: 'Weekly review — flags channels behind their posting cadence target.',
  category:    'sales',
  autonomy:    'review',
  preferredModel: 'claude-haiku-4-5-20251001',

  async run(ctx: AgentContext) {
    const renotifyThreshold = new Date(Date.now() - RENOTIFY_DAYS * 86_400_000).toISOString();
    const lookbackThreshold = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();

    // Load active channels that have a posting target set
    const { data: channels, error: chanError } = await ctx.supabase
      .from('marketing_social_channels')
      .select('id, platform, handle, posting_target_per_week')
      .eq('status', 'active')
      .gt('posting_target_per_week', 0);

    if (chanError) {
      ctx.log('cadence_monitor fetch_error', { error: chanError.message });
      return { summary: `Cadence Monitor: fetch error — ${chanError.message}`, output: {}, confidenceScore: 0 };
    }

    if (!channels || channels.length === 0) {
      return {
        summary: 'Cadence Monitor: no active channels with a posting target.',
        output:  { checked: 0, flagged: 0, skipped: 0 },
        confidenceScore: 1,
      };
    }

    // Idempotency: channels already flagged this week (keyed by channel id)
    const { data: recentFlags } = await ctx.supabase
      .from('growth_pipeline_events')
      .select('source_id')
      .eq('event_type', 'cadence_behind_flag')
      .gt('created_at', renotifyThreshold);

    const recentlyFlagged = new Set<string>(
      (recentFlags ?? []).map((r: { source_id: string }) => r.source_id),
    );

    // Count published items per platform in the last 7 days
    const { data: publishedCounts, error: countError } = await ctx.supabase
      .from('marketing_publishing_queue')
      .select('platform')
      .eq('status', 'published')
      .gt('published_at', lookbackThreshold);

    if (countError) {
      ctx.log('cadence_monitor count_error', { error: countError.message });
    }

    // Tally counts per platform from raw rows
    const platformCounts = new Map<string, number>();
    for (const row of (publishedCounts ?? []) as { platform: string }[]) {
      platformCounts.set(row.platform, (platformCounts.get(row.platform) ?? 0) + 1);
    }

    type BehindChannel = {
      id: string;
      platform: string;
      handle: string;
      target: number;
      actual: number;
      shortfall: number;
    };

    const toFlag: BehindChannel[] = [];
    let skipped = 0;

    for (const channel of channels as ChannelRow[]) {
      if (recentlyFlagged.has(channel.id)) {
        skipped += 1;
        continue;
      }

      const actual   = platformCounts.get(channel.platform) ?? 0;
      const target   = channel.posting_target_per_week;
      const shortfall = target - actual;

      if (shortfall <= 0) continue; // on target or ahead

      ctx.log(`cadence_monitor flagging platform=${channel.platform} actual=${actual} target=${target} shortfall=${shortfall}`);

      toFlag.push({
        id:        channel.id,
        platform:  channel.platform,
        handle:    channel.handle,
        target,
        actual,
        shortfall,
      });
    }

    if (toFlag.length === 0) {
      return {
        summary: `Cadence Monitor: all ${channels.length} active channel(s) are on target (${skipped} already reported this week).`,
        output:  { checked: channels.length, flagged: 0, skipped },
        confidenceScore: 1,
      };
    }

    if (!ctx.dryRun) {
      for (const c of toFlag) {
        await logPipelineEvent(ctx.supabase as any, {
          event_type:  'cadence_behind_flag',
          source_type: 'social_channel',
          source_id:   c.id,
          metadata:    {
            platform:  c.platform,
            handle:    c.handle,
            target:    c.target,
            actual:    c.actual,
            shortfall: c.shortfall,
            lookback_days: LOOKBACK_DAYS,
          },
        });
      }

      await ctx.proposeAction({
        action_type:  'flag_for_review',
        target_table: 'marketing_social_channels',
        preview:      `${toFlag.length} channel(s) are behind their weekly posting target. ${skipped} already reported this week.`,
        payload:      {
          flagged: toFlag.length,
          skipped,
          channels: toFlag.map((c) => ({
            id:        c.id,
            platform:  c.platform,
            handle:    c.handle,
            target:    c.target,
            actual:    c.actual,
            shortfall: c.shortfall,
          })),
        },
      });
    }

    return {
      summary:         `Cadence Monitor: ${toFlag.length} channel(s) behind cadence target (${skipped} already reported this week).`,
      output:          { checked: channels.length, flagged: toFlag.length, skipped },
      confidenceScore: 0.9,
    };
  },
};
