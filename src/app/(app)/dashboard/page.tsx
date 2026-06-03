'use client';

import Link from 'next/link';
import type React from 'react';
import { useMemo } from 'react';
import { ErrorMessage } from './components/shared';
import { useDashboardData } from './hooks/useDashboardData';
import { formatCurrency } from '@/lib/dashboard/utils';
import {
  normalizeQuoteStatus,
  type DashboardLead,
  type DashboardOverview,
  type DashboardQuote,
  type JobRecord,
} from '@/types/dashboard';
import { OverviewCard } from './_components/OverviewCard';
import { RevenueChartCard } from './_components/RevenueChartCard';
import { PopularServicesCard, type PopularService } from './_components/PopularServicesCard';
import { RecentFeedbackCard, type FeedbackItem } from './_components/RecentFeedbackCard';
import { StatusPill } from './_components/StatusPill';

type AvatarLead = {
  initials: string;
  name: string;
};

export default function DashboardHome() {
  const {
    overview,
    metrics,
    moneyFlow,
    jobs,
    quotes,
    channelLeads,
    alertsFeed,
    applicantCount,
    isLoading,
    error,
    refetch,
  } = useDashboardData();

  const fallbackOverview = useMemo(
    () => buildFallbackOverview({ metrics, moneyFlow, jobs, quotes, channelLeads, alertsFeed, applicantCount }),
    [metrics, moneyFlow, jobs, quotes, channelLeads, alertsFeed, applicantCount],
  );
  const dashboard = overview ?? fallbackOverview;

  const leadAvatars = useMemo(
    () => buildLeadAvatars(channelLeads, dashboard.quotesAwaitingReview),
    [channelLeads, dashboard.quotesAwaitingReview],
  );

  const services = useMemo<PopularService[]>(
    () => dashboard.popularServices.map((service, index) => ({
      name: service.name,
      status: 'Active',
      price: formatCurrency(service.amount),
      shade: index === 0 ? 'dark' : index > 2 ? 'soft' : 'mid',
    })),
    [dashboard.popularServices],
  );

  const feedback = useMemo<FeedbackItem[]>(
    () => dashboard.recentFeedback.map((item) => ({
      initials: getInitials(item.customer),
      customer: item.customer,
      service: item.service,
      quote: item.quote,
      rating: item.rating,
    })),
    [dashboard.recentFeedback],
  );

  if (error) {
    return (
      <div className="px-1 pb-6 sm:px-2">
        <ErrorMessage message={error} onRetry={refetch} />
      </div>
    );
  }

  if (isLoading) {
    return <DashboardLoading />;
  }

  return (
    <div className="grid gap-3 px-1 pb-3 sm:px-1.5">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <div className="grid gap-3 xl:col-span-8">
          <OverviewCard
            customers={formatCount(dashboard.customerCount)}
            revenue={formatCompactCurrency(dashboard.revenueMTD)}
            newLeadsCount={dashboard.newLeadsThisWeek}
            leads={leadAvatars}
          />

          <ActionCentreCard
            jobs={dashboard.jobsToday}
            quotes={dashboard.quotesAwaitingReview}
            applicantsAwaitingApproval={dashboard.applicantsAwaitingApproval}
            alertCount={dashboard.alertCount}
          />

          <RevenueChartCard points={dashboard.revenueHistory} />
        </div>

        <aside className="grid content-start gap-3 xl:col-span-4">
          <PopularServicesCard services={services} />
          <RecentFeedbackCard feedback={feedback} />
          <div className="grid grid-cols-2 gap-3">
            <MiniKpi label="Jobs completed" value={String(dashboard.jobsCompleted)} />
            <MiniKpi label="Alerts open" value={String(dashboard.alertCount)} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function DashboardLoading() {
  return (
    <div className="grid gap-3 px-1 pb-3 sm:px-1.5 xl:grid-cols-12">
      <div className="grid gap-3 xl:col-span-8">
        <div className="h-[150px] animate-pulse rounded-[26px] bg-white/80" />
        <div className="h-[190px] animate-pulse rounded-[26px] bg-white/80" />
        <div className="h-[220px] animate-pulse rounded-[26px] bg-white/80" />
      </div>
      <div className="grid content-start gap-3 xl:col-span-4">
        <div className="h-[250px] animate-pulse rounded-[26px] bg-white/80" />
        <div className="h-[190px] animate-pulse rounded-[26px] bg-white/80" />
      </div>
    </div>
  );
}

function ActionCentreCard({
  jobs,
  quotes,
  applicantsAwaitingApproval,
  alertCount,
}: {
  jobs: JobRecord[];
  quotes: DashboardQuote[];
  applicantsAwaitingApproval: number;
  alertCount: number;
}) {
  return (
    <section className="rounded-[26px] border border-[#dfe9e2] bg-white px-4 py-4 shadow-[0_18px_48px_rgba(15,61,46,0.07)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-extrabold leading-tight text-[#17392b]">Action Centre</h2>
          <p className="mt-0.5 text-[12px] font-semibold text-[#87968d]">Work that needs a decision today</p>
        </div>
        <Link href="/dashboard/alerts" className="text-[13px] font-bold text-[#3c8259]">Review all</Link>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-4">
        <ActionMetric href="/dashboard/quotes?workspace=review" label="Quotes" value={quotes.length} />
        <ActionMetric href="/dashboard/schedule?view=day" label="Jobs today" value={jobs.length} />
        <ActionMetric href="/dashboard/applicants?filter=awaiting_approval" label="Applicants" value={applicantsAwaitingApproval} />
        <ActionMetric href="/dashboard/alerts" label="Alerts" value={alertCount} />
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        <ActionList title="Quotes awaiting review" empty="No quotes awaiting review">
          {quotes.slice(0, 3).map((quote) => (
            <Link key={quote.id} href="/dashboard/quotes?workspace=review" className="flex items-center justify-between gap-3 rounded-[16px] bg-[#f4faf6] px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-extrabold text-[#273f34]">{quote.customer_name || 'New customer'}</p>
                <p className="truncate text-[12px] font-semibold text-[#87968d]">{quote.service_type || 'Service quote'}</p>
              </div>
              <p className="shrink-0 text-[13px] font-extrabold text-[#273f34]">{formatCurrency(Number(quote.reviewed_total ?? quote.submitted_total ?? quote.total ?? 0))}</p>
            </Link>
          ))}
        </ActionList>

        <ActionList title="Jobs scheduled today" empty="No jobs scheduled today">
          {jobs.slice(0, 3).map((job) => (
            <Link key={job.id} href="/dashboard/schedule?view=day" className="flex items-center justify-between gap-3 rounded-[16px] bg-[#f4faf6] px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-extrabold text-[#273f34]">{job.customer}</p>
                <p className="truncate text-[12px] font-semibold text-[#87968d]">{job.service}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[12px] font-extrabold text-[#273f34]">{job.scheduledTime || 'TBD'}</p>
                <StatusPill tone={job.status === 'completed' ? 'green' : 'neutral'}>{job.status.replace('_', ' ')}</StatusPill>
              </div>
            </Link>
          ))}
        </ActionList>
      </div>
    </section>
  );
}

function ActionMetric({ href, label, value }: { href: string; label: string; value: number }) {
  return (
    <Link href={href} className="rounded-[18px] border border-[#dfe9e2] bg-[#fbfdfb] px-3 py-2.5 transition hover:bg-[#f4faf6]">
      <p className="text-[22px] font-extrabold leading-none text-[#17392b]">{value}</p>
      <p className="mt-1 truncate text-[11px] font-bold uppercase tracking-[0.08em] text-[#839188]">{label}</p>
    </Link>
  );
}

function ActionList({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <div className="min-h-[112px] rounded-[18px] border border-[#e4ede7] p-2">
      <p className="px-1 pb-2 text-[12px] font-extrabold text-[#17392b]">{title}</p>
      <div className="space-y-2">
        {hasChildren ? children : (
          <p className="rounded-[16px] bg-[#f4faf6] px-3 py-3 text-[13px] font-semibold text-[#7f9187]">{empty}</p>
        )}
      </div>
    </div>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-[#dfe9e2] bg-white px-4 py-3 shadow-[0_18px_48px_rgba(15,61,46,0.06)]">
      <p className="text-[24px] font-extrabold leading-none text-[#17392b]">{value}</p>
      <p className="mt-1 text-[12px] font-bold text-[#839188]">{label}</p>
    </div>
  );
}

function buildFallbackOverview({
  metrics,
  moneyFlow,
  jobs,
  quotes,
  channelLeads,
  alertsFeed,
  applicantCount,
}: {
  metrics: ReturnType<typeof useDashboardData>['metrics'];
  moneyFlow: ReturnType<typeof useDashboardData>['moneyFlow'];
  jobs: JobRecord[];
  quotes: DashboardQuote[];
  channelLeads: DashboardLead[];
  alertsFeed: ReturnType<typeof useDashboardData>['alertsFeed'];
  applicantCount: number;
}): DashboardOverview {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const dedupedQuotes = dedupeQuotes(quotes);
  const customerNames = new Set<string>();

  jobs.forEach((job) => customerNames.add(job.customer.trim().toLowerCase()));
  dedupedQuotes.forEach((quote) => {
    if (quote.customer_name) customerNames.add(quote.customer_name.trim().toLowerCase());
  });
  channelLeads.forEach((lead) => {
    if (lead.customer_name) customerNames.add(lead.customer_name.trim().toLowerCase());
  });

  return {
    customerCount: customerNames.size,
    newLeadsThisWeek: [
      ...dedupedQuotes.map((quote) => quote.created_at),
      ...channelLeads.map((lead) => lead.created_at),
    ].filter((createdAt) => new Date(createdAt).getTime() >= weekAgo).length,
    revenueMTD: metrics.goals.currentRevenue || moneyFlow.overview.revenueThisMonth,
    revenueHistory: moneyFlow.series.slice(-14).map((point) => ({
      label: new Date(point.date).toLocaleDateString('en-AU', { weekday: 'short' }),
      value: Math.max(0, Math.round(point.revenue)),
      date: point.date,
    })),
    jobsToday: jobs.filter((job) => job.scheduledDate === todayKey).sort(compareJobs).slice(0, 5),
    quotesAwaitingReview: dedupedQuotes
      .filter((quote) => ['submitted', 'in_review'].includes(normalizeQuoteStatus(quote.status)))
      .slice(0, 6),
    applicantsAwaitingApproval: applicantCount,
    alertCount: alertsFeed.length,
    popularServices: metrics.revenueByService.slice(0, 5).map((service) => ({ name: service.service, amount: service.amount })),
    recentFeedback: [],
    jobsCompleted: metrics.operationsSnapshot.jobsCompleted || jobs.filter((job) => job.status === 'completed').length,
    dataLineage: [],
  };
}

function buildLeadAvatars(channelLeads: DashboardLead[], quotes: DashboardQuote[]): AvatarLead[] {
  const seen = new Set<string>();
  return [...channelLeads, ...quotes]
    .sort((left, right) => new Date(getCreatedAt(right)).getTime() - new Date(getCreatedAt(left)).getTime())
    .flatMap((entry) => {
      const name = getName(entry);
      if (!name) return [];
      const key = name.trim().toLowerCase();
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ name: firstName(name), initials: getInitials(name) }];
    })
    .slice(0, 5);
}

function compareJobs(a: Pick<JobRecord, 'scheduledDate' | 'scheduledTime'>, b: Pick<JobRecord, 'scheduledDate' | 'scheduledTime'>) {
  const left = new Date(`${a.scheduledDate || '9999-12-31'}T${a.scheduledTime || '23:59:59'}`);
  const right = new Date(`${b.scheduledDate || '9999-12-31'}T${b.scheduledTime || '23:59:59'}`);
  return left.getTime() - right.getTime();
}

function dedupeQuotes(quotes: DashboardQuote[]) {
  const seen = new Set<string>();
  return quotes.filter((quote) => {
    const signature = [
      quote.id,
      (quote.customer_name || '').trim().toLowerCase(),
      quote.service_type || '',
      Math.round(Number(quote.reviewed_total ?? quote.submitted_total ?? quote.total ?? 0) * 100),
      quote.created_at.slice(0, 10),
    ].join('|');
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function getCreatedAt(entry: DashboardLead | DashboardQuote) {
  return entry.created_at;
}

function getName(entry: DashboardLead | DashboardQuote) {
  return entry.customer_name;
}

function firstName(name: string) {
  return name.split(' ').filter(Boolean)[0] || name;
}

function getInitials(name: string | null | undefined) {
  if (!name) return 'BW';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'BW';
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-AU').format(value);
}

function formatCompactCurrency(value: number) {
  if (value >= 1000) {
    const amount = value / 1000;
    return `$${amount.toFixed(1)}k`;
  }
  return formatCurrency(value);
}
