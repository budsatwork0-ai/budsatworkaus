'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { brand } from '@/app/ui/theme';
import type { AdminAlert } from '@/lib/admin-alerts';
import { readCache } from '../hooks/useDashboardData';

type NavBadgeKey = 'dashboard' | 'schedule' | 'quotes' | 'invoices' | 'applicants';

type Props = {
  /** Called whenever badge counts are refreshed, so the layout can update the sidebar. */
  onBadgesUpdate: (badges: Record<NavBadgeKey, number>) => void;
};

const NOTIF_ICONS: Record<AdminAlert['severity'], { bg: string; color: string }> = {
  critical: { bg: '#FEE2E2', color: '#B91C1C' },
  warning:  { bg: '#FEF3C7', color: '#92400E' },
  info:     { bg: '#DBEAFE', color: '#1E40AF' },
};

/**
 * NotificationCenter
 * ------------------
 * Bell-button + dropdown panel for admin alerts.
 * Owns its own fetch/dismiss/restore state; reports badge counts upward
 * via the onBadgesUpdate callback so the sidebar stays in sync.
 */
export function NotificationCenter({ onBadgesUpdate }: Props) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminAlert[]>([]);
  const [dismissedCount, setDismissedCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [appRes, quotesRes, alertsRes] = await Promise.all([
        fetch('/api/applicants?stage=intake&limit=50').then((r) => r.json()).catch(() => ({ applicants: [] })),
        fetch('/api/quotes?status=submitted,in_review&limit=100').then((r) => r.json()).catch(() => ({ quotes: [] })),
        fetch('/api/alerts').then((r) => r.json()).catch(() => ({ alerts: [], dismissedCount: 0 })),
      ]);

      // Re-use the cached dashboard data (populated by useDashboardData on any dashboard page).
      // Falls back to empty arrays if the cache hasn't been primed yet.
      const cached = readCache();
      const receivables: { status: string }[] = cached?.receivables ?? [];
      const jobs: { scheduledDate?: string }[] = cached?.jobs ?? [];

      const communityRoles = new Set(['Quality partner', 'Sponsor', 'Innovation partner']);
      const crewApplicants: { role: string }[] = (appRes.applicants || []).filter(
        (a: { role: string }) => !communityRoles.has(a.role),
      );
      const pendingQuotes: unknown[] = quotesRes.quotes || [];
      const overdueInvoices = receivables.filter((r) => r.status === 'Overdue').length;
      const unscheduledJobs = jobs.filter((j) => !j.scheduledDate).length;

      setNotifications(alertsRes.alerts || []);
      setDismissedCount(alertsRes.dismissedCount || 0);
      onBadgesUpdate({
        dashboard: overdueInvoices + crewApplicants.length + pendingQuotes.length + unscheduledJobs,
        schedule:  unscheduledJobs,
        quotes:    pendingQuotes.length,
        invoices:  overdueInvoices,
        applicants: crewApplicants.length,
      });
    } catch (err) {
      console.error('[NotificationCenter] fetchAll failed:', err);
    } finally {
      setLoading(false);
    }
  }, [onBadgesUpdate]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const dismiss = useCallback(async (id: string) => {
    const prev = notifications;
    const prevCount = dismissedCount;
    setNotifications((ns) => ns.filter((n) => n.id !== id));
    setDismissedCount((c) => c + 1);
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', ids: [id] }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error('[NotificationCenter] dismiss failed:', err);
      setNotifications(prev);
      setDismissedCount(prevCount);
    }
  }, [dismissedCount, notifications]);

  const restoreAll = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore_all' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchAll();
    } catch (err) {
      console.error('[NotificationCenter] restoreAll failed:', err);
    }
  }, [fetchAll]);

  const unreadCount = notifications.filter((n) => n.severity !== 'info').length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-xl border border-black/10 bg-white hover:bg-slate-50 transition-colors text-slate-700"
        aria-label="Notifications"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-4 h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1"
            style={{ background: '#EF4444' }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              className="fixed right-3 top-[76px] w-[calc(100vw-24px)] sm:absolute sm:right-0 sm:top-auto sm:mt-2 sm:w-80 rounded-2xl border border-black/10 bg-white shadow-xl overflow-hidden z-50"
            >
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <p className="text-sm font-semibold" style={{ color: brand.text }}>Notifications</p>
                <div className="flex items-center gap-3">
                  {dismissedCount > 0 && (
                    <button
                      onClick={() => void restoreAll()}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Restore hidden
                    </button>
                  )}
                  <button onClick={fetchAll} className="text-xs text-slate-400 hover:text-slate-600">
                    Refresh
                  </button>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {loading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2].map((n) => (
                      <div key={n} className="h-12 rounded bg-slate-100 animate-pulse" />
                    ))}
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-sm text-slate-400">
                      {dismissedCount > 0
                        ? 'Active alerts are cleared. Restore hidden alerts if needed.'
                        : 'All clear. No notifications.'}
                    </p>
                  </div>
                ) : (
                  notifications.map((n) => {
                    const style = NOTIF_ICONS[n.severity] ?? NOTIF_ICONS.info;
                    return (
                      <div
                        key={n.id}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50"
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: style.bg }}
                        >
                          {n.severity === 'critical' ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={style.color} strokeWidth="2">
                              <path d="M12 9v4" /><path d="M12 17h.01" />
                              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                            </svg>
                          ) : n.severity === 'warning' ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={style.color} strokeWidth="2">
                              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={style.color} strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium" style={{ color: brand.text }}>{n.title}</p>
                              <p className="text-xs text-slate-500">{n.message}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void dismiss(n.id)}
                              className="text-[10px] text-slate-400 hover:text-slate-600 shrink-0"
                            >
                              Dismiss
                            </button>
                          </div>
                          {n.href && (
                            <a
                              href={n.href}
                              onClick={() => setOpen(false)}
                              className="mt-1 inline-block text-[11px] font-medium"
                              style={{ color: brand.primary }}
                            >
                              Open
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
