'use client';

import { useMemo, useState } from 'react';
import { StatusChip, Pagination } from '../shared';
import { TableSkeleton } from '../Skeletons';
import { formatCurrency, formatDate } from '@/lib/dashboard/utils';
import {
  type JobRecord,
  type JobFilters,
  type RecordDetail,
  jobStatusOptions,
  jobStatusLabels,
  ITEMS_PER_PAGE,
} from '@/types/dashboard';

type JobsTabProps = {
  jobs: JobRecord[];
  isLoading: boolean;
  onRowClick: (detail: RecordDetail) => void;
};

export default function JobsTab({ jobs, isLoading, onRowClick }: JobsTabProps) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<JobFilters>({
    status: 'all',
    startDate: '',
    endDate: '',
    search: '',
  });

  const filteredJobs = useMemo(() => {
    const searchTerm = filters.search.trim().toLowerCase();
    return jobs.filter((record) => {
      if (filters.status !== 'all' && record.status !== filters.status) return false;
      if (filters.startDate && record.scheduledDate < filters.startDate) return false;
      if (filters.endDate && record.scheduledDate > filters.endDate) return false;
      if (searchTerm) {
        const haystack = `${record.customer} ${record.service} ${record.id} ${record.address}`.toLowerCase();
        if (!haystack.includes(searchTerm)) return false;
      }
      return true;
    });
  }, [filters, jobs]);

  const paginatedJobs = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredJobs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredJobs, page]);

  const totalPages = Math.ceil(filteredJobs.length / ITEMS_PER_PAGE);

  const handleFilterChange = (key: keyof JobFilters, value: string) => {
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
            {jobStatusOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'all' ? 'All statuses' : jobStatusLabels[option]}
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
            placeholder="Customer, service, or address"
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="rounded-lg border border-black/10 bg-white/90 px-3 py-1.5 text-xs text-slate-700"
          />
        </label>
        <div className="ml-auto">
          <span className="text-xs text-slate-500">{filteredJobs.length} jobs</span>
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
                    <th className="border-b border-slate-100 px-3 py-2">Customer</th>
                    <th className="border-b border-slate-100 px-3 py-2">Service</th>
                    <th className="border-b border-slate-100 px-3 py-2">Date</th>
                    <th className="border-b border-slate-100 px-3 py-2">Time</th>
                    <th className="border-b border-slate-100 px-3 py-2">Address</th>
                    <th className="border-b border-slate-100 px-3 py-2 text-right">Amount</th>
                    <th className="border-b border-slate-100 px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedJobs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">
                        No jobs match the filters
                      </td>
                    </tr>
                  ) : (
                    paginatedJobs.map((record) => (
                      <tr
                        key={record.id}
                        onClick={() => onRowClick({ type: 'job', record })}
                        className="cursor-pointer border-b border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-3 py-2 font-semibold text-slate-900">{record.customer}</td>
                        <td className="px-3 py-2">{record.service}</td>
                        <td className="px-3 py-2">{formatDate(record.scheduledDate)}</td>
                        <td className="px-3 py-2">{record.scheduledTime || '-'}</td>
                        <td className="px-3 py-2 max-w-[200px] truncate">{record.address || '-'}</td>
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
