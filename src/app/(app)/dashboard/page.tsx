'use client';

import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { brand } from '@/app/ui/theme';

type ReceivableStatus = 'Draft' | 'Sent' | 'Part-paid' | 'Paid' | 'Overdue';
type PayableStatus = 'Upcoming' | 'Paid' | 'Overdue';

type ReceivableRecord = {
  id: string;
  jobId: string;
  customer: string;
  service: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  paid: number;
  balance: number;
  status: ReceivableStatus;
  notes: string;
};

type PayableRecord = {
  id: string;
  supplier: string;
  category: string;
  billDate: string;
  dueDate: string;
  amount: number;
  status: PayableStatus;
  paymentMethod: string;
  notes: string;
};

type RecordDetail =
  | { type: 'receivable'; record: ReceivableRecord }
  | { type: 'payable'; record: PayableRecord };

type TabKey = 'overview' | 'receivables' | 'payables' | 'reports';

type CsvColumn<T> = {
  label: string;
  getValue: (row: T) => string | number | boolean | null | undefined;
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
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const summaryCards = [
  {
    label: 'Cash / bank balance',
    value: '$92,400',
    hint: 'As of today',
    viewLabel: 'account',
  },
  {
    label: 'Outstanding receivables',
    value: '$48,600',
    hint: '31 invoices due',
    viewLabel: 'receivables',
  },
  {
    label: 'Upcoming payables (next 30 days)',
    value: '$12,400',
    hint: '9 bills scheduled',
    viewLabel: 'payables',
  },
  {
    label: 'Net profit (month-to-date)',
    value: '$27,100',
    hint: '16.2% margin',
    viewLabel: 'P&L',
  },
];

const revenueByService = [
  { service: 'Commercial cleaning', amount: 14800 },
  { service: 'Facilities maintenance', amount: 8600 },
  { service: 'Landscape + grounds', amount: 5400 },
  { service: 'Sanitation & safety', amount: 3200 },
];

const expensesByCategory = [
  { category: 'Labour', amount: 5800, percent: 38 },
  { category: 'Materials', amount: 2400, percent: 16 },
  { category: 'Subcontractors', amount: 1900, percent: 12 },
  { category: 'Travel', amount: 1600, percent: 10 },
  { category: 'Overheads', amount: 2100, percent: 14 },
];

const alertsData = {
  overdueCount: 3,
  overdueAmount: 17400,
  dueCount: 4,
  dueAmount: 5200,
};

const operationsSnapshot = {
  jobsCompleted: 42,
  averageJobValue: 3210,
  labourPercent: 38,
  grossMargin: 32,
  fixedVsVariable: '60 / 40',
};

const warningMessages = [
  'Missing categories on 2 expenses',
  '3 uncategorised expenses awaiting review',
];

const receivablesData: ReceivableRecord[] = [
  {
    id: 'INV-2071',
    jobId: 'Job 291',
    customer: 'Harbor Collective',
    service: 'Facility maintenance',
    invoiceDate: '2024-10-02',
    dueDate: '2024-10-16',
    amount: 4200,
    paid: 0,
    balance: 4200,
    status: 'Sent',
    notes: 'Scheduled monthly roof inspection with team Bravo.',
  },
  {
    id: 'INV-2064',
    jobId: 'Job 282',
    customer: 'Northbank Events',
    service: 'Event setup',
    invoiceDate: '2024-09-18',
    dueDate: '2024-10-02',
    amount: 8700,
    paid: 4400,
    balance: 4300,
    status: 'Part-paid',
    notes: 'Second instalment on corporate gardens.',
  },
  {
    id: 'INV-2052',
    jobId: 'Job 269',
    customer: 'Central Library',
    service: 'Grounds + facilities',
    invoiceDate: '2024-08-30',
    dueDate: '2024-09-13',
    amount: 6100,
    paid: 6100,
    balance: 0,
    status: 'Paid',
    notes: 'Cleared via EFT on 12 Sep.',
  },
  {
    id: 'INV-2080',
    jobId: 'Job 305',
    customer: 'Watt Medical Suites',
    service: 'Sanitation',
    invoiceDate: '2024-10-05',
    dueDate: '2024-10-19',
    amount: 5400,
    paid: 0,
    balance: 5400,
    status: 'Draft',
    notes: 'Awaiting final approval from the facilities manager.',
  },
  {
    id: 'INV-2047',
    jobId: 'Job 256',
    customer: 'Riverstone Towers',
    service: 'High-rise maintenance',
    invoiceDate: '2024-08-12',
    dueDate: '2024-08-26',
    amount: 6800,
    paid: 0,
    balance: 6800,
    status: 'Overdue',
    notes: 'Follow-up on overdue notice #2.',
  },
];

const payablesData: PayableRecord[] = [
  {
    id: 'BILL-459',
    supplier: 'Greenline Supplies',
    category: 'Materials',
    billDate: '2024-10-18',
    dueDate: '2024-11-01',
    amount: 1800,
    status: 'Upcoming',
    paymentMethod: 'EFT',
    notes: 'Staging supplies for November rollouts.',
  },
  {
    id: 'BILL-448',
    supplier: 'Metro Labour',
    category: 'Subcontractor',
    billDate: '2024-09-28',
    dueDate: '2024-10-05',
    amount: 5200,
    status: 'Paid',
    paymentMethod: 'Direct deposit',
    notes: 'October patch team payment.',
  },
  {
    id: 'BILL-441',
    supplier: 'Atlas Logistics',
    category: 'Transport',
    billDate: '2024-09-12',
    dueDate: '2024-09-26',
    amount: 3100,
    status: 'Overdue',
    paymentMethod: 'Pending EFT',
    notes: 'Overdue fuel reimbursement.',
  },
  {
    id: 'BILL-465',
    supplier: 'Apex Plumbing',
    category: 'Contractor',
    billDate: '2024-10-03',
    dueDate: '2024-10-17',
    amount: 2100,
    status: 'Upcoming',
    paymentMethod: 'Credit card',
    notes: 'Drainage work on Riverstone site.',
  },
  {
    id: 'BILL-472',
    supplier: 'District Electric',
    category: 'Contractor',
    billDate: '2024-09-24',
    dueDate: '2024-10-08',
    amount: 2550,
    status: 'Paid',
    paymentMethod: 'EFT',
    notes: 'Emergency repair on lighting.',
  },
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

const monthlySummaryRecords = [
  { label: 'Revenue (MTD)', value: 128400 },
  { label: 'Expenses (MTD)', value: 101300 },
  { label: 'Net profit (MTD)', value: 27100 },
];

const monthlySummaryColumns: CsvColumn<typeof monthlySummaryRecords[number]>[] = [
  { label: 'Line item', getValue: (row) => row.label },
  { label: 'Amount', getValue: (row) => formatCurrency(row.value) },
];

const reportExports = [
  {
    key: 'receivables',
    label: 'Export Receivables (CSV)',
    description: 'Invoice-level detail including status and balances.',
    columns: receivableCsvColumns,
    data: receivablesData,
    filename: 'receivables.csv',
  },
  {
    key: 'payables',
    label: 'Export Payables (CSV)',
    description: 'Bill log with supplier, category, and payment method.',
    columns: payableCsvColumns,
    data: payablesData,
    filename: 'payables.csv',
  },
  {
    key: 'summary',
    label: 'Export Monthly Summary (CSV)',
    description: 'Totals for revenue, expenses, and net profit.',
    columns: monthlySummaryColumns,
    data: monthlySummaryRecords,
    filename: 'monthly-summary.csv',
  },
];

const tabs: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'receivables', label: 'Receivables' },
  { key: 'payables', label: 'Payables' },
  { key: 'reports', label: 'Reports & Exports' },
];

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

const SummaryCard = ({
  label,
  value,
  hint,
  viewLabel,
}: {
  label: string;
  value: string;
  hint?: string;
  viewLabel: string;
}) => (
  <div className="rounded-2xl border border-black/5 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
    <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
    <div className="text-2xl font-semibold text-slate-900 mt-1">{value}</div>
    {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    <button
      type="button"
      className="mt-3 text-xs font-semibold text-slate-500 hover:text-slate-700 underline decoration-slate-200"
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

const DetailDrawer = ({
  detail,
  onClose,
  accountantView,
}: {
  detail: RecordDetail | null;
  onClose: () => void;
  accountantView: boolean;
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
              <div className="flex items-center justify-between">
                <span>Fixed vs variable costs</span>
                <span className="font-semibold text-slate-900">{operationsSnapshot.fixedVsVariable}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function DashboardHome() {
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
    return receivablesData.filter((record) => {
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
  }, [receivableFilters]);

  const filteredPayables = useMemo(() => {
    const searchTerm = payableFilters.search.trim().toLowerCase();
    return payablesData.filter((record) => {
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
  }, [payableFilters]);

  const handleRowClick = (detail: RecordDetail) => {
    setSelectedDetail(detail);
  };

  const renderOverview = () => (
    <div className="grid gap-4 lg:grid-cols-[1fr_0.92fr]">
      <div className="space-y-4">
        <Panel title="Revenue by service" subtitle="Month-to-date">
          <div className="space-y-3 text-sm text-slate-700">
            {revenueByService.map((item) => (
              <div key={item.service} className="flex items-center justify-between">
                <span>{item.service}</span>
                <span className="font-semibold text-slate-900">{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Expenses by category" subtitle="Percentage of spend">
          <div className="space-y-3 text-sm text-slate-700">
            {expensesByCategory.map((item) => (
              <div key={item.category} className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-800">{item.category}</div>
                  <div className="text-[11px] text-slate-500">{item.percent}% of spend</div>
                </div>
                <span className="font-semibold text-slate-900">{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div className="space-y-4">
        <Panel title="Alerts" subtitle="Calm visibility">
          <div className="space-y-3 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-slate-500">Overdue invoices</p>
                <p className="text-sm font-semibold text-slate-900">
                  {alertsData.overdueCount} · {formatCurrency(alertsData.overdueAmount)}
                </p>
              </div>
              <StatusChip status="Overdue" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-slate-500">Bills due this week</p>
                <p className="text-sm font-semibold text-slate-900">
                  {alertsData.dueCount} · {formatCurrency(alertsData.dueAmount)}
                </p>
              </div>
              <StatusChip status="Upcoming" />
            </div>
          </div>
        </Panel>
        <Panel title="Operations snapshot" subtitle="Jobs + labour">
          <div className="space-y-3">
            <StatRow label="Jobs completed (MTD)" value={`${operationsSnapshot.jobsCompleted}`} />
            <StatRow label="Average job value" value={formatCurrency(operationsSnapshot.averageJobValue)} />
            <StatRow label="Labour % of revenue" value={`${operationsSnapshot.labourPercent}%`} />
            {accountantView && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3 text-xs text-slate-600 space-y-2">
                <div className="flex items-center justify-between">
                  <span>Gross margin</span>
                  <span className="font-semibold text-slate-900">{operationsSnapshot.grossMargin}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Labour % (detail)</span>
                  <span className="font-semibold text-slate-900">{operationsSnapshot.labourPercent}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Fixed vs variable costs</span>
                  <span className="font-semibold text-slate-900">{operationsSnapshot.fixedVsVariable}</span>
                </div>
              </div>
            )}
          </div>
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
              {filteredReceivables.map((record) => (
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
              ))}
              {filteredReceivables.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-sm text-slate-500">
                    No receivables match the filters yet.
                  </td>
                </tr>
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
              {filteredPayables.map((record) => (
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
              ))}
              {filteredPayables.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-500">
                    No payables match the filters yet.
                  </td>
                </tr>
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
                <ExportButton
                  label="Download"
                  data={report.data}
                  columns={report.columns}
                  filename={report.filename}
                  className="text-xs"
                />
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                Includes: {report.columns.map((column) => column.label).join(', ')}
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
    <div className="grid gap-10 w-full px-4 md:px-10 lg:px-12 pb-14">
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summaryCards.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </div>

      <div className="rounded-2xl border border-black/5 bg-white/90 p-1 text-xs text-slate-600 shadow-sm">
        <div className="flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 rounded-xl px-4 py-2 text-center font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
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
          {warningMessages.map((warning) => (
            <span key={warning} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {warning}
            </span>
          ))}
        </div>
      )}

      {renderTabContent()}

      <DetailDrawer detail={selectedDetail} onClose={() => setSelectedDetail(null)} accountantView={accountantView} />
    </div>
  );
}
