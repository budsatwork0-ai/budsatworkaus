import type { ReceivableRecord, PayableRecord } from '@/types/dashboard';

// Currency formatting (AUD)
export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value);

// Date formatting
export const formatDate = (value?: string | null): string => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-AU', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Relative time formatting
export const formatRelativeTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
};

// Format percentage change for display
export const formatChange = (change: number): string | null => {
  if (change === 0) return null;
  const sign = change > 0 ? '+' : '';
  return `${sign}${change}%`;
};

// CSV Export types
export type CsvColumn<T> = {
  label: string;
  getValue: (row: T) => string | number | boolean | null | undefined;
};

// Generic CSV export function
export const exportCsv = <T>({
  data,
  columns,
  filename,
}: {
  data: T[];
  columns: CsvColumn<T>[];
  filename: string;
}): void => {
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

// Pre-configured CSV columns for receivables
export const receivableCsvColumns: CsvColumn<ReceivableRecord>[] = [
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

// Pre-configured CSV columns for payables
export const payableCsvColumns: CsvColumn<PayableRecord>[] = [
  { label: 'Bill ID', getValue: (row) => row.id },
  { label: 'Supplier / Contractor', getValue: (row) => row.supplier },
  { label: 'Category', getValue: (row) => row.category },
  { label: 'Bill date', getValue: (row) => row.billDate },
  { label: 'Due date', getValue: (row) => row.dueDate },
  { label: 'Amount', getValue: (row) => formatCurrency(row.amount) },
  { label: 'Paid status', getValue: (row) => row.status },
  { label: 'Payment method', getValue: (row) => row.paymentMethod },
];

// Debounce utility
export function debounce<T extends (...args: Parameters<T>) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
