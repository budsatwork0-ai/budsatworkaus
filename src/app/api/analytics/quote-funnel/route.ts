import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import {
  checkRateLimit,
  createRateLimiter,
  getClientIp,
  trackRatelimit,
} from '@/lib/rate-limit';

// ─── GET /api/analytics/quote-funnel?days=7|30|90|all ────────────────────────
// Returns aggregated funnel metrics for the admin dashboard. No auth enforced
// at this layer — the dashboard middleware protects the calling page.
export async function GET(req: NextRequest) {
  const daysParam = req.nextUrl.searchParams.get('days') ?? '30';
  const days = daysParam === 'all' || daysParam === '0' ? 0 : Math.max(1, parseInt(daysParam, 10));

  const supabase = createServiceClientSafe();
  if (!supabase) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

  interface RawEvent {
    session_id: string | null;
    event_name: string;
    service: string | null;
    time_spent_seconds: number | null;
    config_changes: number | null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any)
    .from('quote_funnel_events')
    .select('session_id, event_name, service, time_spent_seconds, config_changes');

  if (days > 0) {
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    q = q.gte('created_at', since);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 });

  const events: RawEvent[] = (data as RawEvent[]) ?? [];

  const STAGES = [
    'service_selected',
    'card_expanded',
    'config_started',
    'add_to_quote',
    'quote_submitted',
  ] as const;

  const STAGE_LABELS: Record<string, string> = {
    service_selected: 'Service Selected',
    card_expanded:    'Card Expanded',
    config_started:   'Config Started',
    add_to_quote:     'Add to Quote',
    quote_submitted:  'Quote Submitted',
  };

  const stageSets: Record<string, Set<string>> = {};
  for (const s of STAGES) stageSets[s] = new Set();

  const allSessions = new Set<string>();

  interface ServiceAccum {
    views: Set<string>;
    configStarts: Set<string>;
    addToQuotes: Set<string>;
    submissions: Set<string>;
  }
  const serviceMap: Record<string, ServiceAccum> = {};

  const addToQuoteTimes: number[]   = [];
  const addToQuoteChanges: number[] = [];

  for (const ev of events) {
    if (!ev.session_id) continue;
    allSessions.add(ev.session_id);
    if (stageSets[ev.event_name]) stageSets[ev.event_name].add(ev.session_id);

    if (ev.service) {
      if (!serviceMap[ev.service]) {
        serviceMap[ev.service] = {
          views: new Set(), configStarts: new Set(),
          addToQuotes: new Set(), submissions: new Set(),
        };
      }
      const sm = serviceMap[ev.service];
      if (ev.event_name === 'service_selected') sm.views.add(ev.session_id);
      if (ev.event_name === 'config_started')   sm.configStarts.add(ev.session_id);
      if (ev.event_name === 'add_to_quote')     sm.addToQuotes.add(ev.session_id);
      if (ev.event_name === 'quote_submitted')  sm.submissions.add(ev.session_id);
    }

    if (ev.event_name === 'add_to_quote') {
      if (ev.time_spent_seconds != null) addToQuoteTimes.push(ev.time_spent_seconds);
      if (ev.config_changes != null)     addToQuoteChanges.push(ev.config_changes);
    }
  }

  // Funnel stages
  const funnel = STAGES.map((stage, i) => {
    const sessions  = stageSets[stage].size;
    const prevCount = i > 0 ? stageSets[STAGES[i - 1]].size : null;
    const conversionFromPrev =
      i > 0 && prevCount != null && prevCount > 0
        ? Math.round((sessions / prevCount) * 100)
        : null;
    return {
      stage,
      label: STAGE_LABELS[stage],
      sessions,
      conversionFromPrev: i === 0 ? null : conversionFromPrev,
      dropoffPct:         i === 0 ? null : conversionFromPrev != null ? 100 - conversionFromPrev : null,
    };
  });

  // Overview
  const totalSessions    = allSessions.size;
  const quoteSubmissions = stageSets['quote_submitted'].size;
  const conversionPct    = totalSessions > 0 ? Math.round((quoteSubmissions / totalSessions) * 100) : 0;
  const avgTimeToAdd     =
    addToQuoteTimes.length > 0
      ? Math.round(addToQuoteTimes.reduce((a, b) => a + b, 0) / addToQuoteTimes.length)
      : null;

  // Service performance, sorted by submissions desc
  const services = Object.entries(serviceMap)
    .map(([service, sets]) => {
      const views       = sets.views.size;
      const submissions = sets.submissions.size;
      return {
        service,
        views,
        configStarts:   sets.configStarts.size,
        addToQuotes:    sets.addToQuotes.size,
        submissions,
        submissionRate: views > 0 ? Math.round((submissions / views) * 100) : 0,
      };
    })
    .sort((a, b) => b.submissions - a.submissions);

  // Time analysis
  const sortedTimes      = [...addToQuoteTimes].sort((a, b) => a - b);
  const medianTimeSeconds =
    sortedTimes.length > 0 ? sortedTimes[Math.floor(sortedTimes.length / 2)] : null;
  const avgConfigChanges =
    addToQuoteChanges.length > 0
      ? Math.round((addToQuoteChanges.reduce((a, b) => a + b, 0) / addToQuoteChanges.length) * 10) / 10
      : null;

  // Insights: biggest drop-off stage
  let biggestDropoffStage: string | null = null;
  let biggestDropoffPct: number | null   = null;
  for (const f of funnel.slice(1)) {
    if (f.dropoffPct != null && (biggestDropoffPct == null || f.dropoffPct > biggestDropoffPct)) {
      biggestDropoffPct   = f.dropoffPct;
      biggestDropoffStage = f.label;
    }
  }

  const servicesWithViews = services.filter(s => s.views > 0);
  const bestService  =
    servicesWithViews.length > 0
      ? servicesWithViews.reduce((a, b) => (a.submissionRate >= b.submissionRate ? a : b))
      : null;
  const worstService =
    servicesWithViews.length > 1
      ? servicesWithViews.reduce((a, b) => (a.submissionRate <= b.submissionRate ? a : b))
      : null;

  return NextResponse.json({
    overview: { totalSessions, quoteSubmissions, conversionPct, avgTimeToAddSeconds: avgTimeToAdd },
    funnel,
    services,
    timeAnalysis: { avgTimeSeconds: avgTimeToAdd, medianTimeSeconds, avgConfigChanges },
    insights: {
      biggestDropoffStage,
      biggestDropoffPct,
      bestService:     bestService?.service       ?? null,
      worstService:    worstService?.service      ?? null,
      bestServiceRate: bestService?.submissionRate  ?? null,
      worstServiceRate: worstService?.submissionRate ?? null,
    },
  });
}

const fallbackLimiter = createRateLimiter({ limit: 120, windowMs: 10 * 60 * 1000 });

const BOT_RE = /bot|crawler|spider|googlebot|bingbot|slurp|duckduckbot|facebookexternalhit/i;

const VALID_EVENTS = new Set([
  'service_selected',
  'card_expanded',
  'config_started',
  'add_to_quote',
  'quote_submitted',
]);

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { allowed } = trackRatelimit
    ? await checkRateLimit(trackRatelimit, ip)
    : fallbackLimiter(ip);
  if (!allowed) return new NextResponse(null, { status: 429 });

  const ua = req.headers.get('user-agent') ?? '';
  if (BOT_RE.test(ua)) return NextResponse.json({ ok: true });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const {
    session_id,
    event_name,
    service,
    scope,
    context,
    time_spent_seconds,
    config_changes,
    quote_submitted,
  } = b;

  if (typeof session_id !== 'string' || !session_id) {
    return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
  }
  if (typeof event_name !== 'string' || !VALID_EVENTS.has(event_name)) {
    return NextResponse.json({ error: 'Unknown event_name' }, { status: 400 });
  }

  const supabase = createServiceClientSafe();
  if (!supabase) return NextResponse.json({ ok: true });

  await (supabase as any).from('quote_funnel_events').insert({
    session_id,
    event_name,
    service:            typeof service  === 'string'  ? service  : null,
    scope:              typeof scope    === 'string'  ? scope    : null,
    context:            typeof context  === 'string'  ? context  : null,
    time_spent_seconds: typeof time_spent_seconds === 'number' ? Math.round(time_spent_seconds) : null,
    config_changes:     typeof config_changes     === 'number' ? Math.round(config_changes)     : null,
    quote_submitted:    typeof quote_submitted    === 'boolean' ? quote_submitted : null,
  });

  return NextResponse.json({ ok: true });
}
