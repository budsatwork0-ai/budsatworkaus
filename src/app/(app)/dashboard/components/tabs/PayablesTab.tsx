'use client';

import { useMemo, useState } from 'react';
import { StatusChip, ExportButton, Pagination } from '../shared';
import { TableSkeleton } from '../Skeletons';
import { formatCurrency, formatDate, payableCsvColumns } from '@/lib/dashboard/utils';
import {
  type PayableRecord,
  type PayableFilters,
  type RecordDetail,
  payableStatusOptions,
  ITEMS_PER_PAGE,
} from '@/types/dashboard';

type PayablesTabProps = {
  payables: PayableRecord[];
  isLoading: boolean;
  onRowClick: (detail: RecordDetail) => void;
};

export default function PayablesTab({ payables, isLoading, onRowClick }: PayablesTabProps) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<PayableFilters>({
    status: 'all',
    startDate: '',
    endDate: '',
    search: '',
  });

  const filteredPayables = useMemo(() => {
    const searchTerm = filters.search.trim().toLowerCase();
    return payables.filter((record) => {
      if (filters.status !== 'all' && record.status !== filters.status) return false;
      if (filters.startDate && record.billDate < filters.startDate) return false;
      if (filters.endDate && record.billDate > filters.endDate) return false;
      if (searchTerm) {
        const haystack = `${record.supplier} ${record.category} ${record.id}`.toLowerCase();
        if (!haystack.includes(searchTerm)) return false;
      }
      return true;
    });
  }, [filters, payables]);

  const paginatedPayables = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredPayables.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPayables, page]);

  const totalPages = Math.ceil(filteredPayables.length / ITEMS_PER_PAGE);

  const handleFilterChange = (key: keyof PayableFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-[11px] text-slate-500">
          Status
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
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
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            className="rounded-lg border border-black/10 bg-white/90 px-3 py-1.5 text-xs text-slate-700"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-slate-500">
          To
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
            className="rounded-lg border border-black/10 bg-white/90 px-3 py-1.5 text-xs text-slate-700"
          />
        </label>
        <label className="flex flex-1 min-w-[180px] flex-col gap-1 text-[11px] text-slate-500">
          Search
          <input
            type="text"
            placeholder="Supplier or category"
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="rounded-lg border border-black/10 bg-white/90 px-3 py-1.5 text-xs text-slate-700"
          />
        </label>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500">{filteredPayables.length} results</span>
          <ExportButton
            label="Export CSV"
            data={filteredPayables}
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
                  {paginatedPayables.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500">
                        No payables match the filters
                      </td>
                    </tr>
                  ) : (
                    paginatedPayables.map((record) => (
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
