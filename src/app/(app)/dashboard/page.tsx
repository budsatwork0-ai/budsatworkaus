'use client';

import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { brand } from '@/app/ui/theme';
import {
  useDashboardData,
  useFormattedMetrics,
  type ReceivableRecord,
  type PayableRecord,
} from './hooks/useDashboardData';

type ReceivableStatus = 'Draft' | 'Sent' | 'Part-paid' | 'Paid' | 'Overdue';
type PayableStatus = 'Upcoming' | 'Paid' | 'Overdue';

type RecordDetail =
  | { type: 'receivable'; record: ReceivableRecord }
  | { type: 'payable'; record: PayableRecord };

type TabKey = 'overview' | 'receivables' | 'payables' | 'reports';

type CsvColumn<T> = {
  label: string;
  getValue: (row: T) => string | number | boolean | null | undefined;
};

// Type-erased export config for mixed report types
type ReportExportConfig = {
  key: string;
  label: string;
  description: string;
  filename: string;
  exportFn: () => void;
  columnLabels: string[];
};

type ReceivableFilters = {
  status: 'all' | ReceivableStatus;
  startDate: string;
  endDate: string;
  search: string;
};

type PayableFilters = {
  status: 'all' | PayableStatus;
  startDate: string;
  endDate: string;
  search: string;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (value: string) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-AU', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const statusStyles: Record<ReceivableStatus | PayableStatus, { bg: string; text: string }> = {
  Draft: { bg: 'bg-slate-100', text: 'text-slate-600' },
  Sent: { bg: 'bg-sky-100', text: 'text-slate-700' },
  'Part-paid': { bg: 'bg-amber-100', text: 'text-amber-700' },
  Paid: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  Overdue: { bg: 'bg-amber-100', text: 'text-amber-700' },
  Upcoming: { bg: 'bg-slate-100', text: 'text-slate-600' },
};

const receivableStatusOptions: Array<'all' | ReceivableStatus> = [
  'all',
  'Draft',
  'Sent',
  'Part-paid',
  'Paid',
  'Overdue',
];

const payableStatusOptions: Array<'all' | PayableStatus> = ['all', 'Upcoming', 'Paid', 'Overdue'];

const tabs: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'receivables', label: 'Receivables' },
  { key: 'payables', label: 'Payables' },
  { key: 'reports', label: 'Reports & Exports' },
];

const receivableCsvColumns: CsvColumn<ReceivableRecord>[] = [
  { label: 'Invoice / Job ID', getValue: (row) => `${row.id} / ${row.jobId}` },
  { label: 'Customer', getValue: (row) => row.customer },
  { label: 'Service', getValue: (row) => row.service },
  { label: 'Invoice date', getValue: (row) => row.invoiceDate },
  { label: 'Due date', getValue: (row) => row.dueDate },
  { label: 'Amount', getValue: (row) => formatCurrency(row.amount) },
  { label: 'Paid', getValue: (row) => formatCurrency(row.paid) },
  { label: 'Balance', getValue: (row) => formatCurrency(row.balance) },
  { label: 'Status', getValue: (row) => row.status },
];

const payableCsvColumns: CsvColumn<PayableRecord>[] = [
  { label: 'Bill ID', getValue: (row) => row.id },
  { label: 'Supplier / Contractor', getValue: (row) => row.supplier },
  { label: 'Category', getValue: (row) => row.category },
  { label: 'Bill date', getValue: (row) => row.billDate },
  { label: 'Due date', getValue: (row) => row.dueDate },
  { label: 'Amount', getValue: (row) => formatCurrency(row.amount) },
  { label: 'Paid status', getValue: (row) => row.status },
  { label: 'Payment method', getValue: (row) => row.paymentMethod },
];

const SummaryCard = ({
  label,
  value,
  hint,
  viewLabel,
  isLoading,
}: {
  label: string;
  value: string;
  hint?: string;
  viewLabel: string;
  isLoading?: boolean;
}) => (
  <div className="rounded-2xl border border-black/5 bg-white/90 px-3 sm:px-4 py-3 text-sm text-slate-700 shadow-[0_10px_28px_rgba(15,23,42,0.08)] overflow-hidden">
    <div className="text-[10px] sm:text-[11px] uppercase tracking-wide text-slate-500 truncate">{label}</div>
    {isLoading ? (
      <div className="h-8 w-24 mt-1 bg-slate-100 rounded animate-pulse" />
    ) : (
      <div className="text-xl sm:text-2xl font-semibold text-slate-900 mt-1">{value}</div>
    )}
    {hint && <div className="text-[11px] sm:text-xs text-slate-500 mt-1 truncate">{hint}</div>}
    <button
      type="button"
      className="mt-2 sm:mt-3 text-[11px] sm:text-xs font-semibold text-slate-500 hover:text-slate-700 underline decoration-slate-200"
    >
      View {viewLabel}
    </button>
  </div>
);

const Panel = ({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
}) => (
  <section className="rounded-2xl border border-black/5 bg-white/90 px-4 py-4 shadow-[0_8px_30px_rgba(2,6,23,0.08)]">
    <div className="flex items-start gap-3">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold" style={{ color: brand.primary }}>
          {title}
        </h3>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {right && <div className="ml-auto text-xs text-slate-500">{right}</div>}
    </div>
    <div className="mt-3">{children}</div>
  </section>
);

const StatRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between rounded-xl border border-black/5 bg-white/80 px-3 py-2 text-sm">
    <span className="text-xs text-slate-500">{label}</span>
    <span className="font-semibold text-slate-900">{value}</span>
  </div>
);

const StatusChip = ({ status }: { status: ReceivableStatus | PayableStatus }) => {
  const style = statusStyles[status] ?? { bg: 'bg-slate-100', text: 'text-slate-700' };
  return (
    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${style.bg} ${style.text}`}>
      {status}
    </span>
  );
};

const exportCsv = <T,>({
  data,
  columns,
  filename,
}: {
  data: T[];
  columns: CsvColumn<T>[];
  filename: string;
}) => {
  if (typeof document === 'undefined') return;
  const header = columns.map((col) => `"${col.label.replace(/"/g, '""')}"`).join(',');
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const value = col.getValue(row);
        const safeValue = value == null ? '' : String(value);
        return `"${safeValue.replace(/"/g, '""')}"`;
      })
      .join(',')
  );
  const csvContent = [header, ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const ExportButton = <T,>({
  label,
  data,
  columns,
  filename,
  className,
}: {
  label: string;
  data: T[];
  columns: CsvColumn<T>[];
  filename: string;
  className?: string;
}) => {
  const handleExport = useCallback(() => {
    exportCsv({ data, columns, filename });
  }, [columns, data, filename]);

  return (
    <button
      type="button"
      onClick={handleExport}
      className={`text-xs font-semibold text-slate-500 hover:text-slate-700 underline decoration-slate-200 ${
        className ?? ''
      }`}
    >
      {label}
    </button>
  );
};

const LoadingSpinner = () => (
  <div className="flex items-center justify-center py-12">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />
  </div>
);

const ErrorMessage = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center">
    <p className="text-sm text-red-600 mb-4">{message}</p>
    <button
      onClick={onRetry}
      className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
    >
      Try again
    </button>
  </div>
);

const DetailDrawer = ({
  detail,
  onClose,
  accountantView,
  operationsSnapshot,
}: {
  detail: RecordDetail | null;
  onClose: () => void;
  accountantView: boolean;
  operationsSnapshot: {
    jobsCompleted: number;
    averageJobValue: number;
    labourPercent: number;
    grossMargin: number;
  };
}) => {
  if (!detail) return null;
  const isReceivable = detail.type === 'receivable';
  const record = detail.record;

  const detailRows = isReceivable
    ? [
        { label: 'Customer', value: (record as ReceivableRecord).customer },
        { label: 'Service', value: (record as ReceivableRecord).service },
        { label: 'Invoice date', value: formatDate((record as ReceivableRecord).invoiceDate) },
        { label: 'Due date', value: formatDate(record.dueDate) },
        { label: 'Amount', value: formatCurrency(record.amount) },
        { label: 'Paid', value: formatCurrency((record as ReceivableRecord).paid) },
        { label: 'Balance', value: formatCurrency((record as ReceivableRecord).balance) },
      ]
    : [
        { label: 'Supplier / Contractor', value: (record as PayableRecord).supplier },
        { label: 'Category', value: (record as PayableRecord).category },
        { label: 'Bill date', value: formatDate((record as PayableRecord).billDate) },
        { label: 'Due date', value: formatDate(record.dueDate) },
        { label: 'Amount', value: formatCurrency(record.amount) },
        { label: 'Payment method', value: (record as PayableRecord).paymentMethod },
      ];

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
      <div className="relative ml-auto flex h-full w-full max-w-md flex-col border-l border-black/5 bg-white/95 shadow-2xl">
        <div className="flex items-start justify-between px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Detail</p>
            <h2 className="text-lg font-semibold text-slate-900">
              {isReceivable ? 'Invoice detail' : 'Bill detail'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-black/10 bg-white px-3 py-1 text-sm text-slate-500"
          >
            Close
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-6 text-sm text-slate-700">
          <div className="space-y-1 text-xs text-slate-500">Invoice / Bill ID</div>
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-slate-900">{record.id}</span>
            <StatusChip status={record.status} />
          </div>
          <div className="space-y-2">
            {detailRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between text-sm">
                <span className="text-xs text-slate-500">{row.label}</span>
                <span className="font-semibold text-slate-900">{row.value}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-500">Notes</div>
            <p className="rounded-xl border border-black/5 bg-white/80 px-3 py-2 text-sm text-slate-700">
              {record.notes || 'No notes provided.'}
            </p>
          </div>
          {accountantView && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span>Gross margin</span>
                <span className="font-semibold text-slate-900">{operationsSnapshot.grossMargin}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Labour %</span>
                <span className="font-semibold text-slate-900">{operationsSnapshot.labourPercent}%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function DashboardHome() {
  const { metrics, receivables, payables, isLoading, error, refetch } = useDashboardData();
  const formattedMetrics = useFormattedMetrics(metrics);

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [accountantView, setAccountantView] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<RecordDetail | null>(null);
  const [receivableFilters, setReceivableFilters] = useState<ReceivableFilters>({
    status: 'all',
    startDate: '',
    endDate: '',
    search: '',
  });
  const [payableFilters, setPayableFilters] = useState<PayableFilters>({
    status: 'all',
    startDate: '',
    endDate: '',
    search: '',
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem('dashboard-accountant-view');
    if (saved === 'true') {
      setAccountantView(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('dashboard-accountant-view', accountantView ? 'true' : 'false');
  }, [accountantView]);

  const filteredReceivables = useMemo(() => {
    const searchTerm = receivableFilters.search.trim().toLowerCase();
    return receivables.filter((record) => {
      if (receivableFilters.status !== 'all' && record.status !== receivableFilters.status) {
        return false;
      }
      if (receivableFilters.startDate && record.invoiceDate < receivableFilters.startDate) {
        return false;
      }
      if (receivableFilters.endDate && record.invoiceDate > receivableFilters.endDate) {
        return false;
      }
      if (searchTerm) {
        const haystack = `${record.customer} ${record.service} ${record.id} ${record.jobId}`.toLowerCase();
        if (!haystack.includes(searchTerm)) return false;
      }
      return true;
    });
  }, [receivableFilters, receivables]);

  const filteredPayables = useMemo(() => {
    const searchTerm = payableFilters.search.trim().toLowerCase();
    return payables.filter((record) => {
      if (payableFilters.status !== 'all' && record.status !== payableFilters.status) {
        return false;
      }
      if (payableFilters.startDate && record.billDate < payableFilters.startDate) {
        return false;
      }
      if (payableFilters.endDate && record.billDate > payableFilters.endDate) {
        return false;
      }
      if (searchTerm) {
        const haystack = `${record.supplier} ${record.category} ${record.id}`.toLowerCase();
        if (!haystack.includes(searchTerm)) return false;
      }
      return true;
    });
  }, [payableFilters, payables]);

  const summaryCards = useMemo(() => [
    {
      label: 'Cash / bank balance',
      value: formattedMetrics.cashBalance,
      hint: 'As of today',
      viewLabel: 'account',
    },
    {
      label: 'Outstanding receivables',
      value: formattedMetrics.outstandingReceivables,
      hint: formattedMetrics.outstandingReceivablesHint,
      viewLabel: 'receivables',
    },
    {
      label: 'Upcoming payables (next 30 days)',
      value: formattedMetrics.upcomingPayables,
      hint: formattedMetrics.upcomingPayablesHint,
      viewLabel: 'payables',
    },
    {
      label: 'Net profit (month-to-date)',
      value: formattedMetrics.netProfit,
      hint: formattedMetrics.netProfitHint,
      viewLabel: 'P&L',
    },
  ], [formattedMetrics]);

  const monthlySummaryRecords = useMemo(() => {
    const totalRevenue = metrics?.revenueByService.reduce((sum, s) => sum + s.amount, 0) ?? 0;
    const totalExpenses = metrics?.expensesByCategory.reduce((sum, e) => sum + e.amount, 0) ?? 0;
    return [
      { label: 'Revenue (MTD)', value: totalRevenue },
      { label: 'Expenses (MTD)', value: totalExpenses },
      { label: 'Net profit (MTD)', value: metrics?.netProfit.amount ?? 0 },
    ];
  }, [metrics]);

  const monthlySummaryColumns: CsvColumn<typeof monthlySummaryRecords[number]>[] = [
    { label: 'Line item', getValue: (row) => row.label },
    { label: 'Amount', getValue: (row) => formatCurrency(row.value) },
  ];

  const reportExports: ReportExportConfig[] = useMemo(() => [
    {
      key: 'receivables',
      label: 'Export Receivables (CSV)',
      description: 'Invoice-level detail including status and balances.',
      filename: 'receivables.csv',
      exportFn: () => exportCsv({ data: receivables, columns: receivableCsvColumns, filename: 'receivables.csv' }),
      columnLabels: receivableCsvColumns.map(c => c.label),
    },
    {
      key: 'payables',
      label: 'Export Payables (CSV)',
      description: 'Bill log with supplier, category, and payment method.',
      filename: 'payables.csv',
      exportFn: () => exportCsv({ data: payables, columns: payableCsvColumns, filename: 'payables.csv' }),
      columnLabels: payableCsvColumns.map(c => c.label),
    },
    {
      key: 'summary',
      label: 'Export Monthly Summary (CSV)',
      description: 'Totals for revenue, expenses, and net profit.',
      filename: 'monthly-summary.csv',
      exportFn: () => exportCsv({ data: monthlySummaryRecords, columns: monthlySummaryColumns, filename: 'monthly-summary.csv' }),
      columnLabels: monthlySummaryColumns.map(c => c.label),
    },
  ], [receivables, payables, monthlySummaryRecords, monthlySummaryColumns]);

  const handleRowClick = (detail: RecordDetail) => {
    setSelectedDetail(detail);
  };

  if (error) {
    return (
      <div className="grid gap-6 sm:gap-10 w-full px-3 sm:px-4 md:px-10 lg:px-12 pb-14">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold" style={{ color: brand.primary }}>
            Dashboard
          </h1>
        </div>
        <ErrorMessage message={error} onRetry={refetch} />
      </div>
    );
  }

  const renderOverview = () => (
    <div className="grid gap-4 lg:grid-cols-[1fr_0.92fr]">
      <div className="space-y-4">
        <Panel title="Revenue by service" subtitle="Month-to-date">
          {isLoading ? (
            <LoadingSpinner />
          ) : metrics?.revenueByService.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">No revenue data yet.</p>
          ) : (
            <div className="space-y-3 text-sm text-slate-700">
              {metrics?.revenueByService.map((item) => (
                <div key={item.service} className="flex items-center justify-between">
                  <span>{item.service}</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Expenses by category" subtitle="Percentage of spend">
          {isLoading ? (
            <LoadingSpinner />
          ) : metrics?.expensesByCategory.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">No expense data yet.</p>
          ) : (
            <div className="space-y-3 text-sm text-slate-700">
              {metrics?.expensesByCategory.map((item) => (
                <div key={item.category} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{item.category}</div>
                    <div className="text-[11px] text-slate-500">{item.percent}% of spend</div>
                  </div>
                  <span className="font-semibold text-slate-900">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
      <div className="space-y-4">
        <Panel title="Alerts" subtitle="Calm visibility">
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <div className="space-y-3 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-slate-500">Overdue invoices</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {metrics?.alerts.overdueCount ?? 0} · {formatCurrency(metrics?.alerts.overdueAmount ?? 0)}
                  </p>
                </div>
                <StatusChip status="Overdue" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-slate-500">Due this week</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {metrics?.alerts.dueSoonCount ?? 0} · {formatCurrency(metrics?.alerts.dueSoonAmount ?? 0)}
                  </p>
                </div>
                <StatusChip status="Upcoming" />
              </div>
            </div>
          )}
        </Panel>
        <Panel title="Operations snapshot" subtitle="Jobs + labour">
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <div className="space-y-3">
              <StatRow label="Jobs completed (MTD)" value={`${metrics?.operationsSnapshot.jobsCompleted ?? 0}`} />
              <StatRow label="Average job value" value={formatCurrency(metrics?.operationsSnapshot.averageJobValue ?? 0)} />
              <StatRow label="Labour % of revenue" value={`${metrics?.operationsSnapshot.labourPercent ?? 0}%`} />
              {accountantView && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3 text-xs text-slate-600 space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Gross margin</span>
                    <span className="font-semibold text-slate-900">{metrics?.operationsSnapshot.grossMargin ?? 0}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Labour % (detail)</span>
                    <span className="font-semibold text-slate-900">{metrics?.operationsSnapshot.labourPercent ?? 0}%</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );

  const renderReceivablesView = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-[11px] text-slate-500">
          Status
          <select
            value={receivableFilters.status}
            onChange={(event) =>
              setReceivableFilters((prev) => ({ ...prev, status: event.target.value as ReceivableFilters['status'] }))
            }
            className="rounded-lg border border-black/10 bg-white/90 px-3 py-1 text-xs text-slate-700"
          >
            {receivableStatusOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'all' ? 'All statuses' : option}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-slate-500">
          Invoice from
          <input
            type="date"
            value={receivableFilters.startDate}
            onChange={(event) =>
              setReceivableFilters((prev) => ({ ...prev, startDate: event.target.value }))
            }
            className="rounded-lg border border-black/10 bg-white/90 px-3 py-1 text-xs text-slate-700"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-slate-500">
          Invoice to
          <input
            type="date"
            value={receivableFilters.endDate}
            onChange={(event) =>
              setReceivableFilters((prev) => ({ ...prev, endDate: event.target.value }))
            }
            className="rounded-lg border border-black/10 bg-white/90 px-3 py-1 text-xs text-slate-700"
          />
        </label>
        <label className="flex flex-1 min-w-[180px] flex-col gap-1 text-[11px] text-slate-500">
          Customer / job
          <input
            type="text"
            placeholder="Search customer, job, or invoice"
            value={receivableFilters.search}
            onChange={(event) =>
              setReceivableFilters((prev) => ({ ...prev, search: event.target.value }))
            }
            className="rounded-lg border border-black/10 bg-white/90 px-3 py-1 text-xs text-slate-700"
          />
        </label>
        <div className="ml-auto">
          <ExportButton
            label="Export filtered receivables"
            data={filteredReceivables}
            columns={receivableCsvColumns}
            filename="receivables-filtered.csv"
            className="text-xs"
          />
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white/90">
        <div className="overflow-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-white/95 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="border-b border-slate-100 px-3 py-2 text-left">Invoice / Job ID</th>
                <th className="border-b border-slate-100 px-3 py-2">Customer</th>
                <th className="border-b border-slate-100 px-3 py-2">Service</th>
                <th className="border-b border-slate-100 px-3 py-2">Invoice date</th>
                <th className="border-b border-slate-100 px-3 py-2">Due date</th>
                <th className="border-b border-slate-100 px-3 py-2 text-right">Amount</th>
                <th className="border-b border-slate-100 px-3 py-2 text-right">Paid</th>
                <th className="border-b border-slate-100 px-3 py-2 text-right">Balance</th>
                <th className="border-b border-slate-100 px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6">
                    <LoadingSpinner />
                  </td>
                </tr>
              ) : filteredReceivables.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-sm text-slate-500">
                    No receivables match the filters yet.
                  </td>
                </tr>
              ) : (
                filteredReceivables.map((record) => (
                  <tr
                    key={record.id}
                    onClick={() => handleRowClick({ type: 'receivable', record })}
                    className="cursor-pointer border-b border-slate-100 text-sm transition-colors hover:bg-slate-50"
                  >
                    <td className="px-3 py-2 text-slate-900">
                      <div className="text-sm font-semibold">{record.id}</div>
                      <div className="text-[11px] text-slate-500">{record.jobId}</div>
                    </td>
                    <td className="px-3 py-2">{record.customer}</td>
                    <td className="px-3 py-2">{record.service}</td>
                    <td className="px-3 py-2">{formatDate(record.invoiceDate)}</td>
                    <td className="px-3 py-2">{formatDate(record.dueDate)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(record.amount)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(record.paid)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(record.balance)}</td>
                    <td className="px-3 py-2">
                      <StatusChip status={record.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderPayablesView = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-[11px] text-slate-500">
          Status
          <select
            value={payableFilters.status}
            onChange={(event) =>
              setPayableFilters((prev) => ({ ...prev, status: event.target.value as PayableFilters['status'] }))
            }
            className="rounded-lg border border-black/10 bg-white/90 px-3 py-1 text-xs text-slate-700"
          >
            {payableStatusOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'all' ? 'All statuses' : option}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-slate-500">
          Bill from
          <input
            type="date"
            value={payableFilters.startDate}
            onChange={(event) =>
              setPayableFilters((prev) => ({ ...prev, startDate: event.target.value }))
            }
            className="rounded-lg border border-black/10 bg-white/90 px-3 py-1 text-xs text-slate-700"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-slate-500">
          Bill to
          <input
            type="date"
            value={payableFilters.endDate}
            onChange={(event) =>
              setPayableFilters((prev) => ({ ...prev, endDate: event.target.value }))
            }
            className="rounded-lg border border-black/10 bg-white/90 px-3 py-1 text-xs text-slate-700"
          />
        </label>
        <label className="flex flex-1 min-w-[180px] flex-col gap-1 text-[11px] text-slate-500">
          Supplier / category
          <input
            type="text"
            placeholder="Search supplier or category"
            value={payableFilters.search}
            onChange={(event) =>
              setPayableFilters((prev) => ({ ...prev, search: event.target.value }))
            }
            className="rounded-lg border border-black/10 bg-white/90 px-3 py-1 text-xs text-slate-700"
          />
        </label>
        <div className="ml-auto">
          <ExportButton
            label="Export filtered payables"
            data={filteredPayables}
            columns={payableCsvColumns}
            filename="payables-filtered.csv"
            className="text-xs"
          />
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white/90">
        <div className="overflow-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-white/95 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="border-b border-slate-100 px-3 py-2 text-left">Bill ID</th>
                <th className="border-b border-slate-100 px-3 py-2">Supplier</th>
                <th className="border-b border-slate-100 px-3 py-2">Category</th>
                <th className="border-b border-slate-100 px-3 py-2">Bill date</th>
                <th className="border-b border-slate-100 px-3 py-2">Due date</th>
                <th className="border-b border-slate-100 px-3 py-2 text-right">Amount</th>
                <th className="border-b border-slate-100 px-3 py-2">Paid status</th>
                <th className="border-b border-slate-100 px-3 py-2 text-right">Payment method</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6">
                    <LoadingSpinner />
                  </td>
                </tr>
              ) : filteredPayables.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-500">
                    No payables match the filters yet.
                  </td>
                </tr>
              ) : (
                filteredPayables.map((record) => (
                  <tr
                    key={record.id}
                    onClick={() => handleRowClick({ type: 'payable', record })}
                    className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50"
                  >
                    <td className="px-3 py-2 text-slate-900">
                      <div className="text-sm font-semibold">{record.id}</div>
                    </td>
                    <td className="px-3 py-2">{record.supplier}</td>
                    <td className="px-3 py-2">{record.category}</td>
                    <td className="px-3 py-2">{formatDate(record.billDate)}</td>
                    <td className="px-3 py-2">{formatDate(record.dueDate)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(record.amount)}</td>
                    <td className="px-3 py-2">
                      <StatusChip status={record.status} />
                    </td>
                    <td className="px-3 py-2 text-right">{record.paymentMethod}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderReportsView = () => (
    <div className="space-y-4">
      <Panel
        title="Accountant Pack"
        subtitle="CSV exports generated in the browser"
        right={<span>Blob download · no extra tools</span>}
      >
        <div className="space-y-4">
          {reportExports.map((report) => (
            <div key={report.key} className="rounded-2xl border border-black/5 bg-white/80 px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{report.label}</div>
                  <p className="text-[11px] text-slate-500">{report.description}</p>
                </div>
                <button
                  type="button"
                  onClick={report.exportFn}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 underline decoration-slate-200"
                >
                  Download
                </button>
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                Includes: {report.columnLabels.join(', ')}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'receivables':
        return renderReceivablesView();
      case 'payables':
        return renderPayablesView();
      case 'reports':
        return renderReportsView();
      default:
        return null;
    }
  };

  return (
    <div className="grid gap-6 sm:gap-10 w-full px-3 sm:px-4 md:px-10 lg:px-12 pb-14 overflow-x-hidden">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold" style={{ color: brand.primary }}>
            Dashboard
          </h1>
          <p className="text-sm text-slate-500">
            Financial command centre for Buds at Work. Track cash, receivables, payables, and accountant-ready
            exports in one calm view.
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-emerald-700 font-medium">
            <a href="/dashboard/quotes" className="underline">
              Quotes
            </a>
            <span>•</span>
            <a href="/dashboard/pipelines" className="underline">
              Workflows
            </a>
            <span>•</span>
            <a href="/dashboard/alerts" className="underline">
              Alerts
            </a>
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 text-xs text-slate-500 md:items-end">
          <span>Accountant view</span>
          <button
            type="button"
            aria-pressed={accountantView}
            onClick={() => setAccountantView((prev) => !prev)}
            className="relative flex h-6 w-12 items-center rounded-full border border-black/10 bg-white/90 p-0.5"
          >
            <span
              className={`h-5 w-5 rounded-full bg-slate-900 transition-transform ${
                accountantView ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-4 gap-3">
        {summaryCards.map((card) => (
          <SummaryCard key={card.label} {...card} isLoading={isLoading} />
        ))}
      </div>

      <div className="rounded-2xl border border-black/5 bg-white/90 p-1 text-xs text-slate-600 shadow-sm overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-xl px-2 sm:px-4 py-2 text-center font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 truncate ${
                activeTab === tab.key
                  ? 'text-white'
                  : 'bg-transparent text-slate-600 hover:text-slate-900'
              }`}
              style={activeTab === tab.key ? { background: brand.primary } : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {accountantView && (
        <div className="flex flex-wrap gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-2 text-xs text-amber-700">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Review data in Supabase for complete accuracy
          </span>
        </div>
      )}

      {renderTabContent()}

      <DetailDrawer
        detail={selectedDetail}
        onClose={() => setSelectedDetail(null)}
        accountantView={accountantView}
        operationsSnapshot={metrics?.operationsSnapshot ?? { jobsCompleted: 0, averageJobValue: 0, labourPercent: 0, grossMargin: 0 }}
      />
    </div>
  );
}
