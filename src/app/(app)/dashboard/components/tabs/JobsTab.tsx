'use client';

import { useMemo } from 'react';
import { StatusChip, Pagination } from '../shared';
import { TableSkeleton } from '../Skeletons';
import { formatCurrency, formatDate } from '@/lib/dashboard/utils';
import { useTableFilters } from '../../hooks/useTableFilters';
import {
  type JobRecord,
  type JobFilters,
  type RecordDetail,
  jobStatusOptions,
  jobStatusLabels,
} from '@/types/dashboard';

type JobsTabProps = {
  jobs: JobRecord[];
  isLoading: boolean;
  onRowClick: (detail: RecordDetail) => void;
  initialFilters?: Partial<JobFilters>;
  initialScheduleState?: 'all' | 'scheduled' | 'unscheduled';
  quoteIdToJobId?: Map<string, string>;
  orderIdToQuoteId?: Map<string, string>;
};

function sanitizeScheduleState(value?: string): 'all' | 'scheduled' | 'unscheduled' {
  if (value === 'scheduled' || value === 'unscheduled') return value;
  return 'all';
}

function buildInitialFilters(partial?: Partial<JobFilters>): JobFilters {
  const status = partial?.status && jobStatusOptions.includes(partial.status) ? partial.status : 'all';
  return {
    status,
    startDate: partial?.startDate || '',
    endDate: partial?.endDate || '',
    search: partial?.search || '',
  };
}

export default function JobsTab({
  jobs,
  isLoading,
  onRowClick,
  initialFilters,
  initialScheduleState,
  orderIdToQuoteId,
}: JobsTabProps) {
  const scheduleState = sanitizeScheduleState(initialScheduleState);

  const { filters, setFilter, filtered, paginated, page, setPage, totalPages } = useTableFilters(
    jobs,
    {
      initialFilters: buildInitialFilters(initialFilters),
      filterFn: (record, f) => {
        const isScheduled = Boolean(record.scheduledDate);
        if (scheduleState === 'scheduled' && !isScheduled) return false;
        if (scheduleState === 'unscheduled' && isScheduled) return false;
        if (f.status !== 'all' && record.status !== f.status) return false;
        if (f.startDate && record.scheduledDate < f.startDate) return false;
        if (f.endDate && record.scheduledDate > f.endDate) return false;
        if (f.search) {
          const term = f.search.trim().toLowerCase();
          const haystack = `${record.customer} ${record.service} ${record.id} ${record.address}`.toLowerCase();
          if (!haystack.includes(term)) return false;
        }
        return true;
      },
    }
  );

  const scheduleStateLocal = useMemo(() => scheduleState, [scheduleState]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-[11px] text-slate-500">
          Schedule
          <select
            value={scheduleStateLocal}
            disabled
            className="rounded-lg border border-black/10 bg-white/90 px-3 py-1.5 text-xs text-slate-700"
          >
            <option value="all">All jobs</option>
            <option value="scheduled">Scheduled only</option>
            <option value="unscheduled">Unscheduled only</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-slate-500">
          Status
          <select
            value={filters.status}
            onChange={(e) => setFilter('status', e.target.value)}
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
            placeholder="Customer, service, or address"
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            className="rounded-lg border border-black/10 bg-white/90 px-3 py-1.5 text-xs text-slate-700"
          />
        </label>
        <div className="ml-auto">
          <span className="text-xs text-slate-500">{filtered.length} jobs</span>
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
                    {orderIdToQuoteId && <th className="border-b border-slate-100 px-3 py-2">Quote</th>}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={orderIdToQuoteId ? 8 : 7} className="px-3 py-8 text-center text-sm text-slate-500">
                        No jobs match the filters
                      </td>
                    </tr>
                  ) : (
                    paginated.map((record) => {
                      const linkedQuoteId = orderIdToQuoteId?.get(record.id);
                      return (
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
                          {orderIdToQuoteId && (
                            <td className="px-3 py-2">
                              {linkedQuoteId ? (
                                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                                  Q-{linkedQuoteId.slice(0, 6)}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
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
