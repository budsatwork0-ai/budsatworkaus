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
  const [errorDismissed, setErrorDismissed] = useState(false);

  const weekDates = useMemo(() => getWeekDates(), []);
  // Memoised so it doesn't shift value between renders and is stable in the
  // useEffect dependency array (no re-fetch until the next component mount).
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  useEffect(() => {
    if (!employee) return;

    setStatsError(false);
    setErrorDismissed(false);

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
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: brand.text }}>Hey, {firstName} 👋</h1>
        <p className="text-sm mt-0.5" style={{ color: brand.muted }}>{today}</p>
      </div>

      {/* Onboarding prompt */}
      {!onboardingComplete && (
        <Link href="/crew/onboarding"
          className={`flex items-center justify-between p-4 rounded-2xl border ${glass}`}
          style={{ borderColor: '#F59E0B33', background: 'rgba(245,158,11,0.08)' }}
        >
          <div>
            <p className="font-semibold text-sm" style={{ color: '#F59E0B' }}>Complete your onboarding</p>
            <p className="text-xs mt-0.5" style={{ color: brand.muted }}>Finish setup to unlock available jobs</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
        </Link>
      )}

      {/* Expiring docs alert */}
      {expiringDocs.length > 0 && (
        <Link href="/crew/documents"
          className={`flex items-center justify-between p-4 rounded-2xl border ${glass}`}
          style={{ borderColor: '#EF444433', background: 'rgba(239,68,68,0.08)' }}
        >
          <div>
            <p className="font-semibold text-sm" style={{ color: '#EF4444' }}>
              {expiringDocs.length} document{expiringDocs.length > 1 ? 's' : ''} expiring soon
            </p>
            <p className="text-xs mt-0.5" style={{ color: brand.muted }}>
              {expiringDocs.map((d) => DOC_LABELS[d.doc_type] ?? d.doc_type).join(', ')}
            </p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
        </Link>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map((card) => (
          <Link key={card.label} href={card.href}
            className={`flex flex-col gap-1 p-4 rounded-2xl border ${glass}`}
            style={{ borderColor: `${card.color}33` }}
          >
            <span className="text-2xl font-bold" style={{ color: card.color }}>
              {statsLoading ? '—' : card.value}
            </span>
            <span className="text-xs" style={{ color: brand.muted }}>{card.label}</span>
          </Link>
        ))}
      </div>

      {/* Stats error banner */}
      {statsError && !errorDismissed && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border ${glass}`}
          style={{ borderColor: `${brand.primary}40`, background: 'rgba(15,61,46,0.18)' }}
        >
          <button
            onClick={() => {
              setErrorDismissed(false);
              setStatsLoading(true);
              setStatsError(false);
              // Re-trigger load by briefly toggling — reload via location for simplicity
              window.location.reload();
            }}
            className="flex-1 text-left text-xs"
            style={{ color: brand.muted }}
          >
            ⚠️ Some stats may be unavailable —{' '}
            <span className="underline underline-offset-2" style={{ color: brand.primary }}>tap to retry</span>
          </button>
          <button
            onClick={() => setErrorDismissed(true)}
            aria-label="Dismiss"
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: brand.muted }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </motion.div>
      )}

      {/* This-week summary */}
      <div className={`p-4 rounded-2xl border ${glass}`}>
        <p className="text-sm font-semibold mb-3" style={{ color: brand.text }}>This Week</p>
        <div className="flex gap-4 mb-4">
          <div>
            <p className="text-xl font-bold" style={{ color: brand.primary }}>{weekStats.count}</p>
            <p className="text-xs" style={{ color: brand.muted }}>jobs</p>
          </div>
          <div>
            <p className="text-xl font-bold" style={{ color: brand.primary }}>{weekStats.estHours}h</p>
            <p className="text-xs" style={{ color: brand.muted }}>est. hours</p>
          </div>
        </div>
        {/* Mini week calendar */}
        <div className="grid grid-cols-7 gap-1">
          {weekDates.map((date, i) => {
            const dateStr = date.toISOString().split('T')[0];
            const jobs = jobsByDate.get(dateStr) ?? [];
            const isToday = dateStr === todayStr;
            return (
              <div key={dateStr} className="flex flex-col items-center gap-1">
                <span className="text-xs" style={{ color: brand.muted }}>{DAYS_SHORT[i]}</span>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium"
                  style={{
                    background: isToday ? brand.primary : 'transparent',
                    color: isToday ? '#fff' : brand.text,
                    border: isToday ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {date.getDate()}
                </div>
                {jobs.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-0.5">
                    {jobs.slice(0, 3).map((j) => (
                      <div
                        key={j.id}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: SERVICE_COLORS[j.orders?.service_type ?? ''] ?? brand.primary }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <p className="text-sm font-semibold mb-3" style={{ color: brand.text }}>Quick Actions</p>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}
              className={`flex items-start gap-3 p-4 rounded-2xl border ${glass}`}
            >
              <div className="mt-0.5">{action.icon}</div>
              <div>
                <p className="text-sm font-medium" style={{ color: brand.text }}>{action.label}</p>
                <p className="text-xs mt-0.5" style={{ color: brand.muted }}>{action.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
