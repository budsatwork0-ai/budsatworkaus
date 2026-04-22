'use client';

import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { brand } from '@/app/ui/theme';
import ReportsPage from '../reports/page';
import VisitorsTab from '../components/tabs/VisitorsTab';
import { WorkbenchHeader, WorkbenchQueue, WorkbenchStatGrid, WorkbenchTabs } from '../components/Workbench';
import { Panel, StatRow } from '../components/shared';
import { useDashboardData } from '../hooks/useDashboardData';
import { useTabbedNav } from '../hooks/useTabbedNav';
import { formatCurrency } from '@/lib/dashboard/utils';

type Tab = 'overview' | 'reports' | 'visitors';

function sanitizeTab(value: string | null): Tab {
  if (value === 'reports' || value === 'visitors') return value;
  return 'overview';
}

function normalizeQuoteStatus(status: string) {
  if (status === 'pending') return 'submitted';
  if (status === 'approved') return 'finalized';
  if (status === 'adjusted') return 'in_review';
  if (status === 'converted') return 'paid';
  return status;
}

function InsightsPageContent() {
  const [tab, setTab] = useTabbedNav<Tab>('tab', sanitizeTab);
  const { metrics, alertsFeed, quotes, crew } = useDashboardData();

  const reviewQuotes = useMemo(
    () => quotes.filter((quote) => normalizeQuoteStatus(quote.status) === 'submitted' || normalizeQuoteStatus(quote.status) === 'in_review'),
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

  return (
    <div className="grid gap-6 w-full px-4 md:px-10 lg:px-12 pb-14">
      <WorkbenchHeader
        eyebrow="Insights Workspace"
        title="Read performance like an operations system, not a report dump."
        description="Insights now starts with the signals that matter: target gap, receivables pressure, and quote pipeline health before you dive into reports or visitor analytics."
      />

      <WorkbenchStatGrid stats={stats} />
      <WorkbenchTabs tabs={tabs} activeTab={tab} onTabChange={setTab} />
      <WorkbenchQueue
        title="Insights Focus Queue"
        subtitle="Priority signals derived from the current dashboard snapshot."
        items={queueItems}
      />

      {tab === 'overview' ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <Panel
            title="Service Leaders"
            subtitle="Top revenue contributors this month."
            right={`${metrics.revenueByService.length} tracked services`}
          >
            <div className="space-y-2">
              {metrics.revenueByService.slice(0, 5).map((service) => (
                <StatRow
                  key={service.service}
                  label={service.service}
                  value={formatCurrency(service.amount)}
                />
              ))}
              {metrics.revenueByService.length === 0 ? (
                <div className="rounded-xl border border-dashed border-black/10 bg-white/70 px-4 py-6 text-sm text-slate-500">
                  No revenue by service data available yet.
                </div>
              ) : null}
            </div>
          </Panel>

          <div className="grid gap-5">
            <Panel title="Target Position" subtitle="Current targets versus actual performance.">
              <div className="space-y-2">
                <StatRow
                  label="Revenue Target"
                  value={`${formatCurrency(metrics.goals.currentRevenue)} / ${formatCurrency(metrics.goals.monthlyRevenueTarget)}`}
                />
                <StatRow
                  label="Jobs Target"
                  value={`${metrics.goals.currentJobs} / ${metrics.goals.monthlyJobsTarget}`}
                />
                <StatRow
                  label="Quote Conversion"
                  value={`${quoteConversion}%`}
                />
              </div>
            </Panel>

            <Panel title="Operational Signals" subtitle="Fast read on what’s distorting the month.">
              <div className="space-y-2">
                <StatRow label="Overdue amount" value={formatCurrency(metrics.alerts.overdueAmount)} />
                <StatRow label="Due soon workload" value={`${metrics.alerts.dueSoonCount} jobs`} />
                <StatRow label="Net profit" value={formatCurrency(metrics.netProfit.amount)} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/dashboard/alerts" className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  Open alerts
                </Link>
                <Link href="/dashboard/invoices?tab=overview" className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  Open money
                </Link>
                <Link href="/dashboard/quotes?workspace=review" className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  Open quotes
                </Link>
              </div>
            </Panel>
          </div>
        </div>
      ) : null}

      {tab === 'reports' ? <ReportsPage /> : null}
      {tab === 'visitors' ? <VisitorsTab /> : null}
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
