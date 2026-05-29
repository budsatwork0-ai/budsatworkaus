/**
 * Yard Map / Geo agent — given a quote with an address, fetches a static
 * satellite image, asks the vision model to estimate lawn area + complexity
 * (slopes, obstacles, fencing edges, hedges), and writes those back to
 * the quote so Quote Triage can price sharper.
 *
 * Triggered by Quote Triage via ctx.input.quote_id, or runs over any
 * recent yard-service quote that hasn't been geo-analysed.
 */
import type { AgentDefinition, AgentContext } from '../types';

const SYSTEM = `You are a yard estimation specialist. Given a satellite image
of a property, return a JSON object only:
{
  "lawn_sqm": number,            // visible grass area only
  "complexity": "simple" | "moderate" | "complex",
  "edges_metres": number,        // approximate edge/border to trim
  "obstacles": ["pool","trampoline","tree","garden bed","slope","narrow access","none"],
  "notes": "..."
}
Complexity heuristic:
  simple   — flat, single rectangle, no obstacles
  moderate — 1-2 obstacles or some edging
  complex  — slopes, tight access, 3+ obstacles, or pool surrounds`;

// Matches the repo-wide convention (services-core/constants.ts, SuburbHeatmap,
// YardZonesPreview, etc. all read NEXT_PUBLIC_GOOGLE_MAPS_API_KEY). Falls back
// to the non-public name in case it's set that way in some environments.
const GOOGLE_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

export const yardMapGeoAgent: AgentDefinition = {
  id: 'yard-map-geo',
  name: 'Yard Map / Geo',
  description: 'Pulls satellite imagery for an address, estimates lawn size + complexity.',
  category: 'ops',
  autonomy: 'auto',
  async run(ctx: AgentContext) {
    // Gate on the Maps key. Without it we cannot fetch real satellite imagery,
    // and feeding the vision model a placeholder URL produces garbage estimates
    // that would silently corrupt yard pricing. Skip + flag instead.
    if (!GOOGLE_KEY) {
      ctx.log('yard-map-geo skipped: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not configured');
      await ctx.proposeAction({
        action_type: 'flag_for_review',
        preview: 'Yard geo analysis disabled — NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set',
        payload: { reason: 'missing_google_maps_api_key' },
        requiresApproval: true,
      });
      return {
        summary: 'Skipped — NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set. No yard quotes analysed (avoided placeholder imagery).',
        output: { processed: 0, skipped: true, reason: 'missing_google_maps_api_key' },
      };
    }

    const targetId = ctx.input?.quote_id as string | undefined;

    const q = ctx.supabase
      .from('quotes')
      .select('id, address, suburb, postcode, service, yard_sqm')
      .is('yard_sqm', null);
    const { data: quotes } = targetId ? await q.eq('id', targetId) : await q.eq('service', 'yard').limit(15);

    if (!quotes?.length) return { summary: 'No yard quotes awaiting geo analysis.' };

    let processed = 0;
    for (const quote of quotes) {
      const address = [quote.address, quote.suburb, quote.postcode, 'Australia'].filter(Boolean).join(', ');
      if (!address) continue;

      const imageUrl = staticMapUrl(address, GOOGLE_KEY);
      const raw = await callVision(imageUrl, SYSTEM);

      let parsed: { lawn_sqm: number; complexity: 'simple' | 'moderate' | 'complex'; edges_metres: number; obstacles: string[]; notes: string };
      try { parsed = JSON.parse(raw); } catch { continue; }

      await ctx.supabase
        .from('quotes')
        .update({
          yard_sqm: parsed.lawn_sqm,
          yard_complexity: parsed.complexity,
          geo_image_url: imageUrl,
        })
        .eq('id', quote.id);

      ctx.log(`quote ${quote.id} → ${parsed.lawn_sqm}m² (${parsed.complexity})`);
      processed += 1;
    }

    return {
      summary: `Geo-analysed ${processed} yard quote(s).`,
      output: { processed },
    };
  },
};

function staticMapUrl(address: string, key: string): string {
  const params = new URLSearchParams({
    center: address,
    zoom: '20',
    size: '640x640',
    maptype: 'satellite',
    scale: '2',
    key,
  });
  return `https://maps.googleapis.com/maps/api/staticmap?${params}`;
}

async function callVision(imageUrl: string, system: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'url', url: imageUrl } },
            { type: 'text', text: 'Estimate this yard. JSON only.' },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`vision ${res.status}`);
  const json = (await res.json()) as { content: Array<{ type: string; text?: string }> };
  return json.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
}
