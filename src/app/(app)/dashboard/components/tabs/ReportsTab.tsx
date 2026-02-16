'use client';

import { brand } from '@/app/ui/theme';
import { Panel } from '../shared';
import {
  formatCurrency,
  exportCsv,
  receivableCsvColumns,
  payableCsvColumns,
  type CsvColumn,
} from '@/lib/dashboard/utils';
import type { DashboardMetrics, ReceivableRecord, PayableRecord } from '@/types/dashboard';

type ReportsTabProps = {
  metrics: DashboardMetrics | null;
  receivables: ReceivableRecord[];
  payables: PayableRecord[];
};

export default function ReportsTab({ metrics, receivables, payables }: ReportsTabProps) {
  const monthlySummaryRecords = [
    { label: 'Revenue (MTD)', value: metrics?.revenueByService.reduce((sum, s) => sum + s.amount, 0) ?? 0 },
    { label: 'Expenses (MTD)', value: metrics?.expensesByCategory.reduce((sum, e) => sum + e.amount, 0) ?? 0 },
    { label: 'Net Profit (MTD)', value: metrics?.netProfit.amount ?? 0 },
  ];

  const monthlySummaryColumns: CsvColumn<(typeof monthlySummaryRecords)[number]>[] = [
    { label: 'Line item', getValue: (row) => row.label },
    { label: 'Amount', getValue: (row) => formatCurrency(row.value) },
  ];

  const reportExports = [
    {
      key: 'receivables',
      label: 'Export Receivables (CSV)',
      description: 'Invoice-level detail including status and balances.',
      filename: 'receivables.csv',
      exportFn: () => exportCsv({ data: receivables, columns: receivableCsvColumns, filename: 'receivables.csv' }),
    },
    {
      key: 'payables',
      label: 'Export Payables (CSV)',
      description: 'Bill log with supplier, category, and payment method.',
      filename: 'payables.csv',
      exportFn: () => exportCsv({ data: payables, columns: payableCsvColumns, filename: 'payables.csv' }),
    },
    {
      key: 'summary',
      label: 'Export Monthly Summary (CSV)',
      description: 'Totals for revenue, expenses, and net profit.',
      filename: 'monthly-summary.csv',
      exportFn: () =>
        exportCsv({ data: monthlySummaryRecords, columns: monthlySummaryColumns, filename: 'monthly-summary.csv' }),
    },
  ];

  return (
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
                  className="text-xs font-semibold text-white px-4 py-2 rounded-lg transition-all hover:shadow-lg"
                  style={{ background: brand.primary }}
                >
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Monthly Summary */}
      <Panel title="Monthly Summary" subtitle="Revenue, expenses, and profit">
        <div className="space-y-3">
          {monthlySummaryRecords.map((record) => (
            <div
              key={record.label}
              className="flex items-center justify-between rounded-xl border border-black/5 bg-white/80 px-4 py-3"
            >
              <span className="text-sm text-slate-600">{record.label}</span>
              <span
                className={`text-lg font-semibold ${
                  record.label.includes('Expenses')
                    ? 'text-red-600'
                    : record.label.includes('Profit')
                    ? 'text-emerald-600'
                    : 'text-slate-900'
                }`}
              >
                {formatCurrency(record.value)}
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
