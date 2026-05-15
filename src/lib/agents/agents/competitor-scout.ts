/**
 * Competitor Scout — broad web reconnaissance.
 *
 * Unlike Competitor Watcher (which polls URLs you've already configured),
 * the Scout actively discovers new competitors via web search, fetches
 * their pricing/services pages, and uses the model to extract structured
 * prices: service, price_aud, unit (per_hour / per_visit / flat), suburb,
 * any promo language.
 *
 * Results land in `competitor_intel`, which the Competitor Intel dashboard
 * presents as a map + price distribution + comparison matrix.
 */
import type { AgentDefinition, AgentContext } from '../types';

const SYSTEM = `You extract structured pricing info from a competitor's
services / pricing page. Return JSON only:
{
  "competitor_name": "...",
  "services": [
    {
      "service": "cleaning"|"yard"|"windows"|"dump"|"auto"|"laundry_sneakers"|"other",
      "price_aud": number | null,
      "price_unit": "per_hour"|"per_visit"|"per_sqm"|"flat"|null,
      "promo": "..." | null,
      "raw_snippet": "...the source phrase verbatim, ≤ 240 chars...",
      "confidence": 0..1
    }
  ]
}
If a price isn't clearly listed, leave price_aud null but still include the
service with the closest pricing snippet you can find.`;

const SEARCH_QUERIES = (region: string) => [
  `${region} home cleaning services pricing`,
  `${region} window cleaning quote`,
  `${region} lawn mowing pricing`,
  `${region} yard care prices`,
  `${region} rubbish removal dump run cost`,
  `${region} car detailing pricing`,
];

export const competitorScoutAgent: AgentDefinition = {
  id: 'competitor-scout',
  name: 'Competitor Scout',
  description: 'Crawls the web for local home-services competitors; extracts structured pricing.',
  category: 'sales',
  autonomy: 'review',
  async run(ctx: AgentContext) {
    const region = (ctx.config?.region as string | undefined) ?? 'Logan,South Brisbane';
    const queries = SEARCH_QUERIES(region);

    const backend = process.env.BRAVE_SEARCH_API_KEY
      ? 'brave'
      : process.env.SERPAPI_API_KEY
        ? 'serpapi'
        : 'duckduckgo';
    ctx.log(`search_backend=${backend} region="${region}"`);

    let discovered = 0;
    let extracted = 0;
    let parseFailures = 0;

    for (const q of queries) {
      const hits = await webSearch(q, 5);
      ctx.log(`search query="${q}" hits=${hits.length}`);
      for (const hit of hits) {
        if (isOwnDomain(hit.url)) continue;

        // Skip if we already have a recent snapshot for this URL
        const { data: existing } = await ctx.supabase
          .from('competitor_intel')
          .select('id, scraped_at')
          .eq('url', hit.url)
          .limit(1)
          .maybeSingle();
        const recent = existing?.scraped_at && (Date.now() - new Date(existing.scraped_at).getTime()) < 7 * 24 * 3600_000;
        if (recent) continue;

        const body = await fetchPageText(hit.url);
        if (!body) continue;

        const raw = await ctx.llm(
          `URL: ${hit.url}\nTitle: ${hit.title}\nPage text (first 6k chars):\n"""\n${body.slice(0, 6000)}\n"""`,
          { system: SYSTEM },
        );
        let parsed: { competitor_name: string; services: Array<{ service: string; price_aud: number | null; price_unit: string | null; promo: string | null; raw_snippet: string; confidence: number }> };
        try {
          parsed = parseJsonResponse(raw) as typeof parsed;
        } catch (err) {
          parseFailures += 1;
          ctx.log(`json_parse_failed url=${hit.url}`, {
            error: err instanceof Error ? err.message : String(err),
            rawHead: raw.slice(0, 200),
          });
          continue;
        }

        for (const s of parsed.services ?? []) {
          await ctx.supabase.from('competitor_intel').upsert({
            competitor_name: parsed.competitor_name,
            url: hit.url,
            suburb: extractSuburb(body, region) ?? null,
            service: s.service,
            price_aud: s.price_aud,
            price_unit: s.price_unit,
            promo: s.promo,
            raw_snippet: s.raw_snippet,
            confidence: s.confidence,
            source_query: q,
            scraped_at: new Date().toISOString(),
          }, { onConflict: 'competitor_name,url,service' });
          extracted += 1;
        }
        discovered += 1;
      }
    }

    if (discovered > 0) {
      await ctx.proposeAction({
        action_type: 'flag_for_review',
        target_table: 'competitor_intel',
        target_id: undefined,
        preview: `${discovered} competitor(s) scraped, ${extracted} price entry(ies)`,
        payload: { discovered, extracted, region },
      });
    }

    if (parseFailures > 0) {
      ctx.log(`parse_failures_total=${parseFailures}`);
    }

    return {
      summary: `Discovered ${discovered} new competitor page(s); extracted ${extracted} price entry(ies).`,
      output: { discovered, extracted, parseFailures, backend },
    };
  },
};

/**
 * Parse a JSON response that may be wrapped in markdown code fences or
 * preceded by prose. Newer Claude models often respond with:
 *
 *   ```json
 *   { ... }
 *   ```
 *
 * which `JSON.parse` can't handle directly. This helper strips the fences
 * and, as a fallback, extracts the first balanced object from the string.
 */
function parseJsonResponse(raw: string): unknown {
  let cleaned = raw.trim();
  // Strip ```json ... ``` or ``` ... ``` fences
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  }
  // Fallback: extract first {...} if the response has leading prose
  if (!cleaned.startsWith('{')) {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) cleaned = m[0];
  }
  return JSON.parse(cleaned);
}

// ---------------------------------------------------------------------
// Search + fetch helpers
// ---------------------------------------------------------------------

interface SearchHit { title: string; url: string; snippet: string }

async function webSearch(query: string, limit: number): Promise<SearchHit[]> {
  // Brave Search API if configured (good for commercial use)
  const braveKey = process.env.BRAVE_SEARCH_API_KEY;
  if (braveKey) {
    const u = new URL('https://api.search.brave.com/res/v1/web/search');
    u.searchParams.set('q', query);
    u.searchParams.set('count', String(limit));
    const res = await fetch(u, { headers: { 'X-Subscription-Token': braveKey, accept: 'application/json' } });
    if (!res.ok) return [];
    const j = (await res.json()) as { web?: { results?: Array<{ title: string; url: string; description: string }> } };
    return (j.web?.results ?? []).slice(0, limit).map((r) => ({ title: r.title, url: r.url, snippet: r.description }));
  }

  // SerpAPI fallback
  const serpKey = process.env.SERPAPI_API_KEY;
  if (serpKey) {
    const u = new URL('https://serpapi.com/search.json');
    u.searchParams.set('q', query);
    u.searchParams.set('num', String(limit));
    u.searchParams.set('api_key', serpKey);
    const res = await fetch(u);
    if (!res.ok) return [];
    const j = (await res.json()) as { organic_results?: Array<{ title: string; link: string; snippet: string }> };
    return (j.organic_results ?? []).slice(0, limit).map((r) => ({ title: r.title, url: r.link, snippet: r.snippet }));
  }

  // DuckDuckGo HTML (no API key, best-effort, fragile)
  const u = new URL('https://duckduckgo.com/html/');
  u.searchParams.set('q', query);
  try {
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

async function fetchPageText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 BudsAtWorkBot/1.0' } });
    if (!res.ok) return null;
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<style[\s\S]*?<\/style>/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    return null;
  }
}

function isOwnDomain(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.includes('budsatwork');
  } catch { return true; }
}

function extractSuburb(body: string, regionConfig: string): string | null {
  const suburbs = regionConfig.split(',').map((s) => s.trim());
  for (const s of suburbs) {
    if (body.toLowerCase().includes(s.toLowerCase())) return s;
  }
  // Try a few known Logan suburbs
  const known = ['springwood', 'underwood', 'rochedale', 'daisy hill', 'shailer park', 'loganlea', 'woodridge', 'browns plains', 'mt gravatt', 'sunnybank'];
  for (const s of known) {
    if (body.toLowerCase().includes(s)) return s.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return null;
}
