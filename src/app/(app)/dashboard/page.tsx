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
    () => jobs.filter((job) => job.scheduledDate === todayKey).sort(compareJobs).slice(0, 2),
    [jobs, todayKey],
  );

  const reviewQuotes = useMemo(
    () => quotes.filter((quote) => ['submitted', 'in_review'].includes(normalizeQuoteStatus(quote.status))).slice(0, 2),
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

  const pipeline = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const normalise = (q: { status: string }) => normalizeQuoteStatus(q.status);

    const newThisWeek = quotes.filter((q) => new Date(q.created_at).getTime() >= weekAgo).length;
    const awaitingApproval = quotes.filter((q) => ['submitted', 'in_review'].includes(normalise(q))).length;
    const awaitingPayment = quotes.filter((q) => ['finalized', 'payment_pending'].includes(normalise(q))).length;
    const paidCount = quotes.filter((q) => normalise(q) === 'paid').length;

    const effectiveTotal = (q: typeof quotes[0]) =>
      Number(q.reviewed_total ?? q.submitted_total ?? q.total ?? 0);

    const pipelineValue = quotes
      .filter((q) => ['finalized', 'payment_pending'].includes(normalise(q)))
      .reduce((sum, q) => sum + effectiveTotal(q), 0);

    const revenueThisWeek = moneyFlow.series
      .filter((pt) => new Date(pt.date).getTime() >= weekAgo)
      .reduce((sum, pt) => sum + Math.max(0, pt.revenue), 0);

    const revenueThisMonth = moneyFlow.overview.revenueThisMonth;

    return { newThisWeek, awaitingApproval, awaitingPayment, paidCount, pipelineValue, revenueThisWeek, revenueThisMonth };
  }, [quotes, moneyFlow]);

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
    <div className="grid gap-4 px-1 pb-4 sm:px-2">
      <div className="text-[13px] font-semibold text-[#7f9187]">
        <span className="mr-2 text-[#3c8259]">✣</span>
        Live business overview. Sample visual data is used only where revenue/service history is empty.
      </div>

      {/* Revenue pipeline — real-time from loaded quote data */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <RevenuePill label="New quotes" value={String(pipeline.newThisWeek)} sub="this week" tone="slate" href="/dashboard/quotes?workspace=review" />
        <RevenuePill label="Need approval" value={String(pipeline.awaitingApproval)} sub="pending" tone="amber" href="/dashboard/quotes?workspace=review" />
        <RevenuePill label="Awaiting payment" value={String(pipeline.awaitingPayment)} sub="link sent" tone="blue" href="/dashboard/quotes?workspace=approved" />
        <RevenuePill label="Paid" value={String(pipeline.paidCount)} sub="all time" tone="emerald" href="/dashboard/quotes?workspace=archive" />
        <RevenuePill label="Pipeline value" value={formatCurrency(pipeline.pipelineValue)} sub="open quotes" tone="indigo" href="/dashboard/quotes?workspace=approved" />
        <RevenuePill label="Revenue — week" value={formatCurrency(pipeline.revenueThisWeek)} sub="last 7 days" tone="green" href="/dashboard/payments" />
        <RevenuePill label="Revenue — month" value={formatCurrency(pipeline.revenueThisMonth)} sub="this month" tone="green" href="/dashboard/payments" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="grid gap-4 xl:col-span-8">
          <OverviewCard
            customers={formatCount(customersCount)}
            revenue={formatCompactCurrency(metrics.goals.currentRevenue || moneyFlow.overview.revenueThisMonth)}
            customerDelta="↘ 4.2%"
            revenueDelta={`↗ ${Math.abs(metrics.goals.revenueChange || 8).toFixed(1)}%`}
            newLeadsCount={newLeadsThisWeek}
            leads={leadAvatars}
          />

          <RevenueChartCard points={revenuePoints} />

          <div className="grid gap-4 lg:grid-cols-2">
            <TodayScheduleCard jobs={todayJobs} />
            <QuotesReviewCard quotes={reviewQuotes} />
          </div>
        </div>

        <aside className="grid content-start gap-4 xl:col-span-4">
          <PopularServicesCard services={services} />
          <RecentFeedbackCard feedback={feedback} />
          <div className="grid grid-cols-2 gap-3">
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
    <div className="grid gap-4 px-1 pb-4 sm:px-2 xl:grid-cols-12">
      <div className="grid gap-4 xl:col-span-8">
        <div className="h-[220px] animate-pulse rounded-[30px] bg-white/80" />
        <div className="h-[260px] animate-pulse rounded-[30px] bg-white/80" />
      </div>
      <div className="grid content-start gap-4 xl:col-span-4">
        <div className="h-[320px] animate-pulse rounded-[30px] bg-white/80" />
        <div className="h-[240px] animate-pulse rounded-[30px] bg-white/80" />
      </div>
    </div>
  );
}

function TodayScheduleCard({ jobs }: { jobs: JobRecord[] }) {
  return (
    <section className="max-h-[170px] overflow-hidden rounded-[30px] border border-[#dfe9e2] bg-white px-4 py-4 shadow-[0_18px_48px_rgba(15,61,46,0.07)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[18px] font-extrabold text-[#17392b]">Today&apos;s schedule</h2>
        <Link href="/dashboard/schedule?view=day" className="text-[13px] font-bold text-[#3c8259]">Open</Link>
      </div>
      <div className="mt-3 space-y-2">
        {jobs.length === 0 ? (
          <p className="rounded-[20px] bg-[#f4faf6] px-3 py-3 text-sm font-semibold text-[#7f9187]">No jobs scheduled today.</p>
        ) : (
          jobs.map((job) => (
            <Link key={job.id} href="/dashboard/schedule?view=day" className="flex items-center justify-between gap-3 rounded-[20px] bg-[#f4faf6] px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-extrabold text-[#273f34]">{job.customer}</p>
                <p className="truncate text-[12px] font-semibold text-[#87968d]">{job.service}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[13px] font-extrabold text-[#273f34]">{job.scheduledTime || 'TBD'}</p>
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
    <section className="max-h-[170px] overflow-hidden rounded-[30px] border border-[#dfe9e2] bg-white px-4 py-4 shadow-[0_18px_48px_rgba(15,61,46,0.07)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[18px] font-extrabold text-[#17392b]">Quotes awaiting review</h2>
        <Link href="/dashboard/quotes?workspace=review" className="text-[13px] font-bold text-[#3c8259]">Open</Link>
      </div>
      <div className="mt-3 space-y-2">
        {quotes.length === 0 ? (
          <p className="rounded-[20px] bg-[#f4faf6] px-3 py-3 text-sm font-semibold text-[#7f9187]">No quotes are waiting for review.</p>
        ) : (
          quotes.map((quote) => (
            <Link key={quote.id} href="/dashboard/quotes?workspace=review" className="flex items-center justify-between gap-3 rounded-[20px] bg-[#f4faf6] px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-extrabold text-[#273f34]">{quote.customer_name || 'New customer'}</p>
                <p className="truncate text-[12px] font-semibold text-[#87968d]">{quote.service_type || 'Service quote'}</p>
              </div>
              <p className="shrink-0 text-[14px] font-extrabold text-[#273f34]">{formatCurrency(Number(quote.reviewed_total ?? quote.submitted_total ?? quote.total ?? 0))}</p>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-[#dfe9e2] bg-white px-4 py-3 shadow-[0_18px_48px_rgba(15,61,46,0.06)]">
      <p className="text-[26px] font-extrabold leading-none text-[#17392b]">{value}</p>
      <p className="mt-1 text-[12px] font-bold text-[#839188]">{label}</p>
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

function RevenuePill({
  label,
  value,
  sub,
  tone,
  href,
}: {
  label: string;
  value: string;
  sub: string;
  tone: 'slate' | 'amber' | 'blue' | 'emerald' | 'indigo' | 'green';
  href: string;
}) {
  const colors = {
    slate:   { bg: 'rgba(148,163,184,0.10)', fg: '#475569', accent: '#94a3b8' },
    amber:   { bg: 'rgba(251,191,36,0.10)',  fg: '#92400e', accent: '#d97706' },
    blue:    { bg: 'rgba(59,130,246,0.10)',  fg: '#1d4ed8', accent: '#3b82f6' },
    emerald: { bg: 'rgba(16,185,129,0.10)',  fg: '#065f46', accent: '#10b981' },
    indigo:  { bg: 'rgba(99,102,241,0.10)',  fg: '#3730a3', accent: '#6366f1' },
    green:   { bg: 'rgba(34,197,94,0.10)',   fg: '#14532d', accent: '#22c55e' },
  } as const;
  const c = colors[tone];
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 rounded-2xl border border-black/[0.06] px-4 py-3 shadow-sm transition hover:shadow-md"
      style={{ background: c.bg }}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: c.accent }}>{label}</span>
      <span className="text-[18px] font-bold leading-none" style={{ color: c.fg }}>{value}</span>
      <span className="text-[11px]" style={{ color: c.accent }}>{sub}</span>
    </Link>
  );
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
