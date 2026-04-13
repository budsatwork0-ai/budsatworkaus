'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuth } from '@/app/hooks/useAuth';
import { brand, glass } from '@/app/ui/theme';
import { useEmployee } from '@/app/hooks/useEmployee';
import { SERVICE_TYPE_LABELS } from '@/types/orders';
import type { ServiceType } from '@/types/orders';

// Estimated hours per service type
const SERVICE_HOURS: Record<string, number> = {
  windows: 2, cleaning: 3, yard: 2, dump: 2, auto: 3, laundry_sneakers: 1.5,
};

const SERVICE_COLORS: Record<string, string> = {
  windows: '#3B82F6', cleaning: '#8B5CF6', yard: '#10B981',
  dump: '#F59E0B', auto: '#EC4899', laundry_sneakers: '#6366F1',
};

const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface WeekJob {
  id: string;
  status: string;
  orders: {
    service_type: string;
    scheduled_date: string | null;
    final_price: number;
  } | null;
}

interface CrewStats {
  availableJobs: number;
  todayJobs: number;
  completedThisMonth: number;
  weekEarnings: number;
}

type DocAlert = {
  doc_type: string;
  expires_at: string | null;
  status: string;
};

const DOC_LABELS: Record<string, string> = {
  wwcc: 'WWCC', police_check: 'Police Check', first_aid: 'First Aid',
  drivers_license: "Driver's License", abn: 'ABN', insurance: 'Insurance',
  ndis_screening: 'NDIS Screening',
};

function getWeekDates(): Date[] {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export default function CrewHomePage() {
  const { user } = useAuth();
  const { employee, isLoading: employeeLoading, needsSetup } = useEmployee();
  const [stats, setStats] = useState<CrewStats>({ availableJobs: 0, todayJobs: 0, completedThisMonth: 0, weekEarnings: 0 });
  const [weekJobs, setWeekJobs] = useState<WeekJob[]>([]);
  const [expiringDocs, setExpiringDocs] = useState<DocAlert[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);

  const weekDates = useMemo(() => getWeekDates(), []);
  // Memoised so it doesn't shift value between renders and is stable in the
  // useEffect dependency array (no re-fetch until the next component mount).
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  useEffect(() => {
    if (!employee) return;

    setStatsError(false);

    async function loadData() {
      // Fetch each endpoint independently — a single failing API should not
      // zero-out every stat card without any user feedback.
      const safe = <T,>(p: Promise<T>, fallback: T): Promise<T> =>
        p.catch(() => { setStatsError(true); return fallback; });

      const [availRes, earningsRes, docsRes, weekRes] = await Promise.all([
        safe(fetch('/api/crew/jobs?limit=0').then((r) => r.json()), { total: 0 }),
        safe(fetch('/api/crew/earnings').then((r) => r.json()), { thisWeek: 0, thisMonth: 0, jobs: [] }),
        safe(fetch('/api/crew/documents').then((r) => r.json()), { documents: [] }),
        safe(fetch('/api/crew/my-jobs').then((r) => r.json()), { assignments: [] }),
      ]);

      const allAssignments = weekRes.assignments || [];
      const todayCount = allAssignments.filter(
        (a: { orders?: { scheduled_date?: string | null } }) =>
          a.orders?.scheduled_date === todayStr
      ).length;

      setStats({
        availableJobs: availRes.total ?? 0,
        todayJobs: todayCount,
        completedThisMonth: earningsRes.jobs?.length ?? 0,
        weekEarnings: earningsRes.thisWeek ?? 0,
      });

      setWeekJobs(allAssignments);

      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const expiring = (docsRes.documents || []).filter((d: DocAlert) =>
        d.expires_at && new Date(d.expires_at) <= thirtyDaysFromNow && d.status !== 'expired'
      );
      setExpiringDocs(expiring);
      setStatsLoading(false);
    }

    loadData();
  }, [employee, todayStr]);

  // Group jobs by date for the mini-calendar
  const jobsByDate = useMemo(() => {
    const map = new Map<string, WeekJob[]>();
    for (const job of weekJobs) {
      const date = job.orders?.scheduled_date;
      if (date) {
        if (!map.has(date)) map.set(date, []);
        map.get(date)!.push(job);
      }
    }
    return map;
  }, [weekJobs]);

  // Calculate this-week stats
  const weekStats = useMemo(() => {
    const weekStart = weekDates[0].toISOString().split('T')[0];
    const weekEnd = weekDates[6].toISOString().split('T')[0];
    const thisWeekJobs = weekJobs.filter((j) => {
      const d = j.orders?.scheduled_date;
      return d && d >= weekStart && d <= weekEnd && j.status !== 'declined';
    });
    const estHours = thisWeekJobs.reduce(
      (sum, j) => sum + (SERVICE_HOURS[j.orders?.service_type ?? ''] ?? 2), 0
    );
    return { count: thisWeekJobs.length, estHours };
  }, [weekJobs, weekDates]);

  if (employeeLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: brand.primary, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (needsSetup) {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <h1 className="text-2xl font-bold mb-2" style={{ color: brand.text }}>Welcome to the Crew!</h1>
        <p className="mb-6" style={{ color: brand.muted }}>Let&apos;s get you set up. Complete onboarding to unlock available jobs.</p>
        <Link href="/crew/onboarding" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-medium" style={{ background: brand.primary }}>
          Start Onboarding
        </Link>
      </div>
    );
  }

  const onboardingComplete = employee?.onboarding_complete;
  const firstName = employee?.full_name?.split(' ')[0] || (user?.user_metadata?.full_name as string)?.split(' ')[0] || 'Crew member';
  const today = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });

  const statCards = [
    { label: "Today's Jobs", value: String(stats.todayJobs), color: brand.primary, href: '/crew/my-jobs' },
    { label: 'This Week', value: `$${stats.weekEarnings.toFixed(0)}`, color: '#10B981', href: '/crew/earnings' },
    { label: 'Available', value: String(stats.availableJobs), color: '#3B82F6', href: '/crew/jobs' },
    { label: 'Completed', value: String(stats.completedThisMonth), color: '#8B5CF6', href: '/crew/my-jobs' },
  ];

  const quickActions = [
    { href: '/crew/jobs', label: 'Browse Jobs', desc: 'Find and accept new jobs', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={brand.primary} strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
    ) },
    { href: '/crew/schedule', label: 'View Schedule', desc: 'See your upcoming calendar', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={brand.primary} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
    ) },
    { href: '/crew/documents', label: 'Documents', desc: 'Upload and manage documents', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={brand.primary} strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
    ) },
    { href: '/crew/profile', label: 'Edit Profile', desc: 'Update your details', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={brand.primary} strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
    ) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: brand.text }}>Hey {firstName}!</h1>
        <p className="mt-1 text-sm" style={{ color: brand.muted }}>{today}</p>
      </div>

      {!onboardingComplete && (
        <Link href="/crew/onboarding" className={`block ${glass} rounded-2xl p-5 transition-transform hover:scale-[1.005]`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold" style={{ color: brand.text }}>Complete your onboarding</p>
              <p className="text-sm mt-0.5" style={{ color: brand.muted }}>Finish all sections to start accepting jobs.</p>
            </div>
            <span className="shrink-0 px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(251,191,36,0.15)', color: '#92400E' }}>Incomplete</span>
          </div>
        </Link>
      )}

      {/* Document expiry alerts */}
      {expiringDocs.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
          <div className="flex items-start gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" className="shrink-0 mt-0.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: '#92400E' }}>Documents expiring soon</p>
              <div className="mt-2 space-y-2">
                {expiringDocs.map((doc) => (
                  <div key={doc.doc_type} className="flex items-center justify-between gap-3 bg-white/60 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-xs font-medium" style={{ color: '#92400E' }}>{DOC_LABELS[doc.doc_type] || doc.doc_type}</p>
                      <p className="text-[11px]" style={{ color: '#B45309' }}>
                        Expires {doc.expires_at ? new Date(doc.expires_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : 'soon'}
                      </p>
                    </div>
                    <Link
                      href={`/crew/documents?upload=${doc.doc_type}`}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                      style={{ background: '#92400E' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      Re-upload
                    </Link>
                  </div>
                ))}
              </div>
              <Link href="/crew/documents" className="inline-block mt-2 text-xs font-medium underline" style={{ color: '#92400E' }}>
                View all documents
              </Link>
            </div>
          </div>
        </div>
      )}

      {statsError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-2.5 flex items-center gap-2 text-xs text-amber-800">
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
          </svg>
          Some stats could not be loaded — figures below may be incomplete.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link href={card.href} className={`${glass} rounded-2xl p-4 block transition-transform hover:scale-[1.01]`}>
              <p className="text-[11px] uppercase tracking-wider" style={{ color: brand.muted }}>{card.label}</p>
              {statsLoading ? (
                <div className="h-8 w-12 rounded bg-slate-100 animate-pulse mt-1" />
              ) : (
                <p className="text-2xl font-bold mt-1" style={{ color: card.color }}>{card.value}</p>
              )}
            </Link>
          </motion.div>
        ))}
      </div>

      {/* This Week — mini calendar + hours summary */}
      <div className={`${glass} rounded-2xl p-5`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold" style={{ color: brand.text }}>This Week</h2>
          <Link href="/crew/schedule" className="text-xs font-medium underline" style={{ color: brand.primary }}>
            Full schedule
          </Link>
        </div>

        {/* 7-day mini calendar */}
        <div className="grid grid-cols-7 gap-1.5 mb-4">
          {weekDates.map((date, i) => {
            const dateStr = date.toISOString().split('T')[0];
            const isToday = dateStr === todayStr;
            const dayJobs = jobsByDate.get(dateStr) || [];

            return (
              <div key={dateStr} className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-medium uppercase" style={{ color: brand.muted }}>
                  {DAYS_SHORT[i]}
                </span>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isToday ? 'text-white' : ''}`}
                  style={isToday ? { background: brand.primary } : { color: brand.text }}
                >
                  {date.getDate()}
                </div>
                {/* Job colour dots */}
                <div className="flex flex-wrap justify-center gap-0.5 min-h-[10px]">
                  {dayJobs.slice(0, 3).map((job) => {
                    const color = SERVICE_COLORS[job.orders?.service_type ?? ''] || brand.primary;
                    return (
                      <span key={job.id} className="w-2 h-2 rounded-full" style={{ background: color }} />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Hours + earnings summary strip */}
        {statsLoading ? (
          <div className="h-10 rounded-xl bg-slate-100 animate-pulse" />
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(15,61,46,0.06)' }}>
              <p className="text-lg font-bold" style={{ color: brand.primary }}>{weekStats.count}</p>
              <p className="text-[11px] mt-0.5" style={{ color: brand.muted }}>Jobs</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(59,130,246,0.08)' }}>
              <p className="text-lg font-bold" style={{ color: '#3B82F6' }}>~{weekStats.estHours.toFixed(1)}h</p>
              <p className="text-[11px] mt-0.5" style={{ color: brand.muted }}>Est. hours</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(16,185,129,0.08)' }}>
              <p className="text-lg font-bold" style={{ color: '#10B981' }}>${stats.weekEarnings.toFixed(0)}</p>
              <p className="text-[11px] mt-0.5" style={{ color: brand.muted }}>Earned</p>
            </div>
          </div>
        )}

        {/* Today's jobs detail */}
        {(() => {
          const todayJobs = jobsByDate.get(todayStr) || [];
          if (todayJobs.length === 0) return null;
          return (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: brand.muted }}>Today</p>
              {todayJobs.map((job) => {
                const color = SERVICE_COLORS[job.orders?.service_type ?? ''] || brand.primary;
                const label = SERVICE_TYPE_LABELS[job.orders?.service_type as ServiceType] || job.orders?.service_type || '';
                const estH = SERVICE_HOURS[job.orders?.service_type ?? ''] ?? 2;
                return (
                  <Link
                    key={job.id}
                    href={`/crew/jobs/${job.id}`}
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 transition-opacity hover:opacity-80"
                    style={{ background: `${color}12`, borderLeft: `3px solid ${color}` }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color }}>{label}</p>
                      <p className="text-[11px]" style={{ color: brand.muted }}>~{estH}h</p>
                    </div>
                    <p className="text-sm font-bold" style={{ color: brand.text }}>
                      ${job.orders?.final_price.toFixed(0)}
                    </p>
                  </Link>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Quick Actions */}
      <div className={`${glass} rounded-2xl p-5`}>
        <h2 className="font-semibold mb-4" style={{ color: brand.text }}>Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-center gap-3 p-3 rounded-xl border transition-colors hover:bg-slate-50"
              style={{ borderColor: brand.border }}
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(15,61,46,0.08)' }}>
                {action.icon}
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: brand.text }}>{action.label}</p>
                <p className="text-xs" style={{ color: brand.muted }}>{action.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
