/**
 * PostHog Data API — server-side query client.
 *
 * Used by the Analytics Intelligence Agent to retrieve funnel data, event trends,
 * abandonment signals, and CTA performance from the PostHog project.
 *
 * Requires:
 *   POSTHOG_PERSONAL_API_KEY — personal API key (not the project key)
 *   POSTHOG_PROJECT_ID       — numeric project ID
 *   POSTHOG_HOST             — optional, defaults to https://us.posthog.com
 */

const POSTHOG_HOST = process.env.POSTHOG_HOST ?? 'https://us.posthog.com';
const POSTHOG_KEY  = process.env.POSTHOG_PERSONAL_API_KEY;
const POSTHOG_PID  = process.env.POSTHOG_PROJECT_ID;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FunnelStep {
  action_id: string;
  name: string;
  order: number;
  count: number;
  conversion_rate: number;
  dropout_count: number;
  dropout_conversion_rate: number;
}

export interface TrendPoint {
  date: string;
  count: number;
}

export interface EventTrend {
  label: string;
  data: TrendPoint[];
  total: number;
}

export interface AbandonmentBreakdown {
  step: number;
  count: number;
  pct_of_starts: number;
}

export interface CtaPerformance {
  cta_id: string;
  views: number;
  clicks: number;
  ctr: number;
}

export interface PostHogAvailable {
  available: boolean;
  reason?: string;
}

// ── Internal fetch ────────────────────────────────────────────────────────────

async function phFetch<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  if (!POSTHOG_KEY || !POSTHOG_PID) {
    throw new Error('PostHog API not configured — set POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID');
  }

  const url = `${POSTHOG_HOST}/api/projects/${POSTHOG_PID}${path}`;
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${POSTHOG_KEY}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PostHog ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<T>;
}

// ── Health check ──────────────────────────────────────────────────────────────

export function isPostHogConfigured(): PostHogAvailable {
  if (!POSTHOG_KEY) return { available: false, reason: 'POSTHOG_PERSONAL_API_KEY not set' };
  if (!POSTHOG_PID) return { available: false, reason: 'POSTHOG_PROJECT_ID not set' };
  return { available: true };
}

// ── Quote funnel ──────────────────────────────────────────────────────────────

export async function getQuoteFunnel(days = 14): Promise<FunnelStep[]> {
  type FunnelRes = { result: FunnelStep[][] };

  const data = await phFetch<FunnelRes>('/insights/funnel/', {
    date_from: `-${days}d`,
    events: [
      { id: 'quote_funnel_start', name: 'Funnel Start', order: 0 },
      { id: 'quote_funnel_step_complete', name: 'Step 1 → 2', order: 1,
        properties: [{ key: 'step', type: 'event', value: [1], operator: 'exact' }] },
      { id: 'quote_funnel_step_complete', name: 'Step 2 → 3', order: 2,
        properties: [{ key: 'step', type: 'event', value: [2], operator: 'exact' }] },
      { id: 'quote_funnel_step_complete', name: 'Step 3 → Submit', order: 3,
        properties: [{ key: 'step', type: 'event', value: [3], operator: 'exact' }] },
      { id: 'quote_submitted', name: 'Quote Submitted', order: 4 },
    ],
    funnel_window_days: days,
    breakdown_type: 'event',
  });

  return data.result?.[0] ?? [];
}

// ── Abandonment breakdown ─────────────────────────────────────────────────────

export async function getAbandonmentBreakdown(days = 14): Promise<AbandonmentBreakdown[]> {
  type EventRes = { results: Array<{ properties: { step?: number } }> };

  const [starts, abandons] = await Promise.all([
    phFetch<EventRes>(`/events/?event=quote_funnel_start&date_from=-${days}d&limit=1`),
    phFetch<EventRes>(`/events/?event=quote_funnel_abandon&date_from=-${days}d&limit=5000`),
  ]);

  const totalStarts = starts.results?.length ?? 1;
  const byStep: Record<number, number> = {};

  for (const e of abandons.results ?? []) {
    const step = e.properties?.step ?? 0;
    byStep[step] = (byStep[step] ?? 0) + 1;
  }

  return Object.entries(byStep)
    .map(([step, count]) => ({
      step: parseInt(step),
      count,
      pct_of_starts: Math.round((count / totalStarts) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

// ── CTA performance ───────────────────────────────────────────────────────────

export async function getCtaPerformance(days = 14): Promise<CtaPerformance[]> {
  type EventRes = { results: Array<{ properties: { cta_id?: string } }> };

  const [views, clicks] = await Promise.all([
    phFetch<EventRes>(`/events/?event=cta_view&date_from=-${days}d&limit=5000`),
    phFetch<EventRes>(`/events/?event=cta_click&date_from=-${days}d&limit=5000`),
  ]);

  const viewMap: Record<string, number> = {};
  const clickMap: Record<string, number> = {};

  for (const e of views.results ?? []) {
    const id = e.properties?.cta_id ?? 'unknown';
    viewMap[id] = (viewMap[id] ?? 0) + 1;
  }
  for (const e of clicks.results ?? []) {
    const id = e.properties?.cta_id ?? 'unknown';
    clickMap[id] = (clickMap[id] ?? 0) + 1;
  }

  const allIds = new Set([...Object.keys(viewMap), ...Object.keys(clickMap)]);
  return Array.from(allIds)
    .map((id) => {
      const v = viewMap[id] ?? 0;
      const c = clickMap[id] ?? 0;
      return { cta_id: id, views: v, clicks: c, ctr: v > 0 ? Math.round((c / v) * 100) : 0 };
    })
    .sort((a, b) => b.views - a.views);
}

// ── Event trend ───────────────────────────────────────────────────────────────

export async function getEventTrend(event: string, days = 14): Promise<EventTrend> {
  type TrendRes = { result: Array<{ label: string; data: number[]; labels: string[] }> };

  const data = await phFetch<TrendRes>('/insights/trend/', {
    date_from: `-${days}d`,
    events: [{ id: event, name: event }],
    interval: 'day',
  });

  const series = data.result?.[0];
  if (!series) return { label: event, data: [], total: 0 };

  const points: TrendPoint[] = (series.labels ?? []).map((date: string, i: number) => ({
    date,
    count: series.data?.[i] ?? 0,
  }));

  return {
    label: series.label ?? event,
    data: points,
    total: points.reduce((s, p) => s + p.count, 0),
  };
}

// ── Mobile sessions ───────────────────────────────────────────────────────────

export async function getMobileDropOffCount(days = 14): Promise<number> {
  type EventRes = { results: unknown[] };

  const data = await phFetch<EventRes>(
    `/events/?event=workflow_drop_off&properties=[{"key":"$os","type":"person","value":["Android","iOS"],"operator":"exact"}]&date_from=-${days}d&limit=5000`,
  );

  return data.results?.length ?? 0;
}

// ── Session recording summary ─────────────────────────────────────────────────

export async function getSessionRecordingSummary(days = 7): Promise<{
  total: number;
  with_rage_clicks: number;
  with_dead_clicks: number;
}> {
  type RecRes = { count: number; results: Array<{ click_count?: number; rage_click_count?: number; dead_click_count?: number }> };

  const data = await phFetch<RecRes>(
    `/session_recordings/?date_from=-${days}d&limit=100&order=start_time`,
  );

  const total = data.count ?? 0;
  const with_rage_clicks = (data.results ?? []).filter((r) => (r.rage_click_count ?? 0) > 0).length;
  const with_dead_clicks = (data.results ?? []).filter((r) => (r.dead_click_count ?? 0) > 0).length;

  return { total, with_rage_clicks, with_dead_clicks };
}
