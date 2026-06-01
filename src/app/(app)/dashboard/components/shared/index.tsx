'use client';

import { ReactNode, useCallback } from 'react';
import { brand } from '@/app/ui/theme';
import {
  statusStyles,
  jobStatusLabels,
  type ReceivableStatus,
  type PayableStatus,
  type JobStatus,
} from '@/types/dashboard';
import { formatCurrency, formatDate, exportCsv, type CsvColumn } from '@/lib/dashboard/utils';

// Icons
export function RefreshIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

export function ArrowUpIcon({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className={className}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

export function ArrowDownIcon({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className={className}>
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  );
}

// Summary Card
export const SummaryCard = ({
  label,
  value,
  hint,
  change,
  viewLabel,
  isLoading,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  change?: string | null;
  viewLabel?: string;
  isLoading?: boolean;
  onClick?: () => void;
}) => (
  <div
    className="rounded-[22px] border border-black/5 bg-white px-4 sm:px-5 py-4 text-sm text-slate-700 shadow-[0_8px_26px_rgba(2,6,23,0.05)] overflow-hidden cursor-pointer hover:shadow-[0_12px_32px_rgba(2,6,23,0.08)] hover:border-black/10 transition-all"
    onClick={onClick}
  >
    <div className="text-[10px] sm:text-[11px] uppercase tracking-wide text-slate-500 truncate">{label}</div>
    {isLoading ? (
      <div className="h-9 w-28 mt-1.5 bg-slate-100 rounded animate-pulse" />
    ) : (
      <div className="flex items-baseline gap-2 mt-1.5">
        <div className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: brand.primary }}>{value}</div>
        {change && (
          <div
            className={`flex items-center gap-0.5 text-xs font-medium ${
              change.startsWith('+') ? 'text-emerald-600' : change.startsWith('-') ? 'text-red-600' : 'text-slate-500'
            }`}
          >
            {change.startsWith('+') ? <ArrowUpIcon /> : change.startsWith('-') ? <ArrowDownIcon /> : null}
            {change}
          </div>
        )}
      </div>
    )}
    {hint && <div className="text-[11px] sm:text-xs text-slate-500 mt-1 truncate">{hint}</div>}
    {viewLabel && (
      <button
        type="button"
        className="mt-2 sm:mt-3 text-[11px] sm:text-xs font-semibold hover:text-slate-900 underline decoration-slate-200"
        style={{ color: brand.primary }}
      >
        View {viewLabel} →
      </button>
    )}
  </div>
);

// Panel
export const Panel = ({
  title,
  subtitle,
  right,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <section className={`rounded-[22px] border border-black/5 bg-white px-5 py-5 shadow-[0_8px_26px_rgba(2,6,23,0.05)] ${className}`}>
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

// Stat Row
export const StatRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between rounded-xl border border-black/5 bg-white px-3.5 py-2.5 text-sm">
    <span className="text-xs text-slate-500">{label}</span>
    <span className="font-semibold" style={{ color: brand.primary }}>{value}</span>
  </div>
);

// Status Chip
export const StatusChip = ({ status }: { status: ReceivableStatus | PayableStatus | JobStatus }) => {
  const style = statusStyles[status] ?? { bg: 'bg-slate-100', text: 'text-slate-700' };
  const label = jobStatusLabels[status as JobStatus] ?? status;
  return (
    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${style.bg} ${style.text}`}>
      {label}
    </span>
  );
};

// Export Button
export const ExportButton = <T,>({
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
      className={`text-xs font-semibold text-slate-500 hover:text-slate-700 underline decoration-slate-200 ${className ?? ''}`}
    >
      {label}
    </button>
  );
};

// Pagination — renders at most 7 page buttons with ellipsis for large page counts
export const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) => {
  if (totalPages <= 1) return null;

  // Build a list of page numbers + "..." sentinels to render
  const buildPages = (): (number | '...')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | '...')[] = [1];
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    if (start > 2) pages.push('...');
    for (let p = start; p <= end; p++) pages.push(p);
    if (end < totalPages - 1) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  const pages = buildPages();

  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Previous
      </button>
      <div className="flex items-center gap-1">
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-slate-400">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`w-8 h-8 text-xs font-medium rounded-lg ${
                p === currentPage
                  ? 'text-white'
                  : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50'
              }`}
              style={p === currentPage ? { background: brand.primary } : undefined}
            >
              {p}
            </button>
          )
        )}
      </div>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Next
      </button>
    </div>
  );
};

// Error Message
export const ErrorMessage = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
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

// Detail Drawer
export const DetailDrawer = ({
  detail,
  onClose,
  operationsSnapshot,
}: {
  detail: {
    type: 'receivable' | 'payable' | 'job';
    record: {
      id: string;
      status: string;
      notes?: string;
      customer?: string;
      service?: string;
      invoiceDate?: string;
      dueDate?: string;
      amount?: number;
      paid?: number;
      balance?: number;
      supplier?: string;
      category?: string;
      billDate?: string;
      paymentMethod?: string;
      scheduledDate?: string;
      scheduledTime?: string;
      address?: string;
    };
  } | null;
  onClose: () => void;
  operationsSnapshot: {
    jobsCompleted: number;
    averageJobValue: number;
    labourPercent: number;
    grossMargin: number;
  };
}) => {
  if (!detail) return null;

  const getDetailRows = () => {
    if (detail.type === 'receivable') {
      return [
        { label: 'Customer', value: detail.record.customer || '-' },
        { label: 'Service', value: detail.record.service || '-' },
        { label: 'Invoice date', value: formatDate(detail.record.invoiceDate) },
        { label: 'Due date', value: formatDate(detail.record.dueDate) },
        { label: 'Amount', value: formatCurrency(detail.record.amount || 0) },
        { label: 'Paid', value: formatCurrency(detail.record.paid || 0) },
        { label: 'Balance', value: formatCurrency(detail.record.balance || 0) },
      ];
    } else if (detail.type === 'payable') {
      return [
        { label: 'Supplier / Contractor', value: detail.record.supplier || '-' },
        { label: 'Category', value: detail.record.category || '-' },
        { label: 'Bill date', value: formatDate(detail.record.billDate) },
        { label: 'Due date', value: formatDate(detail.record.dueDate) },
        { label: 'Amount', value: formatCurrency(detail.record.amount || 0) },
        { label: 'Payment method', value: detail.record.paymentMethod || '-' },
      ];
    } else {
      return [
        { label: 'Customer', value: detail.record.customer || '-' },
        { label: 'Service', value: detail.record.service || '-' },
        { label: 'Scheduled date', value: formatDate(detail.record.scheduledDate) },
        { label: 'Time', value: detail.record.scheduledTime || '-' },
        { label: 'Address', value: detail.record.address || '-' },
        { label: 'Amount', value: formatCurrency(detail.record.amount || 0) },
      ];
    }
  };

  const detailRows = getDetailRows();
  const title = detail.type === 'receivable' ? 'Invoice detail' : detail.type === 'payable' ? 'Bill detail' : 'Job detail';

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
      <div className="relative ml-auto flex h-full w-full max-w-md flex-col border-l border-black/5 bg-white/95 shadow-2xl">
        <div className="flex items-start justify-between px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Detail</p>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
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
          <div className="space-y-1 text-xs text-slate-500">ID</div>
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-slate-900">{detail.record.id}</span>
            <StatusChip status={detail.record.status as ReceivableStatus | PayableStatus | JobStatus} />
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
              {detail.record.notes || 'No notes provided.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
