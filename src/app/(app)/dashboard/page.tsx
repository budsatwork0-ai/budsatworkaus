'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { brand } from '@/app/ui/theme';
import { useDashboardData } from './hooks/useDashboardData';
import { ErrorMessage, RefreshIcon } from './components/shared';
import { formatCurrency, formatRelativeTime } from '@/lib/dashboard/utils';
import { jobStatusLabels, type JobRecord, type DashboardCrewMember, type DashboardQuote } from '@/types/dashboard';

type AttentionTone = 'red' | 'amber' | 'blue' | 'emerald';

type AttentionItem = {
  key: string;
  title: string;
  meta: string;
  href: string;
  tone: AttentionTone;
  cta: string;
};

type QuickAction = {
  label: string;
  description: string;
  href: string;
};

type QuoteStatus =
  | 'submitted'
  | 'in_review'
  | 'finalized'
  | 'payment_pending'
  | 'paid'
  | 'denied'
  | 'cancelled';

type DomainCardData = {
  key: string;
  label: string;
  primary: string;
  secondary: string;
  href: string;
  color: string;
  badge?: string;
  badgeColor?: string;
  icon: React.ReactNode;
};

const domainIcons = {
  finance: <Glyph d={['M12 1v22', 'M17 5H9.5a3.5 3.5 0 0 0 0 7H14.5a3.5 3.5 0 0 1 0 7H6']} />,
  operations: <Glyph d={['M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z']} />,
  sales: <Glyph d={['M23 6l-9.5 9.5-5-5L1 18', 'M17 6h6v6']} />,
  crew: <Glyph d={['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75']} />,
  support: <Glyph d={['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z']} />,
  analytics: <Glyph d={['M18 20V10', 'M12 20V4', 'M6 20v-6']} />,
  engineering: <Glyph d={['M16 18l6-6-6-6', 'M8 6l-6 6 6 6']} />,
  design: <Glyph d={['M12 19l7-7 3 3-7 7-3-3z', 'M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z', 'M2 2l7.586 7.586']} />,
  productivity: <Glyph d={['M9 11l3 3L22 4', 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11']} />,
};

function normalizeQuoteStatus(status: string): QuoteStatus {
  if (status === 'pending') return 'submitted';
  if (status === 'approved') return 'finalized';
  if (status === 'adjusted') return 'in_review';
  if (status === 'converted') return 'paid';
  if (
    status === 'submitted' ||
    status === 'in_review' ||
    status === 'finalized' ||
    status === 'payment_pending' ||
    status === 'paid' ||
    status === 'denied' ||
    status === 'cancelled'
  ) {
    return status;
  }
  return 'submitted';
}

function getQuoteValue(quote: DashboardQuote) {
  return Number(quote.reviewed_total ?? quote.submitted_total ?? quote.total ?? 0);
}

function compareJobs(a: Pick<JobRecord, 'scheduledDate' | 'scheduledTime'>, b: Pick<JobRecord, 'scheduledDate' | 'scheduledTime'>) {
  const left = new Date(`${a.scheduledDate || '9999-12-31'}T${a.scheduledTime || '23:59:59'}`);
  const right = new Date(`${b.scheduledDate || '9999-12-31'}T${b.scheduledTime || '23:59:59'}`);
  return left.getTime() - right.getTime();
}

function getInitials(name: string | null | undefined) {
  if (!name) return 'BW';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function toneStyles(tone: AttentionTone) {
  switch (tone) {
    case 'red':
      return { bg: '#FEF2F2', fg: '#B91C1C' };
    case 'amber':
      return { bg: '#FFFBEB', fg: '#B45309' };
    case 'blue':
      return { bg: '#EFF6FF', fg: '#1D4ED8' };
    case 'emerald':
      return { bg: '#ECFDF5', fg: '#047857' };
  }
}

export default function DashboardHome() {
  const { metrics, jobs, recentActivity, lastUpdated, isLoading, error, refetch, crew, quotes, applicantCount } = useDashboardData();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [moneyExpanded, setMoneyExpanded] = useState(false);
  const [scheduleView, setScheduleView] = useState<'Day' | 'Week' | 'Month'>('Day');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [jobMutating, setJobMutating] = useState<string | null>(null);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  const mutateJob = useCallback(async (jobId: string, payload: Record<string, unknown>, successMsg: string) => {
    setJobMutating(jobId);
    setOpenMenu(null);
    try {
      const res = await fetch(`/api/orders/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed');
      await refetch();
      toast.success(successMsg);
    } catch {
      toast.error('Action failed — try again.');
    } finally {
      setJobMutating(null);
    }
  }, [refetch]);

  const todayKey = new Date().toISOString().split('T')[0];

  const todayJobs = useMemo(
    () => jobs.filter((job) => job.scheduledDate === todayKey).sort(compareJobs),
    [jobs, todayKey]
  );
  const unscheduledJobs = useMemo(
    () => jobs.filter((job) => !job.scheduledDate),
    [jobs]
  );
  const inProgressCount = useMemo(
    () => jobs.filter((job) => job.status === 'in_progress').length,
    [jobs]
  );
  const completedJobs = metrics?.operationsSnapshot.jobsCompleted ?? 0;
  const nextScheduledJob = useMemo(() => {
    const now = Date.now();
    return jobs
      .filter((job) => job.scheduledDate)
      .sort(compareJobs)
      .find((job) => {
        const when = new Date(`${job.scheduledDate}T${job.scheduledTime || '23:59:59'}`).getTime();
        return when >= now;
      }) ?? null;
  }, [jobs]);

  const monthRevenue = metrics?.goals.currentRevenue ?? 0;
  const monthRevenueTarget = metrics?.goals.monthlyRevenueTarget ?? 0;
  const monthJobs = metrics?.goals.currentJobs ?? 0;
  const monthJobsTarget = metrics?.goals.monthlyJobsTarget ?? 0;
  const receivableTotal = metrics?.outstandingReceivables.total ?? 0;
  const payableTotal = metrics?.upcomingPayables.total ?? 0;
  const cashBalance = metrics?.cashBalance ?? 0;
  const overdueAmount = metrics?.alerts.overdueAmount ?? 0;
  const overdueCount = metrics?.alerts.overdueCount ?? 0;
  const dueSoonCount = metrics?.alerts.dueSoonCount ?? 0;
  const dueSoonAmount = metrics?.alerts.dueSoonAmount ?? 0;
  const netProfit = metrics?.netProfit.amount ?? 0;
  const grossMargin = metrics?.operationsSnapshot.grossMargin ?? 0;
  const averageJobValue = metrics?.operationsSnapshot.averageJobValue ?? 0;
  const revenueProgress = monthRevenueTarget > 0 ? Math.min(100, Math.round((monthRevenue / monthRevenueTarget) * 100)) : 0;
  const jobsProgress = monthJobsTarget > 0 ? Math.min(100, Math.round((monthJobs / monthJobsTarget) * 100)) : 0;

  const normalizedQuotes = useMemo(
    () => quotes.map((quote) => ({ ...quote, normalizedStatus: normalizeQuoteStatus(quote.status) })),
    [quotes]
  );

  const actionableQuotes = useMemo(
    () => normalizedQuotes.filter((quote) => ['submitted', 'in_review', 'finalized', 'payment_pending'].includes(quote.normalizedStatus)),
    [normalizedQuotes]
  );
  const bookedQuotes = useMemo(
    () => normalizedQuotes.filter((quote) => ['finalized', 'payment_pending', 'paid'].includes(quote.normalizedStatus)).length,
    [normalizedQuotes]
  );
  const quoteConversion = actionableQuotes.length > 0
    ? Math.round((bookedQuotes / normalizedQuotes.filter((quote) => !['denied', 'cancelled'].includes(quote.normalizedStatus)).length) * 100)
    : 0;

  const attentionItems: AttentionItem[] = useMemo(() => {
    const items: AttentionItem[] = [];

    if (overdueCount > 0) {
      items.push({
        key: 'overdue',
        title: `${overdueCount} overdue invoice${overdueCount === 1 ? '' : 's'}`,
        meta: `${formatCurrency(overdueAmount)} owed across receivables that need follow-up.`,
        href: '/dashboard/invoices',
        tone: 'red',
        cta: 'Chase now',
      });
    }

    if (actionableQuotes.length > 0) {
      const oldestQuote = actionableQuotes[actionableQuotes.length - 1];
      items.push({
        key: 'quotes',
        title: `${actionableQuotes.length} quote${actionableQuotes.length === 1 ? '' : 's'} awaiting action`,
        meta: oldestQuote ? `Oldest quote from ${formatRelativeTime(oldestQuote.created_at)}.` : 'Review submitted and in-review quotes.',
        href: '/dashboard/quotes',
        tone: 'amber',
        cta: 'Review',
      });
    }

    if (applicantCount > 0) {
      items.push({
        key: 'applicants',
        title: `${applicantCount} new crew applicant${applicantCount === 1 ? '' : 's'}`,
        meta: 'Fresh intake applications waiting to be triaged.',
        href: '/dashboard/applicants',
        tone: 'blue',
        cta: 'Open intake',
      });
    }

    if (unscheduledJobs.length > 0) {
      items.push({
        key: 'jobs',
        title: `${unscheduledJobs.length} unscheduled job${unscheduledJobs.length === 1 ? '' : 's'}`,
        meta: 'Jobs created without a confirmed date are sitting in the queue.',
        href: '/dashboard/schedule',
        tone: 'emerald',
        cta: 'Place jobs',
      });
    }

    return items;
  }, [actionableQuotes, applicantCount, overdueAmount, overdueCount, unscheduledJobs.length]);

  const quickActions: QuickAction[] = [
    {
      label: 'Schedule job',
      description: 'Review unscheduled jobs and place them on the calendar.',
      href: '/dashboard/schedule',
    },
    {
      label: 'Create invoice',
      description: 'Issue new billing or follow up balances that are still outstanding.',
      href: '/dashboard/invoices',
    },
    {
      label: 'Open quotes',
      description: 'Review submitted quotes and move approved work toward booking.',
      href: '/dashboard/quotes',
    },
    {
      label: 'Manage customers',
      description: 'Jump into customer records, notes and service history.',
      href: '/dashboard/customers',
    },
  ];

  const pipelineStages = useMemo(() => {
    const stages = [
      { key: 'submitted', label: 'Requested', statuses: ['submitted'] as QuoteStatus[] },
      { key: 'in_review', label: 'In Review', statuses: ['in_review'] as QuoteStatus[] },
      { key: 'approved', label: 'Approved', statuses: ['finalized', 'payment_pending'] as QuoteStatus[] },
      { key: 'won', label: 'Won', statuses: ['paid'] as QuoteStatus[] },
      { key: 'lost', label: 'Lost', statuses: ['denied', 'cancelled'] as QuoteStatus[] },
    ];

    return stages.map((stage) => {
      const quotes = normalizedQuotes.filter((quote) => stage.statuses.includes(quote.normalizedStatus));
      return {
        ...stage,
        count: quotes.length,
        value: quotes.reduce((sum, quote) => sum + getQuoteValue(quote), 0),
      };
    });
  }, [normalizedQuotes]);
  const pipelineMax = Math.max(1, ...pipelineStages.map((stage) => stage.count));

  const crewSummary = useMemo(() => ({
    active: crew.filter((m) => m.status === 'active'),
  }), [crew]);

  const visibleCrew = useMemo(
    () => [...crew].sort((a, b) => (b.status === 'active' ? 1 : 0) - (a.status === 'active' ? 1 : 0)).slice(0, 4),
    [crew]
  );

  const topServices = (metrics?.revenueByService ?? []).slice(0, 2);
  const crewUtilisation = crew.length > 0
    ? Math.round((crewSummary.active.length / crew.length) * 100)
    : 0;
  const revenueChange = metrics?.goals.revenueChange ?? 0;

  const domainCards: DomainCardData[] = [
    {
      key: 'finance',
      label: 'Finance',
      primary: `${revenueProgress}% of target · ${grossMargin}% margin`,
      secondary: `${formatCurrency(monthRevenue)} revenue · ${formatCurrency(receivableTotal)} outstanding`,
      href: '/dashboard/invoices',
      color: brand.primary,
      badge: overdueCount > 0 ? `${overdueCount} overdue` : undefined,
      badgeColor: '#ef4444',
      icon: domainIcons.finance,
    },
    {
      key: 'operations',
      label: 'Operations',
      primary: `${todayJobs.length} today · ${unscheduledJobs.length} unscheduled`,
      secondary: `${completedJobs} jobs completed this month · avg ${formatCurrency(averageJobValue)}`,
      href: '/dashboard/schedule',
      color: '#6366f1',
      badge: inProgressCount > 0 ? `${inProgressCount} live` : undefined,
      badgeColor: '#6366f1',
      icon: domainIcons.operations,
    },
    {
      key: 'sales',
      label: 'Sales Pipeline',
      primary: `${actionableQuotes.length} actionable quotes`,
      secondary: `${formatCurrency(pipelineStages.reduce((sum, stage) => sum + stage.value, 0))} quote value in play`,
      href: '/dashboard/quotes',
      color: '#f59e0b',
      badge: quoteConversion > 0 ? `${quoteConversion}% book` : undefined,
      badgeColor: '#f59e0b',
      icon: domainIcons.sales,
    },
    {
      key: 'crew',
      label: 'HR & Crew',
      primary: `${crewSummary.active.length} of ${crew.length} crew active`,
      secondary: applicantCount > 0 ? `${applicantCount} new applicant${applicantCount === 1 ? '' : 's'} in intake` : 'No pending intake applications',
      href: '/dashboard/crew',
      color: '#8b5cf6',
      icon: domainIcons.crew,
    },
    {
      key: 'productivity',
      label: 'Automations',
      primary: `${recentActivity.length} recent events`,
      secondary: monthJobsTarget > 0 ? `${jobsProgress}% of jobs target reached` : 'Automations and workflows',
      href: '/dashboard/automations',
      color: '#f97316',
      icon: domainIcons.productivity,
    },
  ];

  if (error) {
    return (
      <div className="grid gap-6 w-full px-3 sm:px-4 md:px-10 lg:px-12 pb-14">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold" style={{ color: brand.primary }}>Operations Console</h1>
        </div>
        <ErrorMessage message={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="grid gap-5 w-full px-3 sm:px-4 md:px-8 xl:px-10 pb-14">
      {openMenu && <div className="fixed inset-0 z-[5]" onClick={() => setOpenMenu(null)} />}
      <motion.section
        className="grid gap-4 rounded-[22px] border bg-white/86 px-4 py-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] backdrop-blur-[18px] sm:px-6"
        style={{ borderColor: '#d7e7dd' }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#10b981' }}>
              Operations Console · {new Date().toLocaleDateString('en-AU', { weekday: 'long' })}
            </p>
            <div className="flex items-center gap-3">
              <h1 className="text-[30px] font-extrabold tracking-[-0.03em] leading-[1.05]" style={{ color: brand.primary }}>
                {greet()}, Jackson.
              </h1>
              <motion.button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                animate={isRefreshing ? { rotate: 360 } : { rotate: 0 }}
                transition={isRefreshing ? { repeat: Infinity, duration: 0.7, ease: 'linear' } : { duration: 0.2 }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm"
                aria-label="Refresh dashboard"
              >
                <RefreshIcon />
              </motion.button>
            </div>
            <p className="text-sm text-slate-500">
              {todayJobs.length > 0
                ? `${todayJobs.length} job${todayJobs.length !== 1 ? 's' : ''} scheduled today · ${crewSummary.active.length} crew active${unscheduledJobs.length > 0 ? ` · ${unscheduledJobs.length} unscheduled` : ''}`
                : `No jobs scheduled today · ${crewSummary.active.length} crew active`}
            </p>
            {lastUpdated && (
              <p className="text-[11px] text-slate-400">
                Updated {formatRelativeTime(lastUpdated)}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusChip
              label={`${attentionItems.length} items need action`}
              tone="emerald"
            />
            <StatusChip
              label={`${todayJobs.length} jobs scheduled today`}
              tone="blue"
            />
            <StatusChip
              label={`${crewSummary.active.length} active crew`}
              tone="amber"
            />
          </div>
        </div>
      </motion.section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Revenue · MTD"
          value={formatCurrency(monthRevenue)}
          chip={revenueChange !== 0 ? `${revenueChange > 0 ? '+' : ''}${revenueChange}% vs last month` : `Target ${revenueProgress}%`}
          chipTone={revenueChange >= 0 ? 'emerald' : 'red'}
          note={`${formatCurrency(monthRevenueTarget)} target · ${revenueProgress}% reached`}
          loading={isLoading}
        />
        <MetricCard
          label="Jobs this month"
          value={String(monthJobs)}
          chip={`${jobsProgress}% of target`}
          chipTone="blue"
          note={`${monthJobsTarget} target · ${todayJobs.length} today`}
          loading={isLoading}
        />
        <MetricCard
          label="Quote pipeline"
          value={`${actionableQuotes.length}`}
          chip={quoteConversion > 0 ? `${quoteConversion}% book rate` : `${normalizedQuotes.length} total`}
          chipTone="amber"
          note={`${formatCurrency(pipelineStages.reduce((sum, stage) => sum + stage.value, 0))} in quote value`}
          loading={isLoading}
        />
        <MetricCard
          label="Outstanding"
          value={formatCurrency(receivableTotal)}
          chip={overdueCount > 0 ? `${overdueCount} overdue` : 'All current'}
          chipTone={overdueCount > 0 ? 'red' : 'emerald'}
          note={`${formatCurrency(payableTotal)} payables due soon`}
          loading={isLoading}
        />
      </div>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.92fr)]">
        <div className="grid gap-5">
          <SectionShell
            title="Today"
            subtitle="Live schedule data, next confirmed stop, and dispatch context."
            actionHref="/dashboard/schedule"
            actionLabel="Open schedule"
          >
            <div className="grid gap-3 md:grid-cols-3">
              <MiniStat label="Today's jobs" value={String(todayJobs.length)} />
              <MiniStat label="In progress" value={String(inProgressCount)} />
              <MiniStat label="Completed MTD" value={String(completedJobs)} />
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.85fr)]">
              <div className="overflow-hidden rounded-[22px] border border-black/5 bg-white/90">
                <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3.5">
                  <div>
                    <p className="text-[15px] font-bold text-slate-900">Today's schedule</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {new Date().toLocaleDateString('en-AU', { weekday: 'long' })} · {todayJobs.length} job{todayJobs.length !== 1 ? 's' : ''} · {crewSummary.active.length} crew active
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-slate-200 bg-slate-50 p-0.5">
                    {(['Day', 'Week', 'Month'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setScheduleView(v)}
                        className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
                          scheduleView === v ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                {scheduleView !== 'Day' ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-sm text-slate-500 mb-3">Full {scheduleView.toLowerCase()} view on the schedule page.</p>
                    <Link
                      href="/dashboard/schedule"
                      className="inline-flex rounded-full border px-4 py-2 text-xs font-semibold"
                      style={{ borderColor: '#d7e7dd', color: brand.primary }}
                    >
                      Open schedule →
                    </Link>
                  </div>
                ) : todayJobs.length === 0 ? (
                  <EmptyPanel message="No jobs are scheduled for today." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                          <th className="px-4 py-2.5">Time</th>
                          <th className="px-4 py-2.5">Customer</th>
                          <th className="px-4 py-2.5">Service</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-2 py-2.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {todayJobs.slice(0, 6).map((job) => (
                          <tr key={job.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50/50">
                            <td className="px-4 py-3.5 align-middle">
                              <p className="tabular-nums font-bold text-slate-900">{job.scheduledTime || 'TBD'}</p>
                            </td>
                            <td className="px-4 py-3.5 align-middle">
                              <p className="font-semibold text-slate-900">{job.customer}</p>
                              {job.address && <p className="mt-0.5 text-[11px] text-slate-400">{job.address}</p>}
                            </td>
                            <td className="px-4 py-3.5 align-middle">
                              <p className="text-slate-700">{job.service}</p>
                            </td>
                            <td className="px-4 py-3.5 align-middle">
                              <span className={scheduleStatusPill(job.status)}>{scheduleStatusLabel(job.status)}</span>
                            </td>
                            <td className="relative px-2 py-3.5 align-middle">
                              <button
                                type="button"
                                disabled={jobMutating === job.id}
                                onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === job.id ? null : job.id); }}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 disabled:opacity-40"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                  <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
                                </svg>
                              </button>
                              {openMenu === job.id && (
                                <div className="absolute right-0 top-full z-10 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                                  <Link
                                    href={`/dashboard/jobs?highlight=${job.id}`}
                                    className="flex items-center px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                    onClick={() => setOpenMenu(null)}
                                  >
                                    View order
                                  </Link>
                                  <button
                                    type="button"
                                    className="flex w-full items-center px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                    onClick={() => void mutateJob(job.id, { status: 'completed' }, 'Job marked complete')}
                                  >
                                    Mark complete
                                  </button>
                                  <div className="my-1 border-t border-slate-100" />
                                  <button
                                    type="button"
                                    className="flex w-full items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                    onClick={() => void mutateJob(job.id, { status: 'cancelled' }, 'Job cancelled')}
                                  >
                                    Cancel job
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="grid gap-3">
                <InfoCard title="Next scheduled job">
                  {nextScheduledJob ? (
                    <>
                      <p className="text-sm font-semibold text-slate-900">{nextScheduledJob.customer}</p>
                      <p className="text-xs text-slate-500">{nextScheduledJob.service}</p>
                      <InfoRow label="Date" value={new Date(nextScheduledJob.scheduledDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })} />
                      <InfoRow label="Time" value={nextScheduledJob.scheduledTime || 'Time TBD'} />
                      <InfoRow label="Amount" value={formatCurrency(nextScheduledJob.amount)} />
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">No upcoming scheduled jobs yet.</p>
                  )}
                </InfoCard>

                <InfoCard title="Dispatch notes">
                  <InfoRow label="Unscheduled" value={`${unscheduledJobs.length} jobs waiting`} />
                  <InfoRow label="Due soon invoices" value={`${dueSoonCount} · ${formatCurrency(dueSoonAmount)}`} />
                  <InfoRow label="Average job value" value={formatCurrency(averageJobValue)} />
                </InfoCard>
              </div>
            </div>
          </SectionShell>

          <SectionShell
            title="Quick Actions"
            subtitle="The highest-frequency admin moves remain one click away."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="rounded-[18px] border p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(15,61,46,0.10)]"
                  style={{ borderColor: '#d7e7dd', background: 'rgba(255,255,255,.92)' }}
                >
                  <p className="text-[14px] font-extrabold text-slate-900">{action.label}</p>
                  <p className="mt-2 text-xs leading-[1.5] text-slate-500">{action.description}</p>
                </Link>
              ))}
            </div>
          </SectionShell>

          <SectionShell
            title="Domain Command Panel"
            subtitle="The existing domain shortcuts stay, now carrying live context."
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {domainCards.map((card) => (
                <Link
                  key={card.key}
                  href={card.href}
                  className="group relative overflow-hidden rounded-[22px] border border-black/5 bg-white/92 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15,61,46,0.10)]"
                >
                  <div className="absolute inset-0 opacity-[0.06]" style={{ background: card.color }} />
                  <div className="relative flex items-start justify-between gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: `${card.color}18`, color: card.color }}>
                      {card.icon}
                    </span>
                    {card.badge && (
                      <span className="rounded-full px-2 py-1 text-[10px] font-semibold text-white" style={{ background: card.badgeColor ?? card.color }}>
                        {card.badge}
                      </span>
                    )}
                  </div>
                  <p className="relative mt-3 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: '#7b8d84' }}>{card.label}</p>
                  <p className="relative mt-1.5 text-[15px] font-extrabold tracking-[-0.02em] leading-[1.25] text-slate-900">{card.primary}</p>
                  <p className="relative mt-1.5 text-xs leading-[1.45] text-slate-500">{card.secondary}</p>
                </Link>
              ))}
            </div>
          </SectionShell>
        </div>

        <div className="grid gap-5">
          <SectionShell
            title="Needs Attention"
            subtitle="Real alerts derived from current jobs, receivables, quotes and applicants."
            actionHref="/dashboard/alerts"
            actionLabel="Open alerts"
          >
            {attentionItems.length === 0 ? (
              <EmptyPanel message="No urgent items right now." />
            ) : (
              <ul className="m-0 p-0 list-none">
                {attentionItems.map((item) => {
                  const tone = toneStyles(item.tone);
                  return (
                    <li
                      key={item.key}
                      className="flex items-start gap-3 border-t px-1 py-4 first:border-t-0 first:pt-0"
                      style={{ borderColor: '#d7e7dd' }}
                    >
                      <span
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold"
                        style={{ background: tone.bg, color: tone.fg }}
                      >
                        !
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-bold text-slate-900">{item.title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{item.meta}</p>
                      </div>
                      <Link
                        href={item.href}
                        className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold whitespace-nowrap"
                        style={{ borderColor: '#d7e7dd', background: '#fff', color: brand.primary }}
                      >
                        {item.cta}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionShell>

          <SectionShell
            title="Money"
            subtitle="The summary-first money view, expanded with the new dashboard styling."
          >
            <div className="flex items-center justify-between gap-4 rounded-[16px] border p-4" style={{ borderColor: '#d7e7dd', background: 'rgba(255,255,255,.9)' }}>
              <div>
                <h3 className="text-[15px] font-extrabold tracking-[-0.01em] text-slate-900">{formatCurrency(monthRevenue)} this month</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {formatCurrency(receivableTotal)} outstanding · {formatCurrency(payableTotal)} payable · {formatCurrency(netProfit)} net profit MTD
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMoneyExpanded((value) => !value)}
                className="shrink-0 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all hover:-translate-y-px"
                style={{ borderColor: '#d7e7dd', background: 'rgba(255,255,255,.78)', color: brand.primary }}
              >
                {moneyExpanded ? 'Hide details' : 'Show details'}
              </button>
            </div>

            {moneyExpanded && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <MoneyDetailCard label="Net profit MTD" value={formatCurrency(cashBalance)} href="/dashboard/payments" />
                <MoneyDetailCard label="Receivables" value={formatCurrency(receivableTotal)} href="/dashboard/invoices" />
                <MoneyDetailCard label="Payables" value={formatCurrency(payableTotal)} href="/dashboard/expenses" />
                <MoneyDetailCard label="Net profit" value={formatCurrency(netProfit)} href="/dashboard/insights" />
              </div>
            )}
          </SectionShell>

          <SectionShell
            title="Quote Pipeline"
            subtitle="Built from live quote statuses instead of static mock values."
            actionHref="/dashboard/quotes"
            actionLabel="Open quotes"
          >
            {normalizedQuotes.length === 0 ? (
              <EmptyPanel message="No quote data available yet." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-5">
                {pipelineStages.map((stage) => (
                  <div key={stage.key}>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{stage.label}</p>
                    <div className="relative h-28 overflow-hidden rounded-[18px] border border-black/5 bg-[#f1f7f3]">
                      <div
                        className="absolute inset-x-0 bottom-0 rounded-t-[18px]"
                        style={{
                          height: `${Math.max(14, (stage.count / pipelineMax) * 100)}%`,
                          background: 'linear-gradient(180deg, #34d399 0%, #0f3d2e 100%)',
                        }}
                      />
                      {stage.count > 0 && (
                        <span className="absolute left-3 top-3 text-xs font-semibold text-white drop-shadow-sm">
                          {stage.count}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-900">{stage.count} quotes</span>
                      <span className="font-mono text-slate-500">{formatCurrency(stage.value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionShell>

          <SectionShell
            title="Crew today"
            subtitle={`${crewSummary.active.length} of ${crew.length} active · ${crewUtilisation}% utilisation`}
            actionHref="/dashboard/crew"
            actionLabel="Manage"
          >
            {visibleCrew.length === 0 ? (
              <EmptyPanel message="No crew records are available yet." />
            ) : (
              <ul className="m-0 p-0 list-none">
                {visibleCrew.map((member, i) => {
                  const isActive = member.status === 'active';
                  const barWidth = isActive ? Math.max(25, 100 - i * 18) : 0;
                  const roleLabel = member.services?.length
                    ? member.services.slice(0, 2).join(' · ')
                    : 'Crew';
                  const avatarBg = i === 0 ? brand.primary : isActive ? '#2d7a55' : '#94a3b8';

                  return (
                    <li key={member.id} className="flex items-center gap-3 border-t py-3.5 first:border-t-0 first:pt-0" style={{ borderColor: 'rgba(215,231,221,.72)' }}>
                      <span
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-white"
                        style={{ background: avatarBg }}
                      >
                        {getInitials(member.full_name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-slate-900">{member.full_name || 'Unnamed'}</p>
                        <p className="mb-2 text-[11px] text-slate-400">{roleLabel}</p>
                        <div className="h-1.5 overflow-hidden rounded-full" style={{ background: '#eef4f0' }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${barWidth}%`, background: 'linear-gradient(90deg, #34d399, #0f3d2e)' }}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionShell>

          <SectionShell
            title="Recent Activity"
            subtitle="Pulled from the live dashboard activity feed."
          >
            {recentActivity.length === 0 ? (
              <EmptyPanel message="No recent activity is available yet." />
            ) : (
              <div className="space-y-2">
                {recentActivity.slice(0, 5).map((item) => (
                  <div key={item.id} className="rounded-[20px] border border-black/5 bg-white/90 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
                      </div>
                      <div className="text-right">
                        {item.amount !== undefined && (
                          <p className="text-sm font-semibold text-slate-900">{formatCurrency(item.amount)}</p>
                        )}
                        <p className="text-[11px] text-slate-400">{formatRelativeTime(item.timestamp)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionShell>
        </div>
      </div>
    </div>
  );
}

function Glyph({
  d,
  className = 'h-4 w-4',
}: {
  d: string | string[];
  className?: string;
}) {
  const paths = Array.isArray(d) ? d : [d];
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {paths.map((path, index) => (
        <path key={index} d={path} />
      ))}
    </svg>
  );
}

function SectionShell({
  title,
  subtitle,
  actionHref,
  actionLabel,
  children,
}: {
  title: string;
  subtitle: string;
  actionHref?: string;
  actionLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="overflow-hidden rounded-[22px] border bg-white/86 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] backdrop-blur-[18px]"
      style={{ borderColor: '#d7e7dd' }}
    >
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-extrabold tracking-[-0.02em]" style={{ color: brand.primary }}>
            {title}
          </h2>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>
        {actionHref && actionLabel ? (
          <Link href={actionHref} className="shrink-0 text-[12.5px] font-bold whitespace-nowrap" style={{ color: '#1c7c54' }}>
            {actionLabel} →
          </Link>
        ) : null}
      </div>
      {children}
    </motion.section>
  );
}

function MetricCard({
  label,
  value,
  chip,
  chipTone,
  note,
  loading,
}: {
  label: string;
  value: string;
  chip: string;
  chipTone: AttentionTone;
  note: string;
  loading: boolean;
}) {
  const tone = toneStyles(chipTone);
  const arrow = chipTone === 'emerald' ? '↑' : chipTone === 'red' ? '↓' : null;
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="rounded-[24px] border bg-white/92 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
      style={{ borderColor: '#d7e7dd' }}
    >
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      {loading ? (
        <div className="mt-4 h-10 w-32 animate-pulse rounded-xl bg-slate-100" />
      ) : (
        <>
          <p className="text-[30px] font-extrabold tracking-[-0.03em] leading-none text-slate-900">{value}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
              {arrow && <span>{arrow}</span>}{chip}
            </span>
            <span className="text-xs text-slate-500">{note}</span>
          </div>
        </>
      )}
    </motion.article>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border bg-white/86 px-4 py-3.5" style={{ borderColor: 'rgba(0,0,0,.06)' }}>
      <p className="mb-1.5 text-[11px] uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="text-[24px] font-extrabold tracking-[-0.02em] text-slate-900">{value}</p>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[16px] border p-4" style={{ borderColor: '#d7e7dd', background: 'rgba(255,255,255,.9)' }}>
      <h3 className="mb-2.5 text-[15px] font-extrabold tracking-[-0.01em] text-slate-900">{title}</h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t py-2.5 text-[13px]" style={{ borderColor: 'rgba(215,231,221,.72)' }}>
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900 text-right">{value}</span>
    </div>
  );
}

function MoneyDetailCard({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-[18px] border p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(15,61,46,0.08)]"
      style={{ borderColor: '#d7e7dd', background: 'rgba(255,255,255,.92)' }}
    >
      <p className="mb-2 text-[11px] uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="text-[22px] font-extrabold tracking-[-0.02em] text-slate-900">{value}</p>
    </Link>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500">
      {message}
    </div>
  );
}

function StatusChip({
  label,
}: {
  label: string;
  tone: AttentionTone;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold" style={{ borderColor: '#d7e7dd', background: 'rgba(255,255,255,.84)', color: '#0f3d2e' }}>
      <span className="h-2 w-2 rounded-full" style={{ background: '#10b981', boxShadow: '0 0 0 4px rgba(16,185,129,.14)' }} />
      {label}
    </span>
  );
}

function greet() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function scheduleStatusPill(status: JobRecord['status']) {
  switch (status) {
    case 'scheduled': return 'inline-flex rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700';
    case 'in_progress': return 'inline-flex rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-semibold text-indigo-600';
    case 'completed': return 'inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600';
    case 'cancelled': return 'inline-flex rounded-full bg-red-100 px-3 py-1 text-[11px] font-semibold text-red-600';
  }
}

function scheduleStatusLabel(status: JobRecord['status']) {
  switch (status) {
    case 'scheduled': return 'Confirmed';
    case 'in_progress': return 'En route';
    case 'completed': return 'Completed';
    case 'cancelled': return 'Cancelled';
  }
}

function statusPillClass(status: JobRecord['status']) {
  switch (status) {
    case 'scheduled':
      return 'inline-flex rounded-full bg-sky-100 px-3 py-1 text-[11px] font-semibold text-sky-700';
    case 'in_progress':
      return 'inline-flex rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-700';
    case 'completed':
      return 'inline-flex rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700';
    case 'cancelled':
      return 'inline-flex rounded-full bg-red-100 px-3 py-1 text-[11px] font-semibold text-red-700';
  }
}
