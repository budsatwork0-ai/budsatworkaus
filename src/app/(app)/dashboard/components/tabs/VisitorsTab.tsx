'use client';

import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { brand } from '@/app/ui/theme';
import { Panel } from '../shared';

// Inline types until database.ts is regenerated
type SiteVisitor = {
  session_id: string;
  current_page: string;
  page_title: string | null;
  referrer: string | null;
  user_agent: string | null;
  first_seen_at: string;
  last_seen_at: string;
};

type PageView = {
  id: string;
  session_id: string;
  page: string;
  page_title: string | null;
  viewed_at: string;
};

const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

const formatRelativeTime = (timestamp: string) => {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const secs = Math.floor(diffMs / 1000);
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  if (secs < 60) return `${secs}s ago`;
  if (mins < 60) return `${mins}m ago`;
  return `${hours}h ago`;
};

const formatDuration = (from: string, to: string) => {
  const mins = Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 60000);
  if (mins < 1) return 'just arrived';
  return `${mins}m on site`;
};

const getDeviceHint = (ua: string | null): 'mobile' | 'tablet' | 'desktop' => {
  if (!ua) return 'desktop';
  if (/mobile/i.test(ua)) return 'mobile';
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  return 'desktop';
};

const shortenReferrer = (ref: string | null): string | null => {
  if (!ref) return null;
  try {
    const url = new URL(ref);
    const host = url.hostname.replace(/^www\./, '');
    return host || null;
  } catch {
    return null;
  }
};

// Device icons
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
  const device = getDeviceHint(ua);
  if (device === 'mobile') return <MobileIcon />;
  if (device === 'tablet') return <TabletIcon />;
  return <DesktopIcon />;
};

export default function VisitorsTab() {
  const [visitors, setVisitors] = useState<SiteVisitor[]>([]);
  const [recentPageViews, setRecentPageViews] = useState<PageView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Ticker to refresh relative timestamps every 10s
  const [tick, setTick] = useState(0);
  const channelRef = useRef<ReturnType<typeof getSupabaseBrowserClient>['channel'] extends (...args: any[]) => infer R ? R : never>(null as any);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function loadInitialData() {
      setIsLoading(true);
      const fiveMinutesAgo = new Date(Date.now() - ACTIVE_THRESHOLD_MS).toISOString();

      const [{ data: visitorsData }, { data: pageViewsData }] = await Promise.all([
        (supabase as any)
          .from('site_visitors')
          .select('*')
          .gte('last_seen_at', fiveMinutesAgo)
          .order('last_seen_at', { ascending: false }),
        (supabase as any)
          .from('page_views')
          .select('*')
          .order('viewed_at', { ascending: false })
          .limit(20),
      ]);

      setVisitors(visitorsData ?? []);
      setRecentPageViews(pageViewsData ?? []);
      setIsLoading(false);
    }

    loadInitialData();

    // Realtime subscription
    const channel = supabase
      .channel('visitor-tracking')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_visitors' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new as SiteVisitor;
            setVisitors(prev => {
              const without = prev.filter(v => v.session_id !== row.session_id);
              return [row, ...without].slice(0, 50);
            });
          }
          if (payload.eventType === 'DELETE') {
            const old = payload.old as { session_id: string };
            setVisitors(prev => prev.filter(v => v.session_id !== old.session_id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'page_views' },
        (payload) => {
          const row = payload.new as PageView;
          setRecentPageViews(prev => [row, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Refresh relative timestamps every 10s
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  // Derive truly active visitors from local state (last_seen within 5 min)
  const activeVisitors = visitors.filter(v => {
    return Date.now() - new Date(v.last_seen_at).getTime() < ACTIVE_THRESHOLD_MS;
  });

  // Suppress TypeScript warning about tick being unused — it drives re-render
  void tick;

  return (
    <div className="grid gap-4">
      {/* Hero stat */}
      <div className="rounded-2xl border border-black/5 bg-white/90 px-5 py-4 shadow-sm flex items-center gap-4">
        <div className="relative flex items-center justify-center h-10 w-10 rounded-full bg-emerald-50">
          <span className="absolute inline-flex h-3 w-3 rounded-full bg-emerald-400 opacity-75 animate-ping" />
          <span className="relative inline-flex h-3 w-3 rounded-full" style={{ background: brand.primary }} />
        </div>
        <div>
          {isLoading ? (
            <div className="h-7 w-16 rounded animate-pulse bg-slate-100" />
          ) : (
            <p className="text-2xl font-bold text-slate-900">{activeVisitors.length}</p>
          )}
          <p className="text-xs text-slate-500">
            {activeVisitors.length === 1 ? 'visitor' : 'visitors'} on site right now
            <span className="ml-1 text-slate-400">(active in last 5 min)</span>
          </p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Active sessions */}
        <Panel title="Active Sessions" subtitle={`${activeVisitors.length} active`}>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="h-8 w-8 rounded-full animate-pulse bg-slate-100 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-3/4 rounded animate-pulse bg-slate-100" />
                    <div className="h-3 w-1/2 rounded animate-pulse bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : activeVisitors.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">No active visitors right now</p>
          ) : (
            <div className="space-y-3">
              {activeVisitors.map(v => {
                const referrer = shortenReferrer(v.referrer);
                return (
                  <div key={v.session_id} className="flex gap-3 items-start py-2 border-b border-black/5 last:border-0">
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                      <DeviceIcon ua={v.user_agent} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{v.current_page}</p>
                      {v.page_title && (
                        <p className="text-xs text-slate-400 truncate">{v.page_title}</p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-slate-400">
                          {formatDuration(v.first_seen_at, v.last_seen_at)}
                        </span>
                        {referrer && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                            from {referrer}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 mt-0.5">
                      {formatRelativeTime(v.last_seen_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        {/* Live movement feed */}
        <Panel title="Live Movement Feed" subtitle="Last 20 page views">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex justify-between gap-4">
                  <div className="h-3 w-2/3 rounded animate-pulse bg-slate-100" />
                  <div className="h-3 w-12 rounded animate-pulse bg-slate-100" />
                </div>
              ))}
            </div>
          ) : recentPageViews.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">No page views recorded yet</p>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {recentPageViews.map(pv => (
                <div key={pv.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-black/5 last:border-0">
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-mono text-slate-700 truncate block">{pv.page}</span>
                    {pv.page_title && (
                      <span className="text-[11px] text-slate-400 truncate block">{pv.page_title}</span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">{formatRelativeTime(pv.viewed_at)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
