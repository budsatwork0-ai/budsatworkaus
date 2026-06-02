'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { dashboardTheme } from '@/lib/design-system/themes';
import { useDashboardData } from '../hooks/useDashboardData';
import { exportCsv, formatCurrency, formatDate, formatRelativeTime, type CsvColumn } from '@/lib/dashboard/utils';
import type {
  CrewPayWorker,
  LabourAcceptanceStatus,
  MoneyActionAlert,
  MoneyBreakdownItem,
  MoneyFlowPoint,
  MoneyJobMargin,
  MoneyTransaction,
} from '@/types/dashboard';

type MoneyTab = 'overview' | 'incoming' | 'outgoing' | 'crew-pay' | 'transactions';
type RangeKey = 'week' | 'month' | 'quarter' | 'year';
type PayPeriodKey = 'week' | 'fortnight' | 'month';
type GroupMode = 'worker' | 'role';
type TransactionFilter = 'all' | MoneyTransaction['type'];
type DisplayPayStatus = 'Draft' | 'Ready to pay' | 'Paid' | 'Needs review';

type PayHistoryEntry = {
  id: string;
  workerId: string;
  workerName: string;
  periodKey: PayPeriodKey;
  periodLabel: string;
  paidAt: string;
  hours: number;
  amount: number;
};

type DisplayWorker = CrewPayWorker & {
  displayPayStatus: DisplayPayStatus;
};

const TOP_TABS: Array<{ key: MoneyTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'incoming', label: 'Incoming' },
  { key: 'outgoing', label: 'Outgoing' },
  { key: 'crew-pay', label: 'Crew Pay' },
  { key: 'transactions', label: 'Transactions / History' },
];

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' },
];

const PAY_PERIOD_OPTIONS: Array<{ key: PayPeriodKey; label: string }> = [
  { key: 'week', label: 'This week' },
  { key: 'fortnight', label: 'This fortnight' },
  { key: 'month', label: 'This month' },
];

const MONEY_CHART_COLORS = {
  revenue: dashboardTheme.color.primary,
  expenses: '#C96D34',
  labour: '#7AA387',
  net: dashboardTheme.color.accent,
};

const PAY_HISTORY_KEY = 'money-flow-pay-history-v1';

function sanitizeTab(value: string | null): MoneyTab {
  if (value === 'incoming' || value === 'invoices') return 'incoming';
  if (value === 'outgoing' || value === 'expenses') return 'outgoing';
  if (value === 'crew-pay') return 'crew-pay';
  if (value === 'transactions' || value === 'settlements' || value === 'subscriptions') return 'transactions';
  return 'overview';
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - day);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfMonth(date: Date) {
  const next = new Date(date.getFullYear(), date.getMonth(), 1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getPayPeriodBounds(key: PayPeriodKey) {
  const now = new Date();
  if (key === 'month') {
    return {
      start: startOfMonth(now),
      end: now,
      label: 'This month',
    };
  }

  if (key === 'fortnight') {
    const end = new Date(now);
    const start = startOfWeek(now);
    start.setDate(start.getDate() - 7);
    return { start, end, label: 'This fortnight' };
  }

  return {
    start: startOfWeek(now),
    end: now,
    label: 'This week',
  };
}

function aggregateSeries(series: MoneyFlowPoint[], range: RangeKey) {
  const now = new Date();

  if (range === 'week') {
    return series
      .slice(-7)
      .map((point) => ({
        ...point,
        label: new Date(point.date).toLocaleDateString('en-AU', { weekday: 'short' }),
      }));
  }

  if (range === 'month') {
    return series
      .slice(-30)
      .map((point) => ({
        ...point,
        label: new Date(point.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
      }));
  }

  if (range === 'quarter') {
    const bucketMap = new Map<string, { label: string; revenue: number; expenses: number; labourCost: number; net: number }>();

    for (const point of series.slice(-91)) {
      const weekStart = startOfWeek(new Date(point.date));
      const key = weekStart.toISOString().slice(0, 10);
      const current = bucketMap.get(key) || {
        label: weekStart.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
        revenue: 0,
        expenses: 0,
        labourCost: 0,
        net: 0,
      };
      current.revenue += point.revenue;
      current.expenses += point.expenses;
      current.labourCost += point.labourCost;
      current.net += point.net;
      bucketMap.set(key, current);
    }

    return Array.from(bucketMap.entries())
      .sort(([left], [right]) => new Date(left).getTime() - new Date(right).getTime())
      .map(([date, value]) => ({ date, ...value }));
  }

  const monthMap = new Map<string, { label: string; revenue: number; expenses: number; labourCost: number; net: number }>();
  for (const point of series) {
    const date = new Date(point.date);
    if (date < new Date(now.getFullYear() - 1, now.getMonth() + 1, 1)) continue;
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const label = date.toLocaleDateString('en-AU', { month: 'short' });
    const current = monthMap.get(key) || { label, revenue: 0, expenses: 0, labourCost: 0, net: 0 };
    current.revenue += point.revenue;
    current.expenses += point.expenses;
    current.labourCost += point.labourCost;
    current.net += point.net;
    monthMap.set(key, current);
  }

  return Array.from(monthMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-12)
    .map(([date, value]) => ({ date, ...value }));
}

function readPayHistory() {
  if (typeof window === 'undefined') return [] as PayHistoryEntry[];
  try {
    const raw = window.localStorage.getItem(PAY_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PayHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePayHistory(entries: PayHistoryEntry[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PAY_HISTORY_KEY, JSON.stringify(entries));
}

function filterWorkerToPeriod(worker: CrewPayWorker, payPeriod: PayPeriodKey, paidWorkerIds: Set<string>): DisplayWorker | null {
  const { start, end } = getPayPeriodBounds(payPeriod);
  const contributions = worker.contributions.filter((contribution) => {
    const date = new Date(contribution.date);
    return date >= start && date <= end;
  });

  if (contributions.length === 0) return null;

  const approvedHours = contributions.filter((entry) => entry.approved).reduce((sum, entry) => sum + entry.hours, 0);
  const pendingHours = contributions.filter((entry) => !entry.approved).reduce((sum, entry) => sum + entry.hours, 0);
  const totalHours = approvedHours + pendingHours;
  const approvedPay = approvedHours * worker.payRate;
  const pendingPay = pendingHours * worker.payRate;
  const labourAcceptanceSummary = contributions.reduce(
    (summary, contribution) => {
      summary[contribution.labourAcceptance] += 1;
      return summary;
    },
    { accepted: 0, pending: 0, missing: 0 }
  );

  return {
    ...worker,
    contributions,
    approvedHours,
    pendingHours,
    totalHours,
    approvedPay,
    pendingPay,
    estimatedGrossPay: approvedPay + pendingPay,
    labourAcceptanceSummary,
    displayPayStatus: paidWorkerIds.has(worker.id)
      ? 'Paid'
      : worker.payStatus,
  };
}

function acceptanceLabel(status: LabourAcceptanceStatus) {
  if (status === 'accepted') return 'Client accepted labour terms';
  if (status === 'pending') return 'Pending client acceptance';
  return 'No labour acceptance recorded';
}

function acceptanceChip(status: LabourAcceptanceStatus) {
  if (status === 'accepted') return 'bg-emerald-100 text-emerald-700';
  if (status === 'pending') return 'bg-amber-100 text-amber-700';
  return 'bg-rose-100 text-rose-700';
}

function moneyAlertTone(severity: MoneyActionAlert['severity']) {
  if (severity === 'critical') return 'border-red-200 bg-red-50/90';
  if (severity === 'warning') return 'border-amber-200 bg-amber-50/90';
  return 'border-sky-200 bg-sky-50/90';
}

function payStatusTone(status: DisplayPayStatus) {
  if (status === 'Paid') return 'bg-emerald-100 text-emerald-700';
  if (status === 'Ready to pay') return 'bg-sky-100 text-sky-700';
  if (status === 'Needs review') return 'bg-rose-100 text-rose-700';
  return 'bg-slate-100 text-slate-700';
}

function transactionTone(type: MoneyTransaction['type']) {
  if (type === 'incoming') return 'bg-emerald-100 text-emerald-700';
  if (type === 'outgoing') return 'bg-amber-100 text-amber-700';
  if (type === 'payroll') return 'bg-indigo-100 text-indigo-700';
  return 'bg-slate-100 text-slate-700';
}

function KpiCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'accent';
}) {
  return (
    <div
      className="rounded-[24px] border px-4 py-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)]"
      style={{
        background: tone === 'accent' ? 'linear-gradient(145deg, rgba(221,243,228,0.88), rgba(255,255,255,0.96))' : 'rgba(255,255,255,0.92)',
        borderColor: 'rgba(15,61,46,0.08)',
      }}
    >
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-[1.8rem] font-semibold leading-none text-slate-950">{value}</div>
      {hint ? <div className="mt-2 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  right,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 rounded-[28px] border border-black/5 bg-white/92 p-5 shadow-[0_16px_42px_rgba(15,23,42,0.08)] ${className}`}
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold" style={{ color: dashboardTheme.color.primary }}>
            {title}
          </h2>
          {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        {right ? <div className="ml-auto">{right}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ChartLegend() {
  const items = [
    { label: 'Revenue', color: MONEY_CHART_COLORS.revenue },
    { label: 'Expenses', color: MONEY_CHART_COLORS.expenses },
    { label: 'Net position', color: MONEY_CHART_COLORS.net },
    { label: 'Labour cost', color: MONEY_CHART_COLORS.labour },
  ];

  return (
    <div className="flex flex-wrap gap-3 text-xs text-slate-600">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function HeroChart({ data }: { data: Array<MoneyFlowPoint & { label: string }> }) {
  return (
    <ResponsiveContainer width="100%" height={360}>
      <AreaChart data={data} margin={{ top: 10, right: 20, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="moneyRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={MONEY_CHART_COLORS.revenue} stopOpacity={0.22} />
            <stop offset="95%" stopColor={MONEY_CHART_COLORS.revenue} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="moneyExpense" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={MONEY_CHART_COLORS.expenses} stopOpacity={0.18} />
            <stop offset="95%" stopColor={MONEY_CHART_COLORS.expenses} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(15,23,42,0.08)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: '#64748B' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 18,
            border: '1px solid rgba(15,61,46,0.08)',
            boxShadow: '0 18px 40px rgba(15,23,42,0.12)',
            background: 'rgba(255,255,255,0.98)',
          }}
          formatter={(value: number | string | undefined, name: string | undefined) => [formatCurrency(Number(value) || 0), name ?? 'Value']}
          labelFormatter={(label) => `Period: ${label}`}
        />
        <Area type="monotone" dataKey="revenue" stroke={MONEY_CHART_COLORS.revenue} strokeWidth={2.4} fill="url(#moneyRevenue)" name="Revenue" />
        <Area type="monotone" dataKey="expenses" stroke={MONEY_CHART_COLORS.expenses} strokeWidth={2.1} fill="url(#moneyExpense)" name="Expenses" />
        <Line type="monotone" dataKey="net" stroke={MONEY_CHART_COLORS.net} strokeWidth={2.4} dot={false} name="Net position" />
        <Line type="monotone" dataKey="labourCost" stroke={MONEY_CHART_COLORS.labour} strokeWidth={2} dot={false} strokeDasharray="6 6" name="Labour cost" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function BreakdownList({ items, empty }: { items: MoneyBreakdownItem[]; empty: string }) {
  if (items.length === 0) {
    return <div className="rounded-2xl border border-dashed border-black/10 px-4 py-6 text-sm text-slate-500">{empty}</div>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <div className="truncate font-medium text-slate-900">{item.label}</div>
              <div className="text-xs text-slate-500">
                {item.count ? `${item.count} items` : `${item.share}% share`}
              </div>
            </div>
            <div className="font-semibold text-slate-900">{formatCurrency(item.amount)}</div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${Math.max(item.share, 4)}%`, background: dashboardTheme.color.accent }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function AlertsStack({ alerts }: { alerts: MoneyActionAlert[] }) {
  if (alerts.length === 0) {
    return <div className="rounded-2xl border border-dashed border-black/10 px-4 py-6 text-sm text-slate-500">Nothing urgent right now.</div>;
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <div key={alert.id} className={`rounded-2xl border px-4 py-4 ${moneyAlertTone(alert.severity)}`}>
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900">{alert.title}</div>
              <div className="mt-1 text-sm text-slate-600">{alert.message}</div>
            </div>
            {alert.href ? (
              <Link href={alert.href} className="ml-auto text-xs font-semibold" style={{ color: dashboardTheme.color.primary }}>
                {alert.actionLabel || 'Open'} →
              </Link>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function SimpleTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  empty: string;
}) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-black/5 bg-white/95">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm text-slate-700">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.16em] text-slate-500">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-3 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-4 py-10 text-center text-sm text-slate-500">
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((cells, index) => (
                <tr key={index} className="border-t border-slate-100 align-top">
                  {cells.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-4 py-3">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WorkerCard({
  worker,
  selected,
  toggleSelected,
  onMarkPaid,
}: {
  worker: DisplayWorker;
  selected: boolean;
  toggleSelected: () => void;
  onMarkPaid: () => void;
}) {
  return (
    <div className="rounded-[26px] border border-black/5 bg-white/96 p-5 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-start gap-3">
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={selected} onChange={toggleSelected} className="h-4 w-4 rounded border-slate-300" />
          <div>
            <div className="text-base font-semibold text-slate-950">{worker.name}</div>
            <div className="text-xs text-slate-500">
              {worker.role} · {worker.employmentType}
            </div>
          </div>
        </label>
        <div className={`ml-auto rounded-full px-3 py-1 text-[11px] font-semibold ${payStatusTone(worker.displayPayStatus)}`}>
          {worker.displayPayStatus}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-5">
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Accrued</div>
          <div className="mt-1 text-lg font-semibold text-slate-950">{worker.totalHours.toFixed(1)}h</div>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Approved</div>
          <div className="mt-1 text-lg font-semibold text-slate-950">{worker.approvedHours.toFixed(1)}h</div>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Pending</div>
          <div className="mt-1 text-lg font-semibold text-slate-950">{worker.pendingHours.toFixed(1)}h</div>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Pay rate</div>
          <div className="mt-1 text-lg font-semibold text-slate-950">{formatCurrency(worker.payRate)}/hr</div>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Estimated gross</div>
          <div className="mt-1 text-lg font-semibold text-slate-950">{formatCurrency(worker.estimatedGrossPay)}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-black/5 bg-slate-50/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Award reference / rate check</div>
              <div className="mt-1 text-sm font-medium text-slate-900">{worker.awardCategory}</div>
            </div>
            <div
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                worker.awardStatus === 'compliant'
                  ? 'bg-emerald-100 text-emerald-700'
                  : worker.awardStatus === 'review'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-slate-100 text-slate-700'
              }`}
            >
              {worker.awardStatus === 'compliant' ? 'Above reference' : worker.awardStatus === 'review' ? 'Needs review' : 'Reference required'}
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 text-sm">
            <div>
              <div className="text-xs text-slate-500">Classification</div>
              <div className="mt-1 font-medium text-slate-900">{worker.classification || 'Set level'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Reference minimum</div>
              <div className="mt-1 font-medium text-slate-900">
                {worker.minimumAwardRate == null ? 'Set reference' : `${formatCurrency(worker.minimumAwardRate)}/hr`}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Variance</div>
              <div className={`mt-1 font-medium ${worker.awardVariance != null && worker.awardVariance < 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                {worker.awardVariance == null ? 'Reference required' : `${worker.awardVariance >= 0 ? '+' : ''}${formatCurrency(worker.awardVariance)}/hr`}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-black/5 bg-slate-50/70 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Client labour acceptance</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">
              Accepted · {worker.labourAcceptanceSummary.accepted}
            </span>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-700">
              Pending · {worker.labourAcceptanceSummary.pending}
            </span>
            <span className="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-semibold text-rose-700">
              Missing · {worker.labourAcceptanceSummary.missing}
            </span>
          </div>
          <div className="mt-3 text-sm text-slate-600">
            {worker.serviceMix.length > 0 ? `Service mix: ${worker.serviceMix.join(', ')}` : 'No service mix recorded yet.'}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Jobs feeding this pay period</div>
        <div className="space-y-2">
          {worker.contributions.slice(0, 4).map((contribution) => (
            <div key={contribution.assignmentId} className="flex flex-wrap items-center gap-3 rounded-2xl border border-black/5 bg-white px-3 py-3 text-sm">
              <div className="min-w-[180px]">
                <div className="font-medium text-slate-900">{contribution.customer}</div>
                <div className="text-xs text-slate-500">
                  {contribution.jobLabel} · {contribution.service}
                </div>
              </div>
              <div className="text-xs text-slate-500">{formatDate(contribution.date)}</div>
              <div className="text-sm font-semibold text-slate-900">{contribution.hours.toFixed(1)}h</div>
              <div className="text-sm text-slate-600">{formatCurrency(contribution.estimatedRevenue)} job value</div>
              <div className={`rounded-full px-3 py-1 text-[11px] font-semibold ${acceptanceChip(contribution.labourAcceptance)}`}>
                {acceptanceLabel(contribution.labourAcceptance)}
              </div>
              <div className={`rounded-full px-3 py-1 text-[11px] font-semibold ${contribution.approved ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                {contribution.approved ? 'Approved for payroll' : 'Pending approval'}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onMarkPaid}
          disabled={worker.displayPayStatus === 'Paid' || worker.approvedPay <= 0}
          className="rounded-full px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: dashboardTheme.color.primary }}
        >
          Mark Paid
        </button>
        <button
          type="button"
          onClick={() => toast.info(`${worker.name}: ${worker.approvedHours.toFixed(1)} approved hours, ${worker.pendingHours.toFixed(1)} pending.`)}
          className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Review Pay
        </button>
      </div>
    </div>
  );
}

export default function MoneyFlowWorkspace() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { metrics, moneyFlow, receivables, payables, isLoading } = useDashboardData('full');

  const [tab, setTab] = useState<MoneyTab>(() => sanitizeTab(searchParams?.get('tab') ?? null));
  const [range, setRange] = useState<RangeKey>('month');
  const [payPeriod, setPayPeriod] = useState<PayPeriodKey>('fortnight');
  const [groupMode, setGroupMode] = useState<GroupMode>('worker');
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<Set<string>>(new Set());
  const [transactionFilter, setTransactionFilter] = useState<TransactionFilter>('all');
  const [payHistory, setPayHistory] = useState<PayHistoryEntry[]>([]);

  useEffect(() => {
    setTab(sanitizeTab(searchParams?.get('tab') ?? null));
  }, [searchParams]);

  useEffect(() => {
    setPayHistory(readPayHistory());
  }, []);

  const handleTabChange = (nextTab: MoneyTab) => {
    setTab(nextTab);
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('tab', nextTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const chartData = useMemo(() => aggregateSeries(moneyFlow.series, range), [moneyFlow.series, range]);
  const payPeriodMeta = useMemo(() => getPayPeriodBounds(payPeriod), [payPeriod]);
  const paidWorkerIds = useMemo(
    () => new Set(payHistory.filter((entry) => entry.periodKey === payPeriod).map((entry) => entry.workerId)),
    [payHistory, payPeriod]
  );

  const workers = useMemo(
    () =>
      moneyFlow.crewPay.workers
        .map((worker) => filterWorkerToPeriod(worker, payPeriod, paidWorkerIds))
        .filter((worker): worker is DisplayWorker => Boolean(worker)),
    [moneyFlow.crewPay.workers, paidWorkerIds, payPeriod]
  );

  const groupedWorkers = useMemo(() => {
    if (groupMode === 'worker') {
      return [{ label: 'Crew', workers }];
    }

    const map = new Map<string, DisplayWorker[]>();
    for (const worker of workers) {
      const key = worker.role || 'Crew';
      const current = map.get(key) || [];
      current.push(worker);
      map.set(key, current);
    }

    return Array.from(map.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([label, grouped]) => ({ label, workers: grouped }));
  }, [groupMode, workers]);

  const payableStatusFilter = searchParams?.get('status') ?? '';
  const visibleReceivables = useMemo(
    () => receivables.filter((record) => !payableStatusFilter || record.status === payableStatusFilter),
    [payableStatusFilter, receivables]
  );
  const visiblePayables = useMemo(
    () => payables.filter((record) => !payableStatusFilter || record.status === payableStatusFilter),
    [payableStatusFilter, payables]
  );

  const selectedWorkers = useMemo(
    () => workers.filter((worker) => selectedWorkerIds.has(worker.id)),
    [selectedWorkerIds, workers]
  );

  const periodSummary = useMemo(() => {
    const approvedHours = workers.reduce((sum, worker) => sum + worker.approvedHours, 0);
    const pendingHours = workers.reduce((sum, worker) => sum + worker.pendingHours, 0);
    const totalHours = approvedHours + pendingHours;
    const payrollOwed = workers
      .filter((worker) => worker.displayPayStatus !== 'Paid')
      .reduce((sum, worker) => sum + worker.approvedPay, 0);

    return {
      totalHours,
      approvedHours,
      pendingHours,
      payrollOwed,
      readyCount: workers.filter((worker) => worker.displayPayStatus === 'Ready to pay').length,
      paidCount: workers.filter((worker) => worker.displayPayStatus === 'Paid').length,
      reviewCount: workers.filter((worker) => worker.displayPayStatus === 'Needs review').length,
    };
  }, [workers]);

  const transactionRows = useMemo(
    () => moneyFlow.transactions.filter((entry) => transactionFilter === 'all' || entry.type === transactionFilter),
    [moneyFlow.transactions, transactionFilter]
  );

  const handleToggleWorker = (workerId: string) => {
    setSelectedWorkerIds((current) => {
      const next = new Set(current);
      if (next.has(workerId)) next.delete(workerId);
      else next.add(workerId);
      return next;
    });
  };

  const markWorkersPaid = (workersToMark: DisplayWorker[]) => {
    const payableWorkers = workersToMark.filter((worker) => worker.approvedPay > 0 && worker.displayPayStatus !== 'Paid');
    if (payableWorkers.length === 0) {
      toast.info('No approved payroll items selected.');
      return;
    }

    const entries: PayHistoryEntry[] = payableWorkers.map((worker) => ({
      id: `${worker.id}-${Date.now()}`,
      workerId: worker.id,
      workerName: worker.name,
      periodKey: payPeriod,
      periodLabel: payPeriodMeta.label,
      paidAt: new Date().toISOString(),
      hours: worker.approvedHours,
      amount: worker.approvedPay,
    }));

    const nextHistory = [...entries, ...payHistory].slice(0, 80);
    setPayHistory(nextHistory);
    writePayHistory(nextHistory);
    toast.success(`${payableWorkers.length} payroll item${payableWorkers.length === 1 ? '' : 's'} marked paid for ${payPeriodMeta.label.toLowerCase()}.`);
    setSelectedWorkerIds(new Set());
  };

  const handleRunPayroll = () => {
    handleTabChange('crew-pay');
    const readyIds = workers.filter((worker) => worker.displayPayStatus === 'Ready to pay').map((worker) => worker.id);
    setSelectedWorkerIds(new Set(readyIds));
    toast.info(`${readyIds.length} crew members are ready to pay for ${payPeriodMeta.label.toLowerCase()}.`);
  };

  const exportPayrollSummary = () => {
    if (workers.length === 0) {
      toast.info('No crew pay items in this pay period.');
      return;
    }

    const columns: CsvColumn<DisplayWorker>[] = [
      { label: 'Worker', getValue: (row) => row.name },
      { label: 'Role', getValue: (row) => row.role },
      { label: 'Employment type', getValue: (row) => row.employmentType },
      { label: 'Approved hours', getValue: (row) => row.approvedHours.toFixed(2) },
      { label: 'Pending hours', getValue: (row) => row.pendingHours.toFixed(2) },
      { label: 'Pay rate', getValue: (row) => row.payRate.toFixed(2) },
      { label: 'Approved pay', getValue: (row) => row.approvedPay.toFixed(2) },
      { label: 'Status', getValue: (row) => row.displayPayStatus },
      { label: 'Award category', getValue: (row) => row.awardCategory },
      { label: 'Reference minimum', getValue: (row) => row.minimumAwardRate ?? '' },
    ];

    exportCsv({
      data: workers,
      columns,
      filename: `payroll-summary-${payPeriod}.csv`,
    });
    toast.success('Payroll summary exported.');
  };

  const outstandingInvoiceRows = visibleReceivables
    .slice(0, 8)
    .map((record) => [
      <div key={`${record.id}-invoice`}>
        <div className="font-semibold text-slate-900">{record.id}</div>
        <div className="text-xs text-slate-500">{record.jobId}</div>
      </div>,
      <div key={`${record.id}-customer`}>
        <div className="font-medium text-slate-900">{record.customer}</div>
        <div className="text-xs text-slate-500">{record.service}</div>
      </div>,
      formatDate(record.dueDate),
      <div key={`${record.id}-amount`} className="font-semibold text-slate-900">{formatCurrency(record.balance)}</div>,
      <span key={`${record.id}-status`} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${record.status === 'Overdue' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>
        {record.status}
      </span>,
    ]);

  const outgoingRows = visiblePayables
    .slice(0, 8)
    .map((record) => [
      <div key={`${record.id}-bill`}>
        <div className="font-semibold text-slate-900">{record.id}</div>
        <div className="text-xs text-slate-500">{record.category}</div>
      </div>,
      <div key={`${record.id}-vendor`} className="font-medium text-slate-900">{record.supplier}</div>,
      formatDate(record.dueDate),
      <div key={`${record.id}-amount`} className="font-semibold text-slate-900">{formatCurrency(record.amount)}</div>,
      <span key={`${record.id}-status`} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${record.status === 'Overdue' ? 'bg-rose-100 text-rose-700' : record.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
        {record.status}
      </span>,
    ]);

  const marginRows = moneyFlow.jobMargins.map((job: MoneyJobMargin) => [
    <div key={`${job.orderId}-job`}>
      <div className="font-semibold text-slate-900">{job.customer}</div>
      <div className="text-xs text-slate-500">{job.service}</div>
    </div>,
    formatDate(job.date),
    <div key={`${job.orderId}-revenue`} className="font-medium text-slate-900">{formatCurrency(job.revenue)}</div>,
    <div key={`${job.orderId}-labour`} className="font-medium text-slate-900">{formatCurrency(job.labourCost)}</div>,
    <div key={`${job.orderId}-margin`} className={`font-semibold ${job.margin < 30 ? 'text-rose-700' : 'text-slate-900'}`}>{job.margin}%</div>,
    <span key={`${job.orderId}-accept`} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${acceptanceChip(job.labourAcceptance)}`}>
      {acceptanceLabel(job.labourAcceptance)}
    </span>,
  ]);

  const recentHistory = payHistory.slice(0, 8);

  return (
    <div className="grid gap-6 min-w-0 w-full overflow-x-hidden pb-14">
      <section className="rounded-[32px] border border-black/5 bg-white/78 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Money Flow system</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 md:text-[2rem]">
              Incoming, outgoing, labour, payroll, and client pricing acceptance in one operational view.
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              The Money tab now follows the real flow of work: quotes become jobs, jobs accrue labour, labour becomes payroll, revenue lands, costs leave, and anything risky surfaces as an action queue.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleRunPayroll}
              className="rounded-full px-4 py-2 text-sm font-semibold text-white"
              style={{ background: dashboardTheme.color.primary }}
            >
              Run Payroll
            </button>
            <button
              type="button"
              onClick={exportPayrollSummary}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Export Payroll Summary
            </button>
            <Link
              href="/dashboard/subscriptions"
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Open Subscriptions
            </Link>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-black/5 bg-white/70 p-1.5">
        {TOP_TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => handleTabChange(item.key)}
            className="rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
            style={tab === item.key ? { background: dashboardTheme.color.primary, color: '#fff' } : { color: dashboardTheme.color.muted }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <>
          <SectionCard
            title="Money flow"
            subtitle="A live view of revenue, expenses, net position, and labour cost. The chart takes priority so trend changes are obvious at a glance."
            right={
              <div className="flex flex-wrap gap-2">
                {RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setRange(option.key)}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold"
                    style={range === option.key ? { background: dashboardTheme.color.primary, color: '#fff' } : { background: '#F8FAFC', color: '#475569' }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            }
            className="overflow-hidden"
          >
            <div
              className="rounded-[26px] border border-black/5 p-4 md:p-5"
              style={{
                background:
                  'radial-gradient(circle at top left, rgba(221,243,228,0.9), transparent 32%), linear-gradient(180deg, rgba(255,255,255,0.98), rgba(249,251,250,0.92))',
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Hero chart</div>
                  <div className="mt-1 text-lg font-semibold text-slate-950">
                    Revenue vs spend vs labour for the {range}.
                  </div>
                </div>
                <ChartLegend />
              </div>
              <div className="mt-4">
                {isLoading ? (
                  <div className="h-[360px] animate-pulse rounded-[22px] bg-slate-100" />
                ) : (
                  <HeroChart data={chartData} />
                )}
              </div>
            </div>
          </SectionCard>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <KpiCard label="Revenue this month" value={formatCurrency(moneyFlow.overview.revenueThisMonth)} hint={`${metrics.goals.currentJobs} completed jobs this month`} tone="accent" />
            <KpiCard label="Expenses this month" value={formatCurrency(moneyFlow.overview.expensesThisMonth)} hint="Paid supplier and operating costs" />
            <KpiCard label="Payroll owed" value={formatCurrency(periodSummary.payrollOwed)} hint={`${periodSummary.approvedHours.toFixed(1)} approved crew hours in ${payPeriodMeta.label.toLowerCase()}`} />
            <KpiCard label="Outstanding invoices" value={formatCurrency(moneyFlow.overview.outstandingInvoices)} hint={`${receivables.length} live receivables`} />
            <KpiCard label="Gross margin" value={`${moneyFlow.overview.grossMargin}%`} hint="Revenue less paid expenses" />
            <KpiCard label="Labour cost as % of revenue" value={`${moneyFlow.overview.labourCostPercent}%`} hint="Approved payroll against current revenue" />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <SectionCard title="Action queue" subtitle="Money should tell you what needs attention, not just describe the past.">
              <AlertsStack alerts={moneyFlow.alerts} />
            </SectionCard>
            <SectionCard title="Payroll pulse" subtitle={`Current pay run for ${payPeriodMeta.label.toLowerCase()}`}>
              <div className="grid gap-3 sm:grid-cols-2">
                <KpiCard label="Accrued hours" value={`${periodSummary.totalHours.toFixed(1)}h`} hint="Approved and pending" />
                <KpiCard label="Ready to pay" value={String(periodSummary.readyCount)} hint={`${periodSummary.paidCount} already marked paid`} />
                <KpiCard label="Needs review" value={String(periodSummary.reviewCount)} hint="Rate or approval issue" />
                <KpiCard label="Pending hours" value={`${periodSummary.pendingHours.toFixed(1)}h`} hint="Still awaiting approval" />
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard title="Outstanding invoices" subtitle="What money is expected and what is now at risk.">
              <SimpleTable
                headers={['Invoice', 'Customer', 'Due', 'Balance', 'Status']}
                rows={outstandingInvoiceRows}
                empty="No receivables match the current view."
              />
            </SectionCard>
            <SectionCard title="Lowest margin jobs" subtitle="Jobs where labour pressure is eroding margin.">
              <SimpleTable
                headers={['Job', 'Date', 'Revenue', 'Labour cost', 'Margin', 'Acceptance']}
                rows={marginRows}
                empty="No low-margin jobs to review."
              />
            </SectionCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard title="Revenue by service" subtitle="Which services are generating the most money.">
              <BreakdownList items={moneyFlow.incoming.revenueByService} empty="Revenue by service will appear once jobs are completed." />
            </SectionCard>
            <SectionCard title="Expense pressure" subtitle="Where outgoing money is accumulating.">
              <BreakdownList items={moneyFlow.outgoing.expenseByCategory} empty="No paid expenses recorded yet." />
            </SectionCard>
          </div>
        </>
      ) : null}

      {tab === 'incoming' ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <KpiCard label="Expected money" value={formatCurrency(moneyFlow.incoming.expected)} hint="Outstanding invoices plus accepted quote value" tone="accent" />
            <KpiCard label="Collected" value={formatCurrency(moneyFlow.incoming.received)} hint="Recorded payments received" />
            <KpiCard label="Overdue" value={formatCurrency(moneyFlow.incoming.overdue)} hint="Invoices that have slipped past due" />
            <KpiCard label="Deposits collected" value={formatCurrency(moneyFlow.incoming.depositsCollected)} hint="Part-paid jobs and invoice deposits" />
            <KpiCard label="Quotes accepted" value={String(moneyFlow.incoming.quotesAccepted)} hint="Client-approved pricing ready to become revenue" />
            <KpiCard label="Invoices paid" value={String(moneyFlow.incoming.invoicesPaid)} hint={`${moneyFlow.incoming.invoicesIssued} invoices issued`} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <SectionCard title="Incoming queue" subtitle="What is issued, overdue, and still waiting to land.">
              <SimpleTable
                headers={['Invoice', 'Customer', 'Due', 'Balance', 'Status']}
                rows={outstandingInvoiceRows}
                empty="No receivables in view."
              />
            </SectionCard>
            <SectionCard title="Revenue mix" subtitle="Top services driving the inflow right now.">
              <BreakdownList items={moneyFlow.incoming.revenueByService} empty="No service mix yet." />
            </SectionCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard title="Top customers" subtitle="Who is driving revenue this period.">
              <BreakdownList items={moneyFlow.incoming.revenueByCustomer} empty="Customer mix will populate after more completed work." />
            </SectionCard>
            <SectionCard title="Related actions" subtitle="Other revenue operations nearby.">
              <div className="space-y-3 text-sm">
                <Link href="/dashboard/quotes" className="flex items-center justify-between rounded-2xl border border-black/5 bg-slate-50 px-4 py-3">
                  <span className="font-medium text-slate-900">Open Quotes workspace</span>
                  <span className="text-slate-500">Review accepted pricing →</span>
                </Link>
                <Link href="/dashboard/subscriptions" className="flex items-center justify-between rounded-2xl border border-black/5 bg-slate-50 px-4 py-3">
                  <span className="font-medium text-slate-900">Recurring revenue</span>
                  <span className="text-slate-500">Open subscriptions →</span>
                </Link>
                <div className="rounded-2xl border border-black/5 bg-slate-50 px-4 py-4 text-slate-600">
                  Revenue collection is tied back to quotes and jobs so deposits, overdues, and accepted labour pricing can be reviewed together rather than in separate finance pages.
                </div>
              </div>
            </SectionCard>
          </div>
        </>
      ) : null}

      {tab === 'outgoing' ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <KpiCard label="Outgoing due" value={formatCurrency(moneyFlow.outgoing.due)} hint="Upcoming payables plus approved payroll" tone="accent" />
            <KpiCard label="Paid this month" value={formatCurrency(moneyFlow.outgoing.paid)} hint="Confirmed operating spend" />
            <KpiCard label="Payroll owed" value={formatCurrency(periodSummary.payrollOwed)} hint="Crew approved and ready to clear" />
            <KpiCard label="Supplier costs" value={formatCurrency(moneyFlow.outgoing.supplierCosts)} hint="Non-subscription suppliers due soon" />
            <KpiCard label="Subscriptions" value={formatCurrency(moneyFlow.outgoing.subscriptionCosts)} hint="Recurring software or service spend" />
            <KpiCard label="Settlement clearing" value={formatCurrency(moneyFlow.outgoing.settlementClearing)} hint="Pending payout movements" />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <SectionCard title="Outgoing queue" subtitle="Bills, supplier costs, and due dates that need handling.">
              <SimpleTable
                headers={['Bill', 'Supplier', 'Due', 'Amount', 'Status']}
                rows={outgoingRows}
                empty="No outgoing records in view."
              />
            </SectionCard>
            <SectionCard title="Expense breakdown" subtitle="Where the most cost pressure is building.">
              <BreakdownList items={moneyFlow.outgoing.expenseByCategory} empty="No expense breakdown available." />
            </SectionCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard title="Upcoming payroll" subtitle={`Approved hours waiting for payout in ${payPeriodMeta.label.toLowerCase()}`}>
              <div className="space-y-3">
                {workers.slice(0, 6).map((worker) => (
                  <div key={worker.id} className="flex items-center justify-between rounded-2xl border border-black/5 bg-slate-50 px-4 py-3">
                    <div>
                      <div className="font-medium text-slate-900">{worker.name}</div>
                      <div className="text-xs text-slate-500">{worker.approvedHours.toFixed(1)} approved hours</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-slate-950">{formatCurrency(worker.approvedPay)}</div>
                      <div className={`text-[11px] font-semibold ${worker.displayPayStatus === 'Needs review' ? 'text-rose-700' : 'text-slate-500'}`}>
                        {worker.displayPayStatus}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
            <SectionCard title="Reimbursements and subscriptions" subtitle="Small recurring drains are still operational issues.">
              <div className="grid gap-3 sm:grid-cols-2">
                <KpiCard label="Reimbursements" value={formatCurrency(moneyFlow.outgoing.reimbursementCosts)} hint="Expense items tagged reimbursement" />
                <KpiCard label="Recurring tools" value={formatCurrency(moneyFlow.outgoing.subscriptionCosts)} hint="Subscription-tagged payables" />
              </div>
            </SectionCard>
          </div>
        </>
      ) : null}

      {tab === 'crew-pay' ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-2 rounded-full border border-black/5 bg-white/80 p-1">
              {PAY_PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setPayPeriod(option.key)}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={payPeriod === option.key ? { background: dashboardTheme.color.primary, color: '#fff' } : { color: '#475569' }}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 rounded-full border border-black/5 bg-white/80 p-1">
              <button
                type="button"
                onClick={() => setGroupMode('worker')}
                className="rounded-full px-3 py-1.5 text-xs font-semibold"
                style={groupMode === 'worker' ? { background: dashboardTheme.color.primary, color: '#fff' } : { color: '#475569' }}
              >
                Group by worker
              </button>
              <button
                type="button"
                onClick={() => setGroupMode('role')}
                className="rounded-full px-3 py-1.5 text-xs font-semibold"
                style={groupMode === 'role' ? { background: dashboardTheme.color.primary, color: '#fff' } : { color: '#475569' }}
              >
                Group by role
              </button>
            </div>
            <div className="ml-auto flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => markWorkersPaid(selectedWorkers)}
                className="rounded-full px-4 py-2 text-sm font-semibold text-white"
                style={{ background: dashboardTheme.color.primary }}
              >
                Mark Paid
              </button>
              <button
                type="button"
                onClick={exportPayrollSummary}
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Export Payroll Summary
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <KpiCard label="Accrued hours" value={`${periodSummary.totalHours.toFixed(1)}h`} hint={payPeriodMeta.label} tone="accent" />
            <KpiCard label="Approved hours" value={`${periodSummary.approvedHours.toFixed(1)}h`} hint="Ready to turn into payroll" />
            <KpiCard label="Pending hours" value={`${periodSummary.pendingHours.toFixed(1)}h`} hint="Still awaiting approval" />
            <KpiCard label="Payroll owed" value={formatCurrency(periodSummary.payrollOwed)} hint={`${periodSummary.readyCount} ready to pay`} />
            <KpiCard label="Paid in this period" value={String(periodSummary.paidCount)} hint="Marked paid in this console" />
            <KpiCard label="Needs review" value={String(periodSummary.reviewCount)} hint="Rate or acceptance issue flagged" />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <SectionCard title="Crew pay run" subtitle="Review workers, their hours, jobs, acceptance state, and award reference before you clear payroll.">
              <div className="space-y-4">
                {groupedWorkers.map((group) => (
                  <div key={group.label} className="space-y-4">
                    {groupMode === 'role' ? <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{group.label}</div> : null}
                    {group.workers.map((worker) => (
                      <WorkerCard
                        key={worker.id}
                        worker={worker}
                        selected={selectedWorkerIds.has(worker.id)}
                        toggleSelected={() => handleToggleWorker(worker.id)}
                        onMarkPaid={() => markWorkersPaid([worker])}
                      />
                    ))}
                  </div>
                ))}
                {workers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-slate-500">
                    No crew accruals in {payPeriodMeta.label.toLowerCase()}.
                  </div>
                ) : null}
              </div>
            </SectionCard>

            <div className="space-y-4">
              <SectionCard title="Award reference note" subtitle="Use the built-in comparison as an operational check, then confirm the exact classification when needed.">
                <div className="space-y-3 text-sm text-slate-600">
                  <p>
                    Cleaning and yard crews are compared against a lightweight Fair Work reference so underpayment risk is visible inside payroll review instead of hidden in a separate compliance process.
                  </p>
                  <p>
                    Weekend, overtime, and public holiday loadings are intentionally left for the next pass so the core hourly check stays simple and practical.
                  </p>
                </div>
              </SectionCard>

              <SectionCard title="Payment history" subtitle="Recent mark-paid events recorded in this console.">
                <div className="space-y-3">
                  {recentHistory.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-black/10 px-4 py-6 text-sm text-slate-500">
                      No payroll history recorded yet.
                    </div>
                  ) : (
                    recentHistory.map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-black/5 bg-slate-50 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium text-slate-900">{entry.workerName}</div>
                            <div className="text-xs text-slate-500">
                              {entry.periodLabel} · {entry.hours.toFixed(1)}h
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-slate-950">{formatCurrency(entry.amount)}</div>
                            <div className="text-xs text-slate-500">{formatRelativeTime(entry.paidAt)}</div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SectionCard>
            </div>
          </div>
        </>
      ) : null}

      {tab === 'transactions' ? (
        <>
          <div className="flex flex-wrap gap-2">
            {(['all', 'incoming', 'outgoing', 'payroll', 'settlement'] as TransactionFilter[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTransactionFilter(option)}
                className="rounded-full px-3 py-1.5 text-xs font-semibold"
                style={transactionFilter === option ? { background: dashboardTheme.color.primary, color: '#fff' } : { background: 'rgba(255,255,255,0.88)', color: '#475569' }}
              >
                {option === 'all' ? 'All transactions' : option.charAt(0).toUpperCase() + option.slice(1)}
              </button>
            ))}
          </div>

          <SectionCard title="Transaction history" subtitle="Money movements across receivables, payables, payroll, and settlements in one chronological stream.">
            <div className="space-y-3">
              {transactionRows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-slate-500">
                  No transactions in this filter.
                </div>
              ) : (
                transactionRows.map((entry) => (
                  <div key={entry.id} className="rounded-[24px] border border-black/5 bg-white/95 px-4 py-4 shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className={`rounded-full px-3 py-1 text-[11px] font-semibold ${transactionTone(entry.type)}`}>
                        {entry.type}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-slate-950">{entry.title}</div>
                        <div className="text-sm text-slate-500">{entry.subtitle}</div>
                      </div>
                      <div className="ml-auto text-right">
                        <div className="font-semibold text-slate-950">{formatCurrency(entry.amount)}</div>
                        <div className="text-xs text-slate-500">{formatRelativeTime(entry.date)}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>Status: {entry.status}</span>
                      {entry.reference ? <span>Reference: {entry.reference}</span> : null}
                      {entry.href ? (
                        <Link href={entry.href} className="font-semibold" style={{ color: dashboardTheme.color.primary }}>
                          Open source →
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
