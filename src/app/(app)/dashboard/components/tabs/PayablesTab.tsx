'use client';

import { StatusChip, ExportButton, Pagination } from '../shared';
import { TableSkeleton } from '../Skeletons';
import { formatCurrency, formatDate, payableCsvColumns } from '@/lib/dashboard/utils';
import { useTableFilters } from '../../hooks/useTableFilters';
import {
  type PayableRecord,
  type PayableFilters,
  type RecordDetail,
  payableStatusOptions,
} from '@/types/dashboard';

type PayablesTabProps = {
  payables: PayableRecord[];
  isLoading: boolean;
  onRowClick: (detail: RecordDetail) => void;
  initialFilters?: Partial<PayableFilters>;
};

function buildInitialFilters(partial?: Partial<PayableFilters>): PayableFilters {
  const status = partial?.status && payableStatusOptions.includes(partial.status) ? partial.status : 'all';
  return {
    status,
    startDate: partial?.startDate || '',
    endDate: partial?.endDate || '',
    search: partial?.search || '',
  };
}

export default function PayablesTab({ payables, isLoading, onRowClick, initialFilters }: PayablesTabProps) {
  const { filters, setFilter, filtered, paginated, page, setPage, totalPages } = useTableFilters(
    payables,
    {
      initialFilters: buildInitialFilters(initialFilters),
      filterFn: (record, f) => {
        if (f.status !== 'all' && record.status !== f.status) return false;
        if (f.startDate && record.billDate < f.startDate) return false;
        if (f.endDate && record.billDate > f.endDate) return false;
        if (f.search) {
          const term = f.search.trim().toLowerCase();
          const haystack = `${record.supplier} ${record.category} ${record.id}`.toLowerCase();
          if (!haystack.includes(term)) return false;
        }
        return true;
      },
    }
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-[11px] text-slate-500">
          Status
          <select
            value={filters.status}
            onChange={(e) => setFilter('status', e.target.value)}
            className="rounded-lg border border-black/10 bg-white/90 px-3 py-1.5 text-xs text-slate-700"
          >
            {payableStatusOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'all' ? 'All statuses' : option}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-slate-500">
          From
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilter('startDate', e.target.value)}
            className="rounded-lg border border-black/10 bg-white/90 px-3 py-1.5 text-xs text-slate-700"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-slate-500">
          To
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilter('endDate', e.target.value)}
            className="rounded-lg border border-black/10 bg-white/90 px-3 py-1.5 text-xs text-slate-700"
          />
        </label>
        <label className="flex flex-1 min-w-[180px] flex-col gap-1 text-[11px] text-slate-500">
          Search
          <input
            type="text"
            placeholder="Supplier or category"
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            className="rounded-lg border border-black/10 bg-white/90 px-3 py-1.5 text-xs text-slate-700"
          />
        </label>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500">{filtered.length} results</span>
          <ExportButton
            label="Export CSV"
            data={filtered}
            columns={payableCsvColumns}
            filename="payables.csv"
          />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-black/5 bg-white/90">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-white/95 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="border-b border-slate-100 px-3 py-2">Bill ID</th>
                    <th className="border-b border-slate-100 px-3 py-2">Supplier</th>
                    <th className="border-b border-slate-100 px-3 py-2">Category</th>
                    <th className="border-b border-slate-100 px-3 py-2">Due</th>
                    <th className="border-b border-slate-100 px-3 py-2 text-right">Amount</th>
                    <th className="border-b border-slate-100 px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500">
                        No payables match the filters
                      </td>
                    </tr>
                  ) : (
                    paginated.map((record) => (
                      <tr
                        key={record.id}
                        onClick={() => onRowClick({ type: 'payable', record })}
                        className="cursor-pointer border-b border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-3 py-2 font-semibold text-slate-900">{record.id}</td>
                        <td className="px-3 py-2">{record.supplier}</td>
                        <td className="px-3 py-2">{record.category}</td>
                        <td className="px-3 py-2">{formatDate(record.dueDate)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatCurrency(record.amount)}</td>
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
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
