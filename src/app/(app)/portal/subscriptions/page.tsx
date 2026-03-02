'use client';

import { useEffect, useState } from 'react';
import { brand } from '@/app/ui/theme';

type Subscription = {
  id: string;
  service_type: string;
  context: string;
  scope: string | null;
  frequency: string;
  price_per_cycle: number;
  status: string;
  next_service_date: string | null;
};

const glass = 'bg-white/80 backdrop-blur-2xl border border-black/8 shadow-[0_10px_30px_rgba(2,6,23,0.08)] rounded-2xl';

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Window Cleaning', cleaning: 'Home Cleaning', yard: 'Yard Care',
  dump: 'Dump Run', auto: 'Auto Detailing', laundry_sneakers: 'Laundry & Sneakers',
};

const FREQ_LABELS: Record<string, string> = {
  daily: 'Daily', '3x_weekly': '3x Weekly', weekly: 'Weekly',
  fortnightly: 'Fortnightly', monthly: 'Monthly',
};

const STATUS_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  active: { bg: '#ECFDF5', fg: '#065F46', label: 'Active' },
  paused: { bg: '#FEF3C7', fg: '#92400E', label: 'Paused' },
  cancelled: { bg: '#FEE2E2', fg: '#991B1B', label: 'Cancelled' },
};

export default function PortalSubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/subscriptions?limit=50')
      .then((r) => r.json())
      .then((data) => setSubs(data.subscriptions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/subscriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setSubs((prev) => prev.map((s) => (s.id === id ? { ...s, status: data.status || newStatus } : s)));
      }
    } catch { /* ignore */ } finally {
      setActionLoading(null);
      setConfirmCancel(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: brand.primary }}>My Subscriptions</h1>
        <p className="text-sm mt-1" style={{ color: brand.muted }}>Manage your recurring services.</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((n) => (
            <div key={n} className={`${glass} p-5`}>
              <div className="h-5 w-40 rounded bg-slate-200 animate-pulse" />
              <div className="h-4 w-24 rounded bg-slate-100 animate-pulse mt-2" />
            </div>
          ))}
        </div>
      ) : subs.length === 0 ? (
        <div className={`${glass} p-10 text-center`}>
          <p className="font-medium" style={{ color: brand.text }}>No subscriptions yet</p>
          <p className="text-sm mt-1" style={{ color: brand.muted }}>Set up a recurring service to keep things running smoothly.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {subs.map((sub) => {
            const style = STATUS_STYLES[sub.status] || STATUS_STYLES.active;
            const isActive = sub.status === 'active';
            const isPaused = sub.status === 'paused';

            return (
              <div key={sub.id} className={`${glass} p-5`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold" style={{ color: brand.text }}>
                        {SERVICE_LABELS[sub.service_type] || sub.service_type}
                      </p>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: style.bg, color: style.fg }}
                      >
                        {style.label}
                      </span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: brand.muted }}>
                      {sub.context}{sub.scope ? ` · ${sub.scope}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold" style={{ color: brand.text }}>
                      ${sub.price_per_cycle.toFixed(2)}
                    </p>
                    <p className="text-[11px]" style={{ color: brand.muted }}>per cycle</p>
                  </div>
                </div>

                {/* Frequency & Next Service */}
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-black/5">
                  <div className="flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={brand.muted} strokeWidth="2">
                      <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" />
                      <path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" />
                    </svg>
                    <span className="text-xs font-medium" style={{ color: brand.text }}>
                      {FREQ_LABELS[sub.frequency] || sub.frequency}
                    </span>
                  </div>
                  {sub.next_service_date && (
                    <div className="flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={brand.muted} strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <path d="M16 2v4M8 2v4M3 10h18" />
                      </svg>
                      <span className="text-xs" style={{ color: brand.muted }}>
                        Next: {new Date(sub.next_service_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {sub.status !== 'cancelled' && (
                  <div className="flex gap-2 mt-3">
                    {isActive && (
                      <button
                        onClick={() => updateStatus(sub.id, 'paused')}
                        disabled={actionLoading === sub.id}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-amber-50"
                        style={{ borderColor: '#FCD34D', color: '#92400E' }}
                      >
                        {actionLoading === sub.id ? 'Saving...' : 'Pause'}
                      </button>
                    )}
                    {isPaused && (
                      <button
                        onClick={() => updateStatus(sub.id, 'active')}
                        disabled={actionLoading === sub.id}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                        style={{ background: brand.primary }}
                      >
                        {actionLoading === sub.id ? 'Saving...' : 'Resume'}
                      </button>
                    )}
                    {confirmCancel === sub.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: '#991B1B' }}>Are you sure?</span>
                        <button
                          onClick={() => updateStatus(sub.id, 'cancelled')}
                          disabled={actionLoading === sub.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 text-white"
                        >
                          Yes, cancel
                        </button>
                        <button
                          onClick={() => setConfirmCancel(null)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                          style={{ borderColor: brand.border, color: brand.muted }}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmCancel(sub.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-red-50"
                        style={{ borderColor: '#FCA5A5', color: '#991B1B' }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
