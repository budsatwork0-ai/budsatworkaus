'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { dashboardTheme } from '@/lib/design-system/themes';
import { formatCurrency } from '@/lib/dashboard/utils';
import { Panel, ArrowUpIcon, ArrowDownIcon } from '../shared';

// ─── Types ────────────────────────────────────────────────────────────────────

type SiteVisitor = {
  session_id: string; current_page: string; page_title: string | null;
  referrer: string | null; user_agent: string | null;
  city: string | null; country: string | null;
  first_seen_at: string; last_seen_at: string;
};

type PageView = {
  id: string; session_id: string; page: string; page_title: string | null;
  viewed_at: string; scroll_depth: number | null; time_on_page: number | null;
  utm_source: string | null; utm_medium: string | null; utm_campaign: string | null;
};

type AnalyticsSession = {
  session_id: string; referrer: string | null; user_agent: string | null;
  city: string | null; country: string | null;
  utm_source: string | null; utm_medium: string | null; utm_campaign: string | null;
  is_returning: boolean; pages_visited: number; total_seconds: number;
  first_seen_at: string; last_seen_at: string;
};

type VisitorEvent = {
  id: string; session_id: string | null; event_name: string; event_label: string | null;
  page: string | null; source: 'client' | 'server';
  quote_id: string | null; order_id: string | null; payment_id: string | null;
  event_value: number | null; event_data: Record<string, unknown> | null; created_at: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000;
const BRAND = dashboardTheme.color.primary as string;
const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316'];

// Conversion funnel pages (order matters — top of funnel first)
const FUNNEL_PAGES = [
  { path: '/', label: 'Homepage' },
  { path: '/services', label: 'Services' },
  { path: '/pricing', label: 'Pricing' },
  { path: '/contact', label: 'Contact / Quote' },
  { path: '/account/sign-up', label: 'Sign Up' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatRelativeTime = (ts: string) => {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000), m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000);
  if (s < 60) return `${s}s ago`;
  if (m < 60) return `${m}m ago`;
  return `${h}h ago`;
};

const formatDuration = (secs: number): string => {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60), s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
};

const formatSessionDuration = (from: string, to: string) => {
  const mins = Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 60000);
  if (mins < 1) return 'just arrived';
  return `${mins}m on site`;
};

const cleanTitle = (t: string | null) => t ? t.replace(/\s*\|.*$/, '').trim() || null : null;

const shortenReferrer = (ref: string | null): string | null => {
  if (!ref) return null;
  try { return new URL(ref).hostname.replace(/^www\./, '') || null; }
  catch { return null; }
};

const formatLocation = (city: string | null, country: string | null) =>
  city && country ? `${city}, ${country}` : country ?? city ?? null;

const getDevice = (ua: string | null): 'mobile' | 'tablet' | 'desktop' => {
  if (!ua) return 'desktop';
  if (/mobile/i.test(ua)) return 'mobile';
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  return 'desktop';
};

const classifySource = (referrer: string | null, utmSource: string | null): string => {
  if (utmSource) return utmSource;
  if (!referrer) return 'Direct';
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '');
    if (/google\.|bing\.|yahoo\.|duckduckgo\./.test(host)) return 'Organic Search';
    if (/facebook\.|instagram\.|linkedin\.|twitter\.|tiktok\.|pinterest\./.test(host)) return 'Social';
    return host;
  } catch { return 'Direct'; }
};

const dayLabel = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
};

const getEventString = (event: VisitorEvent, key: string): string | null => {
  const value = event.event_data?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
};

const getEventIdentity = (event: VisitorEvent): string | null =>
  event.payment_id ?? event.order_id ?? event.quote_id ?? event.session_id ?? null;

// ─── Sub-component: Stat card ─────────────────────────────────────────────────

const StatCard = ({
  label, value, sub, delta, loading,
}: { label: string; value: string | number; sub?: string; delta?: number; loading?: boolean }) => {
  const isUp = delta !== undefined && delta > 0;
  const isDown = delta !== undefined && delta < 0;
  return (
    <div className="rounded-2xl border border-black/5 bg-white/90 shadow-[0_10px_28px_rgba(15,23,42,0.08)] overflow-hidden">
      <div className="h-0.5 w-full" style={{ background: BRAND }} />
      <div className="px-4 py-4">
        <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">{label}</p>
        {loading ? (
          <>
            <div className="h-8 w-16 rounded-lg animate-pulse bg-slate-100 mb-2" />
            <div className="h-4 w-24 rounded-full animate-pulse bg-slate-100" />
          </>
        ) : (
          <>
            <p className="text-3xl font-bold text-slate-900 mb-1">{value}</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {delta !== undefined && (
                <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  isUp ? 'bg-emerald-50 text-emerald-700' : isDown ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  {isUp ? <ArrowUpIcon /> : isDown ? <ArrowDownIcon /> : null}
                  {delta > 0 ? `+${delta}` : delta}
                </span>
              )}
              {sub && <span className="text-[11px] text-slate-400">{sub}</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Sub-component: Section sub-tabs ─────────────────────────────────────────

type SubTab = 'overview' | 'acquisition' | 'content' | 'audience' | 'live';

const SubTabBar = ({ active, onChange }: { active: SubTab; onChange: (t: SubTab) => void }) => (
  <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 w-fit">
    {(['overview', 'acquisition', 'content', 'audience', 'live'] as SubTab[]).map(t => (
      <button
        key={t}
        onClick={() => onChange(t)}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
          active === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
        }`}
        style={active === t ? { color: BRAND } : undefined}
      >
        {t}
      </button>
    ))}
  </div>
);

// ─── Device icons ─────────────────────────────────────────────────────────────

const MobileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
    <rect x="7" y="2" width="10" height="20" rx="2" />
    <circle cx="12" cy="18" r="1" fill="currentColor" stroke="none" />
  </svg>
);
const DesktopIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);
const TabletIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <circle cx="12" cy="18" r="1" fill="currentColor" stroke="none" />
  </svg>
);
const DeviceIcon = ({ ua }: { ua: string | null }) => {
  const d = getDevice(ua);
  if (d === 'mobile') return <MobileIcon />;
  if (d === 'tablet') return <TabletIcon />;
  return <DesktopIcon />;
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-black/5 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? BRAND }}>{p.name}: <b>{p.value}</b></p>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VisitorsTab() {
  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [tick, setTick] = useState(0);

  // Raw data
  const [liveVisitors, setLiveVisitors] = useState<SiteVisitor[]>([]);
  const [recentPageViews, setRecentPageViews] = useState<PageView[]>([]);
  const [historicalPageViews, setHistoricalPageViews] = useState<PageView[]>([]);
  const [sessions, setSessions] = useState<AnalyticsSession[]>([]);
  const [events, setEvents] = useState<VisitorEvent[]>([]);

  const channelRef = useRef<any>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function load() {
      setIsLoading(true);
      const fiveMinAgo = new Date(Date.now() - ACTIVE_THRESHOLD_MS).toISOString();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      const [
        { data: liveData },
        { data: recentPV },
        { data: histPV },
        { data: sessData },
        { data: evtData },
      ] = await Promise.all([
        // Active live visitors
        (supabase as any).from('site_visitors')
          .select('*').gte('last_seen_at', fiveMinAgo).order('last_seen_at', { ascending: false }),
        // Recent page views for feed
        (supabase as any).from('page_views')
          .select('id,session_id,page,page_title,viewed_at,scroll_depth,time_on_page')
          .order('viewed_at', { ascending: false }).limit(30),
        // Historical page views (30 days) for trends + top pages
        (supabase as any).from('page_views')
          .select('session_id,page,page_title,viewed_at,scroll_depth,time_on_page,utm_source,utm_medium,utm_campaign')
          .gte('viewed_at', thirtyDaysAgo),
        // Persistent sessions (90 days) for acquisition + audience
        (supabase as any).from('analytics_sessions')
          .select('session_id,referrer,user_agent,city,country,utm_source,utm_medium,utm_campaign,is_returning,pages_visited,total_seconds,first_seen_at,last_seen_at')
          .gte('first_seen_at', ninetyDaysAgo)
          .order('first_seen_at', { ascending: false }),
        // Visitor events (30 days) for CTA/funnel
        (supabase as any).from('visitor_events')
          .select('id,session_id,event_name,event_label,page,source,quote_id,order_id,payment_id,event_value,event_data,created_at')
          .gte('created_at', thirtyDaysAgo),
      ]);

      setLiveVisitors(liveData ?? []);
      setRecentPageViews(recentPV ?? []);
      setHistoricalPageViews(histPV ?? []);
      setSessions(sessData ?? []);
      setEvents(evtData ?? []);
      setIsLoading(false);
    }

    load();

    // Realtime subscriptions
    const channel = supabase
      .channel('visitor-tracking-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_visitors' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const row = payload.new as SiteVisitor;
          setLiveVisitors(prev => [row, ...prev.filter(v => v.session_id !== row.session_id)].slice(0, 50));
        }
        if (payload.eventType === 'DELETE') {
          const old = payload.old as { session_id: string };
          setLiveVisitors(prev => prev.filter(v => v.session_id !== old.session_id));
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'page_views' }, (payload) => {
        const row = payload.new as PageView;
        setRecentPageViews(prev => [row, ...prev].slice(0, 30));
        setHistoricalPageViews(prev => [row, ...prev]);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'analytics_sessions' }, (payload) => {
        setSessions(prev => [payload.new as AnalyticsSession, ...prev]);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'visitor_events' }, (payload) => {
        setEvents(prev => [payload.new as VisitorEvent, ...prev]);
      })
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Tick for relative timestamps
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);
  void tick;

  // ─── Derived analytics ────────────────────────────────────────────────────

  const activeVisitors = useMemo(() =>
    liveVisitors.filter(v => Date.now() - new Date(v.last_seen_at).getTime() < ACTIVE_THRESHOLD_MS),
    [liveVisitors]
  );

  // Date buckets
  const now = useMemo(() => new Date(), []);
  const todayStart = useMemo(() => new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(), [now]);
  const sevenDaysAgo = useMemo(() => new Date(Date.now() - 7 * 86400000).toISOString(), []);
  const fourteenDaysAgo = useMemo(() => new Date(Date.now() - 14 * 86400000).toISOString(), []);
  const twentyEightDaysAgo = useMemo(() => new Date(Date.now() - 28 * 86400000).toISOString(), []);

  const uniqueVisitors28 = useMemo(() =>
    new Set(historicalPageViews.filter(pv => pv.viewed_at >= twentyEightDaysAgo).map(pv => pv.session_id)).size,
    [historicalPageViews, twentyEightDaysAgo]
  );
  const uniqueVisitors7 = useMemo(() =>
    new Set(historicalPageViews.filter(pv => pv.viewed_at >= sevenDaysAgo).map(pv => pv.session_id)).size,
    [historicalPageViews, sevenDaysAgo]
  );
  const uniqueVisitorsPrev7 = useMemo(() =>
    new Set(historicalPageViews.filter(pv => pv.viewed_at >= fourteenDaysAgo && pv.viewed_at < sevenDaysAgo).map(pv => pv.session_id)).size,
    [historicalPageViews, sevenDaysAgo, fourteenDaysAgo]
  );
  const uniqueVisitorsToday = useMemo(() =>
    new Set(historicalPageViews.filter(pv => pv.viewed_at >= todayStart).map(pv => pv.session_id)).size,
    [historicalPageViews, todayStart]
  );

  // Bounce rate: sessions with only 1 page view
  const bounceRate = useMemo(() => {
    const recent7 = sessions.filter(s => s.first_seen_at >= sevenDaysAgo);
    if (!recent7.length) return 0;
    const bounces = recent7.filter(s => s.pages_visited <= 1).length;
    return Math.round((bounces / recent7.length) * 100);
  }, [sessions, sevenDaysAgo]);

  // Avg session duration (seconds)
  const avgSessionDuration = useMemo(() => {
    const recent = sessions.filter(s => s.first_seen_at >= sevenDaysAgo && s.total_seconds > 0);
    if (!recent.length) return 0;
    return Math.round(recent.reduce((sum, s) => sum + s.total_seconds, 0) / recent.length);
  }, [sessions, sevenDaysAgo]);

  // Daily trend (last 14 days)
  const dailyTrend = useMemo(() => {
    const days: { date: string; visitors: number; pageviews: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
      const pvs = historicalPageViews.filter(pv => pv.viewed_at >= start && pv.viewed_at < end);
      days.push({
        date: dayLabel(start),
        visitors: new Set(pvs.map(pv => pv.session_id)).size,
        pageviews: pvs.length,
      });
    }
    return days;
  }, [historicalPageViews]);

  // Traffic sources (last 30 days from sessions)
  const trafficSources = useMemo(() => {
    const map = new Map<string, number>();
    sessions.forEach(s => {
      const src = classifySource(s.referrer, s.utm_source);
      map.set(src, (map.get(src) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [sessions]);

  // Top UTM campaigns
  const topCampaigns = useMemo(() => {
    const map = new Map<string, number>();
    sessions.filter(s => s.utm_campaign).forEach(s => {
      const key = s.utm_campaign!;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, sessions]) => ({ name, sessions })).sort((a, b) => b.sessions - a.sessions).slice(0, 8);
  }, [sessions]);

  // Top pages (last 30 days)
  const topPages = useMemo(() => {
    const map = new Map<string, { views: number; title: string | null; avgScroll: number; avgTime: number; scrollCount: number; timeCount: number }>();
    historicalPageViews.forEach(pv => {
      const existing = map.get(pv.page) ?? { views: 0, title: pv.page_title, avgScroll: 0, avgTime: 0, scrollCount: 0, timeCount: 0 };
      existing.views++;
      if (pv.scroll_depth !== null) { existing.avgScroll += pv.scroll_depth; existing.scrollCount++; }
      if (pv.time_on_page !== null && pv.time_on_page > 0) { existing.avgTime += pv.time_on_page; existing.timeCount++; }
      map.set(pv.page, existing);
    });
    return Array.from(map.entries())
      .map(([path, d]) => ({
        path,
        title: cleanTitle(d.title) ?? path,
        views: d.views,
        avgScroll: d.scrollCount > 0 ? Math.round(d.avgScroll / d.scrollCount) : null,
        avgTime: d.timeCount > 0 ? Math.round(d.avgTime / d.timeCount) : null,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  }, [historicalPageViews]);

  // Exit pages: last page viewed per session
  const exitPages = useMemo(() => {
    // Group page views by session, find the last one
    const sessionLastPage = new Map<string, PageView>();
    [...historicalPageViews]
      .sort((a, b) => a.viewed_at.localeCompare(b.viewed_at))
      .forEach(pv => sessionLastPage.set(pv.session_id, pv));

    const map = new Map<string, number>();
    sessionLastPage.forEach(pv => map.set(pv.page, (map.get(pv.page) ?? 0) + 1));

    return Array.from(map.entries())
      .map(([path, exits]) => ({ path, exits }))
      .sort((a, b) => b.exits - a.exits)
      .slice(0, 8);
  }, [historicalPageViews]);

  // Device breakdown
  const deviceBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    sessions.forEach(s => {
      const d = getDevice(s.user_agent);
      map.set(d, (map.get(d) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
  }, [sessions]);

  // Geographic breakdown (top countries)
  const geoBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    sessions.forEach(s => {
      if (s.country) map.set(s.country, (map.get(s.country) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([country, visitors]) => ({ country, visitors }))
      .sort((a, b) => b.visitors - a.visitors)
      .slice(0, 8);
  }, [sessions]);

  // New vs returning
  const returningStats = useMemo(() => {
    const recent = sessions.filter(s => s.first_seen_at >= sevenDaysAgo);
    const returning = recent.filter(s => s.is_returning).length;
    const newV = recent.length - returning;
    return { new: newV, returning, total: recent.length };
  }, [sessions, sevenDaysAgo]);

  const sessionLookup = useMemo(
    () => new Map(sessions.map((session) => [session.session_id, session])),
    [sessions]
  );

  // Page funnel
  const pageFunnelData = useMemo(() => {
    return FUNNEL_PAGES.map(fp => {
      const sessionsOnPage = new Set(
        historicalPageViews.filter(pv => pv.page === fp.path || pv.page.startsWith(fp.path + '/')).map(pv => pv.session_id)
      );
      return { ...fp, visitors: sessionsOnPage.size };
    });
  }, [historicalPageViews]);

  const pageFunnelMax = pageFunnelData[0]?.visitors ?? 1;

  const commercialFunnel = useMemo(() => {
    const steps = [
      { event: 'quote_start', label: 'Quote Started' },
      { event: 'quote_step_3', label: 'Reached Contact Step' },
      { event: 'quote_submitted', label: 'Quote Submitted' },
      { event: 'checkout_started', label: 'Checkout Started' },
      { event: 'payment_completed', label: 'Payment Completed' },
    ] as const;

    return steps.map((step) => {
      const identities = new Set<string>();
      events
        .filter((event) => event.event_name === step.event)
        .forEach((event) => {
          const identity = getEventIdentity(event);
          if (identity) identities.add(identity);
        });
      return { ...step, visitors: identities.size };
    });
  }, [events]);

  const commercialFunnelMax = commercialFunnel[0]?.visitors ?? 1;
  const quoteStarts = commercialFunnel[0]?.visitors ?? 0;
  const quoteSubmissions = commercialFunnel[2]?.visitors ?? 0;
  const checkoutStarts = commercialFunnel[3]?.visitors ?? 0;
  const paymentsCompleted = commercialFunnel[4]?.visitors ?? 0;
  const quoteCompletionRate = quoteStarts > 0 ? Math.round((quoteSubmissions / quoteStarts) * 100) : 0;
  const checkoutCompletionRate = checkoutStarts > 0 ? Math.round((paymentsCompleted / checkoutStarts) * 100) : 0;

  const attributedRevenue = useMemo(
    () => events
      .filter((event) => event.event_name === 'payment_completed')
      .reduce((sum, event) => sum + (event.event_value ?? 0), 0),
    [events]
  );

  const sourcePerformance = useMemo(() => {
    const map = new Map<string, { quotes: number; payments: number; revenue: number }>();

    events.forEach((event) => {
      if (!event.session_id) return;
      if (event.event_name !== 'quote_submitted' && event.event_name !== 'payment_completed') return;

      const session = sessionLookup.get(event.session_id);
      const source = classifySource(session?.referrer ?? null, session?.utm_source ?? null);
      const bucket = map.get(source) ?? { quotes: 0, payments: 0, revenue: 0 };

      if (event.event_name === 'quote_submitted') bucket.quotes += 1;
      if (event.event_name === 'payment_completed') {
        bucket.payments += 1;
        bucket.revenue += event.event_value ?? 0;
      }

      map.set(source, bucket);
    });

    return Array.from(map.entries())
      .map(([source, value]) => ({
        source,
        ...value,
        quoteToPaidRate: value.quotes > 0 ? Math.round((value.payments / value.quotes) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue || b.payments - a.payments)
      .slice(0, 6);
  }, [events, sessionLookup]);

  const servicePerformance = useMemo(() => {
    const map = new Map<string, { started: number; submitted: number; paid: number; revenue: number }>();

    events.forEach((event) => {
      const service =
        getEventString(event, 'service') ??
        getEventString(event, 'service_type') ??
        null;
      if (!service) return;

      const bucket = map.get(service) ?? { started: 0, submitted: 0, paid: 0, revenue: 0 };
      if (event.event_name === 'quote_start' || event.event_name === 'service_selected') bucket.started += 1;
      if (event.event_name === 'quote_submitted') bucket.submitted += 1;
      if (event.event_name === 'payment_completed') {
        bucket.paid += 1;
        bucket.revenue += event.event_value ?? 0;
      }
      map.set(service, bucket);
    });

    return Array.from(map.entries())
      .map(([service, value]) => ({
        service,
        ...value,
        submitRate: value.started > 0 ? Math.round((value.submitted / value.started) * 100) : 0,
        paidRate: value.submitted > 0 ? Math.round((value.paid / value.submitted) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue || b.paid - a.paid || b.submitted - a.submitted)
      .slice(0, 8);
  }, [events]);

  const topDropOffReasons = useMemo(() => {
    const map = new Map<string, number>();

    events
      .filter((event) => event.event_name === 'quote_step3_submit_failed' || event.event_name === 'quote_step3_abandoned')
      .forEach((event) => {
        const missingFieldsRaw = getEventString(event, 'missing_fields');
        const missingFields = missingFieldsRaw?.split(',').map((field) => field.trim()).filter(Boolean) ?? [];

        if (missingFields.length === 0 || (missingFields.length === 1 && missingFields[0] === 'none')) {
          map.set('general_friction', (map.get('general_friction') ?? 0) + 1);
          return;
        }

        missingFields.forEach((field) => {
          map.set(field, (map.get(field) ?? 0) + 1);
        });
      });

    return Array.from(map.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [events]);

  // Top CTA events (last 30 days)
  const topEvents = useMemo(() => {
    const map = new Map<string, number>();
    events.forEach(e => map.set(e.event_name, (map.get(e.event_name) ?? 0) + 1));
    return Array.from(map.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [events]);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="grid gap-5">

      {/* ── Hero stat cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Live now */}
        <div className="rounded-2xl border border-black/5 bg-white/90 shadow-[0_10px_28px_rgba(15,23,42,0.08)] overflow-hidden col-span-2 sm:col-span-1">
          <div className="h-0.5 w-full" style={{ background: '#10b981' }} />
          <div className="px-4 py-4">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Live Now</p>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              {isLoading ? <div className="h-8 w-10 rounded animate-pulse bg-slate-100" /> :
                <p className="text-3xl font-bold text-slate-900">{activeVisitors.length}</p>}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">visitors on site</p>
          </div>
        </div>
        <StatCard label="Today" value={uniqueVisitorsToday} sub="unique visitors" loading={isLoading} />
        <StatCard label="Last 7 Days" value={uniqueVisitors7} delta={uniqueVisitors7 - uniqueVisitorsPrev7} sub="vs prev. 7 days" loading={isLoading} />
        <StatCard label="Avg Session" value={isLoading ? '–' : formatDuration(avgSessionDuration)} sub="last 7 days" loading={isLoading} />
        <StatCard label="Bounce Rate" value={isLoading ? '–' : `${bounceRate}%`} sub="last 7 days" loading={isLoading} />
      </div>

      {/* ── Sub-tabs ─────────────────────────────────────────────────── */}
      <SubTabBar active={subTab} onChange={setSubTab} />

      {/* ════════════════════════════════════════════════════════════════
          OVERVIEW TAB
      ════════════════════════════════════════════════════════════════ */}
      {subTab === 'overview' && (
        <div className="grid gap-5">

          {/* Daily Trend */}
          <Panel title="Visitor Trend" subtitle="Daily unique visitors + pageviews — last 14 days">
            {isLoading ? (
              <div className="h-48 rounded-xl animate-pulse bg-slate-100" />
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={dailyTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gVisitors" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={BRAND} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={BRAND} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gPageviews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={1} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Area type="monotone" dataKey="visitors" name="Visitors" stroke={BRAND} strokeWidth={2} fill="url(#gVisitors)" dot={false} />
                  <Area type="monotone" dataKey="pageviews" name="Pageviews" stroke="#10b981" strokeWidth={1.5} fill="url(#gPageviews)" dot={false} strokeDasharray="4 2" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Panel>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <Panel title="Commercial Funnel" subtitle="Tracked journey from quote start to payment (last 30 days)">
              {isLoading ? (
                <div className="space-y-3">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-8 rounded-lg animate-pulse bg-slate-100" />)}</div>
              ) : (
                <div className="space-y-3">
                  {commercialFunnel.map((step, i) => {
                    const pct = commercialFunnelMax > 0 ? Math.round((step.visitors / commercialFunnelMax) * 100) : 0;
                    const dropPct = i > 0 && commercialFunnel[i - 1].visitors > 0
                      ? Math.round(((commercialFunnel[i - 1].visitors - step.visitors) / commercialFunnel[i - 1].visitors) * 100)
                      : null;
                    return (
                      <div key={step.event}>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-700">{step.label}</span>
                          <div className="flex items-center gap-2">
                            {dropPct !== null && dropPct > 0 ? (
                              <span className="text-[10px] text-red-400">−{dropPct}%</span>
                            ) : null}
                            <span className="text-xs font-semibold text-slate-900">{step.visitors.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: PALETTE[i % PALETTE.length] }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>

            <div className="grid gap-3">
              <Panel title="Commercial Snapshot" subtitle="What the tracked event stream says this month">
                {isLoading ? <div className="h-32 animate-pulse bg-slate-100 rounded-xl" /> : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-slate-50 px-4 py-3">
                      <p className="text-xl font-bold text-slate-900">{quoteStarts}</p>
                      <p className="text-[11px] text-slate-400 mt-1">Quote starts</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-4 py-3">
                      <p className="text-xl font-bold text-slate-900">{quoteSubmissions}</p>
                      <p className="text-[11px] text-slate-400 mt-1">Quote submissions</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-4 py-3">
                      <p className="text-xl font-bold text-slate-900">{paymentsCompleted}</p>
                      <p className="text-[11px] text-slate-400 mt-1">Payments completed</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-4 py-3">
                      <p className="text-xl font-bold text-slate-900">{formatCurrency(attributedRevenue)}</p>
                      <p className="text-[11px] text-slate-400 mt-1">Attributed revenue</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-4 py-3">
                      <p className="text-xl font-bold text-slate-900">{quoteCompletionRate}%</p>
                      <p className="text-[11px] text-slate-400 mt-1">Start to submit</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-4 py-3">
                      <p className="text-xl font-bold text-slate-900">{checkoutCompletionRate}%</p>
                      <p className="text-[11px] text-slate-400 mt-1">Checkout to paid</p>
                    </div>
                  </div>
                )}
              </Panel>

              <Panel title="Top Friction" subtitle="Most common missing or blocked fields on step 3">
                {isLoading ? <div className="h-24 animate-pulse bg-slate-100 rounded-xl" /> :
                  topDropOffReasons.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3 text-center">No repeated step-3 friction recorded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {topDropOffReasons.map((reason) => (
                        <div key={reason.reason} className="flex items-center justify-between">
                          <span className="text-xs text-slate-600 truncate">{reason.reason.replace(/_/g, ' ')}</span>
                          <span className="text-xs font-semibold text-slate-900 ml-2 shrink-0">{reason.count}</span>
                        </div>
                      ))}
                    </div>
                  )
                }
              </Panel>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Revenue by Source" subtitle="Paid conversions grouped by acquisition source">
              {isLoading ? <div className="h-40 animate-pulse bg-slate-100 rounded-xl" /> :
                sourcePerformance.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">No attributed quote or payment events yet.</p>
                ) : (
                  <div className="space-y-3">
                    {sourcePerformance.map((source, i) => (
                      <div key={source.source}>
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                            <span className="text-xs font-medium text-slate-700 truncate">{source.source}</span>
                          </div>
                          <span className="text-xs font-semibold text-slate-900">{formatCurrency(source.revenue)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>{source.quotes} quotes</span>
                          <span>{source.payments} paid</span>
                          <span>{source.quoteToPaidRate}% quote to paid</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
            </Panel>

            <Panel title="Service Performance" subtitle="Tracked quote and payment flow by service">
              {isLoading ? <div className="h-40 animate-pulse bg-slate-100 rounded-xl" /> :
                servicePerformance.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">No service funnel events recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-black/5">
                          <th className="text-left py-2 pr-3 text-slate-400 font-medium">Service</th>
                          <th className="text-right py-2 pr-3 text-slate-400 font-medium">Started</th>
                          <th className="text-right py-2 pr-3 text-slate-400 font-medium">Submitted</th>
                          <th className="text-right py-2 pr-3 text-slate-400 font-medium">Paid</th>
                          <th className="text-right py-2 text-slate-400 font-medium">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {servicePerformance.map((service) => (
                          <tr key={service.service} className="border-b border-black/5 last:border-0">
                            <td className="py-2 pr-3 font-medium text-slate-700">{service.service.replace(/_/g, ' ')}</td>
                            <td className="py-2 pr-3 text-right text-slate-600">{service.started}</td>
                            <td className="py-2 pr-3 text-right text-slate-600">{service.submitted}</td>
                            <td className="py-2 pr-3 text-right font-semibold text-slate-900">{service.paid}</td>
                            <td className="py-2 text-right font-semibold text-slate-900">{formatCurrency(service.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              }
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Page Funnel" subtitle="Visitors reaching each key page (last 30 days)">
              {isLoading ? (
                <div className="space-y-3">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-8 rounded-lg animate-pulse bg-slate-100" />)}</div>
              ) : (
                <div className="space-y-2">
                  {pageFunnelData.map((step, i) => {
                    const pct = pageFunnelMax > 0 ? Math.round((step.visitors / pageFunnelMax) * 100) : 0;
                    const dropPct = i > 0 && pageFunnelData[i - 1].visitors > 0
                      ? Math.round(((pageFunnelData[i - 1].visitors - step.visitors) / pageFunnelData[i - 1].visitors) * 100)
                      : null;
                    return (
                      <div key={step.path}>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-700">{step.label}</span>
                          <div className="flex items-center gap-2">
                            {dropPct !== null && dropPct > 0 ? (
                              <span className="text-[10px] text-red-400">−{dropPct}%</span>
                            ) : null}
                            <span className="text-xs font-semibold text-slate-900">{step.visitors.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: PALETTE[i % PALETTE.length] }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>

            <div className="grid gap-3">
              <Panel title="Returning vs New (7 days)" subtitle="Visitor loyalty split">
                {isLoading ? <div className="h-20 animate-pulse bg-slate-100 rounded-xl" /> : (
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-500">New</span>
                        <span className="text-xs font-semibold text-slate-900">{returningStats.new}</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden mb-3">
                        <div className="h-full rounded-full" style={{ width: returningStats.total ? `${Math.round(returningStats.new / returningStats.total * 100)}%` : '0%', background: BRAND }} />
                      </div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-500">Returning</span>
                        <span className="text-xs font-semibold text-slate-900">{returningStats.returning}</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-400" style={{ width: returningStats.total ? `${Math.round(returningStats.returning / returningStats.total * 100)}%` : '0%' }} />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-slate-900">
                        {returningStats.total > 0 ? `${Math.round(returningStats.returning / returningStats.total * 100)}%` : '–'}
                      </p>
                      <p className="text-[11px] text-slate-400">return rate</p>
                    </div>
                  </div>
                )}
              </Panel>

              <Panel title="Top Tracked Events" subtitle="Browser and server events flowing into the insight stream">
                {isLoading ? <div className="h-24 animate-pulse bg-slate-100 rounded-xl" /> :
                  topEvents.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3 text-center">
                      No events yet — add <code className="bg-slate-100 px-1 rounded">data-track="event-name"</code> or trigger lifecycle events server-side.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {topEvents.map((event) => (
                        <div key={event.name} className="flex items-center justify-between">
                          <span className="text-xs text-slate-600 truncate">{event.name.replace(/_/g, ' ')}</span>
                          <span className="text-xs font-semibold text-slate-900 ml-2 shrink-0">{event.count}</span>
                        </div>
                      ))}
                    </div>
                  )
                }
              </Panel>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          ACQUISITION TAB
      ════════════════════════════════════════════════════════════════ */}
      {subTab === 'acquisition' && (
        <div className="grid gap-5">
          <div className="grid gap-4 lg:grid-cols-2">

            {/* Traffic Sources Pie */}
            <Panel title="Traffic Sources" subtitle="Where visitors are coming from (last 30 days)">
              {isLoading ? <div className="h-56 animate-pulse bg-slate-100 rounded-xl" /> : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={trafficSources} cx="50%" cy="50%" innerRadius={45} outerRadius={72} dataKey="value" paddingAngle={2}>
                        {trafficSources.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                      </Pie>
                      <Tooltip content={<ChartTip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {trafficSources.map((s, i) => {
                      const total = trafficSources.reduce((sum, x) => sum + x.value, 0);
                      const pct = total > 0 ? Math.round(s.value / total * 100) : 0;
                      return (
                        <div key={s.name} className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                          <span className="text-xs text-slate-600 truncate flex-1">{s.name}</span>
                          <span className="text-xs font-semibold text-slate-900 shrink-0">{pct}%</span>
                          <span className="text-[11px] text-slate-400 shrink-0">({s.value})</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Panel>

            {/* Traffic Sources Bar */}
            <Panel title="Session Volume by Source" subtitle="Absolute session counts">
              {isLoading ? <div className="h-56 animate-pulse bg-slate-100 rounded-xl" /> : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={trafficSources} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={90} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="value" name="Sessions" radius={[0, 4, 4, 0]}>
                      {trafficSources.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>
          </div>

          {/* UTM Campaigns */}
          <Panel title="UTM Campaigns" subtitle="Tracked marketing campaigns (last 30 days)">
            {isLoading ? <div className="h-32 animate-pulse bg-slate-100 rounded-xl" /> :
              topCampaigns.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center">
                  <p className="text-xs text-slate-400">No UTM campaigns tracked yet.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Add <code className="bg-slate-100 px-1 rounded">?utm_source=google&utm_campaign=spring</code> to your ad links.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-black/5">
                        <th className="text-left py-2 pr-4 text-slate-400 font-medium">Campaign</th>
                        <th className="text-right py-2 text-slate-400 font-medium">Sessions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topCampaigns.map((c, i) => (
                        <tr key={c.name} className="border-b border-black/5 last:border-0">
                          <td className="py-2 pr-4 font-medium text-slate-700 flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                            {c.name}
                          </td>
                          <td className="py-2 text-right font-semibold text-slate-900">{c.sessions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </Panel>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          CONTENT TAB
      ════════════════════════════════════════════════════════════════ */}
      {subTab === 'content' && (
        <div className="grid gap-5">

          {/* Top Pages */}
          <Panel title="Top Pages" subtitle="Most viewed pages — last 30 days">
            {isLoading ? <div className="h-56 animate-pulse bg-slate-100 rounded-xl" /> : (
              <>
                <div className="mb-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={topPages.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 40, left: 8, bottom: 0 }}>
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                      <YAxis dataKey="title" type="category" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={110} />
                      <Tooltip content={<ChartTip />} />
                      <Bar dataKey="views" name="Views" fill={BRAND} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-black/5">
                        <th className="text-left py-2 pr-3 text-slate-400 font-medium">Page</th>
                        <th className="text-right py-2 pr-3 text-slate-400 font-medium">Views</th>
                        <th className="text-right py-2 pr-3 text-slate-400 font-medium">Avg Time</th>
                        <th className="text-right py-2 text-slate-400 font-medium">Avg Scroll</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topPages.map(p => (
                        <tr key={p.path} className="border-b border-black/5 last:border-0 hover:bg-slate-50/50">
                          <td className="py-2 pr-3 font-medium text-slate-700 max-w-[180px] truncate">{p.title}</td>
                          <td className="py-2 pr-3 text-right font-semibold text-slate-900">{p.views}</td>
                          <td className="py-2 pr-3 text-right text-slate-600">{p.avgTime !== null ? formatDuration(p.avgTime) : '–'}</td>
                          <td className="py-2 text-right">
                            {p.avgScroll !== null ? (
                              <span className={`font-semibold ${p.avgScroll >= 75 ? 'text-emerald-600' : p.avgScroll >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                                {p.avgScroll}%
                              </span>
                            ) : '–'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Panel>

          {/* Exit Pages */}
          <Panel
            title="Exit Pages"
            subtitle="Where visitors leave your site — high exits on a key page = UX problem"
          >
            {isLoading ? <div className="h-40 animate-pulse bg-slate-100 rounded-xl" /> : (
              <div className="space-y-2">
                {exitPages.map((ep, i) => {
                  const total = exitPages.reduce((s, x) => s + x.exits, 0);
                  const pct = total > 0 ? Math.round(ep.exits / total * 100) : 0;
                  return (
                    <div key={ep.path}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-mono text-slate-600 truncate max-w-[60%]">{ep.path}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-400">{ep.exits} exits</span>
                          <span className={`text-xs font-semibold ${pct >= 30 ? 'text-red-500' : pct >= 15 ? 'text-amber-500' : 'text-slate-600'}`}>{pct}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: PALETTE[i % PALETTE.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          AUDIENCE TAB
      ════════════════════════════════════════════════════════════════ */}
      {subTab === 'audience' && (
        <div className="grid gap-5">
          <div className="grid gap-4 lg:grid-cols-2">

            {/* Device breakdown */}
            <Panel title="Device Breakdown" subtitle="Desktop, mobile & tablet split (last 90 days)">
              {isLoading ? <div className="h-48 animate-pulse bg-slate-100 rounded-xl" /> : (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                      <Pie data={deviceBreakdown} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={2}>
                        {deviceBreakdown.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                      </Pie>
                      <Tooltip content={<ChartTip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-3">
                    {deviceBreakdown.map((d, i) => {
                      const total = deviceBreakdown.reduce((s, x) => s + x.value, 0);
                      const pct = total > 0 ? Math.round(d.value / total * 100) : 0;
                      return (
                        <div key={d.name} className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: PALETTE[i] }} />
                          <span className="text-xs text-slate-600 flex-1">{d.name}</span>
                          <span className="text-sm font-bold text-slate-900">{pct}%</span>
                          <span className="text-[11px] text-slate-400">({d.value})</span>
                        </div>
                      );
                    })}
                    {deviceBreakdown.length === 0 && (
                      <p className="text-xs text-slate-400">No session data yet</p>
                    )}
                  </div>
                </div>
              )}
            </Panel>

            {/* Geographic */}
            <Panel title="Top Countries" subtitle="Session origin by country (last 90 days)">
              {isLoading ? <div className="h-48 animate-pulse bg-slate-100 rounded-xl" /> :
                geoBreakdown.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No location data yet</p>
                ) : (
                  <div className="space-y-2">
                    {geoBreakdown.map((g, i) => {
                      const total = geoBreakdown.reduce((s, x) => s + x.visitors, 0);
                      const pct = total > 0 ? Math.round(g.visitors / total * 100) : 0;
                      return (
                        <div key={g.country}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-medium text-slate-700">{g.country}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-slate-400">{g.visitors}</span>
                              <span className="text-xs font-semibold text-slate-700">{pct}%</span>
                            </div>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: PALETTE[i % PALETTE.length] }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              }
            </Panel>
          </div>

          {/* Engagement quality */}
          <Panel title="Audience Engagement Quality" subtitle="Session depth and engagement metrics (last 7 days)">
            {isLoading ? <div className="h-24 animate-pulse bg-slate-100 rounded-xl" /> : (
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-2xl font-bold text-slate-900">{formatDuration(avgSessionDuration)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Avg session duration</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-2xl font-bold text-slate-900">{bounceRate}%</p>
                  <p className="text-[11px] text-slate-400 mt-1">Bounce rate</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-2xl font-bold text-slate-900">
                    {sessions.filter(s => s.first_seen_at >= sevenDaysAgo).length > 0
                      ? (sessions.filter(s => s.first_seen_at >= sevenDaysAgo).reduce((sum, s) => sum + s.pages_visited, 0) / sessions.filter(s => s.first_seen_at >= sevenDaysAgo).length).toFixed(1)
                      : '–'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Pages per session</p>
                </div>
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          LIVE TAB
      ════════════════════════════════════════════════════════════════ */}
      {subTab === 'live' && (
        <div className="grid gap-4 lg:grid-cols-2">

          {/* Active Sessions */}
          <Panel title="Active Sessions" subtitle={`${activeVisitors.length} visitor${activeVisitors.length !== 1 ? 's' : ''} right now`}>
            {isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => (
                <div key={i} className="flex gap-3">
                  <div className="h-8 w-8 rounded-full animate-pulse bg-slate-100 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-3/4 rounded animate-pulse bg-slate-100" />
                    <div className="h-3 w-1/2 rounded animate-pulse bg-slate-100" />
                  </div>
                </div>
              ))}</div>
            ) : activeVisitors.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">No active visitors right now</p>
            ) : (
              <div className="space-y-3">
                {activeVisitors.map(v => {
                  const ref = shortenReferrer(v.referrer);
                  const loc = formatLocation(v.city, v.country);
                  return (
                    <div key={v.session_id} className="flex gap-3 items-start py-2 border-b border-black/5 last:border-0">
                      <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                        <DeviceIcon ua={v.user_agent} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {cleanTitle(v.page_title) ?? v.current_page}
                        </p>
                        <p className="text-[11px] font-mono text-slate-400 truncate">{v.current_page}</p>
                        {loc && <p className="text-[11px] text-slate-400">{loc}</p>}
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[11px] text-slate-400">{formatSessionDuration(v.first_seen_at, v.last_seen_at)}</span>
                          {ref && <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">via {ref}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] text-slate-400">{formatRelativeTime(v.last_seen_at)}</span>
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* Live Movement Feed */}
          <Panel title="Live Movement Feed" subtitle="Last 30 page views">
            {isLoading ? (
              <div className="space-y-2">{[1,2,3,4,5].map(i => (
                <div key={i} className="flex justify-between gap-4">
                  <div className="h-3 w-2/3 rounded animate-pulse bg-slate-100" />
                  <div className="h-3 w-12 rounded animate-pulse bg-slate-100" />
                </div>
              ))}</div>
            ) : recentPageViews.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">No page views recorded yet</p>
            ) : (
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {recentPageViews.map(pv => (
                  <div key={pv.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-black/5 last:border-0">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm text-slate-700 truncate block">{cleanTitle(pv.page_title) ?? pv.page}</span>
                      <span className="text-[11px] font-mono text-slate-400 truncate block">{pv.page}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[11px] text-slate-400 block">{formatRelativeTime(pv.viewed_at)}</span>
                      {pv.scroll_depth !== null && (
                        <span className="text-[10px] text-slate-300">{pv.scroll_depth}% scroll</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
