'use client';

import { Suspense, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ReportsView } from '../reports/ReportsView';
const VisitorsTab = dynamic(() => import('../components/tabs/VisitorsTab'), { ssr: false });
import { WorkbenchHeader, WorkbenchQueue, WorkbenchStatGrid, WorkbenchTabs } from '../components/Workbench';
import { ErrorMessage, Panel, RefreshIcon, StatRow } from '../components/shared';
import { PanelSkeleton } from '../components/Skeletons';
import { useDashboardData } from '../hooks/useDashboardData';
import { useTabbedNav } from '../hooks/useTabbedNav';
import { formatCurrency, formatDate, formatRelativeTime } from '@/lib/dashboard/utils';

type Tab = 'overview' | 'reports' | 'visitors';
type FocusArea = 'ceo' | 'growth' | 'sales' | 'ops' | 'finance';

function sanitizeTab(value: string | null): Tab {
  if (value === 'reports' || value === 'visitors') return value;
  return 'overview';
}

function sanitizeFocusArea(value: string | null): FocusArea {
  if (value === 'growth' || value === 'sales' || value === 'ops' || value === 'finance') return value;
  return 'ceo';
}

function normalizeQuoteStatus(status: string) {
  if (status === 'pending') return 'submitted';
  if (status === 'approved') return 'finalized';
  if (status === 'adjusted') return 'in_review';
  if (status === 'converted') return 'paid';
  return status;
}

function getQuoteAmount(quote: {
  reviewed_total?: number | null;
  submitted_total?: number | null;
  total?: number | null;
}) {
  return Number(quote.reviewed_total ?? quote.submitted_total ?? quote.total ?? 0);
}

function formatDurationHours(hours: number | null) {
  if (hours === null || !Number.isFinite(hours) || hours <= 0) return '–';
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.round((hours / 24) * 10) / 10;
  return `${days}d`;
}

function average(numbers: number[]) {
  if (numbers.length === 0) return null;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function formatDelta(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? '+100%' : '0%';
  const delta = Math.round(((current - previous) / previous) * 100);
  return `${delta >= 0 ? '+' : ''}${delta}%`;
}

function HeaderBadge({
  label,
  tone = 'slate',
  title,
}: {
  label: string;
  tone?: 'slate' | 'emerald' | 'amber' | 'red';
  title?: string;
}) {
  const styles = {
    slate: 'bg-slate-100 text-slate-600',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  };

  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${styles[tone]}`}
    >
      {label}
    </span>
  );
}

function InsightsLoadingState() {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)] animate-pulse"
          >
            <div className="h-3 w-24 rounded bg-slate-200" />
            <div className="mt-4 h-9 w-28 rounded bg-slate-200" />
            <div className="mt-4 h-6 w-36 rounded-full bg-slate-100" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-black/5 bg-white/85 p-1 animate-pulse">
        <div className="grid gap-1 sm:grid-cols-2 xl:auto-cols-fr xl:grid-flow-col">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-xl px-4 py-3">
              <div className="h-4 w-20 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>

      <section className="rounded-[24px] border border-black/5 bg-white/90 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)] animate-pulse">
        <div className="h-4 w-32 rounded bg-slate-200" />
        <div className="mt-2 h-3 w-56 rounded bg-slate-100" />
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-[20px] border border-black/5 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
              <div className="h-6 w-16 rounded-full bg-slate-100" />
              <div className="mt-4 h-4 w-40 rounded bg-slate-200" />
              <div className="mt-3 h-3 w-full rounded bg-slate-100" />
              <div className="mt-2 h-3 w-4/5 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <PanelSkeleton rows={5} />
        <div className="grid gap-5">
          <PanelSkeleton rows={3} />
          <PanelSkeleton rows={3} />
        </div>
      </div>
    </>
  );
}

function InsightSnapshotCard({
  title,
  value,
  detail,
  tone = 'slate',
}: {
  title: string;
  value: string;
  detail: string;
  tone?: 'slate' | 'emerald' | 'amber' | 'blue' | 'red';
}) {
  const toneStyles = {
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    blue: 'bg-sky-50 text-sky-700 border-sky-100',
    red: 'bg-red-50 text-red-700 border-red-100',
  };

  return (
    <div className={`rounded-[20px] border p-4 ${toneStyles[tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">{title}</p>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-600">{detail}</p>
    </div>
  );
}

function InsightsPageContent() {
  const [tab, setTab] = useTabbedNav<Tab>('tab', sanitizeTab);
  const [focusArea, setFocusArea] = useTabbedNav<FocusArea>('view', sanitizeFocusArea);
  const { metrics, moneyFlow, receivables, payables, alertsFeed, quotes, crew, partnerReferrals, lastUpdated, isLoading, error, refetch } = useDashboardData('full');
  const now = useMemo(() => new Date(), []);

  const reviewQuotes = useMemo(
    () => quotes.filter((quote) => normalizeQuoteStatus(quote.status) === 'submitted' || normalizeQuoteStatus(quote.status) === 'in_review'),
    [quotes]
  );

  const closeReadyQuotes = useMemo(
    () => quotes.filter((quote) => {
      const status = normalizeQuoteStatus(quote.status);
      if (status === 'paid') return false;
      return status === 'finalized' || status === 'payment_pending' || quote.payment_status === 'pending_payment';
    }),
    [quotes]
  );

  const wonQuotes = useMemo(
    () => quotes.filter((quote) => normalizeQuoteStatus(quote.status) === 'paid').length,
    [quotes]
  );

  const quoteConversion = quotes.length > 0 ? Math.round((wonQuotes / quotes.length) * 100) : 0;
  const revenueGap = Math.max(0, metrics.goals.monthlyRevenueTarget - metrics.goals.currentRevenue);
  const jobsGap = Math.max(0, metrics.goals.monthlyJobsTarget - metrics.goals.currentJobs);
  const activeCrew = crew.filter((member) => member.status === 'active').length;
  const hasSnapshot = Boolean(lastUpdated);
  const isRefreshing = isLoading && hasSnapshot;
  const monthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthProgressTarget = Math.round((metrics.goals.monthlyRevenueTarget / monthDays) * now.getDate());
  const runRateRevenue = now.getDate() > 0
    ? Math.round((metrics.goals.currentRevenue / now.getDate()) * monthDays)
    : 0;
  const runRateGap = runRateRevenue - metrics.goals.monthlyRevenueTarget;

  const sevenDaysAgo = useMemo(() => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), []);
  const fourteenDaysAgo = useMemo(() => new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), []);
  const fortyEightHoursAgo = useMemo(() => new Date(Date.now() - 48 * 60 * 60 * 1000), []);
  const seventyTwoHoursAgo = useMemo(() => new Date(Date.now() - 72 * 60 * 60 * 1000), []);

  const quotesLast7 = useMemo(
    () => quotes.filter((quote) => new Date(quote.created_at) >= sevenDaysAgo),
    [quotes, sevenDaysAgo]
  );
  const quotesPrev7 = useMemo(
    () => quotes.filter((quote) => {
      const createdAt = new Date(quote.created_at);
      return createdAt >= fourteenDaysAgo && createdAt < sevenDaysAgo;
    }),
    [quotes, fourteenDaysAgo, sevenDaysAgo]
  );
  const quoteIntakeDelta = quotesPrev7.length > 0
    ? Math.round(((quotesLast7.length - quotesPrev7.length) / quotesPrev7.length) * 100)
    : (quotesLast7.length > 0 ? 100 : 0);

  const reviewPipelineValue = useMemo(
    () => reviewQuotes.reduce((sum, quote) => sum + getQuoteAmount(quote), 0),
    [reviewQuotes]
  );
  const closeReadyValue = useMemo(
    () => closeReadyQuotes.reduce((sum, quote) => sum + getQuoteAmount(quote), 0),
    [closeReadyQuotes]
  );
  const scenarioRevenue = metrics.goals.currentRevenue + closeReadyValue + Math.round(reviewPipelineValue * (quoteConversion / 100));

  const staleReviewQuotes = useMemo(
    () => reviewQuotes.filter((quote) => new Date(quote.created_at) < fortyEightHoursAgo),
    [reviewQuotes, fortyEightHoursAgo]
  );
  const stalledPaymentQuotes = useMemo(
    () => closeReadyQuotes.filter((quote) => {
      const reference = quote.payment_requested_at ?? quote.finalized_at ?? quote.created_at;
      return new Date(reference) < seventyTwoHoursAgo;
    }),
    [closeReadyQuotes, seventyTwoHoursAgo]
  );

  const avgQuoteToFinalizeHours = useMemo(
    () => average(
      quotes
        .filter((quote) => quote.finalized_at)
        .map((quote) => (new Date(quote.finalized_at as string).getTime() - new Date(quote.created_at).getTime()) / 3_600_000)
        .filter((value) => value >= 0)
    ),
    [quotes]
  );
  const avgQuoteToPaymentRequestHours = useMemo(
    () => average(
      quotes
        .filter((quote) => quote.payment_requested_at)
        .map((quote) => (new Date(quote.payment_requested_at as string).getTime() - new Date(quote.created_at).getTime()) / 3_600_000)
        .filter((value) => value >= 0)
    ),
    [quotes]
  );

  const serviceDemandLast7 = useMemo(() => {
    const byService = new Map<string, { count: number; value: number }>();
    quotesLast7.forEach((quote) => {
      const service = quote.service_type || 'unknown';
      const current = byService.get(service) || { count: 0, value: 0 };
      current.count += 1;
      current.value += getQuoteAmount(quote);
      byService.set(service, current);
    });

    return Array.from(byService.entries())
      .map(([service, summary]) => ({ service, ...summary }))
      .sort((a, b) => b.count - a.count || b.value - a.value)
      .slice(0, 5);
  }, [quotesLast7]);

  const serviceWinRates = useMemo(() => {
    const byService = new Map<string, { total: number; won: number; pipeline: number }>();
    quotes.forEach((quote) => {
      const service = quote.service_type || 'unknown';
      const status = normalizeQuoteStatus(quote.status);
      const current = byService.get(service) || { total: 0, won: 0, pipeline: 0 };
      current.total += 1;
      if (status === 'paid') current.won += 1;
      if (status === 'submitted' || status === 'in_review' || status === 'finalized' || status === 'payment_pending') {
        current.pipeline += 1;
      }
      byService.set(service, current);
    });

    return Array.from(byService.entries())
      .map(([service, summary]) => ({
        service,
        ...summary,
        winRate: summary.total > 0 ? Math.round((summary.won / summary.total) * 100) : 0,
      }))
      .sort((a, b) => b.winRate - a.winRate || b.won - a.won)
      .slice(0, 5);
  }, [quotes]);

  const maluCareReferral = useMemo(
    () => partnerReferrals.find((snapshot) => snapshot.partner === 'MaluCare') ?? null,
    [partnerReferrals]
  );

  // NDIS-specific insights: volume, conversion by management type, avg hours,
  // revenue mix, pipeline — everything a program manager needs at a glance.
  const ndisInsights = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ndisQuotes = quotes.filter((q: any) => q.context === 'ndis');
    const total = ndisQuotes.length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const last30 = ndisQuotes.filter((q: any) =>
      new Date(q.created_at) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const won = ndisQuotes.filter((q: any) => normalizeQuoteStatus(q.status) === 'paid').length;
    const conversion = total > 0 ? Math.round((won / total) * 100) : 0;
    const revenue = ndisQuotes
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((q: any) => normalizeQuoteStatus(q.status) === 'paid')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .reduce((s: number, q: any) => s + getQuoteAmount(q), 0);
    const pipelineValue = ndisQuotes
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((q: any) => {
        const st = normalizeQuoteStatus(q.status);
        return st === 'submitted' || st === 'in_review' || st === 'finalized' || st === 'payment_pending';
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .reduce((s: number, q: any) => s + getQuoteAmount(q), 0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hoursValues = ndisQuotes.map((q: any) => Number(q.ndis_estimated_hours)).filter((n: number) => Number.isFinite(n) && n > 0);
    const avgHours = hoursValues.length > 0
      ? hoursValues.reduce((s: number, n: number) => s + n, 0) / hoursValues.length
      : 0;

    const byMgmt: Record<string, { total: number; won: number; value: number }> = {
      plan_managed: { total: 0, won: 0, value: 0 },
      self_managed: { total: 0, won: 0, value: 0 },
      agency_managed: { total: 0, won: 0, value: 0 },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ndisQuotes.forEach((q: any) => {
      const key = q.ndis_management_type as string | null;
      if (!key || !byMgmt[key]) return;
      byMgmt[key].total += 1;
      if (normalizeQuoteStatus(q.status) === 'paid') byMgmt[key].won += 1;
      byMgmt[key].value += getQuoteAmount(q);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const forwarded = ndisQuotes.filter((q: any) => !!q.ndis_forwarded_at).length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accepted = ndisQuotes.filter((q: any) => !!q.ndis_accepted_at).length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const booked = ndisQuotes.filter((q: any) => !!q.ndis_booked_at).length;

    // Service mix (cleaning vs yard)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cleaningCount = ndisQuotes.filter((q: any) => q.service_type === 'cleaning').length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yardCount = ndisQuotes.filter((q: any) => q.service_type === 'yard').length;

    return {
      total,
      last30Count: last30.length,
      won,
      conversion,
      revenue,
      pipelineValue,
      avgHours,
      byMgmt,
      forwarded,
      accepted,
      booked,
      cleaningCount,
      yardCount,
    };
  }, [quotes]);

  const completedJobsPerActiveCrew = activeCrew > 0
    ? (metrics.operationsSnapshot.jobsCompleted / activeCrew).toFixed(1)
    : '0.0';
  const overdueReceivables = receivables.filter((record) => record.status === 'Overdue');
  const dueSoonPayables = payables.filter((record) => record.status === 'Upcoming');
  const readyCrew = crew.filter((member) => member.status === 'active' && (member.assignedJobs ?? 0) === 0).length;
  const overloadedCrew = crew.filter((member) => (member.assignedJobs ?? 0) >= 3).length;
  const activeQuotePipeline = reviewQuotes.length + closeReadyQuotes.length;
  const activeQuotePipelineValue = reviewPipelineValue + closeReadyValue;
  const executiveSignals = [
    {
      title: 'Run-Rate Projection',
      value: formatCurrency(runRateRevenue),
      detail: `${runRateGap >= 0 ? '+' : ''}${formatCurrency(runRateGap)} versus monthly target if current pace holds.`,
      tone: runRateGap >= 0 ? ('emerald' as const) : ('amber' as const),
    },
    {
      title: 'Revenue Pace',
      value: `${formatCurrency(metrics.goals.currentRevenue)} / ${formatCurrency(monthProgressTarget)}`,
      detail: 'Current month revenue versus where the target says you should be today.',
      tone: metrics.goals.currentRevenue >= monthProgressTarget ? ('emerald' as const) : ('blue' as const),
    },
    {
      title: 'Scenario Revenue',
      value: formatCurrency(scenarioRevenue),
      detail: `Current revenue plus close-ready value and review pipeline at the current ${quoteConversion}% conversion rate.`,
      tone: scenarioRevenue >= metrics.goals.monthlyRevenueTarget ? ('emerald' as const) : ('slate' as const),
    },
  ];

  const stats = [
    {
      label: 'Revenue · MTD',
      value: formatCurrency(metrics.goals.currentRevenue),
      detail: `${metrics.goals.revenueChange >= 0 ? '+' : ''}${metrics.goals.revenueChange}% vs last month`,
      tone: 'emerald' as const,
    },
    {
      label: 'Jobs Completed',
      value: String(metrics.operationsSnapshot.jobsCompleted),
      detail: `${metrics.goals.currentJobs}/${metrics.goals.monthlyJobsTarget} monthly target`,
      tone: 'blue' as const,
    },
    {
      label: 'Gross Margin',
      value: `${metrics.operationsSnapshot.grossMargin}%`,
      detail: `${metrics.operationsSnapshot.labourPercent}% labour mix`,
      tone: 'slate' as const,
    },
    {
      label: 'Active Alerts',
      value: String(alertsFeed.length),
      detail: `${activeCrew} active crew · ${quoteConversion}% quote conversion`,
      tone: alertsFeed.length > 0 ? ('amber' as const) : ('emerald' as const),
    },
  ];

  const queueItems = [
    {
      key: 'revenue-gap',
      title: revenueGap > 0 ? `${formatCurrency(revenueGap)} below revenue target` : 'Revenue target is on track',
      detail: revenueGap > 0
        ? 'Open reports to compare actual revenue against service mix and identify where the shortfall is coming from.'
        : 'Current month revenue is at or above the configured target.',
      tone: revenueGap > 0 ? ('amber' as const) : ('emerald' as const),
      actionLabel: 'Open reports',
      onAction: () => setTab('reports'),
    },
    {
      key: 'receivables',
      title: `${metrics.outstandingReceivables.count} receivables still open`,
      detail: `${formatCurrency(metrics.outstandingReceivables.total)} remains outstanding across active invoices.`,
      tone: metrics.outstandingReceivables.count > 0 ? ('red' as const) : ('emerald' as const),
      actionLabel: 'Open money',
      href: '/dashboard/invoices?tab=invoices&status=Overdue',
    },
    {
      key: 'pipeline',
      title: `${reviewQuotes.length} quotes still in the review queue`,
      detail: jobsGap > 0
        ? `${jobsGap} jobs short of target means quote conversion matters right now.`
        : 'Use the quote queue to keep the next wave of work healthy.',
      tone: reviewQuotes.length > 0 ? ('blue' as const) : ('slate' as const),
      actionLabel: 'Open quotes',
      href: '/dashboard/quotes?workspace=review',
    },
  ];

  const tabs = [
    { key: 'overview' as const, label: 'Overview' },
    { key: 'reports' as const, label: 'Reports' },
    { key: 'visitors' as const, label: 'Visitors' },
  ];
  const focusTabs = [
    { key: 'ceo' as const, label: 'CEO' },
    { key: 'growth' as const, label: 'Growth' },
    { key: 'sales' as const, label: 'Sales' },
    { key: 'ops' as const, label: 'Ops' },
    { key: 'finance' as const, label: 'Finance' },
  ];

  if (error && !hasSnapshot && !isLoading) {
    return (
      <div className="grid gap-6 w-full px-4 md:px-10 lg:px-12 pb-14">
        <WorkbenchHeader
        eyebrow="Insights Workspace"
        title="Read performance like an operations system, not a report dump."
        description="Insights now combines the live dashboard snapshot with funnel and visitor analytics, so this workspace is unavailable until that data loads."
          actions={(
            <button
              type="button"
              onClick={() => { void refetch(); }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm"
              aria-label="Refresh insights"
            >
              <RefreshIcon />
            </button>
          )}
        />
        <ErrorMessage message={error} onRetry={() => { void refetch(); }} />
      </div>
    );
  }

  return (
    <div className="grid gap-6 w-full px-4 md:px-10 lg:px-12 pb-14">
      <WorkbenchHeader
        eyebrow="Insights Workspace"
        title="Read performance like an operations system, not a report dump."
        description="Insights now starts with target gap, receivables pressure, quote pipeline health, and tracked funnel behaviour before you dive into reports or visitor analytics."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            {lastUpdated ? (
              <HeaderBadge
                label={`Updated ${formatRelativeTime(lastUpdated)}`}
                title={`Last updated ${formatDate(lastUpdated)}`}
                tone="slate"
              />
            ) : null}
            {isRefreshing ? <HeaderBadge label="Refreshing live data" tone="emerald" /> : null}
            <button
              type="button"
              onClick={() => { void refetch(); }}
              disabled={isLoading}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Refresh insights"
            >
              <RefreshIcon className={isRefreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            </button>
          </div>
        )}
      />

      {error && hasSnapshot ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>Refresh failed. Showing the last cached dashboard snapshot until the next successful load.</p>
            <button
              type="button"
              onClick={() => { void refetch(); }}
              className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-800 shadow-sm"
            >
              Retry now
            </button>
          </div>
        </div>
      ) : null}

      {isLoading && !hasSnapshot ? (
        <InsightsLoadingState />
      ) : (
        <>
          <WorkbenchStatGrid stats={stats} />
          <WorkbenchTabs tabs={tabs} activeTab={tab} onTabChange={setTab} />
          <WorkbenchQueue
            title="Insights Focus Queue"
            subtitle="Priority signals derived from the current dashboard snapshot."
            items={queueItems}
          />

          {tab === 'overview' ? (
            <div className="grid gap-5">
              <WorkbenchTabs tabs={focusTabs} activeTab={focusArea} onTabChange={setFocusArea} />

              {focusArea === 'ceo' ? (
                <>
                  <section className="rounded-[24px] border border-black/5 bg-white/90 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">CEO View</p>
                        <p className="text-sm text-slate-500">Pace, scenario revenue, and whether the month is still recoverable.</p>
                      </div>
                      <HeaderBadge
                        label={`${now.getDate()} / ${monthDays} days into the month`}
                        tone="slate"
                        title={`Pace checkpoint for ${formatDate(now.toISOString())}`}
                      />
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-3">
                      {executiveSignals.map((signal) => (
                        <InsightSnapshotCard
                          key={signal.title}
                          title={signal.title}
                          value={signal.value}
                          detail={signal.detail}
                          tone={signal.tone}
                        />
                      ))}
                    </div>
                  </section>

                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                    <div className="grid gap-5">
                      <Panel title="Strategic Snapshot" subtitle="The few numbers that explain the month right now.">
                        <div className="space-y-2">
                          <StatRow label="Revenue target gap" value={formatCurrency(revenueGap)} />
                          <StatRow label="Jobs target gap" value={String(jobsGap)} />
                          <StatRow label="Active quote pipeline" value={`${activeQuotePipeline} quotes · ${formatCurrency(activeQuotePipelineValue)}`} />
                          <StatRow label="Alerts in play" value={`${alertsFeed.length} live`} />
                        </div>
                      </Panel>

                      <Panel title="What Changes The Month" subtitle="These are the levers with the biggest immediate impact.">
                        <div className="space-y-2">
                          <StatRow label="Close-ready revenue" value={formatCurrency(closeReadyValue)} />
                          <StatRow label="Review revenue at risk" value={formatCurrency(reviewPipelineValue)} />
                          <StatRow label="Outstanding receivables" value={formatCurrency(metrics.outstandingReceivables.total)} />
                          <StatRow label="Upcoming payables" value={formatCurrency(metrics.upcomingPayables.total)} />
                        </div>
                      </Panel>
                    </div>

                    <div className="grid gap-5">
                      <Panel title="Open Next" subtitle="The few places most likely to move the month right now.">
                        <div className="flex flex-wrap gap-2">
                          <Link href="/dashboard/quotes?workspace=review" className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                            Review quote queue
                          </Link>
                          <Link href="/dashboard/quotes?status=finalized,payment_pending" className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                            Chase payment-ready quotes
                          </Link>
                          <Link href="/dashboard/invoices?tab=invoices&status=Overdue" className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                            Reduce overdue receivables
                          </Link>
                          <Link href="/dashboard/alerts" className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                            Resolve alerts
                          </Link>
                        </div>
                      </Panel>

                      <Panel title="Service Leaders" subtitle="Top revenue contributors this month." right={`${metrics.revenueByService.length} tracked services`}>
                        <div className="space-y-2">
                          {metrics.revenueByService.slice(0, 5).map((service) => (
                            <StatRow key={service.service} label={service.service} value={formatCurrency(service.amount)} />
                          ))}
                        </div>
                      </Panel>
                    </div>
                  </div>
                </>
              ) : null}

              {focusArea === 'growth' ? (
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                  <div className="grid gap-5">
                    <Panel title="Growth Signals" subtitle="Quote demand, service momentum, and what changed in the last 7 days." right={`${quotesLast7.length} quotes in the last 7 days`}>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-2">
                          <StatRow label="Quote intake trend" value={`${quoteIntakeDelta >= 0 ? '+' : ''}${quoteIntakeDelta}%`} />
                          <StatRow label="Review pipeline value" value={formatCurrency(reviewPipelineValue)} />
                          <StatRow label="Close-ready value" value={formatCurrency(closeReadyValue)} />
                        </div>
                        <div className="space-y-2">
                          {serviceDemandLast7.length > 0 ? serviceDemandLast7.map((service) => (
                            <StatRow key={service.service} label={`${service.service} · ${service.count} quotes`} value={formatCurrency(service.value)} />
                          )) : (
                            <div className="rounded-xl border border-dashed border-black/10 bg-white/70 px-4 py-6 text-sm text-slate-500">
                              No recent quote demand captured yet.
                            </div>
                          )}
                        </div>
                      </div>
                    </Panel>

                    <Panel title="Revenue Mix Momentum" subtitle="What the last 7 days says about where next month is forming.">
                      <div className="space-y-2">
                        {serviceDemandLast7.length > 0 ? serviceDemandLast7.map((service) => (
                          <StatRow
                            key={`${service.service}-mix`}
                            label={`${service.service} share`}
                            value={`${Math.round((service.value / Math.max(1, activeQuotePipelineValue)) * 100)}% of active pipeline`}
                          />
                        )) : (
                          <div className="rounded-xl border border-dashed border-black/10 bg-white/70 px-4 py-6 text-sm text-slate-500">
                            Wait for more quote flow to build a growth picture.
                          </div>
                        )}
                      </div>
                    </Panel>

                    <Panel
                      title="NDIS Program"
                      subtitle="Volume, conversion, and routing health for NDIS household-tasks quotes."
                      right={
                        ndisInsights.total > 0
                          ? `${ndisInsights.total} lifetime · ${ndisInsights.last30Count} in 30d`
                          : 'No NDIS quotes yet'
                      }
                    >
                      {ndisInsights.total > 0 ? (
                        <div className="space-y-4">
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div className="space-y-2">
                              <StatRow label="Paid NDIS revenue" value={formatCurrency(ndisInsights.revenue)} />
                              <StatRow label="Active NDIS pipeline" value={formatCurrency(ndisInsights.pipelineValue)} />
                              <StatRow label="Conversion rate" value={`${ndisInsights.conversion}%`} />
                              <StatRow
                                label="Avg hours per quote"
                                value={ndisInsights.avgHours > 0 ? `${ndisInsights.avgHours.toFixed(1)} hr` : '—'}
                              />
                            </div>
                            <div className="space-y-2">
                              <StatRow
                                label="Cleaning vs Yard"
                                value={`${ndisInsights.cleaningCount} cleaning · ${ndisInsights.yardCount} yard`}
                              />
                              <StatRow label="Forwarded to funder" value={`${ndisInsights.forwarded} / ${ndisInsights.total}`} />
                              <StatRow label="Accepted" value={`${ndisInsights.accepted} / ${ndisInsights.total}`} />
                              <StatRow label="Booked" value={`${ndisInsights.booked} / ${ndisInsights.total}`} />
                            </div>
                          </div>
                          <div>
                            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              By management type
                            </div>
                            <div className="grid gap-2 sm:grid-cols-3">
                              {(['plan_managed', 'self_managed', 'agency_managed'] as const).map((key) => {
                                const b = ndisInsights.byMgmt[key];
                                const label =
                                  key === 'plan_managed' ? 'Plan-managed'
                                  : key === 'self_managed' ? 'Self-managed'
                                  : 'Agency-managed';
                                const conv = b.total > 0 ? Math.round((b.won / b.total) * 100) : 0;
                                return (
                                  <div key={key} className="rounded-xl border border-violet-200 bg-violet-50/50 px-3 py-2.5">
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">{label}</div>
                                    <div className="mt-0.5 text-sm font-semibold text-slate-900">
                                      {b.total} {b.total === 1 ? 'quote' : 'quotes'}
                                    </div>
                                    <div className="text-[11px] text-slate-600">
                                      {formatCurrency(b.value)} · {conv}% paid
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-black/10 bg-white/70 px-4 py-6 text-sm text-slate-500">
                          No NDIS quotes yet. Once participants submit through the NDIS flow, you&rsquo;ll see
                          volume, conversion, and routing health here.
                        </div>
                      )}
                    </Panel>

                    <Panel
                      title="Partner Referrals"
                      subtitle="Tracked outbound clicks from the NDIS quote flow into trusted partners."
                      right={maluCareReferral ? `${maluCareReferral.totalClicks} MaluCare clicks` : 'No partner clicks yet'}
                    >
                      {maluCareReferral ? (
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="space-y-2">
                            <StatRow label="MaluCare clicks · 30 days" value={String(maluCareReferral.totalClicks)} />
                            <StatRow label="Tracked unique sessions" value={String(maluCareReferral.uniqueSessions)} />
                            <StatRow label="Last 7 days" value={`${maluCareReferral.clicksLast7Days} (${formatDelta(maluCareReferral.clicksLast7Days, maluCareReferral.clicksPrev7Days)})`} />
                            <StatRow
                              label="Last click"
                              value={maluCareReferral.lastClickedAt ? formatRelativeTime(maluCareReferral.lastClickedAt) : 'No clicks yet'}
                            />
                          </div>
                          <div className="space-y-2">
                            <StatRow label="Destination" value={maluCareReferral.destinationUrl || 'https://malucare.org/'} />
                            {maluCareReferral.topSources.length > 0 ? maluCareReferral.topSources.map((source) => (
                              <StatRow
                                key={source.source}
                                label={`Source · ${source.source}`}
                                value={`${source.clicks} click${source.clicks === 1 ? '' : 's'}`}
                              />
                            )) : (
                              <div className="rounded-xl border border-dashed border-black/10 bg-white/70 px-4 py-6 text-sm text-slate-500">
                                Waiting for the first tracked MaluCare referral click.
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-black/10 bg-white/70 px-4 py-6 text-sm text-slate-500">
                          No MaluCare referral clicks have been captured yet. Once someone clicks the partner badge in the NDIS quote flow, it will show up here.
                        </div>
                      )}
                    </Panel>
                  </div>

                  <div className="grid gap-5">
                    <Panel title="Growth To Watch" subtitle="Signals that demand is heating up or cooling off.">
                      <div className="space-y-2">
                        <StatRow label="Quotes last 7 days" value={String(quotesLast7.length)} />
                        <StatRow label="Quotes previous 7 days" value={String(quotesPrev7.length)} />
                        <StatRow label="Projected month-end revenue" value={formatCurrency(runRateRevenue)} />
                        <StatRow label="Scenario month-end revenue" value={formatCurrency(scenarioRevenue)} />
                      </div>
                    </Panel>
                  </div>
                </div>
              ) : null}

              {focusArea === 'sales' ? (
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                  <div className="grid gap-5">
                    <Panel title="Sales Engine" subtitle="Speed to close, pipeline drag, and which services are actually converting.">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-2">
                          <StatRow label="Avg quote to finalized" value={formatDurationHours(avgQuoteToFinalizeHours)} />
                          <StatRow label="Avg quote to payment request" value={formatDurationHours(avgQuoteToPaymentRequestHours)} />
                          <StatRow label="Stale review quotes" value={`${staleReviewQuotes.length} older than 48h`} />
                          <StatRow label="Stalled payment quotes" value={`${stalledPaymentQuotes.length} older than 72h`} />
                        </div>
                        <div className="space-y-2">
                          {serviceWinRates.length > 0 ? serviceWinRates.map((service) => (
                            <StatRow key={service.service} label={`${service.service} · ${service.pipeline} still open`} value={`${service.winRate}% won`} />
                          )) : (
                            <div className="rounded-xl border border-dashed border-black/10 bg-white/70 px-4 py-6 text-sm text-slate-500">
                              No service win-rate data available yet.
                            </div>
                          )}
                        </div>
                      </div>
                    </Panel>

                    <Panel title="Pipeline Pressure" subtitle="Where the quote engine is slowing down.">
                      <div className="space-y-2">
                        <StatRow label="Review queue" value={`${reviewQuotes.length} quotes`} />
                        <StatRow label="Close-ready quotes" value={`${closeReadyQuotes.length} quotes`} />
                        <StatRow label="Review queue value" value={formatCurrency(reviewPipelineValue)} />
                        <StatRow label="Close-ready value" value={formatCurrency(closeReadyValue)} />
                      </div>
                    </Panel>
                  </div>

                  <div className="grid gap-5">
                    <Panel title="Actions" subtitle="What the sales side should do next.">
                      <div className="flex flex-wrap gap-2">
                        <Link href="/dashboard/quotes?workspace=review" className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          Clear review queue
                        </Link>
                        <Link href="/dashboard/quotes?status=finalized,payment_pending" className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          Follow up unpaid quotes
                        </Link>
                      </div>
                    </Panel>
                  </div>
                </div>
              ) : null}

              {focusArea === 'ops' ? (
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                  <div className="grid gap-5">
                    <Panel title="Operations Pressure" subtitle="Capacity, receivables, and signals likely to distort delivery.">
                      <div className="space-y-2">
                        <StatRow label="Jobs per active crew" value={completedJobsPerActiveCrew} />
                        <StatRow label="Due soon workload" value={`${metrics.alerts.dueSoonCount} jobs`} />
                        <StatRow label="Ready crew capacity" value={`${readyCrew} crew unassigned`} />
                        <StatRow label="Overloaded crew" value={`${overloadedCrew} crew with 3+ jobs`} />
                      </div>
                    </Panel>

                    <Panel title="Crew Snapshot" subtitle="What the current crew mix says about execution risk.">
                      <div className="space-y-2">
                        <StatRow label="Active crew" value={String(activeCrew)} />
                        <StatRow label="Crew listed" value={String(crew.length)} />
                        <StatRow label="Jobs completed this month" value={String(metrics.operationsSnapshot.jobsCompleted)} />
                        <StatRow label="Average job value" value={formatCurrency(metrics.operationsSnapshot.averageJobValue)} />
                      </div>
                    </Panel>
                  </div>

                  <div className="grid gap-5">
                    <Panel title="Margin + Labour" subtitle="Operational quality through a unit-economics lens.">
                      <div className="space-y-2">
                        <StatRow label="Gross margin" value={`${metrics.operationsSnapshot.grossMargin}%`} />
                        <StatRow label="Labour mix" value={`${metrics.operationsSnapshot.labourPercent}%`} />
                        <StatRow label="Net profit" value={formatCurrency(metrics.netProfit.amount)} />
                        <StatRow label="Overdue amount" value={formatCurrency(metrics.alerts.overdueAmount)} />
                      </div>
                    </Panel>
                  </div>
                </div>
              ) : null}

              {focusArea === 'finance' ? (
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                  <div className="grid gap-5">
                    <Panel title="Finance Snapshot" subtitle="Cash pressure, margin, and what still needs to land.">
                      <div className="space-y-2">
                        <StatRow label="Net profit MTD" value={formatCurrency(metrics.netProfit.amount)} />
                        <StatRow label="Outstanding receivables" value={formatCurrency(metrics.outstandingReceivables.total)} />
                        <StatRow label="Upcoming payables" value={formatCurrency(metrics.upcomingPayables.total)} />
                        <StatRow label="Cash balance proxy" value={formatCurrency(metrics.cashBalance)} />
                      </div>
                    </Panel>

                    <Panel title="Money Flow" subtitle="What has been received, what is due, and what is owed.">
                      <div className="space-y-2">
                        <StatRow label="Incoming received" value={formatCurrency(moneyFlow.overview.incomingReceived)} />
                        <StatRow label="Outgoing paid" value={formatCurrency(moneyFlow.overview.outgoingPaid)} />
                        <StatRow label="Outstanding invoices" value={formatCurrency(moneyFlow.overview.outstandingInvoices)} />
                        <StatRow label="Payroll owed" value={formatCurrency(moneyFlow.overview.payrollOwed)} />
                      </div>
                    </Panel>
                  </div>

                  <div className="grid gap-5">
                    <Panel title="Finance Risks" subtitle="The most immediate balance-sheet pressure points.">
                      <div className="space-y-2">
                        <StatRow label="Overdue invoices" value={`${overdueReceivables.length} records`} />
                        <StatRow label="Due payables" value={`${dueSoonPayables.length} records`} />
                        <StatRow label="Gross margin" value={`${metrics.operationsSnapshot.grossMargin}%`} />
                        <StatRow label="Receivables count" value={String(metrics.outstandingReceivables.count)} />
                      </div>
                    </Panel>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === 'reports' ? <ReportsView metrics={metrics} crewCount={activeCrew} embedded /> : null}
          {tab === 'visitors' ? <VisitorsTab /> : null}
        </>
      )}
    </div>
  );
}

export default function InsightsPage() {
  return (
    <Suspense fallback={<div className="min-h-[320px] w-full" />}>
      <InsightsPageContent />
    </Suspense>
  );
}
