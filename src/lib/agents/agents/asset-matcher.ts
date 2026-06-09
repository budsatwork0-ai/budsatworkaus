/**
 * Asset Matcher — daily cron (7:00am).
 *
 * For each active production card, finds confirmed, unattached content_assets
 * whose related_characters overlap with the card's related_characters.
 * Cards with no characters specified match any confirmed unattached asset.
 * Surfaces these as suggestions — never attaches assets automatically.
 *
 * Does NOT:
 *   - Set production_card_id on any asset.
 *   - Change consent_status on any asset.
 *   - Modify production cards in any way.
 *
 * Idempotency: skips cards already surfaced via asset_match_suggested in the last 7 days.
 * autonomy: review — all output goes through proposeAction.
 */
import type { AgentDefinition, AgentContext } from '../types';
import { logPipelineEvent } from '@/lib/growth/pipeline-events';

const RENOTIFY_DAYS   = 7;
const ACTIVE_STATUSES = ['to_film', 'in_edit', 'ready_to_publish'] as const;

export const assetMatcherAgent: AgentDefinition = {
  id:          'asset-matcher',
  name:        'Asset Matcher',
  description: 'Daily review — suggests confirmed cleared assets for active production cards.',
  category:    'sales',
  autonomy:    'review',
  preferredModel: 'claude-haiku-4-5-20251001',

  async run(ctx: AgentContext) {
    const renotifyThreshold = new Date(Date.now() - RENOTIFY_DAYS * 86_400_000).toISOString();

    // Load active production cards
    const { data: cards, error: cardsError } = await ctx.supabase
      .from('content_production_cards')
      .select('id, title, platform, format, related_characters')
      .in('status', ACTIVE_STATUSES as unknown as string[]);

    if (cardsError) {
      ctx.log('asset_matcher fetch_cards_error', { error: cardsError.message });
      return { summary: `Asset Matcher: fetch error — ${cardsError.message}`, output: {}, confidenceScore: 0 };
    }

    if (!cards || cards.length === 0) {
      return {
        summary: 'Asset Matcher: no active production cards.',
        output:  { checked: 0, matched: 0, skipped: 0 },
        confidenceScore: 1,
      };
    }

    // Load confirmed, unattached assets
    const { data: assets, error: assetsError } = await ctx.supabase
      .from('content_assets')
      .select('id, title, asset_type, related_characters')
      .eq('consent_status', 'confirmed')
      .is('production_card_id', null);

    if (assetsError) {
      ctx.log('asset_matcher fetch_assets_error', { error: assetsError.message });
      return { summary: `Asset Matcher: assets fetch error — ${assetsError.message}`, output: {}, confidenceScore: 0 };
    }

    const confirmedAssets = assets ?? [];

    if (confirmedAssets.length === 0) {
      return {
        summary: 'Asset Matcher: no confirmed unattached assets available.',
        output:  { checked: cards.length, matched: 0, skipped: 0 },
        confidenceScore: 1,
      };
    }

    // Idempotency: cards flagged in the last 7 days
    const { data: recentFlags } = await ctx.supabase
      .from('growth_pipeline_events')
      .select('source_id')
      .eq('event_type', 'asset_match_suggested')
      .gt('created_at', renotifyThreshold);

    const recentlyFlagged = new Set<string>(
      (recentFlags ?? []).map((r: { source_id: string }) => r.source_id),
    );

    type CardRow  = { id: string; title: string; platform: string; format: string; related_characters: string[] };
    type AssetRow = { id: string; title: string; asset_type: string; related_characters: string[] };

    const matches: Array<{ card: CardRow; suggestions: AssetRow[] }> = [];
    let skipped = 0;

    for (const card of cards as CardRow[]) {
      if (recentlyFlagged.has(card.id)) {
        skipped += 1;
        continue;
      }

      const cardChars = new Set<string>(
        (card.related_characters ?? []).map((c: string) => c.toLowerCase().trim()),
      );

      // Match on character overlap. If the card lists no characters, match all confirmed assets.
      const matched = (confirmedAssets as AssetRow[]).filter((a) => {
        if (cardChars.size === 0) return true;
        return (a.related_characters ?? [])
          .map((c: string) => c.toLowerCase().trim())
          .some((c: string) => cardChars.has(c));
      });

      if (matched.length > 0) {
        matches.push({ card, suggestions: matched });
      }
    }

    if (matches.length === 0) {
      return {
        summary: `Asset Matcher: no matches found (${skipped} card(s) already reported this week).`,
        output:  { checked: cards.length, matched: 0, skipped },
        confidenceScore: 1,
      };
    }

    if (!ctx.dryRun) {
      for (const { card, suggestions } of matches) {
        await logPipelineEvent(ctx.supabase as any, {
          event_type:  'asset_match_suggested',
          source_type: 'production_card',
          source_id:   card.id,
          metadata:    {
            card_title:       card.title,
            platform:         card.platform,
            format:           card.format,
            suggestion_count: suggestions.length,
            asset_ids:        suggestions.map((a) => a.id),
            asset_titles:     suggestions.map((a) => a.title),
          },
        });
      }

      await ctx.proposeAction({
        action_type:  'flag_for_review',
        target_table: 'content_assets',
        preview:      `${matches.length} production card(s) have confirmed cleared assets available to attach. ${skipped} already reported this week.`,
        payload:      {
          matched: matches.length,
          skipped,
          cards: matches.map(({ card, suggestions }) => ({
            id:               card.id,
            title:            card.title,
            platform:         card.platform,
            suggestion_count: suggestions.length,
            suggestions:      suggestions.map((a) => ({
              id:         a.id,
              title:      a.title,
              asset_type: a.asset_type,
            })),
          })),
        },
      });
    }

    return {
      summary:         `Asset Matcher: ${matches.length} card(s) matched with cleared assets (${skipped} already reported this week).`,
      output:          { checked: cards.length, matched: matches.length, skipped },
      confidenceScore: 0.9,
    };
  },
};
