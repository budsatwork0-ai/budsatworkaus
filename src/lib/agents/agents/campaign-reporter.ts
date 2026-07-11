/**
 * Campaign Reporter — weekly cron (Monday 8:00am).
 *
 * For each active campaign, compares the campaign's stated KPIs and dates
 * against actual published output in the linked publishing queue.
 * Flags campaigns with visible gaps: nothing published, past end date,
 * or no queue items linked at all.
 *
 * Does NOT:
 *   - Change campaign KPIs, goals, dates, or result_summary.
 *   - Create content ideas, scripts, or queue items.
 *   - Publish anything.
 *
 * Idempotency: skips campaigns already flagged via campaign_kpi_report in the last 7 days.
 * autonomy: review — all output goes through proposeAction.
 */
import type { AgentDefinition, AgentContext } from '../types';
import { logPipelineEvent } from '@/lib/growth/pipeline-events';

const RENOTIFY_DAYS = 7;

type QueueRow = {
  id: string;
  status: string;
  platform: string;
  published_at: string | null;
};

type CampaignRow = {
  id: string;
  name: string;
  goal: string;
  channels: string[];
  start_date: string | null;
  end_date: string | null;
  kpis: Record<string, unknown>;
  result_summary: string;
};


export const campaignReporterAgent: AgentDefinition = {
  id:          'campaign-reporter',
  name:        'Campaign Reporter',
  description: 'Weekly review — compares active campaign KPIs against published output.',
  category:    'sales',
  autonomy:    'review',
  preferredModel: 'claude-haiku-4-5-20251001',

  schema_dependencies: [
    'growth_pipeline_events', 'marketing_campaign_queue_items',
    'marketing_campaigns', 'marketing_publishing_queue',
  ],
  async run(ctx: AgentContext) {
    const renotifyThreshold = new Date(Date.now() - RENOTIFY_DAYS * 86_400_000).toISOString();
    const now = Date.now();

    // Load all active campaigns
    const { data: campaigns, error: campError } = await ctx.supabase
      .from('marketing_campaigns')
      .select('id, name, goal, channels, start_date, end_date, kpis, result_summary')
      .eq('status', 'active');

    if (campError) {
      ctx.log('campaign_reporter fetch_error', { error: campError.message });
      return { summary: `Campaign Reporter: fetch error — ${campError.message}`, output: {}, confidenceScore: 0 };
    }

    if (!campaigns || campaigns.length === 0) {
      return {
        summary: 'Campaign Reporter: no active campaigns.',
        output:  { checked: 0, flagged: 0, skipped: 0 },
        confidenceScore: 1,
      };
    }

    // Idempotency: campaigns already reported this week
    const { data: recentFlags } = await ctx.supabase
      .from('growth_pipeline_events')
      .select('source_id')
      .eq('event_type', 'campaign_kpi_report')
      .gt('created_at', renotifyThreshold);

    const recentlyFlagged = new Set<string>(
      (recentFlags ?? []).map((r: { source_id: string }) => r.source_id),
    );

    // Step 1: load campaign → queue item links
    const campaignIds = (campaigns as CampaignRow[]).map((c) => c.id);
    const { data: links, error: linkError } = await ctx.supabase
      .from('marketing_campaign_queue_items')
      .select('campaign_id, queue_item_id')
      .in('campaign_id', campaignIds);

    if (linkError) {
      ctx.log('campaign_reporter fetch_links_error', { error: linkError.message });
    }

    type LinkRow = { campaign_id: string; queue_item_id: string };

    // Step 2: load the actual queue items
    const queueItemIds = (links ?? []).map((l: LinkRow) => l.queue_item_id);
    const itemsByCampaign = new Map<string, QueueRow[]>();

    if (queueItemIds.length > 0) {
      const { data: queueItems, error: queueError } = await ctx.supabase
        .from('marketing_publishing_queue')
        .select('id, status, platform, published_at')
        .in('id', queueItemIds);

      if (queueError) {
        ctx.log('campaign_reporter fetch_queue_error', { error: queueError.message });
      }

      // Build a map from queue_item_id → QueueRow for quick lookup
      const queueById = new Map<string, QueueRow>(
        ((queueItems ?? []) as QueueRow[]).map((q) => [q.id, q]),
      );

      // Group queue items by campaign_id
      for (const link of (links ?? []) as LinkRow[]) {
        const q = queueById.get(link.queue_item_id);
        if (!q) continue;
        if (!itemsByCampaign.has(link.campaign_id)) itemsByCampaign.set(link.campaign_id, []);
        itemsByCampaign.get(link.campaign_id)!.push(q);
      }
    }

    type FlaggedCampaign = {
      id: string;
      name: string;
      goal: string;
      channels: string[];
      start_date: string | null;
      end_date: string | null;
      kpis: Record<string, unknown>;
      total_linked: number;
      published_count: number;
      ready_count: number;
      draft_count: number;
      is_overdue: boolean;
      gap_reasons: string[];
    };

    const toFlag: FlaggedCampaign[] = [];
    let skipped = 0;

    for (const campaign of campaigns as CampaignRow[]) {
      if (recentlyFlagged.has(campaign.id)) {
        skipped += 1;
        continue;
      }

      const queueItems = itemsByCampaign.get(campaign.id) ?? [];
      const published  = queueItems.filter((q) => q.status === 'published');
      const ready      = queueItems.filter((q) => q.status === 'ready');
      const draft      = queueItems.filter((q) => q.status === 'draft');

      const isOverdue = campaign.end_date
        ? new Date(campaign.end_date).getTime() < now
        : false;

      const startHasPassed = campaign.start_date
        ? new Date(campaign.start_date).getTime() < now
        : true; // no start date → treat as already started

      // Flag conditions
      const gapReasons: string[] = [];
      if (queueItems.length === 0) gapReasons.push('no queue items linked');
      if (published.length === 0 && startHasPassed) gapReasons.push('no published content yet');
      if (isOverdue) gapReasons.push('past end date');

      if (gapReasons.length === 0) continue; // campaign looks healthy — no flag

      ctx.log(`campaign_reporter flagging campaign="${campaign.name}" reasons=${gapReasons.join(',')}`);

      toFlag.push({
        id:              campaign.id,
        name:            campaign.name,
        goal:            campaign.goal,
        channels:        campaign.channels,
        start_date:      campaign.start_date,
        end_date:        campaign.end_date,
        kpis:            campaign.kpis,
        total_linked:    queueItems.length,
        published_count: published.length,
        ready_count:     ready.length,
        draft_count:     draft.length,
        is_overdue:      isOverdue,
        gap_reasons:     gapReasons,
      });
    }

    if (toFlag.length === 0) {
      return {
        summary: `Campaign Reporter: ${campaigns.length} active campaign(s) checked — all progressing (${skipped} already reported this week).`,
        output:  { checked: campaigns.length, flagged: 0, skipped },
        confidenceScore: 1,
      };
    }

    if (!ctx.dryRun) {
      for (const c of toFlag) {
        await logPipelineEvent(ctx.supabase as any, {
          event_type:  'campaign_kpi_report',
          source_type: 'marketing_campaign',
          source_id:   c.id,
          metadata:    {
            name:            c.name,
            goal:            c.goal,
            channels:        c.channels,
            start_date:      c.start_date,
            end_date:        c.end_date,
            kpis:            c.kpis,
            total_linked:    c.total_linked,
            published_count: c.published_count,
            ready_count:     c.ready_count,
            draft_count:     c.draft_count,
            is_overdue:      c.is_overdue,
            gap_reasons:     c.gap_reasons,
          },
        });
      }

      await ctx.proposeAction({
        action_type:  'flag_for_review',
        target_table: 'marketing_campaigns',
        preview:      `${toFlag.length} active campaign(s) have KPI gaps. ${skipped} already reported this week.`,
        payload:      {
          flagged: toFlag.length,
          skipped,
          campaigns: toFlag.map((c) => ({
            id:              c.id,
            name:            c.name,
            end_date:        c.end_date,
            is_overdue:      c.is_overdue,
            total_linked:    c.total_linked,
            published_count: c.published_count,
            ready_count:     c.ready_count,
            kpis:            c.kpis,
            gap_reasons:     c.gap_reasons,
          })),
        },
      });
    }

    return {
      summary:         `Campaign Reporter: ${toFlag.length} campaign(s) flagged with KPI gaps (${skipped} already reported this week).`,
      output:          { checked: campaigns.length, flagged: toFlag.length, skipped },
      confidenceScore: 0.9,
    };
  },
};
