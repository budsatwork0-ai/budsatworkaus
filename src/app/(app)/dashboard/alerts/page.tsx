'use client';

import { useEffect, useState } from 'react';
import { brand } from '@/app/ui/theme';
import type { Alert } from '@/app/api/alerts/route';

const glass = 'bg-white/80 backdrop-blur-2xl border shadow-[0_10px_30px_rgba(2,6,23,0.08)]';

const SEVERITY_STYLES: Record<Alert['severity'], { bg: string; text: string; dot: string; label: string }> = {
  critical: { bg: 'bg-red-50', text: 'text-red-800', dot: 'bg-red-500', label: 'Critical' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-800', dot: 'bg-amber-500', label: 'Warning' },
  info: { bg: 'bg-blue-50', text: 'text-blue-800', dot: 'bg-blue-500', label: 'Info' },
};

function AlertSkeleton() {
  return (
    <div className={`${glass} rounded-2xl p-4 animate-pulse`} style={{ borderColor: brand.border, background: brand.card }}>
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

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<'all' | Alert['severity']>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAlerts();
  }, []);

  async function fetchAlerts() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/alerts');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAlerts(data.alerts || []);
    } catch (err) {
      console.error('Failed to load alerts:', err);
      setError('Failed to load alerts. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.severity === filter);
  const unreadCount = alerts.filter(a => !a.read).length;

  function markRead(id: string) {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
  }

  function markAllRead() {
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
  }

  return (
    <div className="min-h-screen" style={{ background: brand.bg }}>
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold" style={{ color: brand.primary }}>Alerts</h1>
            <p className="text-sm mt-1" style={{ color: brand.muted }}>
              Urgent issues and reminders across jobs and payables.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchAlerts}
              className="text-xs px-3 py-1.5 rounded-lg border transition hover:bg-white"
              style={{ borderColor: brand.border, color: brand.muted }}
            >
              Refresh
            </button>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs px-3 py-1.5 rounded-lg border transition hover:bg-white"
                style={{ borderColor: brand.border, color: brand.primary }}
              >
                Mark all read ({unreadCount})
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
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs border transition ${filter === f ? 'bg-white shadow-sm font-medium' : 'bg-transparent hover:bg-white/60'}`}
            style={{ borderColor: brand.border, color: filter === f ? brand.primary : brand.muted }}
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
        <div className={`${glass} rounded-2xl p-6 text-center`} style={{ borderColor: brand.border, background: brand.card }}>
          <p className="text-sm text-red-600 mb-2">{error}</p>
          <button
            onClick={fetchAlerts}
            className="text-xs px-4 py-1.5 rounded-lg border"
            style={{ borderColor: brand.border, color: brand.primary }}
          >
            Try again
          </button>
        </div>
      )}

      {/* Alert list */}
      {!isLoading && !error && (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className={`${glass} rounded-2xl p-8 text-center`} style={{ borderColor: brand.border, background: brand.card }}>
              <div className="text-2xl mb-2">✓</div>
              <div className="text-sm font-medium" style={{ color: brand.text }}>
                {filter === 'all' ? 'No active alerts' : `No ${filter} alerts`}
              </div>
              <div className="text-xs mt-1" style={{ color: brand.muted }}>
                {filter === 'all' ? 'Everything looks good.' : 'Try switching to All to see other alerts.'}
              </div>
            </div>
          )}
          {filtered.map(alert => {
            const sev = SEVERITY_STYLES[alert.severity];
            return (
              <div
                key={alert.id}
                onClick={() => markRead(alert.id)}
                className={`${glass} rounded-2xl p-4 cursor-pointer transition hover:shadow-md ${!alert.read ? 'ring-1 ring-inset' : ''}`}
                style={{
                  borderColor: brand.border,
                  background: brand.card,
                }}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${sev.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: brand.text }}>{alert.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${sev.bg} ${sev.text}`}>{sev.label}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{alert.source}</span>
                      {!alert.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
                    </div>
                    <p className="text-sm mt-1" style={{ color: brand.muted }}>{alert.message}</p>
                    <div className="text-[11px] mt-1.5" style={{ color: brand.muted }}>
                      {formatTimestamp(alert.timestamp)}
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
