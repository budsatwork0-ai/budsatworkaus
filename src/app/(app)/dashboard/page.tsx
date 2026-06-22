'use client';

import type React from 'react';
import Link from 'next/link';
import { useMemo } from 'react';
import { ErrorMessage } from './components/shared';
import { useDashboardData } from './hooks/useDashboardData';
import { formatCurrency } from '@/lib/dashboard/utils';
import { normalizeQuoteStatus, type JobRecord, type DashboardAlert } from '@/types/dashboard';
import { StatusPill } from './_components/StatusPill';

export default function MissionControl() {
  const {
    metrics,
    moneyFlow,
    jobs,
    quotes,
    channelLeads,
    alertsFeed,
    applicantCount,
    lastUpdated,
    isLoading,
    error,
    refetch,
  } = useDashboardData();

  const todayKey = new Date().toISOString().split('T')[0];
  const todayLabel = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });

  // Priority 1 — action items
  const reviewQuotes = useMemo(
    () => quotes.filter((q) => ['submitted', 'in_review'].includes(normalizeQuoteStatus(q.status))),
    [quotes],
  );

  const awaitingPayment = useMemo(
    () => quotes.filter((q) => ['finalized', 'payment_pending'].includes(normalizeQuoteStatus(q.status))),
    [quotes],
  );

  const criticalAlerts = useMemo(
    () => alertsFeed.filter((a) => a.severity === 'critical').slice(0, 3),
    [alertsFeed],
  );

  const overdueCount = metrics.alerts.overdueCount;
  const overdueAmount = metrics.alerts.overdueAmount;

  // Priority 2 — work queue
  const todayJobs = useMemo(
    () => jobs.filter((j) => j.scheduledDate === todayKey).sort(compareJobs),
    [jobs, todayKey],
  );

  const unscheduledJobs = useMemo(
    () => jobs.filter((j) => !j.scheduledDate && !['completed', 'cancelled'].includes(j.status)).slice(0, 5),
    [jobs],
  );

  // Priority 4 — awareness metrics
  const revenueThisMonth = moneyFlow.overview.revenueThisMonth;
  const pipelineValue = useMemo(
    () => awaitingPayment.reduce((sum, q) => sum + Number(q.reviewed_total ?? q.submitted_total ?? q.total ?? 0), 0),
    [awaitingPayment],
  );
  const newLeadsThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return [...channelLeads, ...quotes].filter((e) => {
      const ts = 'created_at' in e ? e.created_at : '';
      return ts && new Date(ts).getTime() >= weekAgo;
    }).length;
  }, [channelLeads, quotes]);
  const jobsCompleted = metrics.operationsSnapshot.jobsCompleted || jobs.filter((j) => j.status === 'completed').length;

  const hasActionItems =
    reviewQuotes.length > 0 ||
    overdueCount > 0 ||
    applicantCount > 0 ||
    criticalAlerts.length > 0;

  if (error) {
    return (
      <div className="px-1 pb-10 sm:px-3">
        <ErrorMessage message={error} onRetry={refetch} />
      </div>
    );
  }

  if (isLoading) {
    return <MissionControlLoading />;
  }

  return (
    <div className="grid gap-5 px-1 pb-8 sm:px-2">

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-[#7f9187]">
          {lastUpdated
            ? `Updated ${new Date(lastUpdated).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}`
            : 'Live'}
        </p>
        <button
          type="button"
          onClick={refetch}
          className="text-[13px] font-semibold text-[#3c8259] hover:underline"
        >
          Refresh
        </button>
      </div>

      {/* Priority 1 — Requires Attention */}
      {hasActionItems && (
        <section>
          <SectionLabel>Requires attention</SectionLabel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reviewQuotes.length > 0 && (
              <ActionCard
                href="/dashboard/quotes?workspace=review"
                count={reviewQuotes.length}
                noun="quote"
                label="awaiting review"
                detail="Submitted and waiting for your approval"
                tone="amber"
              />
            )}
            {overdueCount > 0 && (
              <ActionCard
                href="/dashboard/invoices?tab=invoices&status=Overdue"
                count={overdueCount}
                noun="overdue invoice"
                label={`· ${formatCurrency(overdueAmount)} outstanding`}
                detail="Payment is past due — follow up now"
                tone="red"
              />
            )}
            {applicantCount > 0 && (
              <ActionCard
                href="/dashboard/applicants?filter=awaiting_approval"
                count={applicantCount}
                noun="applicant"
                label="awaiting approval"
                detail="Review their applications"
                tone="blue"
              />
            )}
            {criticalAlerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </section>
      )}

      {/* Priority 2 — Today's schedule */}
      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <SectionLabel noMargin>Today · {todayLabel}</SectionLabel>
          <Link href="/dashboard/schedule?view=day" className="text-[12px] font-bold text-[#3c8259]">
            Full schedule
          </Link>
        </div>
        <div className="overflow-hidden rounded-[28px] border border-[#dfe9e2] bg-white shadow-[0_18px_48px_rgba(15,61,46,0.06)]">
          {todayJobs.length === 0 ? (
            <p className="px-4 py-5 text-[14px] font-semibold text-[#7f9187]">
              No jobs scheduled today.
            </p>
          ) : (
            <div className="divide-y divide-[#f0f5f1]">
              {todayJobs.map((job) => (
                <JobRow key={job.id} job={job} href="/dashboard/schedule?view=day" showTime />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Priority 2 — Quotes to review (expanded) */}
      {reviewQuotes.length > 0 && (
        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <SectionLabel noMargin>Quotes to review</SectionLabel>
            <Link href="/dashboard/quotes?workspace=review" className="text-[12px] font-bold text-[#3c8259]">
              Open queue
            </Link>
          </div>
          <div className="overflow-hidden rounded-[28px] border border-[#dfe9e2] bg-white shadow-[0_18px_48px_rgba(15,61,46,0.06)]">
            <div className="divide-y divide-[#f0f5f1]">
              {reviewQuotes.slice(0, 8).map((q) => (
                <Link
                  key={q.id}
                  href="/dashboard/quotes?workspace=review"
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#f8fbf9]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-extrabold text-[#273f34]">
                      {q.customer_name || 'New customer'}
                    </p>
                    <p className="truncate text-[12px] font-semibold text-[#87968d]">
                      {q.service_type || 'Service quote'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <p className="text-[14px] font-extrabold text-[#273f34]">
                      {formatCurrency(Number(q.reviewed_total ?? q.submitted_total ?? q.total ?? 0))}
                    </p>
                    <span className="text-[12px] font-semibold text-[#3c8259]">Review →</span>
                  </div>
                </Link>
              ))}
              {reviewQuotes.length > 8 && (
                <Link
                  href="/dashboard/quotes?workspace=review"
                  className="flex items-center justify-center px-4 py-3 text-[13px] font-bold text-[#3c8259] hover:bg-[#f8fbf9]"
                >
                  {reviewQuotes.length - 8} more →
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Priority 2 — Needs scheduling */}
      {unscheduledJobs.length > 0 && (
        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <SectionLabel noMargin>Needs scheduling</SectionLabel>
            <Link
              href="/dashboard/schedule?view=list&scheduleState=unscheduled"
              className="text-[12px] font-bold text-[#3c8259]"
            >
              Schedule all
            </Link>
          </div>
          <div className="overflow-hidden rounded-[28px] border border-[#dfe9e2] bg-white shadow-[0_18px_48px_rgba(15,61,46,0.06)]">
            <div className="divide-y divide-[#f0f5f1]">
              {unscheduledJobs.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  href="/dashboard/schedule?view=list&scheduleState=unscheduled"
                  badge={<span className="text-[12px] font-semibold text-[#d97706]">Unscheduled</span>}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Priority 4 — Awareness strip */}
      <section>
        <SectionLabel>This month</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <AwarenessKpi
            label="Revenue"
            value={formatCompact(revenueThisMonth)}
            href="/dashboard/invoices"
          />
          <AwarenessKpi
            label="Pipeline"
            value={formatCompact(pipelineValue)}
            href="/dashboard/quotes?workspace=approved"
          />
          <AwarenessKpi
            label="New leads"
            value={String(newLeadsThisWeek)}
            sub="this week"
            href="/dashboard/leads"
          />
          <AwarenessKpi
            label="Jobs done"
            value={String(jobsCompleted)}
            href="/dashboard/orders"
          />
        </div>
      </section>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function SectionLabel({ children, noMargin }: { children: React.ReactNode; noMargin?: boolean }) {
  return (
    <p className={`text-[11px] font-bold uppercase tracking-[0.12em] text-[#a1b0a8] ${noMargin ? '' : 'mb-2.5'}`}>
      {children}
    </p>
  );
}

function ActionCard({
  href,
  count,
  noun,
  label,
  detail,
  tone,
}: {
  href: string;
  count: number;
  noun: string;
  label: string;
  detail: string;
  tone: 'amber' | 'red' | 'blue';
}) {
  const styles = {
    amber: { border: '#fbbf24', bg: 'rgba(251,191,36,0.07)', dot: '#d97706', text: '#92400e' },
    red:   { border: '#fca5a5', bg: 'rgba(239,68,68,0.07)',  dot: '#dc2626', text: '#7f1d1d' },
    blue:  { border: '#93c5fd', bg: 'rgba(59,130,246,0.07)', dot: '#2563eb', text: '#1e3a5f' },
  } as const;
  const s = styles[tone];

  return (
    <Link
      href={href}
      className="flex flex-col gap-1.5 rounded-[22px] border px-4 py-4 shadow-sm transition hover:shadow-md"
      style={{ borderColor: s.border, background: s.bg }}
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.dot }} />
        <span className="text-[13px] font-bold" style={{ color: s.text }}>
          {count} {noun}{count !== 1 ? 's' : ''} {label}
        </span>
      </div>
      <p className="text-[12px] font-medium text-[#87968d]">{detail}</p>
      <p className="mt-0.5 text-[12px] font-bold" style={{ color: s.dot }}>Take action →</p>
    </Link>
  );
}

function AlertCard({ alert }: { alert: DashboardAlert }) {
  return (
    <Link
      href={alert.href || '/dashboard/alerts'}
      className="flex flex-col gap-1.5 rounded-[22px] border border-[#fca5a5] px-4 py-4 shadow-sm transition hover:shadow-md"
      style={{ background: 'rgba(239,68,68,0.07)' }}
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[#dc2626]" />
        <span className="text-[13px] font-bold text-[#7f1d1d] truncate">{alert.title}</span>
      </div>
      <p className="text-[12px] font-medium text-[#87968d] line-clamp-2">{alert.message}</p>
      <p className="mt-0.5 text-[12px] font-bold text-[#dc2626]">View alert →</p>
    </Link>
  );
}

function JobRow({
  job,
  href,
  showTime,
  badge,
}: {
  job: JobRecord;
  href: string;
  showTime?: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#f8fbf9]"
    >
      <div className="flex min-w-0 items-center gap-3">
        {showTime && (
          <span className="w-16 shrink-0 text-[13px] font-bold text-[#3c8259]">
            {job.scheduledTime || 'TBD'}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[14px] font-extrabold text-[#273f34]">{job.customer}</p>
          <p className="truncate text-[12px] font-semibold text-[#87968d]">{job.service}</p>
        </div>
      </div>
      {badge ?? (
        <StatusPill tone={job.status === 'completed' ? 'green' : 'neutral'}>
          {job.status.replace('_', ' ')}
        </StatusPill>
      )}
    </Link>
  );
}

function AwarenessKpi({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-[22px] border border-[#dfe9e2] bg-white px-4 py-3.5 shadow-[0_18px_48px_rgba(15,61,46,0.05)] transition hover:shadow-md"
    >
      <p className="text-[24px] font-extrabold leading-none text-[#17392b]">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] font-semibold text-[#87968d]">{sub}</p>}
      <p className="mt-1 text-[12px] font-bold text-[#839188]">{label}</p>
    </Link>
  );
}

function MissionControlLoading() {
  return (
    <div className="grid gap-5 px-1 pb-8 sm:px-2">
      <div className="h-5 w-32 animate-pulse rounded-full bg-white/80" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-24 animate-pulse rounded-[22px] bg-white/80" />
        <div className="h-24 animate-pulse rounded-[22px] bg-white/80" />
        <div className="h-24 animate-pulse rounded-[22px] bg-white/80" />
      </div>
      <div className="h-[200px] animate-pulse rounded-[28px] bg-white/80" />
      <div className="h-[160px] animate-pulse rounded-[28px] bg-white/80" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-[22px] bg-white/80" />
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function compareJobs(
  a: Pick<JobRecord, 'scheduledDate' | 'scheduledTime'>,
  b: Pick<JobRecord, 'scheduledDate' | 'scheduledTime'>,
) {
  const left = new Date(`${a.scheduledDate || '9999-12-31'}T${a.scheduledTime || '23:59:59'}`);
  const right = new Date(`${b.scheduledDate || '9999-12-31'}T${b.scheduledTime || '23:59:59'}`);
  return left.getTime() - right.getTime();
}

function formatCompact(value: number) {
  if (value >= 1000) {
    const amount = value / 1000;
    return `$${amount.toFixed(amount >= 10 ? 0 : 1)}k`;
  }
  return formatCurrency(value);
}
