/**
 * Consent Monitor — weekly cron (Tuesday 7:15am).
 *
 * Flags content_assets with consent_status 'pending' or 'unknown' that are
 * older than 7 days. Prompts Jackson to resolve outstanding consent decisions.
 *
 * Does NOT:
 *   - Change consent_status on any asset.
 *   - Attach or detach assets from production cards.
 *   - Contact crew members or customers directly.
 *
 * Idempotency: skips assets already flagged via consent_unresolved_flag in the last 7 days.
 * autonomy: review — surfaces a flag_for_review action for Jackson only.
 */
import type { AgentDefinition, AgentContext } from '../types';
import { logPipelineEvent } from '@/lib/growth/pipeline-events';

const PENDING_DAYS   = 7;
const RENOTIFY_DAYS  = 7;

const PENDING_STATUSES = ['pending', 'unknown'] as const;

export const consentMonitorAgent: AgentDefinition = {
  id:          'consent-monitor',
  name:        'Consent Monitor',
  description: 'Weekly review — flags assets with pending/unknown consent older than 7 days.',
  category:    'compliance',
  autonomy:    'review',
  preferredModel: 'claude-haiku-4-5-20251001',

  async run(ctx: AgentContext) {
    const pendingThreshold  = new Date(Date.now() - PENDING_DAYS  * 86_400_000).toISOString();
    const renotifyThreshold = new Date(Date.now() - RENOTIFY_DAYS * 86_400_000).toISOString();

    // Load assets with unresolved consent older than threshold
    const { data: pendingAssets, error } = await ctx.supabase
      .from('content_assets')
      .select('id, title, asset_type, consent_status, related_characters, created_at')
      .in('consent_status', PENDING_STATUSES as unknown as string[])
      .lt('created_at', pendingThreshold);

    if (error) {
      ctx.log('consent_monitor fetch_error', { error: error.message });
      return { summary: `Consent Monitor: fetch error — ${error.message}`, output: {}, confidenceScore: 0 };
    }

    if (!pendingAssets || pendingAssets.length === 0) {
      return {
        summary: 'Consent Monitor: no unresolved consent issues.',
        output:  { pending: 0, flagged: 0, skipped: 0 },
        confidenceScore: 1,
      };
    }

    // Idempotency: skip assets already flagged this week
    const { data: recentFlags } = await ctx.supabase
      .from('growth_pipeline_events')
      .select('source_id')
      .eq('event_type', 'consent_unresolved_flag')
      .gt('created_at', renotifyThreshold);

    const recentlyFlagged = new Set<string>(
      (recentFlags ?? []).map((r: { source_id: string }) => r.source_id),
    );

    type AssetRow = {
      id: string;
      title: string;
      asset_type: string;
      consent_status: string;
      related_characters: string[];
      created_at: string;
    };

    const toFlag  = (pendingAssets as AssetRow[]).filter((a) => !recentlyFlagged.has(a.id));
    const skipped = pendingAssets.length - toFlag.length;

    if (toFlag.length === 0) {
      return {
        summary: `Consent Monitor: ${pendingAssets.length} unresolved asset(s) — all already flagged this week.`,
        output:  { pending: pendingAssets.length, flagged: 0, skipped },
        confidenceScore: 1,
      };
    }

    const now = Date.now();

    if (!ctx.dryRun) {
      for (const asset of toFlag) {
        const daysPending = Math.floor((now - new Date(asset.created_at).getTime()) / 86_400_000);
        ctx.log(`consent_monitor flagging asset="${asset.title}" status=${asset.consent_status} days=${daysPending}`);

        await logPipelineEvent(ctx.supabase as any, {
          event_type:  'consent_unresolved_flag',
          source_type: 'content_asset',
          source_id:   asset.id,
          metadata:    {
            title:              asset.title,
            asset_type:         asset.asset_type,
            consent_status:     asset.consent_status,
            days_pending:       daysPending,
            related_characters: asset.related_characters,
          },
        });
      }

      await ctx.proposeAction({
        action_type:  'flag_for_review',
        target_table: 'content_assets',
        preview:      `${toFlag.length} asset(s) have unresolved consent (pending/unknown) for ${PENDING_DAYS}+ days. ${skipped} already reported this week.`,
        payload:      {
          flagged: toFlag.length,
          skipped,
          assets: toFlag.map((a) => ({
            id:             a.id,
            title:          a.title,
            asset_type:     a.asset_type,
            consent_status: a.consent_status,
            days_pending:   Math.floor((now - new Date(a.created_at).getTime()) / 86_400_000),
          })),
        },
      });
    }

    return {
      summary:         `Consent Monitor: ${toFlag.length} asset(s) flagged with unresolved consent (${skipped} already reported this week).`,
      output:          { pending: pendingAssets.length, flagged: toFlag.length, skipped },
      confidenceScore: 0.9,
    };
  },
};
