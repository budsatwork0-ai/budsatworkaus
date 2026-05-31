/**
 * Meta Graph API client for marketing metrics.
 *
 * Pulls daily reach / engagement / follower counts for the connected
 * Instagram Business account and Facebook Page, so the Marketing Studio
 * scoreboard can auto-fill instead of being typed in by hand.
 *
 * Required env (all optional — absence just means "not configured yet"):
 *   META_ACCESS_TOKEN   long-lived Page access token (also grants the linked IG account)
 *   META_FB_PAGE_ID     numeric Facebook Page id
 *   META_IG_USER_ID     Instagram Business account id linked to that Page
 *   META_GRAPH_VERSION  optional, defaults to v21.0
 *
 * Graph API metric names drift between versions. Every fetch is wrapped so a
 * single failed metric degrades to 0 rather than breaking the whole sync, and
 * the values it could read are still stored.
 */

const GRAPH = `https://graph.facebook.com`;

export type ChannelMetrics = {
  channel: 'instagram' | 'facebook';
  views: number;        // reach / unique impressions for the day
  engagements: number;  // interactions for the day
  followers: number;    // current total followers
};

export type MetaSyncResult = {
  configured: boolean;
  metrics: ChannelMetrics[];
  errors: string[];
};

function env() {
  return {
    token: process.env.META_ACCESS_TOKEN,
    pageId: process.env.META_FB_PAGE_ID,
    igId: process.env.META_IG_USER_ID,
    version: process.env.META_GRAPH_VERSION || 'v21.0',
  };
}

export function isMetaConfigured(): boolean {
  const { token, pageId, igId } = env();
  return Boolean(token && (pageId || igId));
}

async function getJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Sum the `total_value` (or latest day value) out of a Graph /insights response. */
function readInsightValue(payload: Record<string, unknown> | null): number {
  if (!payload) return 0;
  const data = payload.data as Array<Record<string, unknown>> | undefined;
  if (!data?.length) return 0;
  let total = 0;
  for (const metric of data) {
    // newer shape: { total_value: { value } }
    const tv = metric.total_value as { value?: number } | undefined;
    if (tv && typeof tv.value === 'number') { total += tv.value; continue; }
    // classic shape: { values: [{ value }, ...] } — take the most recent
    const values = metric.values as Array<{ value?: number }> | undefined;
    if (values?.length) {
      const last = values[values.length - 1]?.value;
      if (typeof last === 'number') total += last;
    }
  }
  return total;
}

async function fetchInstagram(igId: string, token: string, version: string, errors: string[]): Promise<ChannelMetrics | null> {
  const base = `${GRAPH}/${version}/${igId}`;
  // Followers (direct field)
  const profile = await getJson(`${base}?fields=followers_count&access_token=${token}`);
  const followers = Number((profile?.followers_count as number) ?? 0);

  // Reach (views) + interactions (engagement) — newer Graph requires metric_type=total_value
  const reach = await getJson(`${base}/insights?metric=reach&period=day&metric_type=total_value&access_token=${token}`);
  const interactions = await getJson(`${base}/insights?metric=total_interactions&period=day&metric_type=total_value&access_token=${token}`);

  if (!profile && !reach) { errors.push('instagram: no data (check META_IG_USER_ID / token scopes)'); return null; }
  return {
    channel: 'instagram',
    views: readInsightValue(reach),
    engagements: readInsightValue(interactions),
    followers,
  };
}

async function fetchFacebook(pageId: string, token: string, version: string, errors: string[]): Promise<ChannelMetrics | null> {
  const base = `${GRAPH}/${version}/${pageId}`;
  const profile = await getJson(`${base}?fields=followers_count,fan_count&access_token=${token}`);
  const followers = Number((profile?.followers_count as number) ?? (profile?.fan_count as number) ?? 0);

  const impressions = await getJson(`${base}/insights?metric=page_impressions_unique&period=day&access_token=${token}`);
  const engagement = await getJson(`${base}/insights?metric=page_post_engagements&period=day&access_token=${token}`);

  if (!profile && !impressions) { errors.push('facebook: no data (check META_FB_PAGE_ID / token scopes)'); return null; }
  return {
    channel: 'facebook',
    views: readInsightValue(impressions),
    engagements: readInsightValue(engagement),
    followers,
  };
}

/** Pull current-day metrics for every configured Meta channel. */
export async function fetchMetaMetrics(): Promise<MetaSyncResult> {
  const { token, pageId, igId, version } = env();
  const errors: string[] = [];
  if (!token || (!pageId && !igId)) {
    return { configured: false, metrics: [], errors: ['META_ACCESS_TOKEN and a Page/IG id are required'] };
  }

  const metrics: ChannelMetrics[] = [];
  if (igId) {
    const ig = await fetchInstagram(igId, token, version, errors);
    if (ig) metrics.push(ig);
  }
  if (pageId) {
    const fb = await fetchFacebook(pageId, token, version, errors);
    if (fb) metrics.push(fb);
  }

  return { configured: true, metrics, errors };
}
