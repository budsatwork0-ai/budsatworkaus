'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { brand } from '@/app/ui/theme';
import { useDashboardData } from './hooks/useDashboardData';
import { RefreshIcon, ErrorMessage } from './components/shared';
import { formatRelativeTime } from '@/lib/dashboard/utils';

type AttentionItem = {
  key: string;
  label: string;
  value: number;
  href: string;
  tone: 'red' | 'amber' | 'blue' | 'emerald';
};

type QuickAction = {
  label: string;
  description: string;
  href: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value);
}

function compareJobs(a: { scheduledDate: string; scheduledTime: string }, b: { scheduledDate: string; scheduledTime: string }) {
  const left = new Date(`${a.scheduledDate || '9999-12-31'}T${a.scheduledTime || '23:59:59'}`);
  const right = new Date(`${b.scheduledDate || '9999-12-31'}T${b.scheduledTime || '23:59:59'}`);
  return left.getTime() - right.getTime();
}

export default function DashboardHome() {
  const { metrics, receivables, jobs, lastUpdated, isLoading, error, refetch } = useDashboardData();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [moneyExpanded, setMoneyExpanded] = useState(false);
  const [applicantCount, setApplicantCount] = useState(0);
  const [pendingQuoteCount, setPendingQuoteCount] = useState(0);

  const fetchAttentionCounts = useCallback(async () => {
    const [applicantData, quoteData] = await Promise.all([
      fetch('/api/applicants?stage=intake&limit=50').then((r) => r.json()).catch(() => ({ applicants: [] })),
      fetch('/api/quotes?status=submitted,in_review&limit=100').then((r) => r.json()).catch(() => ({ quotes: [] })),
    ]);

    const communityRoles = new Set(['Quality partner', 'Sponsor', 'Innovation partner']);
    const crewApplicants = (applicantData.applicants || []).filter(
      (applicant: { role?: string }) => !communityRoles.has(applicant.role || '')
    );

    setApplicantCount(crewApplicants.length);
    setPendingQuoteCount((quoteData.quotes || []).length);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refetch(), fetchAttentionCounts()]);
    setIsRefreshing(false);
  }, [fetchAttentionCounts, refetch]);

  useEffect(() => {
    fetchAttentionCounts();
  }, [fetchAttentionCounts]);

  const todayKey = new Date().toISOString().split('T')[0];
  const overdueInvoiceCount = receivables.filter((record) => record.status === 'Overdue').length;
  const unscheduledJobs = jobs.filter((job) => !job.scheduledDate);
  const todayJobs = useMemo(
    () => jobs.filter((job) => job.scheduledDate === todayKey).sort(compareJobs),
    [jobs, todayKey]
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
  const inProgressCount = jobs.filter((job) => job.status === 'in_progress').length;

  const attentionItems: AttentionItem[] = useMemo(
    () =>
      ([
        {
          key: 'overdue-invoices',
          label: 'Overdue invoices',
          value: overdueInvoiceCount,
          href: '/dashboard/invoices',
          tone: 'red',
        },
        {
          key: 'new-applicants',
          label: 'New applicants',
          value: applicantCount,
          href: '/dashboard/applicants',
          tone: 'blue',
        },
        {
          key: 'pending-quotes',
          label: 'Quotes awaiting review',
          value: pendingQuoteCount,
          href: '/dashboard/quotes',
          tone: 'amber',
        },
        {
          key: 'unscheduled-jobs',
          label: 'Unscheduled jobs',
          value: unscheduledJobs.length,
          href: '/dashboard/schedule',
          tone: 'emerald',
        },
      ] satisfies AttentionItem[]).filter((item) => item.value > 0),
    [applicantCount, overdueInvoiceCount, pendingQuoteCount, unscheduledJobs.length]
  );

  const quickActions: QuickAction[] = [
    {
      label: 'Schedule Job',
      description: 'Review and place jobs on the calendar.',
      href: '/dashboard/schedule',
    },
    {
      label: 'Create Invoice',
      description: 'Follow up on unpaid work and outstanding balances.',
      href: '/dashboard/invoices',
    },
    {
      label: 'Add Customer',
      description: 'Create a customer record and capture contact details.',
      href: '/dashboard/customers',
    },
    {
      label: 'Send Reminder',
      description: 'Resend approved quote or payment follow-up.',
      href: '/dashboard/quotes',
    },
  ];

  const monthRevenue = metrics?.goals.currentRevenue ?? 0;
  const receivableTotal = metrics?.outstandingReceivables.total ?? 0;
  const payableTotal = metrics?.upcomingPayables.total ?? 0;
  const netProfit = metrics?.netProfit.amount ?? 0;
  const moneyHasActivity = monthRevenue > 0 || receivableTotal > 0 || payableTotal > 0 || netProfit !== 0;

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
    <div className="grid gap-6 w-full px-3 sm:px-4 md:px-10 lg:px-12 pb-14">
      <motion.div
        className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold" style={{ color: brand.primary }}>
              Operations Console
            </h1>
            <motion.button
              onClick={handleRefresh}
              disabled={isRefreshing}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.95 }}
              animate={isRefreshing ? { rotate: 360 } : { rotate: 0 }}
              transition={isRefreshing ? { repeat: Infinity, duration: 0.7, ease: 'linear' } : { duration: 0.2 }}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
              title="Refresh"
            >
              <RefreshIcon />
            </motion.button>
          </div>
          <p className="text-sm text-slate-500">
            A reduced view of what needs attention, what is happening today, and what affects cash.
          </p>
          {lastUpdated && <p className="text-[11px] text-slate-400">Updated {formatRelativeTime(lastUpdated)}</p>}
        </div>
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1.4fr]">
        <Section
          title="Attention"
          subtitle="Only items that need action right now."
          loading={isLoading}
        >
          {attentionItems.length === 0 ? (
            <EmptyMessage message="No urgent items right now." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {attentionItems.map((item) => (
                <AttentionCard key={item.key} item={item} />
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Today"
          subtitle="Jobs scheduled for today and the next confirmed stop."
          loading={isLoading}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <StatCard label="Today's jobs" value={String(todayJobs.length)} />
            <StatCard label="In progress" value={String(inProgressCount)} />
            <StatCard label="Unscheduled" value={String(unscheduledJobs.length)} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-black/6 bg-white/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Today&apos;s schedule</p>
                  <p className="text-xs text-slate-500">Only scheduled work for {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</p>
                </div>
                <Link href="/dashboard/schedule" className="text-xs font-semibold" style={{ color: brand.primary }}>
                  Open schedule
                </Link>
              </div>

              <div className="mt-3 space-y-2">
                {todayJobs.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">
                    No jobs are scheduled for today.
                  </p>
                ) : (
                  todayJobs.slice(0, 4).map((job) => (
                    <div key={job.id} className="flex items-center justify-between rounded-xl border border-black/6 bg-white px-3 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{job.customer}</p>
                        <p className="text-xs text-slate-500">{job.service}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">{job.scheduledTime || 'Time TBD'}</p>
                        <p className="text-xs text-slate-500">{job.status === 'in_progress' ? 'In progress' : 'Scheduled'}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-black/6 bg-white/70 p-4">
              <p className="text-sm font-semibold text-slate-900">Next scheduled job</p>
              {nextScheduledJob ? (
                <div className="mt-3 space-y-2">
                  <div className="rounded-xl bg-slate-50 px-3 py-3">
                    <p className="text-sm font-semibold text-slate-900">{nextScheduledJob.customer}</p>
                    <p className="text-xs text-slate-500">{nextScheduledJob.service}</p>
                  </div>
                  <StatusRow label="Date" value={new Date(nextScheduledJob.scheduledDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })} />
                  <StatusRow label="Time" value={nextScheduledJob.scheduledTime || 'Time TBD'} />
                  <StatusRow label="Status" value={nextScheduledJob.status === 'in_progress' ? 'In progress' : 'Scheduled'} />
                </div>
              ) : (
                <p className="mt-3 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">
                  No upcoming scheduled jobs yet.
                </p>
              )}
            </div>
          </div>
        </Section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <Section
          title="Quick Actions"
          subtitle="The four actions used most often during the day."
          loading={isLoading}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="rounded-2xl border border-black/6 bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-sm"
              >
                <p className="text-sm font-semibold text-slate-900">{action.label}</p>
                <p className="mt-1 text-xs text-slate-500">{action.description}</p>
              </Link>
            ))}
          </div>
        </Section>

        <Section
          title="Money"
          subtitle="A single summary line with detail on demand."
          loading={isLoading}
        >
          {moneyHasActivity ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setMoneyExpanded((value) => !value)}
                className="flex w-full items-center justify-between rounded-2xl border border-black/6 bg-white px-4 py-3 text-left"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatCurrency(monthRevenue)} this month
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatCurrency(receivableTotal)} outstanding · {formatCurrency(payableTotal)} due soon
                  </p>
                </div>
                <span className="text-xs font-semibold" style={{ color: brand.primary }}>
                  {moneyExpanded ? 'Hide details' : 'Show details'}
                </span>
              </button>

              {moneyExpanded && (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MoneyCard label="This month" value={formatCurrency(monthRevenue)} href="/dashboard/payments" />
                  <MoneyCard label="Invoices due" value={formatCurrency(receivableTotal)} href="/dashboard/invoices" />
                  <MoneyCard label="Expenses due" value={formatCurrency(payableTotal)} href="/dashboard/expenses" />
                  <MoneyCard label="Net profit" value={formatCurrency(netProfit)} href="/dashboard/insights" />
                </div>
              )}
            </div>
          ) : (
            <EmptyMessage message="No money activity recorded yet this month." />
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  loading,
  children,
}: {
  title: string;
  subtitle: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-3xl border border-black/6 bg-white/82 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] backdrop-blur"
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold" style={{ color: brand.primary }}>{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      {loading ? <div className="h-32 rounded-2xl bg-slate-100/80 animate-pulse" /> : children}
    </motion.section>
  );
}

function AttentionCard({ item }: { item: AttentionItem }) {
  const tones = {
    red: { bg: '#FEF2F2', text: '#B91C1C' },
    amber: { bg: '#FFFBEB', text: '#B45309' },
    blue: { bg: '#EFF6FF', text: '#1D4ED8' },
    emerald: { bg: '#ECFDF5', text: '#047857' },
  } as const;

  return (
    <Link
      href={item.href}
      className="rounded-2xl border border-black/6 bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-sm"
    >
      <div
        className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold"
        style={{ background: tones[item.tone].bg, color: tones[item.tone].text }}
      >
        {item.value}
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900">{item.label}</p>
    </Link>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/6 bg-white/70 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-black/6 bg-white px-3 py-2">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function MoneyCard({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-black/6 bg-white px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-sm">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </Link>
  );
}

function EmptyMessage({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500">
      {message}
    </div>
  );
}
