'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { dashboardTheme } from '@/lib/design-system/themes';
import type { AdminAlert } from '@/lib/admin-alerts';

const glass = 'bg-white/80 backdrop-blur-2xl border shadow-[0_10px_30px_rgba(2,6,23,0.08)]';

const SEVERITY_STYLES: Record<AdminAlert['severity'], { bg: string; text: string; dot: string; label: string }> = {
  critical: { bg: 'bg-red-50', text: 'text-red-800', dot: 'bg-red-500', label: 'Critical' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-800', dot: 'bg-amber-500', label: 'Warning' },
  info: { bg: 'bg-blue-50', text: 'text-blue-800', dot: 'bg-blue-500', label: 'Info' },
};

function AlertSkeleton() {
  return (
    <div className={`${glass} rounded-2xl p-4 animate-pulse`} style={{ borderColor: dashboardTheme.color.border, background: dashboardTheme.color.card }}>
      <div className="flex items-start gap-3">
        <div className="w-2 h-2 rounded-full mt-1.5 bg-slate-200 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <div className="h-4 w-32 bg-slate-200 rounded" />
            <div className="h-4 w-16 bg-slate-100 rounded" />
          </div>
          <div className="h-3 w-3/4 bg-slate-100 rounded" />
          <div className="h-3 w-20 bg-slate-100 rounded" />
        </div>
      </div>
    </div>
  );
}

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function AlertsPageContent() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [filter, setFilter] = useState<'all' | AdminAlert['severity']>(() => {
    const severity = searchParams?.get('severity');
    return severity === 'critical' || severity === 'warning' || severity === 'info' ? severity : 'all';
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissedCount, setDismissedCount] = useState(0);

  useEffect(() => {
    fetchAlerts();
  }, []);

  useEffect(() => {
    const severity = searchParams?.get('severity');
    setFilter(severity === 'critical' || severity === 'warning' || severity === 'info' ? severity : 'all');
  }, [searchParams]);

  async function fetchAlerts() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/alerts');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAlerts(data.alerts || []);
      setDismissedCount(data.dismissedCount || 0);
    } catch (err) {
      console.error('Failed to load alerts:', err);
      setError('Failed to load alerts. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.severity === filter);
  async function dismissAlerts(ids: string[]) {
    if (ids.length === 0) return;

    const previousAlerts = alerts;
    const previousDismissedCount = dismissedCount;

    setAlerts((prev) => prev.filter((alert) => !ids.includes(alert.id)));
    setDismissedCount((count) => count + ids.length);

    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', ids }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      console.error('Failed to dismiss alerts:', err);
      setAlerts(previousAlerts);
      setDismissedCount(previousDismissedCount);
      setError('Failed to dismiss alert. Please try again.');
    }
  }

  async function restoreDismissed() {
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore_all' }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      await fetchAlerts();
    } catch (err) {
      console.error('Failed to restore alerts:', err);
      setError('Failed to restore dismissed alerts. Please try again.');
    }
  }

  return (
    <div className="min-h-screen" style={{ background: dashboardTheme.color.bg }}>
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold" style={{ color: dashboardTheme.color.primary }}>Alerts</h1>
            <p className="text-sm mt-1" style={{ color: dashboardTheme.color.muted }}>
              Urgent issues and reminders across jobs and payables.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchAlerts}
              className="text-xs px-3 py-1.5 rounded-lg border transition hover:bg-white"
              style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.muted }}
            >
              Refresh
            </button>
            {filtered.length > 0 && (
              <button
                onClick={() => void dismissAlerts(filtered.map((alert) => alert.id))}
                className="text-xs px-3 py-1.5 rounded-lg border transition hover:bg-white"
                style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.primary }}
              >
                Clear visible ({filtered.length})
              </button>
            )}
            {dismissedCount > 0 && (
              <button
                onClick={() => void restoreDismissed()}
                className="text-xs px-3 py-1.5 rounded-lg border transition hover:bg-white"
                style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.muted }}
              >
                Restore hidden ({dismissedCount})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['all', 'critical', 'warning', 'info'] as const).map(f => (
          <button
            key={f}
            onClick={() => {
              setFilter(f);
              const params = new URLSearchParams(searchParams?.toString() ?? '');
              if (f === 'all') {
                params.delete('severity');
              } else {
                params.set('severity', f);
              }
              router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
            }}
            className={`px-3 py-1 rounded-full text-xs border transition ${filter === f ? 'bg-white shadow-sm font-medium' : 'bg-transparent hover:bg-white/60'}`}
            style={{ borderColor: dashboardTheme.color.border, color: filter === f ? dashboardTheme.color.primary : dashboardTheme.color.muted }}
          >
            {f === 'all'
              ? `All (${alerts.length})`
              : `${SEVERITY_STYLES[f].label} (${alerts.filter(a => a.severity === f).length})`}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <AlertSkeleton key={i} />)}
        </div>
      )}

      {/* Error state */}
      {!isLoading && error && (
        <div className={`${glass} rounded-2xl p-6 text-center`} style={{ borderColor: dashboardTheme.color.border, background: dashboardTheme.color.card }}>
          <p className="text-sm text-red-600 mb-2">{error}</p>
          <button
            onClick={fetchAlerts}
            className="text-xs px-4 py-1.5 rounded-lg border"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.primary }}
          >
            Try again
          </button>
        </div>
      )}

      {/* Alert list */}
      {!isLoading && !error && (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className={`${glass} rounded-2xl p-8 text-center`} style={{ borderColor: dashboardTheme.color.border, background: dashboardTheme.color.card }}>
              <div className="text-2xl mb-2">✓</div>
              <div className="text-sm font-medium" style={{ color: dashboardTheme.color.text }}>
                {filter === 'all' ? 'No active alerts' : `No ${filter} alerts`}
              </div>
              <div className="text-xs mt-1" style={{ color: dashboardTheme.color.muted }}>
                {filter === 'all'
                  ? dismissedCount > 0
                    ? 'Everything active is cleared. Restore hidden alerts if needed.'
                    : 'Everything looks good.'
                  : 'Try switching to All to see other alerts.'}
              </div>
            </div>
          )}
          {filtered.map(alert => {
            const sev = SEVERITY_STYLES[alert.severity];
            return (
              <div
                key={alert.id}
                className={`${glass} rounded-2xl p-4 transition hover:shadow-md`}
                style={{
                  borderColor: dashboardTheme.color.border,
                  background: dashboardTheme.color.card,
                }}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${sev.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: dashboardTheme.color.text }}>{alert.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${sev.bg} ${sev.text}`}>{sev.label}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{alert.source}</span>
                    </div>
                    <p className="text-sm mt-1" style={{ color: dashboardTheme.color.muted }}>{alert.message}</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div className="text-[11px]" style={{ color: dashboardTheme.color.muted }}>
                        {formatTimestamp(alert.timestamp)}
                      </div>
                      <div className="flex items-center gap-2">
                        {alert.href && (
                          <a
                            href={alert.href}
                            className="text-[11px] font-medium"
                            style={{ color: dashboardTheme.color.primary }}
                          >
                            Open
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => void dismissAlerts([alert.id])}
                          className="text-[11px] font-medium text-slate-500 hover:text-slate-700"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AlertsPage() {
  return (
    <Suspense fallback={<div className="min-h-[320px] w-full" />}>
      <AlertsPageContent />
    </Suspense>
  );
}
