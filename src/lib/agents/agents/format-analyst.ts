/**
 * Format Analyst — weekly cron (Friday 9:00am).
 *
 * Reads published queue items from the last 90 days. Identifies winning
 * formats, platforms, story arcs, characters, and CTAs. Writes pipeline
 * events and surfaces a review-only recommendation action.
 *
 * Does NOT:
 *   - Rewrite playbooks or distribution strategies automatically.
 *   - Create content ideas, scripts, queue items, or campaigns.
 *   - Edit Story Bible, Characters, Arcs, Current Chapter, Open Threads,
 *     consent records, campaigns, or publishing queue records.
 *
 * Idempotency (two levels):
 *   1. Weekly gate — skips entirely if a format_learning_report was already
 *      written for the current ISO week (YYYY-Www in metadata.analysis_week).
 *   2. Per-insight gate — each insight_key is not re-surfaced if a
 *      format_learning_insight event with that key was written within
 *      LEARNING_RENOTIFY_DAYS (28 days).
 *
 * autonomy: review — all output goes through proposeAction, no source records modified.
 */
import type { AgentDefinition, AgentContext } from '../types';
import { logPipelineEvent } from '@/lib/growth/pipeline-events';

const LOOKBACK_DAYS          = 90;
const VELOCITY_WINDOW_DAYS   = 30;
const LEARNING_RENOTIFY_DAYS = 28;
const MIN_PUBLISHED_TO_ANALYSE = 3;

// ── ISO week helper ────────────────────────────────────────────────────────────

function currentIsoWeek(): string {
  const d = new Date();
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// ── Engagement score helper ────────────────────────────────────────────────────
// Returns a numeric score from a performance_data object, or null if no data.

type PerformanceData = {
  views?:          number;
  likes?:          number;
  shares?:         number;
  saves?:          number;
  reach?:          number;
  comments?:       number;
  watch_time_pct?: number;
};

function engagementScore(pd: PerformanceData | null): number | null {
  if (!pd) return null;
  const { views = 0, likes = 0, shares = 0, saves = 0, comments = 0 } = pd;
  const score = views + likes * 3 + shares * 5 + saves * 4 + comments * 2;
  return score > 0 ? score : null;
}

// ── Types ──────────────────────────────────────────────────────────────────────

type QueueItem = {
  id:                 string;
  title:              string;
  platform:           string;
  format:             string;
  related_arc_id:     string | null;
  related_characters: string[];
  notes:              string;
  published_at:       string;
  performance_data:   PerformanceData | null;
};

type ArcRow = {
  id:    string;
  title: string;
};

type Insight = {
  insight_key:     string;
  type:            string;
  description:     string;
  recommendation:  string;
  evidence:        Record<string, unknown>;
};

// ── Frequency counter helper ───────────────────────────────────────────────────

function topByCount<T extends string>(
  items: T[],
  limit = 3,
): Array<{ value: T; count: number }> {
  const counts = new Map<T, number>();
  for (const v of items) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}


export const formatAnalystAgent: AgentDefinition = {
  id:          'format-analyst',
  name:        'Format Analyst',
  description: 'Weekly review — turns published performance data into reusable content learnings.',
  category:    'sales',
  autonomy:    'review',
  preferredModel: 'claude-haiku-4-5-20251001',

  schema_dependencies: ['growth_pipeline_events', 'marketing_publishing_queue', 'story_arcs'],
  async run(ctx: AgentContext) {
    const analysisWeek      = currentIsoWeek();
    const now               = Date.now();
    const lookbackThreshold = new Date(now - LOOKBACK_DAYS * 86_400_000).toISOString();
    const renotifyThreshold = new Date(now - LEARNING_RENOTIFY_DAYS * 86_400_000).toISOString();
    const velocityMid       = new Date(now - VELOCITY_WINDOW_DAYS * 86_400_000).toISOString();
    const velocityPrior     = new Date(now - VELOCITY_WINDOW_DAYS * 2 * 86_400_000).toISOString();

    // ── Weekly gate ────────────────────────────────────────────────────────────
    const { data: weeklyCheck } = await ctx.supabase
      .from('growth_pipeline_events')
      .select('id')
      .eq('event_type', 'format_learning_report')
      .eq('metadata->>analysis_week', analysisWeek)
      .limit(1);

    if (weeklyCheck && weeklyCheck.length > 0) {
      return {
        summary:         `Format Analyst: already ran for ${analysisWeek} — skipping.`,
        output:          { week: analysisWeek, skipped: true },
        confidenceScore: 1,
      };
    }

    // ── Load published queue items ─────────────────────────────────────────────
    const { data: items, error: itemsError } = await ctx.supabase
      .from('marketing_publishing_queue')
      .select('id, title, platform, format, related_arc_id, related_characters, notes, published_at, performance_data')
      .eq('status', 'published')
      .gte('published_at', lookbackThreshold)
      .order('published_at', { ascending: false });

    if (itemsError) {
      ctx.log('format_analyst fetch_error', { error: itemsError.message });
      return { summary: `Format Analyst: fetch error — ${itemsError.message}`, output: {}, confidenceScore: 0 };
    }

    const published = (items ?? []) as QueueItem[];

    if (published.length < MIN_PUBLISHED_TO_ANALYSE) {
      return {
        summary:         `Format Analyst: only ${published.length} published item(s) in the last ${LOOKBACK_DAYS} days — need ${MIN_PUBLISHED_TO_ANALYSE} to analyse.`,
        output:          { published: published.length, analysed: false },
        confidenceScore: 1,
      };
    }

    // ── Load arc names for any referenced arcs ─────────────────────────────────
    const arcIds = [...new Set(published.map((i) => i.related_arc_id).filter(Boolean))] as string[];
    const arcNameById = new Map<string, string>();

    if (arcIds.length > 0) {
      const { data: arcs } = await ctx.supabase
        .from('story_arcs')
        .select('id, title')
        .in('id', arcIds);
      for (const arc of (arcs ?? []) as ArcRow[]) {
        arcNameById.set(arc.id, arc.title);
      }
    }

    // ── Load already-known insight keys (per-insight idempotency) ─────────────
    const { data: knownEvents } = await ctx.supabase
      .from('growth_pipeline_events')
      .select('metadata')
      .eq('event_type', 'format_learning_insight')
      .gte('created_at', renotifyThreshold);

    const knownInsightKeys = new Set<string>(
      (knownEvents ?? [])
        .map((e: { metadata: Record<string, unknown> }) => e.metadata?.insight_key as string)
        .filter(Boolean),
    );

    // ── Structural analysis ────────────────────────────────────────────────────

    // Platform distribution
    const platformCounts = topByCount(published.map((i) => i.platform));

    // Format distribution overall
    const formatsAll = published
      .map((i) => i.format)
      .filter((f) => f.trim() !== '');
    const formatCounts = topByCount(formatsAll);

    // Top format per top platform
    const topPlatform = platformCounts[0]?.value ?? null;
    const topPlatformItems = published.filter((i) => i.platform === topPlatform);
    const topFormatOnTopPlatform = topByCount(
      topPlatformItems.map((i) => i.format).filter((f) => f.trim() !== ''),
    )[0] ?? null;

    // Arc frequency
    const arcList = published
      .map((i) => i.related_arc_id)
      .filter(Boolean) as string[];
    const arcCounts = topByCount(arcList);
    const topArcId   = arcCounts[0]?.value ?? null;
    const topArcName = topArcId ? (arcNameById.get(topArcId) ?? topArcId) : null;

    // Character frequency (flatten arrays)
    const allChars = published.flatMap((i) => i.related_characters ?? []);
    const charCounts = topByCount(allChars);
    const topCharacters = charCounts.slice(0, 3).map((c) => c.value);

    // Engagement leaders (items with performance_data)
    const scoredItems = published
      .map((i) => ({ item: i, score: engagementScore(i.performance_data) }))
      .filter((x): x is { item: QueueItem; score: number } => x.score !== null)
      .sort((a, b) => b.score - a.score);

    const topEngagementItem = scoredItems[0] ?? null;

    // Publishing velocity
    const recentItems = published.filter((i) => i.published_at >= velocityMid);
    const priorItems  = published.filter(
      (i) => i.published_at >= velocityPrior && i.published_at < velocityMid,
    );
    const velocityTrend =
      recentItems.length > priorItems.length ? 'accelerating' :
      recentItems.length < priorItems.length ? 'decelerating' : 'steady';

    // ── Build insights (skip already-known keys) ───────────────────────────────
    const newInsights: Insight[] = [];

    if (topPlatform && platformCounts[0]) {
      const key = `top_platform:${topPlatform}`;
      if (!knownInsightKeys.has(key)) {
        newInsights.push({
          insight_key:    key,
          type:           'platform_leader',
          description:    `${topPlatform} is the most-published platform with ${platformCounts[0].count} item(s) in the last ${LOOKBACK_DAYS} days.`,
          recommendation: `Continue prioritising ${topPlatform} — it has the most content momentum.`,
          evidence:       { platform: topPlatform, count: platformCounts[0].count, all_platforms: platformCounts },
        });
      }
    }

    if (topPlatform && topFormatOnTopPlatform) {
      const key = `top_format:${topPlatform}:${topFormatOnTopPlatform.value}`;
      if (!knownInsightKeys.has(key)) {
        newInsights.push({
          insight_key:    key,
          type:           'format_leader',
          description:    `"${topFormatOnTopPlatform.value}" is the leading format on ${topPlatform} (${topFormatOnTopPlatform.count} published).`,
          recommendation: `Default new ${topPlatform} content to "${topFormatOnTopPlatform.value}" format — it has the clearest production track record.`,
          evidence:       { platform: topPlatform, format: topFormatOnTopPlatform.value, count: topFormatOnTopPlatform.count },
        });
      }
    }

    if (formatCounts.length > 0 && formatsAll.length > 0) {
      const key = `overall_format_leader:${formatCounts[0].value}`;
      if (!knownInsightKeys.has(key)) {
        newInsights.push({
          insight_key:    key,
          type:           'overall_format',
          description:    `"${formatCounts[0].value}" is the most-used format overall across all platforms (${formatCounts[0].count} published).`,
          recommendation: `"${formatCounts[0].value}" is the established content format — ensure new scripts are written to this spec unless testing a new format explicitly.`,
          evidence:       { format: formatCounts[0].value, count: formatCounts[0].count, all_formats: formatCounts },
        });
      }
    }

    if (topArcId && topArcName) {
      const key = `top_arc:${topArcId}`;
      if (!knownInsightKeys.has(key)) {
        newInsights.push({
          insight_key:    key,
          type:           'arc_momentum',
          description:    `Story arc "${topArcName}" is the most-featured arc with ${arcCounts[0].count} published item(s).`,
          recommendation: `Develop more threads under "${topArcName}" — it has the most production momentum and audience exposure.`,
          evidence:       { arc_id: topArcId, arc_name: topArcName, count: arcCounts[0].count, all_arcs: arcCounts.slice(0, 5) },
        });
      }
    }

    if (topCharacters.length > 0) {
      const key = `top_characters:${topCharacters.slice(0, 2).join(',')}`;
      if (!knownInsightKeys.has(key)) {
        newInsights.push({
          insight_key:    key,
          type:           'character_frequency',
          description:    `Most-featured characters: ${topCharacters.join(', ')}.`,
          recommendation: `These characters carry the content voice — keep them front-and-centre in new scripts and hooks.`,
          evidence:       { top_characters: topCharacters, character_counts: charCounts.slice(0, 5) },
        });
      }
    }

    if (topEngagementItem) {
      const { item, score } = topEngagementItem;
      const key = `engagement_leader:${item.platform}:${item.format}`;
      if (!knownInsightKeys.has(key)) {
        newInsights.push({
          insight_key:    key,
          type:           'engagement_leader',
          description:    `Best engagement score: "${item.title}" on ${item.platform} (${item.format}) — score ${score}.`,
          recommendation: `Study and replicate the hook, format, and structure of "${item.title}". It outperforms other published items on measured engagement.`,
          evidence:       {
            queue_item_id:    item.id,
            title:            item.title,
            platform:         item.platform,
            format:           item.format,
            engagement_score: score,
            performance_data: item.performance_data,
          },
        });
      }
    }

    if (velocityTrend !== 'steady') {
      const key = `velocity_trend:${velocityTrend}:${analysisWeek}`;
      if (!knownInsightKeys.has(key)) {
        newInsights.push({
          insight_key:    key,
          type:           'publishing_velocity',
          description:    `Publishing is ${velocityTrend}: ${recentItems.length} item(s) in the last ${VELOCITY_WINDOW_DAYS} days vs ${priorItems.length} in the prior ${VELOCITY_WINDOW_DAYS} days.`,
          recommendation: velocityTrend === 'decelerating'
            ? `Output is slowing — review Production Monitor flags and unblock the pipeline.`
            : `Output is accelerating — ensure quality and consent gates are keeping pace.`,
          evidence: {
            recent_count: recentItems.length,
            prior_count:  priorItems.length,
            trend:        velocityTrend,
            window_days:  VELOCITY_WINDOW_DAYS,
          },
        });
      }
    }

    const skippedInsights = [
      topPlatform ? 1 : 0,
      topFormatOnTopPlatform ? 1 : 0,
      formatCounts.length > 0 ? 1 : 0,
      topArcId ? 1 : 0,
      topCharacters.length > 0 ? 1 : 0,
      topEngagementItem ? 1 : 0,
      velocityTrend !== 'steady' ? 1 : 0,
    ].reduce((a, b) => a + b, 0) - newInsights.length;

    if (newInsights.length === 0) {
      ctx.log('format_analyst no_new_insights', { week: analysisWeek, skipped: skippedInsights });

      if (!ctx.dryRun) {
        await logPipelineEvent(ctx.supabase as any, {
          event_type:  'format_learning_report',
          source_type: 'publishing_queue',
          metadata:    {
            analysis_week:     analysisWeek,
            published_analysed: published.length,
            new_insights:      0,
            skipped_insights:  skippedInsights,
            note:              'All learnings already surfaced within the last 28 days.',
          },
        });
      }

      return {
        summary:         `Format Analyst: ${published.length} items analysed — all ${skippedInsights} learning(s) already surfaced in the last ${LEARNING_RENOTIFY_DAYS} days.`,
        output:          { published: published.length, new_insights: 0, skipped_insights: skippedInsights },
        confidenceScore: 1,
      };
    }

    // ── Write per-insight events ───────────────────────────────────────────────
    if (!ctx.dryRun) {
      for (const insight of newInsights) {
        await logPipelineEvent(ctx.supabase as any, {
          event_type:  'format_learning_insight',
          source_type: 'publishing_queue',
          metadata:    {
            analysis_week:   analysisWeek,
            insight_key:     insight.insight_key,
            type:            insight.type,
            description:     insight.description,
            recommendation:  insight.recommendation,
            evidence:        insight.evidence,
          },
        });
      }

      // Write the weekly summary report event
      await logPipelineEvent(ctx.supabase as any, {
        event_type:  'format_learning_report',
        source_type: 'publishing_queue',
        metadata:    {
          analysis_week:      analysisWeek,
          published_analysed: published.length,
          new_insights:       newInsights.length,
          skipped_insights:   skippedInsights,
          insight_keys:       newInsights.map((i) => i.insight_key),
        },
      });

      // Surface all new insights as a single review action
      await ctx.proposeAction({
        action_type:  'flag_for_review',
        target_table: 'marketing_publishing_queue',
        preview:      `Format Analyst: ${newInsights.length} new learning(s) from ${published.length} published items (${analysisWeek}).`,
        payload:      {
          analysis_week:       analysisWeek,
          published_analysed:  published.length,
          new_insights:        newInsights.length,
          skipped_insights:    skippedInsights,
          items_with_perf_data: scoredItems.length,
          insights: newInsights.map((i) => ({
            key:            i.insight_key,
            type:           i.type,
            description:    i.description,
            recommendation: i.recommendation,
          })),
        },
      });
    }

    return {
      summary:         `Format Analyst: ${newInsights.length} new learning(s) from ${published.length} published items (${analysisWeek}). ${skippedInsights} already known.`,
      output:          {
        published:          published.length,
        new_insights:       newInsights.length,
        skipped_insights:   skippedInsights,
        items_with_perf_data: scoredItems.length,
        analysis_week:      analysisWeek,
      },
      confidenceScore: 0.9,
    };
  },
};
