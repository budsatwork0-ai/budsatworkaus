/**
 * Competitor Watcher — fetches configured competitor pages monthly,
 * diffs against the last snapshot, flags pricing or promo moves.
 *
 * Config: { watch_urls: ["https://comp1.au/pricing","..."] }
 */
import type { AgentDefinition, AgentContext } from '../types';

const SYSTEM = `Compare two snapshots of a competitor pricing/services page.
Return strict JSON:
{
  "changed": boolean,
  "summary": "...one paragraph...",
  "price_moves": [{"service":"...","direction":"up"|"down","from":"","to":""}],
  "promo_added": "..." | null,
  "promo_removed": "..." | null,
  "severity": "low"|"medium"|"high"
}`;

export const competitorWatcherAgent: AgentDefinition = {
  id: 'competitor-watcher',
  name: 'Competitor Watcher',
  description: 'Tracks competitor pricing pages and promos; flags moves to match or beat.',
  category: 'sales',
  autonomy: 'review',
  preferredModel: 'claude-haiku-4-5-20251001',
  schema_dependencies: ['competitor_pages'],
  async run(ctx: AgentContext) {
    const urls = (ctx.config?.watch_urls as string[] | undefined) ?? [];
    const { data: rows } = await ctx.supabase.from('competitor_pages').select('id, competitor, url, last_snapshot');
    const tracked = new Map((rows ?? []).map((r) => [r.url, r]));

    // Add any new URLs from config
    for (const url of urls) {
      if (!tracked.has(url)) {
        const competitor = new URL(url).hostname.replace('www.', '');
        await ctx.supabase.from('competitor_pages').insert({ competitor, url });
      }
    }

    let changes = 0;
    for (const row of rows ?? []) {
      const fresh = await fetchPage(row.url);
      if (!fresh) continue;

      if (!row.last_snapshot) {
        await ctx.supabase.from('competitor_pages')
          .update({ last_snapshot: fresh, last_checked: new Date().toISOString() })
          .eq('id', row.id);
        continue;
      }

      if (fresh.slice(0, 1500) === (row.last_snapshot as string).slice(0, 1500)) continue;

      const raw = await ctx.llm(
        `Competitor: ${row.competitor}\n\nOLD:\n"""\n${(row.last_snapshot as string).slice(0, 4000)}\n"""\n\nNEW:\n"""\n${fresh.slice(0, 4000)}\n"""`,
        { system: SYSTEM },
      );
      let parsed: { changed: boolean; summary: string; price_moves: unknown[]; promo_added: string | null; promo_removed: string | null; severity: string };
      try { parsed = JSON.parse(raw); } catch { continue; }

      if (parsed.changed) {
        changes += 1;
        await ctx.supabase.from('competitor_pages').update({
          last_snapshot: fresh,
          last_checked: new Date().toISOString(),
          change_notes: [{ at: new Date().toISOString(), ...parsed }],
        }).eq('id', row.id);

        await ctx.proposeAction({
          action_type: 'flag_for_review',
          target_table: 'competitor_pages',
          target_id: row.id,
          preview: `${row.competitor} ${parsed.severity}: ${parsed.summary.slice(0, 80)}`,
          payload: parsed,
        });
      } else {
        await ctx.supabase.from('competitor_pages').update({ last_checked: new Date().toISOString() }).eq('id', row.id);
      }
    }
    return { summary: `Checked ${rows?.length ?? 0} competitor(s); ${changes} change(s).`, output: { changes } };
  },
};

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'BudsAtWorkBot/1.0' } });
    if (!res.ok) return null;
    const html = await res.text();
    // strip script/style/tags for a stable snapshot
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
