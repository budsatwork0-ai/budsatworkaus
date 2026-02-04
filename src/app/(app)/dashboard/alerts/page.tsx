'use client';

import { useState } from 'react';
import { brand } from '@/app/ui/theme';

const glass = 'bg-white/80 backdrop-blur-2xl border shadow-[0_10px_30px_rgba(2,6,23,0.08)]';

type Alert = {
  id: string;
  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  source: string;
  timestamp: string;
  read: boolean;
};

const SEVERITY_STYLES: Record<Alert['severity'], { bg: string; text: string; dot: string; label: string }> = {
  critical: { bg: 'bg-red-50', text: 'text-red-800', dot: 'bg-red-500', label: 'Critical' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-800', dot: 'bg-amber-500', label: 'Warning' },
  info: { bg: 'bg-blue-50', text: 'text-blue-800', dot: 'bg-blue-500', label: 'Info' },
};

const MOCK_ALERTS: Alert[] = [
  { id: 'a1', title: 'Subscription overdue', message: 'Bin Care Lite for 14 Maple St is 5 days past due. Follow up with customer.', severity: 'critical', source: 'Subscriptions', timestamp: '2 hours ago', read: false },
  { id: 'a2', title: 'Induction incomplete', message: 'Dean has not completed shadow shift requirement within SLA window.', severity: 'warning', source: 'Onboarding', timestamp: '6 hours ago', read: false },
  { id: 'a3', title: 'Quote pending 48h+', message: 'Quote #Q-047 for window cleaning has been waiting for approval since Tuesday.', severity: 'warning', source: 'Quotes', timestamp: '1 day ago', read: false },
  { id: 'a4', title: 'New order confirmed', message: 'Deep clean for 22 Oak Ave confirmed and scheduled for Thursday 9am.', severity: 'info', source: 'Orders', timestamp: '1 day ago', read: true },
  { id: 'a5', title: 'Weekly revenue target met', message: 'Revenue this week hit $2,450 — 102% of target.', severity: 'info', source: 'Reports', timestamp: '2 days ago', read: true },
];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>(MOCK_ALERTS);
  const [filter, setFilter] = useState<'all' | Alert['severity']>('all');

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
              Urgent issues and reminders across jobs and teams.
            </p>
          </div>
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

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['all', 'critical', 'warning', 'info'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs border transition ${filter === f ? 'bg-white shadow-sm font-medium' : 'bg-transparent hover:bg-white/60'}`}
            style={{ borderColor: brand.border, color: filter === f ? brand.primary : brand.muted }}
          >
            {f === 'all' ? `All (${alerts.length})` : `${SEVERITY_STYLES[f].label} (${alerts.filter(a => a.severity === f).length})`}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className={`${glass} rounded-2xl p-6 text-center`} style={{ borderColor: brand.border, background: brand.card }}>
            <div className="text-sm" style={{ color: brand.muted }}>No alerts matching this filter.</div>
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
                ...(alert.read ? {} : { ringColor: sev.dot === 'bg-red-500' ? '#ef4444' : sev.dot === 'bg-amber-500' ? '#f59e0b' : '#3b82f6' }),
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
                  <div className="text-[11px] mt-1.5" style={{ color: brand.muted }}>{alert.timestamp}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs mt-6" style={{ color: brand.muted }}>
        Design-only. Alerts will be generated automatically from orders, subscriptions, and onboarding events.
      </p>
    </div>
  );
}
