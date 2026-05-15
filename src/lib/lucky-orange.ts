/**
 * Lucky Orange API helper.
 *
 * Site ID: a592b727 (configured in your <script> tag).
 *
 * Lucky Orange exposes a REST API at https://api.luckyorange.com/v2/
 * which requires an API key + secret in headers. Drop them into
 * .env.local as LUCKY_ORANGE_API_KEY / LUCKY_ORANGE_API_SECRET.
 *
 * The methods below are intentionally narrow — they return only what
 * the design agents actually consume. Extend as needed.
 */

const SITE_ID = process.env.LUCKY_ORANGE_SITE_ID ?? 'a592b727';
const BASE = 'https://api.luckyorange.com/v2';
const KEY = process.env.LUCKY_ORANGE_API_KEY;
const SECRET = process.env.LUCKY_ORANGE_API_SECRET;

function authHeaders(): HeadersInit {
  return {
    'x-api-key': KEY ?? '',
    'x-api-secret': SECRET ?? '',
    'content-type': 'application/json',
  };
}

async function get<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set('site_id', SITE_ID);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const res = await fetch(url.toString(), { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`Lucky Orange ${path} → ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export interface PageHeatmap {
  page_path: string;
  sessions: number;
  click_hotspots: Array<{ selector: string; clicks: number; x_pct: number; y_pct: number }>;
  dead_clicks: Array<{ selector: string; clicks: number }>;      // clicks on non-interactive elements
  rage_clicks: Array<{ selector: string; clicks: number }>;      // 3+ rapid clicks
  scroll_depth: { p25: number; p50: number; p75: number; p90: number };
  avg_time_on_page_s: number;
}

export interface FunnelStep {
  name: string;
  visitors: number;
  conversion_pct_from_previous: number;
}

export interface SessionSummary {
  id: string;
  url: string;
  duration_s: number;
  device: 'mobile' | 'tablet' | 'desktop';
  events_count: number;
  had_rage_click: boolean;
  recording_url: string;
}

/** Heatmap rollup for a single page over the last N days. */
export async function pageHeatmap(page: string, days = 7): Promise<PageHeatmap> {
  return get<PageHeatmap>('/heatmaps/summary', { page, days });
}

/** Top pages by traffic over a window — useful for picking what to audit. */
export async function topPages(days = 7, limit = 20): Promise<Array<{ page: string; sessions: number }>> {
  return get<Array<{ page: string; sessions: number }>>('/pages/top', { days, limit });
}

/** Funnel performance. Steps come from agent config. */
export async function funnel(stepNames: string[], days = 14): Promise<FunnelStep[]> {
  return get<FunnelStep[]>('/funnels/run', { steps: stepNames.join(','), days });
}

/** Recent recordings, filtered to ones likely worth watching. */
export async function notableSessions(days = 3, limit = 20): Promise<SessionSummary[]> {
  return get<SessionSummary[]>('/sessions/notable', { days, limit });
}

/**
 * When credentials are missing or in a dev env, return fixture data so
 * agents stay runnable. Set LUCKY_ORANGE_USE_FIXTURES=1 to force.
 */
export function isFixtureMode(): boolean {
  return !KEY || !SECRET || process.env.LUCKY_ORANGE_USE_FIXTURES === '1';
}

export const FIXTURES = {
  topPages: [
    { page: '/', sessions: 1240 },
    { page: '/services/yard-care', sessions: 612 },
    { page: '/services/cleaning', sessions: 488 },
    { page: '/quote', sessions: 357 },
    { page: '/pricing', sessions: 281 },
    { page: '/contact', sessions: 192 },
  ] as Array<{ page: string; sessions: number }>,
  pageHeatmap: (p: string): PageHeatmap => ({
    page_path: p,
    sessions: 357,
    click_hotspots: [
      { selector: 'a.cta-quote-hero',    clicks: 412, x_pct: 50, y_pct: 38 },
      { selector: 'nav a[href="/services"]', clicks: 198, x_pct: 32, y_pct: 6 },
    ],
    dead_clicks: [
      { selector: '.hero-image',         clicks: 73 },
      { selector: '.testimonial-photo',  clicks: 41 },
    ],
    rage_clicks: [
      { selector: 'button.quote-submit', clicks: 18 },
    ],
    scroll_depth: { p25: 100, p50: 86, p75: 47, p90: 19 },
    avg_time_on_page_s: 38,
  }),
  funnel: (steps: string[]): FunnelStep[] =>
    steps.map((name, i) => ({
      name,
      visitors: [1240, 612, 357, 188, 142][i] ?? 100,
      conversion_pct_from_previous: i === 0 ? 100 : [0, 49, 58, 53, 76][i] ?? 50,
    })),
};
