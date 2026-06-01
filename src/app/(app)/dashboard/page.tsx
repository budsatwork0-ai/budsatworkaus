'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { brand } from '@/app/ui/theme';
import { useAuth } from '@/app/hooks/useAuth';
import { useDashboardData } from './hooks/useDashboardData';
import { ErrorMessage, RefreshIcon } from './components/shared';
import { DashboardHero } from './components/DashboardHero';
import { ErrorBoundary } from './_components/ErrorBoundary';
import { formatCurrency, formatRelativeTime } from '@/lib/dashboard/utils';
import { jobStatusLabels, normalizeQuoteStatus, type DashboardAlert, type DashboardCrewMember, type DashboardQuote, type JobRecord } from '@/types/dashboard';
import { SummaryCardsSkeleton, TableSkeleton, PanelSkeleton, ActivitySkeleton } from './components/Skeletons';

type AttentionTone = 'red' | 'amber' | 'blue' | 'emerald';
type MobileGroup = 'priority' | 'performance';
type SectionKey = 'attention' | 'actions' | 'today' | 'money' | 'pipeline' | 'crew' | 'activity';

type NextBestAction = {
  key: string;
  title: string;
  detail: string;
  href: string;
  tone: AttentionTone;
};

const SECTION_GROUPS: Record<MobileGroup, SectionKey[]> = {
  priority: ['attention', 'actions', 'today'],
  performance: ['money', 'pipeline', 'crew', 'activity'],
};

const SECTION_ORDER_BY_ROLE: Record<'admin' | 'employee' | 'customer', SectionKey[]> = {
  admin: ['attention', 'actions', 'today', 'money', 'pipeline', 'crew', 'activity'],
  employee: ['today', 'attention', 'actions', 'crew', 'pipeline', 'money', 'activity'],
  customer: ['today', 'actions', 'attention', 'money', 'pipeline', 'crew', 'activity'],
};

const ROLE_COPY: Record<'admin' | 'employee' | 'customer', { title: string; subtitle: string }> = {
  admin: {
    title: 'Operations Console',
    subtitle: '',
  },
  employee: {
    title: 'Your day at a glance',
    subtitle: '',
  },
  customer: {
    title: 'Business overview',
    subtitle: '',
  },
};



function compareJobs(a: Pick<JobRecord, 'scheduledDate' | 'scheduledTime'>, b: Pick<JobRecord, 'scheduledDate' | 'scheduledTime'>) {
  const left = new Date(`${a.scheduledDate || '9999-12-31'}T${a.scheduledTime || '23:59:59'}`);
  const right = new Date(`${b.scheduledDate || '9999-12-31'}T${b.scheduledTime || '23:59:59'}`);
  return left.getTime() - right.getTime();
}

function quoteValue(quote: DashboardQuote) {
  return Number(quote.reviewed_total ?? quote.submitted_total ?? quote.total ?? 0);
}

function ageInDays(timestamp: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60 * 24)));
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
  const {
    metrics,
    moneyFlow,
    jobs,
    recentActivity,
    alertsFeed,
    crew,
    quotes,
    applicantCount,
    lastUpdated,
    isLoading,
    error,
    refetch,
  } = useDashboardData();
  const { role } = useAuth();
  const [mobileGroup, setMobileGroup] = useState<MobileGroup>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dashboard_mobile_group');
      if (saved === 'priority' || saved === 'performance') return saved;
    }
    return 'priority';
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const roleKey = (role === 'admin' || role === 'employee' || role === 'customer' ? role : 'customer') as 'admin' | 'employee' | 'customer';
  const roleCopy = ROLE_COPY[roleKey];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

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

  const quotePipeline = useMemo(() => {
    const stages = [
      { key: 'submitted', label: 'Requested', href: '/dashboard/quotes?workspace=review&status=submitted' },
      { key: 'in_review', label: 'In Review', href: '/dashboard/quotes?workspace=review&status=in_review' },
      { key: 'finalized', label: 'Approved', href: '/dashboard/quotes?workspace=approved&status=finalized' },
      { key: 'payment_pending', label: 'Payment Pending', href: '/dashboard/quotes?workspace=approved&status=payment_pending' },
      { key: 'paid', label: 'Won', href: '/dashboard/quotes?workspace=archive&status=paid' },
    ] as const;

    return stages.map((stage) => {
      const stageQuotes = quotes.filter((quote) => normalizeQuoteStatus(quote.status) === stage.key);
      const totalValue = stageQuotes.reduce((sum, quote) => sum + quoteValue(quote), 0);
      const ages = stageQuotes.map((quote) => ageInDays(quote.created_at));
      const averageAge = ages.length > 0 ? Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length) : 0;
      const oldestAge = ages.length > 0 ? Math.max(...ages) : 0;
      const convertedCount = stageQuotes.filter((q) => q.converted_order_id).length;
      return {
        ...stage,
        count: stageQuotes.length,
        totalValue,
        averageAge,
        oldestAge,
        convertedCount,
      };
    });
  }, [quotes]);

  const maxPipelineCount = Math.max(1, ...quotePipeline.map((stage) => stage.count));
  const reviewQueueCount = quotePipeline
    .filter((stage) => stage.key === 'submitted' || stage.key === 'in_review')
    .reduce((sum, stage) => sum + stage.count, 0);

  const crewSummary = useMemo(() => {
    const active = crew.filter((member) => member.status === 'active');
    const ready = crew.filter((member) => member.readyForCrewApproval);
    return { active, ready };
  }, [crew]);

  const visibleCrew = useMemo(() => {
    return [...crew]
      .sort((left, right) => {
        const leftScore = (left.inProgressJobs ?? 0) * 3 + (left.assignedJobs ?? 0) * 2 + (left.status === 'active' ? 1 : 0);
        const rightScore = (right.inProgressJobs ?? 0) * 3 + (right.assignedJobs ?? 0) * 2 + (right.status === 'active' ? 1 : 0);
        return rightScore - leftScore;
      })
      .slice(0, 4);
  }, [crew]);

  const crewUtilization = useMemo(() => {
    const active = crew.filter((m) => m.status === 'active');
    if (active.length === 0) return { totalInProgress: 0, overloaded: [] as typeof crew };
    const totalAssigned = active.reduce((sum, m) => sum + (m.assignedJobs ?? 0), 0);
    const totalInProgress = active.reduce((sum, m) => sum + (m.inProgressJobs ?? 0), 0);
    const avgLoad = Math.round(totalAssigned / active.length);
    const overloaded = active.filter((m) => (m.assignedJobs ?? 0) > avgLoad * 1.5 && avgLoad > 0);
    return { totalInProgress, overloaded };
  }, [crew]);

  const nextBestActions = useMemo<NextBestAction[]>(() => {
    const actions: NextBestAction[] = [];

    if (metrics.alerts.overdueCount > 0) {
      actions.push({
        key: 'overdue-invoices',
        title: `Follow up ${metrics.alerts.overdueCount} overdue invoice${metrics.alerts.overdueCount === 1 ? '' : 's'}`,
        detail: `${formatCurrency(metrics.alerts.overdueAmount)} is outstanding and now overdue.`,
        href: '/dashboard/invoices?tab=invoices&status=Overdue',
        tone: 'red',
      });
    }

    if (unscheduledJobs.length > 0) {
      actions.push({
        key: 'unscheduled-jobs',
        title: `Place ${unscheduledJobs.length} unscheduled job${unscheduledJobs.length === 1 ? '' : 's'}`,
        detail: 'Confirmed work is waiting for calendar placement.',
        href: '/dashboard/schedule?view=list&scheduleState=unscheduled',
        tone: 'amber',
      });
    }

    if (reviewQueueCount > 0) {
      actions.push({
        key: 'review-quotes',
        title: `Review ${reviewQueueCount} quote${reviewQueueCount === 1 ? '' : 's'} in the active pricing queue`,
        detail: 'Submitted and in-review quotes are the fastest lever for new work.',
        href: '/dashboard/quotes?workspace=review',
        tone: 'blue',
      });
    }

    if (crewSummary.ready.length > 0 || applicantCount > 0) {
      actions.push({
        key: 'crew-approvals',
        title: crewSummary.ready.length > 0
          ? `Approve ${crewSummary.ready.length} crew member${crewSummary.ready.length === 1 ? '' : 's'}`
          : `Triage ${applicantCount} applicant${applicantCount === 1 ? '' : 's'}`,
        detail: crewSummary.ready.length > 0
          ? 'Onboarding is complete and crew access can be unlocked.'
          : 'New applicants are waiting in intake.',
        href: crewSummary.ready.length > 0
          ? '/dashboard/crew?tab=onboarding&filter=awaiting_approval'
          : '/dashboard/crew?tab=applicants&group=crew',
        tone: 'emerald',
      });
    }

    return actions.slice(0, 4);
  }, [applicantCount, crewSummary.ready.length, metrics.alerts.overdueAmount, metrics.alerts.overdueCount, reviewQueueCount, unscheduledJobs.length]);


  const sections: Record<SectionKey, React.ReactNode | null> = useMemo(() => ({
    attention: alertsFeed.length === 0 ? null : (
      <SectionShell
        title="Alerts"
        subtitle=""
        actionHref="/dashboard/alerts"
        actionLabel="View all"
      >
        <div className="space-y-2">
          {alertsFeed.slice(0, 5).map((alert) => (
            <AlertRow key={alert.id} alert={alert} />
          ))}
        </div>
      </SectionShell>
    ),
    actions: nextBestActions.length === 0 ? null : (
      <SectionShell
        title="Next Actions"
        subtitle=""
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {nextBestActions.map((action) => (
            <ActionCard key={action.key} action={action} />
          ))}
        </div>
      </SectionShell>
    ),
    today: (
      <SectionShell
        title="Today"
        subtitle=""
        actionHref="/dashboard/schedule?view=day"
        actionLabel="Open schedule"
      >
        <div className="grid gap-3 md:grid-cols-3">
          <MiniStat label="Today's jobs" value={String(todayJobs.length)} />
          <MiniStat label="In progress" value={String(inProgressCount)} />
          <MiniStat label="Unscheduled" value={String(unscheduledJobs.length)} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.85fr)]">
          <div className="overflow-hidden rounded-[22px] border border-black/5 bg-white">
            <div className="border-b border-slate-100 bg-[#f1f7f3] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Today's schedule</p>
            </div>
            {todayJobs.length === 0 ? (
              <EmptyPanel message="No jobs are scheduled for today." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-slate-500">
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Service</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayJobs.slice(0, 5).map((job) => (
                      <tr key={job.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 align-top">
                          <p className="font-semibold text-slate-900">{job.scheduledTime || 'Time TBD'}</p>
                          <p className="text-[11px] text-slate-500">{job.address || 'Address pending'}</p>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <p className="font-semibold text-slate-900">{job.customer}</p>
                          <p className="text-[11px] text-slate-500">{formatCurrency(job.amount)}</p>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <p className="font-medium text-slate-900">{job.service}</p>
                          {job.notes && <p className="text-[11px] text-slate-500">{job.notes}</p>}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className={statusPillClass(job.status)}>
                            {jobStatusLabels[job.status]}
                          </span>
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

          </div>
        </div>
      </SectionShell>
    ),
    money: (
      <SectionShell
        title="Money"
        subtitle=""
        actionHref="/dashboard/invoices?tab=overview"
        actionLabel="Open money"
      >
        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard label="Revenue · MTD" value={formatCurrency(metrics.goals.currentRevenue)} delta={metrics.goals.revenueChange} note={`${formatCurrency(metrics.goals.monthlyRevenueTarget)} target`} />
          <MetricCard label="Receivables" value={formatCurrency(metrics.outstandingReceivables.total)} delta={metrics.outstandingReceivables.change} note={`${metrics.outstandingReceivables.count} invoices open`} />
          <MetricCard label="Payables" value={formatCurrency(metrics.upcomingPayables.total)} delta={metrics.upcomingPayables.change} note={`${metrics.upcomingPayables.count} bills upcoming`} />
          <MetricCard label="Net Profit" value={formatCurrency(metrics.netProfit.amount)} delta={metrics.netProfit.change} note={`${metrics.netProfit.margin}% margin`} />
        </div>

      </SectionShell>
    ),
    pipeline: quotes.length === 0 ? null : (
      <SectionShell
        title="Quote Pipeline"
        subtitle=""
        actionHref="/dashboard/quotes?workspace=review"
        actionLabel="Open quotes"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {quotePipeline.map((stage) => (
              <Link key={stage.key} href={stage.href} className="rounded-[20px] border border-black/5 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(15,61,46,0.08)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{stage.label}</p>
                <div className="mt-3 relative h-28 overflow-hidden rounded-[18px] border border-black/5 bg-[#f1f7f3]">
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-t-[18px]"
                    style={{
                      height: `${Math.max(14, (stage.count / maxPipelineCount) * 100)}%`,
                      background: 'linear-gradient(180deg, #34d399 0%, #0f3d2e 100%)',
                    }}
                  />
                  {stage.count > 0 && (
                    <span className="absolute left-3 top-3 text-xs font-semibold text-white drop-shadow-sm">
                      {stage.count}
                    </span>
                  )}
                </div>
                <div className="mt-3 space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{formatCurrency(stage.totalValue)}</span>
                    <span className="text-slate-500">{stage.count} quotes</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-slate-500">
                    <span>Avg age {stage.averageAge}d</span>
                    <span>Oldest {stage.oldestAge}d</span>
                  </div>
                  {stage.convertedCount > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                        {stage.convertedCount} converted →
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
      </SectionShell>
    ),
    crew: (
      <SectionShell
        title="Crew"
        subtitle=""
        actionHref="/dashboard/crew?tab=onboarding"
        actionLabel="Open crew"
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <MiniStat label="Active" value={String(crewSummary.active.length)} />
          <MiniStat label="Live now" value={String(crewUtilization.totalInProgress)} />
          <MiniStat label="Ready for access" value={String(crewSummary.ready.length)} />
        </div>

        {crewUtilization.overloaded.length > 0 && (
          <div className="mb-3 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <span className="font-semibold">Overloaded: </span>
            {crewUtilization.overloaded.map((m) => m.full_name || 'Unnamed').join(', ')} — carrying more than 1.5× average job load.
          </div>
        )}

        {visibleCrew.length > 0 && (
          <div className="space-y-3">
            {visibleCrew.map((member) => (
              <CrewCard key={member.id} member={member} />
            ))}
          </div>
        )}
      </SectionShell>
    ),
    activity: recentActivity.length === 0 ? null : (
      <SectionShell
        title="Recent Activity"
        subtitle=""
      >
        <div className="space-y-2">
          {recentActivity.slice(0, 6).map((item) => (
            <div key={item.id} className="rounded-[20px] border border-black/5 bg-white px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
                </div>
                <div className="text-right">
                  {item.amount !== undefined ? (
                    <p className="text-sm font-semibold text-slate-900">{formatCurrency(item.amount)}</p>
                  ) : null}
                  <p className="text-[11px] text-slate-400">{formatRelativeTime(item.timestamp)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionShell>
    ),
  }), [alertsFeed, nextBestActions, todayJobs, inProgressCount, unscheduledJobs, nextScheduledJob, metrics, quotePipeline, maxPipelineCount, crewSummary, crewUtilization, visibleCrew, recentActivity]);

  const orderedSections = SECTION_ORDER_BY_ROLE[roleKey];

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

  if (isLoading) {
    return (
      <div className="grid gap-5 w-full px-3 sm:px-4 md:px-8 xl:px-10 pb-14">
        <div className="rounded-[28px] border border-black/5 bg-white px-4 py-5 shadow-[0_8px_26px_rgba(2,6,23,0.05)] sm:px-6 animate-pulse">
          <div className="h-8 w-56 bg-slate-200 rounded-xl mb-4" />
          <div className="flex gap-2">
            <div className="h-8 w-28 bg-slate-100 rounded-full" />
            <div className="h-8 w-28 bg-slate-100 rounded-full" />
          </div>
        </div>
        <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-[0_8px_26px_rgba(2,6,23,0.05)] space-y-4">
          <div className="h-5 w-20 bg-slate-200 rounded animate-pulse" />
          <SummaryCardsSkeleton />
        </div>
        <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-[0_8px_26px_rgba(2,6,23,0.05)] space-y-4">
          <div className="h-5 w-16 bg-slate-200 rounded animate-pulse" />
          <TableSkeleton rows={4} />
        </div>
        <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-[0_8px_26px_rgba(2,6,23,0.05)] space-y-4">
          <div className="h-5 w-24 bg-slate-200 rounded animate-pulse" />
          <PanelSkeleton rows={3} />
        </div>
        <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-[0_8px_26px_rgba(2,6,23,0.05)] space-y-4">
          <div className="h-5 w-28 bg-slate-200 rounded animate-pulse" />
          <ActivitySkeleton items={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 w-full px-3 sm:px-4 md:px-8 xl:px-10 pb-14">
      <motion.section
        className="grid gap-4 rounded-[28px] border border-black/5 bg-white px-4 py-5 shadow-[0_8px_26px_rgba(2,6,23,0.05)] sm:px-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-[-0.03em]" style={{ color: brand.primary }}>
                {roleCopy.title}
              </h1>
              <div className="flex items-center gap-2">
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
                {lastUpdated && !isRefreshing && (
                  <span className="text-xs text-slate-400">
                    Updated {formatRelativeTime(lastUpdated)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {alertsFeed.length > 0 && <HeaderChip label={`${alertsFeed.length} active alert${alertsFeed.length === 1 ? '' : 's'}`} tone="red" />}
            {todayJobs.length > 0 && <HeaderChip label={`${todayJobs.length} job${todayJobs.length === 1 ? '' : 's'} today`} tone="blue" />}
            {crewSummary.active.length > 0 && <HeaderChip label={`${crewSummary.active.length} active crew`} tone="emerald" />}
          </div>
        </div>

      </motion.section>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
      >
        <ErrorBoundary label="overview">
          <DashboardHero metrics={metrics} moneyFlow={moneyFlow} recentActivity={recentActivity} />
        </ErrorBoundary>
      </motion.div>
    </div>
  );
}

function Glyph({ d, className = 'h-4 w-4' }: { d: string | string[]; className?: string }) {
  const paths = Array.isArray(d) ? d : [d];
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {paths.map((path, index) => <path key={index} d={path} />)}
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
    <section className="rounded-[28px] border border-black/5 bg-white p-5 shadow-[0_8px_26px_rgba(2,6,23,0.05)]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.02em]" style={{ color: brand.primary }}>{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {actionHref && actionLabel ? (
          <Link href={actionHref} className="text-xs font-semibold text-slate-500 transition hover:text-slate-900">
            {actionLabel} →
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  delta,
  note,
}: {
  label: string;
  value: string;
  delta: number;
  note: string;
}) {
  const tone: AttentionTone = delta > 0 ? 'emerald' : delta < 0 ? 'red' : 'blue';
  const colors = toneStyles(tone);
  return (
    <div className="rounded-[24px] border border-black/5 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-900">{value}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: colors.bg, color: colors.fg }}>
          {delta > 0 ? '+' : ''}{delta}%
        </span>
        <span className="text-xs text-slate-500">{note}</span>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-black/5 bg-white px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-slate-900">{value}</p>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[22px] border border-black/5 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white px-3 py-2">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900 text-right">{value}</span>
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500">
      {message}
    </div>
  );
}

function HeaderChip({ label, tone }: { label: string; tone: AttentionTone }) {
  const colors = toneStyles(tone);
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
      <span className="h-2 w-2 rounded-full" style={{ background: colors.fg }} />
      {label}
    </span>
  );
}

function AlertRow({ alert }: { alert: DashboardAlert }) {
  const tone = alert.severity === 'critical' ? toneStyles('red') : alert.severity === 'warning' ? toneStyles('amber') : toneStyles('blue');
  return (
    <Link href={alert.href || '/dashboard/alerts'} className="flex items-start gap-3 rounded-[20px] border border-black/5 bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold" style={{ background: tone.bg, color: tone.fg }}>
        !
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-slate-900">{alert.title}</p>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{alert.source}</span>
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-500">{alert.message}</p>
      </div>
      <span className="text-[11px] font-semibold text-slate-400">{formatRelativeTime(alert.timestamp)}</span>
    </Link>
  );
}

const ACTION_BADGE_LABELS: Record<AttentionTone, string> = {
  red: 'Overdue',
  amber: 'Pending',
  blue: 'Review',
  emerald: 'Approve',
};

function ActionCard({ action }: { action: NextBestAction }) {
  const colors = toneStyles(action.tone);
  return (
    <Link href={action.href} className="rounded-[20px] border border-black/5 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(15,61,46,0.08)]">
      <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: colors.bg, color: colors.fg }}>
        {ACTION_BADGE_LABELS[action.tone]}
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-900">{action.title}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{action.detail}</p>
    </Link>
  );
}


function CrewCard({ member }: { member: DashboardCrewMember }) {
  const progressPct = member.progress?.total ? Math.round((member.progress.completed / member.progress.total) * 100) : 0;
  const statusTone =
    member.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
    member.status === 'suspended' ? 'bg-red-100 text-red-700' :
    'bg-slate-100 text-slate-700';

  return (
    <Link href={member.awaitingApproval ? '/dashboard/crew?tab=onboarding&filter=awaiting_approval' : '/dashboard/crew?tab=applicants&group=crew'} className="flex items-start gap-3 rounded-[20px] border border-black/5 bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ background: member.status === 'active' ? brand.primary : '#64748b' }}>
        {getInitials(member.full_name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">{member.full_name || 'Unnamed crew member'}</p>
            <p className="text-xs text-slate-500">
              {member.services?.length ? member.services.join(', ') : (member.currentSectionLabel || 'Onboarding in progress')}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${statusTone}`}>{member.status}</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full"
            style={{
              width: `${progressPct}%`,
              background: 'linear-gradient(90deg, #34d399 0%, #0f3d2e 100%)',
            }}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
          <span>{member.onboardingComplete ? 'Onboarding complete' : `${progressPct}% onboarding complete`}</span>
          <span>{member.assignedJobs ?? 0} assigned · {member.inProgressJobs ?? 0} live</span>
        </div>
      </div>
    </Link>
  );
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
