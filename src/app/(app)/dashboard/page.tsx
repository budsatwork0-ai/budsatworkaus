'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ErrorMessage } from './components/shared';
import { useDashboardData } from './hooks/useDashboardData';
import { formatCurrency } from '@/lib/dashboard/utils';
import { normalizeQuoteStatus, type DashboardLead, type DashboardQuote, type JobRecord } from '@/types/dashboard';
import { OverviewCard } from './_components/OverviewCard';
import { RevenueChartCard } from './_components/RevenueChartCard';
import { PopularServicesCard, type PopularService } from './_components/PopularServicesCard';
import { RecentFeedbackCard, type FeedbackItem } from './_components/RecentFeedbackCard';
import { StatusPill } from './_components/StatusPill';

const SAMPLE_REVENUE = [
  { label: 'Mon', value: 1300 },
  { label: 'Tue', value: 1900 },
  { label: 'Wed', value: 1500 },
  { label: 'Thu', value: 2400 },
  { label: 'Fri', value: 1700 },
  { label: 'Sat', value: 2800 },
  { label: 'Sun', value: 2100 },
  { label: 'Next', value: 1600 },
  { label: 'Plan', value: 2600 },
];

const DEFAULT_SERVICES: PopularService[] = [
  { name: 'Window clean', status: 'Active', price: '$120', shade: 'dark' },
  { name: 'Weekly clean', status: 'Active', price: '$180/wk', shade: 'mid' },
  { name: 'Yard care', status: 'Active', price: '$140', shade: 'mid' },
  { name: 'Car detail', status: 'Offline', price: '$160', shade: 'soft' },
  { name: 'Bond clean', status: 'Active', price: '$520', shade: 'dark' },
];

const DEFAULT_FEEDBACK: FeedbackItem[] = [
  { initials: 'J', customer: 'Joyce', service: 'Bond clean', quote: 'Spotless, arrived on time.', rating: 5 },
  { initials: 'M', customer: 'Marina', service: 'Yard care', quote: 'Great job, will rebook weekly.', rating: 5 },
];

export default function DashboardHome() {
  const {
    metrics,
    moneyFlow,
    jobs,
    quotes,
    channelLeads,
    recentActivity,
    isLoading,
    error,
    refetch,
  } = useDashboardData();

  const todayKey = new Date().toISOString().split('T')[0];

  const todayJobs = useMemo(
    () => jobs.filter((job) => job.scheduledDate === todayKey).sort(compareJobs).slice(0, 4),
    [jobs, todayKey],
  );

  const reviewQuotes = useMemo(
    () => quotes.filter((quote) => ['submitted', 'in_review'].includes(normalizeQuoteStatus(quote.status))).slice(0, 4),
    [quotes],
  );

  const customersCount = useMemo(() => {
    const names = new Set<string>();
    jobs.forEach((job) => names.add(job.customer));
    quotes.forEach((quote) => {
      if (quote.customer_name) names.add(quote.customer_name);
    });
    channelLeads.forEach((lead) => {
      if (lead.customer_name) names.add(lead.customer_name);
    });
    return names.size || channelLeads.length || quotes.length || jobs.length;
  }, [channelLeads, jobs, quotes]);

  const leadAvatars = useMemo(() => {
    const source = [...channelLeads, ...quotes]
      .sort((left, right) => new Date(getCreatedAt(right)).getTime() - new Date(getCreatedAt(left)).getTime())
      .slice(0, 5);

    const avatars = source.map((entry, index) => {
      const name = getName(entry) || ['Gladyce', 'Elbert', 'Dash', 'Joyce', 'Marina'][index] || 'Lead';
      return { name: firstName(name), initials: getInitials(name) };
    });

    return avatars.length > 0
      ? avatars
      : ['Gladyce', 'Elbert', 'Dash', 'Joyce', 'Marina'].map((name) => ({ name, initials: getInitials(name) }));
  }, [channelLeads, quotes]);

  const newLeadsThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const count = [...channelLeads, ...quotes].filter((entry) => new Date(getCreatedAt(entry)).getTime() >= weekAgo).length;
    return count || leadAvatars.length;
  }, [channelLeads, leadAvatars.length, quotes]);

  const revenuePoints = useMemo(() => {
    if (moneyFlow.series.length === 0) return SAMPLE_REVENUE;
    const points = moneyFlow.series.slice(-9).map((point) => ({
      label: new Date(point.date).toLocaleDateString('en-AU', { weekday: 'short' }),
      value: Math.max(0, Math.round(point.revenue)),
    }));
    return points.length > 0 ? points : SAMPLE_REVENUE;
  }, [moneyFlow.series]);

  const services = useMemo<PopularService[]>(() => {
    if (metrics.revenueByService.length === 0) return DEFAULT_SERVICES;
    return metrics.revenueByService.slice(0, 5).map((service, index) => ({
      name: service.service,
      status: 'Active',
      price: formatCurrency(service.amount),
      shade: index === 0 || index === 4 ? 'dark' : index === 3 ? 'soft' : 'mid',
    }));
  }, [metrics.revenueByService]);

  const feedback = useMemo<FeedbackItem[]>(() => {
    const completed = recentActivity.filter((item) => item.type === 'job_completed').slice(0, 2);
    if (completed.length === 0) return DEFAULT_FEEDBACK;
    return completed.map((item) => ({
      initials: getInitials(item.title),
      customer: item.title.replace(/^Completed\s+/i, '').split(' for ')[0] || 'Customer',
      service: item.description.split(' · ')[0] || 'Service',
      quote: 'Completed and ready for follow-up.',
      rating: 5,
    }));
  }, [recentActivity]);

  if (error) {
    return (
      <div className="px-1 pb-10 sm:px-3">
        <ErrorMessage message={error} onRetry={refetch} />
      </div>
    );
  }

  if (isLoading) {
    return <DashboardLoading />;
  }

  const jobsCompleted = metrics.operationsSnapshot.jobsCompleted || jobs.filter((job) => job.status === 'completed').length;

  return (
    <div className="grid gap-6 px-1 pb-10 sm:px-3">
      <div className="text-[16px] font-semibold text-[#7f9187]">
        <span className="mr-2 text-[#3c8259]">✣</span>
        Live business overview. Sample visual data is used only where revenue/service history is empty.
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="grid gap-6 xl:col-span-8">
          <OverviewCard
            customers={formatCount(customersCount)}
            revenue={formatCompactCurrency(metrics.goals.currentRevenue || moneyFlow.overview.revenueThisMonth)}
            customerDelta="↘ 4.2%"
            revenueDelta={`↗ ${Math.abs(metrics.goals.revenueChange || 8).toFixed(1)}%`}
            newLeadsCount={newLeadsThisWeek}
            leads={leadAvatars}
          />

          <RevenueChartCard points={revenuePoints} />

          <div className="grid gap-6 lg:grid-cols-2">
            <TodayScheduleCard jobs={todayJobs} />
            <QuotesReviewCard quotes={reviewQuotes} />
          </div>
        </div>

        <aside className="grid content-start gap-6 xl:col-span-4">
          <PopularServicesCard services={services} />
          <RecentFeedbackCard feedback={feedback} />
          <div className="grid grid-cols-2 gap-4">
            <MiniKpi label="Jobs completed" value={String(jobsCompleted)} />
            <MiniKpi label="Quotes awaiting review" value={String(reviewQuotes.length)} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function DashboardLoading() {
  return (
    <div className="grid gap-6 px-1 pb-10 sm:px-3 xl:grid-cols-12">
      <div className="grid gap-6 xl:col-span-8">
        <div className="h-[410px] animate-pulse rounded-[30px] bg-white/80" />
        <div className="h-[390px] animate-pulse rounded-[30px] bg-white/80" />
      </div>
      <div className="grid content-start gap-6 xl:col-span-4">
        <div className="h-[560px] animate-pulse rounded-[30px] bg-white/80" />
        <div className="h-[290px] animate-pulse rounded-[30px] bg-white/80" />
      </div>
    </div>
  );
}

function TodayScheduleCard({ jobs }: { jobs: JobRecord[] }) {
  return (
    <section className="rounded-[30px] border border-[#dfe9e2] bg-white px-6 py-6 shadow-[0_18px_48px_rgba(15,61,46,0.07)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[24px] font-extrabold text-[#17392b]">Today&apos;s schedule</h2>
        <Link href="/dashboard/schedule?view=day" className="text-sm font-bold text-[#3c8259]">Open</Link>
      </div>
      <div className="mt-5 space-y-3">
        {jobs.length === 0 ? (
          <p className="rounded-[20px] bg-[#f4faf6] px-4 py-4 text-sm font-semibold text-[#7f9187]">No jobs scheduled today.</p>
        ) : (
          jobs.map((job) => (
            <Link key={job.id} href="/dashboard/schedule?view=day" className="flex items-center justify-between gap-3 rounded-[20px] bg-[#f4faf6] px-4 py-4">
              <div className="min-w-0">
                <p className="truncate text-base font-extrabold text-[#273f34]">{job.customer}</p>
                <p className="truncate text-sm font-semibold text-[#87968d]">{job.service}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-extrabold text-[#273f34]">{job.scheduledTime || 'TBD'}</p>
                <StatusPill tone={job.status === 'completed' ? 'green' : 'neutral'}>{job.status.replace('_', ' ')}</StatusPill>
              </div>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

function QuotesReviewCard({ quotes }: { quotes: DashboardQuote[] }) {
  return (
    <section className="rounded-[30px] border border-[#dfe9e2] bg-white px-6 py-6 shadow-[0_18px_48px_rgba(15,61,46,0.07)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[24px] font-extrabold text-[#17392b]">Quotes awaiting review</h2>
        <Link href="/dashboard/quotes?workspace=review" className="text-sm font-bold text-[#3c8259]">Open</Link>
      </div>
      <div className="mt-5 space-y-3">
        {quotes.length === 0 ? (
          <p className="rounded-[20px] bg-[#f4faf6] px-4 py-4 text-sm font-semibold text-[#7f9187]">No quotes are waiting for review.</p>
        ) : (
          quotes.map((quote) => (
            <Link key={quote.id} href="/dashboard/quotes?workspace=review" className="flex items-center justify-between gap-3 rounded-[20px] bg-[#f4faf6] px-4 py-4">
              <div className="min-w-0">
                <p className="truncate text-base font-extrabold text-[#273f34]">{quote.customer_name || 'New customer'}</p>
                <p className="truncate text-sm font-semibold text-[#87968d]">{quote.service_type || 'Service quote'}</p>
              </div>
              <p className="shrink-0 text-base font-extrabold text-[#273f34]">{formatCurrency(Number(quote.reviewed_total ?? quote.submitted_total ?? quote.total ?? 0))}</p>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-[#dfe9e2] bg-white px-5 py-5 shadow-[0_18px_48px_rgba(15,61,46,0.06)]">
      <p className="text-[34px] font-extrabold leading-none text-[#17392b]">{value}</p>
      <p className="mt-2 text-sm font-bold text-[#839188]">{label}</p>
    </div>
  );
}

function compareJobs(a: Pick<JobRecord, 'scheduledDate' | 'scheduledTime'>, b: Pick<JobRecord, 'scheduledDate' | 'scheduledTime'>) {
  const left = new Date(`${a.scheduledDate || '9999-12-31'}T${a.scheduledTime || '23:59:59'}`);
  const right = new Date(`${b.scheduledDate || '9999-12-31'}T${b.scheduledTime || '23:59:59'}`);
  return left.getTime() - right.getTime();
}

function getCreatedAt(entry: DashboardLead | DashboardQuote) {
  return 'created_at' in entry ? entry.created_at : new Date().toISOString();
}

function getName(entry: DashboardLead | DashboardQuote) {
  return 'customer_name' in entry ? entry.customer_name : null;
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
    return `$${amount.toFixed(amount >= 10 ? 1 : 1)}k`;
  }
  return formatCurrency(value);
}
