/**
 * Trend Scout — daily web reconnaissance for platform content trends.
 *
 * Searches TikTok, Instagram, YouTube, and Facebook for trending content
 * formats, hooks, and topics relevant to local home-services businesses.
 * Writes to research_trends. Never approves trends for content — that is
 * the Adaptation Validator's job and ultimately Jackson's decision.
 *
 * autonomy: review — all writes go through proposeAction after scouting.
 * Deduplication: skips any (platform, title) pair already in the table
 * (case-insensitive LOWER comparison).
 */
import type { AgentDefinition, AgentContext } from '../types';
import { logPipelineEvent } from '@/lib/growth/pipeline-events';

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM = `You are a content strategist for Buds At Work, a local home services
business in Logan & South Brisbane, Australia (cleaning, yard care, window cleaning,
dump runs, car detailing, NDIS support work).

Given web search result snippets about trending content on a social platform, extract
2-4 genuine trends that a local services business could realistically adapt.

Return ONLY valid JSON — no markdown fences, no other text:
{
  "trends": [
    {
      "title": "Short trend name, ≤60 chars",
      "description": "What the trend is and why it performs. ≤200 chars. Specific, not generic.",
      "trend_type": "format"|"hook"|"topic"|"audio"|"visual_style"|"other",
      "urgency": "evergreen"|"two_week_window"|"forty_eight_hour_window",
      "adaptation_angle": "Specific angle for Buds At Work content. ≤200 chars. Must name a service or story element."
    }
  ]
}

Rules:
- Only include trends with a concrete, plausible link to home services content.
- Skip generic advice ("post consistently", "add value").
- Skip trends requiring large production budgets or celebrity talent.
- Be specific — "Satisfying before/after Reel" is good, "make engaging content" is not.
- If no results are relevant, return { "trends": [] }.`;

// ─── Platform search queries ──────────────────────────────────────────────────

const PLATFORM_QUERIES: Record<string, string[]> = {
  tiktok:    [
    'trending tiktok content formats small business 2025',
    'tiktok hooks that get views local services tradies',
  ],
  instagram: [
    'trending instagram reels format local business 2025',
    'instagram hook ideas cleaning yard home services',
  ],
  youtube:   [
    'trending youtube video formats small business 2025',
    'youtube shorts trending topics local tradie business',
  ],
  facebook:  [
    'facebook content strategy local service business 2025',
    'facebook post formats high engagement small business',
  ],
};

const PLATFORMS = Object.keys(PLATFORM_QUERIES) as Array<keyof typeof PLATFORM_QUERIES>;

// ─── Agent definition ─────────────────────────────────────────────────────────

export const trendScoutAgent: AgentDefinition = {
  id:          'trend-scout',
  name:        'Trend Scout',
  description: 'Scouts daily content trends per platform and records them in Research Lab.',
  category:    'sales',
  autonomy:    'review',
  preferredModel: 'claude-haiku-4-5-20251001',

  async run(ctx: AgentContext) {
    let totalInserted  = 0;
    let totalSkipped   = 0;
    let totalExtracted = 0;

    // Load existing (platform, title) pairs for dedup — LOWER comparison.
    const { data: existing } = await ctx.supabase
      .from('research_trends')
      .select('platform, title');

    const existingKeys = new Set<string>(
      (existing ?? []).map((r: { platform: string; title: string }) =>
        `${r.platform}::${r.title.toLowerCase().trim()}`,
      ),
    );

    for (const platform of PLATFORMS) {
      const queries = PLATFORM_QUERIES[platform];
      const snippets: string[] = [];

      for (const q of queries) {
        const hits = await webSearch(q, 5);
        ctx.log(`trend_scout platform=${platform} query="${q}" hits=${hits.length}`);
        for (const hit of hits) {
          snippets.push(`Title: ${hit.title}\nSnippet: ${hit.snippet}`);
        }
      }

      if (snippets.length === 0) {
        ctx.log(`trend_scout platform=${platform} no_results`);
        continue;
      }

      const prompt = `Platform: ${platform.toUpperCase()}

Search results:
${snippets.slice(0, 10).join('\n\n')}

Extract 2-4 trends for a local home services business in Logan & South Brisbane.`;

      let parsed: { trends: Array<{ title: string; description: string; trend_type: string; urgency: string; adaptation_angle: string }> };
      try {
        const raw = await ctx.llm(prompt, { system: SYSTEM });
        parsed = parseJsonResponse(raw) as typeof parsed;
        if (!Array.isArray(parsed?.trends)) {
          ctx.log(`trend_scout platform=${platform} unexpected_shape`);
          continue;
        }
      } catch (err) {
        ctx.log(`trend_scout platform=${platform} llm_or_parse_error`, {
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      totalExtracted += parsed.trends.length;

      for (const trend of parsed.trends) {
        const titleClean = (trend.title ?? '').trim().slice(0, 255);
        if (!titleClean) continue;

        const dedupeKey = `${platform}::${titleClean.toLowerCase()}`;
        if (existingKeys.has(dedupeKey)) {
          totalSkipped += 1;
          ctx.log(`trend_scout skip_duplicate platform=${platform} title="${titleClean}"`);
          continue;
        }

        const trendType = VALID_TREND_TYPES.has(trend.trend_type) ? trend.trend_type : 'other';
        const urgency   = VALID_URGENCIES.has(trend.urgency)       ? trend.urgency   : 'evergreen';

        if (!ctx.dryRun) {
          const { error } = await ctx.supabase
            .from('research_trends')
            .insert({
              platform,
              title:            titleClean,
              description:      (trend.description ?? '').slice(0, 500),
              trend_type:       trendType,
              urgency,
              adaptation_angle: (trend.adaptation_angle ?? '').slice(0, 500),
              status:           'watching',
              notes:            `Auto-scouted by Trend Scout agent.`,
            });

          if (error) {
            ctx.log(`trend_scout insert_error platform=${platform}`, { error: error.message });
            continue;
          }

          existingKeys.add(dedupeKey);
          totalInserted += 1;

          await logPipelineEvent(ctx.supabase as any, {
            event_type:  'trend_scouted',
            source_type: 'opportunity',
            metadata:    { platform, title: titleClean, trend_type: trendType, urgency },
          });
        } else {
          ctx.log(`trend_scout dry_run would_insert platform=${platform} title="${titleClean}"`);
          totalInserted += 1;
        }
      }
    }

    if (totalInserted > 0) {
      await ctx.proposeAction({
        action_type:  'flag_for_review',
        target_table: 'research_trends',
        preview:      `${totalInserted} new trend(s) scouted across ${PLATFORMS.length} platforms. ${totalSkipped} duplicate(s) skipped.`,
        payload:      { inserted: totalInserted, skipped: totalSkipped, extracted: totalExtracted },
      });
    }

    return {
      summary:     `Trend Scout: ${totalInserted} new trends added, ${totalSkipped} duplicates skipped, ${totalExtracted} extracted from LLM.`,
      output:      { inserted: totalInserted, skipped: totalSkipped, extracted: totalExtracted },
      confidenceScore: totalInserted > 0 ? 0.75 : 0.5,
    };
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_TREND_TYPES = new Set(['audio', 'format', 'hook', 'topic', 'visual_style', 'other']);
const VALID_URGENCIES   = new Set(['evergreen', 'two_week_window', 'forty_eight_hour_window']);

function parseJsonResponse(raw: string): unknown {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  }
  if (!cleaned.startsWith('{')) {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) cleaned = m[0];
  }
  return JSON.parse(cleaned);
}

interface SearchHit { title: string; url: string; snippet: string }

async function webSearch(query: string, limit: number): Promise<SearchHit[]> {
  const braveKey = process.env.BRAVE_SEARCH_API_KEY;
  if (braveKey) {
    const u = new URL('https://api.search.brave.com/res/v1/web/search');
    u.searchParams.set('q', query);
    u.searchParams.set('count', String(limit));
    try {
      const res = await fetch(u, { headers: { 'X-Subscription-Token': braveKey, accept: 'application/json' } });
      if (!res.ok) return [];
      const j = (await res.json()) as { web?: { results?: Array<{ title: string; url: string; description: string }> } };
      return (j.web?.results ?? []).slice(0, limit).map((r) => ({ title: r.title, url: r.url, snippet: r.description }));
    } catch { return []; }
  }

  const serpKey = process.env.SERPAPI_API_KEY;
  if (serpKey) {
    const u = new URL('https://serpapi.com/search.json');
    u.searchParams.set('q', query);
    u.searchParams.set('num', String(limit));
    u.searchParams.set('api_key', serpKey);
    try {
      const res = await fetch(u);
      if (!res.ok) return [];
      const j = (await res.json()) as { organic_results?: Array<{ title: string; link: string; snippet: string }> };
      return (j.organic_results ?? []).slice(0, limit).map((r) => ({ title: r.title, url: r.link, snippet: r.snippet }));
    } catch { return []; }
  }

  // DuckDuckGo fallback — no API key required, fragile
  try {
    const u = new URL('https://duckduckgo.com/html/');
    u.searchParams.set('q', query);
    const res = await fetch(u.toString(), { headers: { 'user-agent': 'Mozilla/5.0 BudsAtWorkBot/1.0' } });
    if (!res.ok) return [];
    const html = await res.text();
    const hits: SearchHit[] = [];
    const re = /<a [^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && hits.length < limit) {
      hits.push({ title: m[2].replace(/&amp;/g, '&'), url: decodeURIComponent(m[1]), snippet: '' });
    }
    return hits;
  } catch {
    return [];
  }
}
