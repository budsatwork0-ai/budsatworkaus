'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { brand, glass } from '@/app/ui/theme';
import { useEmployee } from '@/app/hooks/useEmployee';
import { SERVICE_TYPE_LABELS } from '@/types/orders';
import { ASSIGNMENT_STATUS_COLORS, ASSIGNMENT_STATUS_LABELS } from '@/types/crew';
import type { ServiceType } from '@/types/orders';
import type { AssignmentStatus } from '@/types/crew';
import Link from 'next/link';

const SERVICE_HOURS: Record<string, number> = {
  windows: 2, cleaning: 3, yard: 2, dump: 2, auto: 3, laundry_sneakers: 1.5,
};

interface ScheduleJob {
  id: string;
  status: string;
  orders: {
    service_type: string;
    customer_name: string;
    scheduled_date: string | null;
    scheduled_time: string | null;
    final_price: number;
  } | null;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SchedulePage() {
  const { employee, isLoading: empLoading } = useEmployee();
  const [jobs, setJobs] = useState<ScheduleJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);

  // Calculate week dates
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + (weekOffset * 7));
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  const dateFrom = weekDates[0].toISOString().split('T')[0];
  const dateTo = weekDates[6].toISOString().split('T')[0];

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/crew/my-jobs`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.assignments || []);
      }
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (employee) fetchJobs();
  }, [employee, fetchJobs]);

  if (empLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: brand.primary, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const todayStr = today.toISOString().split('T')[0];

  // Weekly summary stats
  const weekStats = useMemo(() => {
    const weekJobs = jobs.filter((j) => {
      const d = j.orders?.scheduled_date;
      return d && d >= dateFrom && d <= dateTo && j.status !== 'declined';
    });
    const estHours = weekJobs.reduce(
      (sum, j) => sum + (SERVICE_HOURS[j.orders?.service_type ?? ''] ?? 2), 0
    );
    const earnings = weekJobs
      .filter((j) => j.status === 'completed')
      .reduce((sum, j) => sum + (j.orders?.final_price ?? 0), 0);
    return { count: weekJobs.length, estHours, earnings };
  }, [jobs, dateFrom, dateTo]);

  // Group jobs by date
  const jobsByDate = new Map<string, ScheduleJob[]>();
  for (const job of jobs) {
    const date = job.orders?.scheduled_date;
    if (date) {
      if (!jobsByDate.has(date)) jobsByDate.set(date, []);
      jobsByDate.get(date)!.push(job);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: brand.text }}>Schedule</h1>
        <p className="text-sm mt-1" style={{ color: brand.muted }}>Your upcoming jobs at a glance.</p>
      </div>

      {/* Weekly summary strip */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          <div className={`${glass} rounded-2xl p-4 text-center`}>
            <p className="text-2xl font-bold" style={{ color: brand.primary }}>{weekStats.count}</p>
            <p className="text-xs mt-1" style={{ color: brand.muted }}>Jobs this week</p>
          </div>
          <div className={`${glass} rounded-2xl p-4 text-center`}>
            <p className="text-2xl font-bold" style={{ color: '#3B82F6' }}>~{weekStats.estHours.toFixed(1)}h</p>
            <p className="text-xs mt-1" style={{ color: brand.muted }}>Est. hours</p>
          </div>
          <div className={`${glass} rounded-2xl p-4 text-center`}>
            <p className="text-2xl font-bold" style={{ color: '#10B981' }}>${weekStats.earnings.toFixed(0)}</p>
            <p className="text-xs mt-1" style={{ color: brand.muted }}>Earned</p>
          </div>
        </div>
      )}

      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setWeekOffset((w) => w - 1)}
          className="px-3 py-1.5 rounded-lg text-sm border transition-colors hover:bg-slate-50"
          style={{ borderColor: brand.border, color: brand.muted }}
        >
          &larr; Previous
        </button>
        <p className="text-sm font-medium" style={{ color: brand.text }}>
          {weekDates[0].toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
          {' - '}
          {weekDates[6].toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
        <button
          onClick={() => setWeekOffset((w) => w + 1)}
          className="px-3 py-1.5 rounded-lg text-sm border transition-colors hover:bg-slate-50"
          style={{ borderColor: brand.border, color: brand.muted }}
        >
          Next &rarr;
        </button>
      </div>

      {/* Week grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekDates.map((date, i) => {
          const dateStr = date.toISOString().split('T')[0];
          const isToday = dateStr === todayStr;
          const dayJobs = jobsByDate.get(dateStr) || [];
          const inRange = dateStr >= dateFrom && dateStr <= dateTo;

          return (
            <div
              key={i}
              className={`${glass} rounded-xl p-3 min-h-[120px] ${isToday ? 'ring-2 ring-emerald-700' : ''}`}
            >
              <div className="text-center mb-2">
                <p className="text-[10px] uppercase font-medium" style={{ color: brand.muted }}>
                  {DAYS[i]}
                </p>
                <p
                  className="text-lg font-bold"
                  style={{ color: isToday ? brand.primary : brand.text }}
                >
                  {date.getDate()}
                </p>
              </div>
              <div className="space-y-1">
                {dayJobs.map((job) => {
                  const serviceLabel = SERVICE_TYPE_LABELS[job.orders?.service_type as ServiceType] || '';
                  return (
                    <Link
                      key={job.id}
                      href={`/crew/jobs/${job.id}`}
                      className="block px-1.5 py-1 rounded text-[10px] font-medium truncate transition-opacity hover:opacity-80"
                      style={{ background: 'rgba(15,61,46,0.1)', color: brand.primary }}
                    >
                      {serviceLabel}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Job list for current week */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className={`${glass} rounded-2xl p-5 animate-pulse`}>
              <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
              <div className="h-3 bg-slate-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: brand.muted }}>
            This Week
          </h2>
          {weekDates.map((date) => {
            const dateStr = date.toISOString().split('T')[0];
            const dayJobs = jobsByDate.get(dateStr) || [];
            if (dayJobs.length === 0) return null;

            return (
              <div key={dateStr}>
                <p className="text-xs font-medium mb-2" style={{ color: brand.muted }}>
                  {date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })}
                </p>
                {dayJobs.map((job) => {
                  const serviceLabel = SERVICE_TYPE_LABELS[job.orders?.service_type as ServiceType] || '';
                  const statusColor = ASSIGNMENT_STATUS_COLORS[job.status as AssignmentStatus] || '';
                  const statusLabel = ASSIGNMENT_STATUS_LABELS[job.status as AssignmentStatus] || job.status;

                  return (
                    <Link
                      key={job.id}
                      href={`/crew/jobs/${job.id}`}
                      className={`block ${glass} rounded-xl p-4 mb-2 transition-transform hover:scale-[1.005]`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium" style={{ color: brand.text }}>
                              {serviceLabel}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColor}`}>
                              {statusLabel}
                            </span>
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: brand.muted }}>
                            {job.orders?.customer_name}
                            {job.orders?.scheduled_time && ` at ${job.orders.scheduled_time}`}
                          </p>
                        </div>
                        <p className="font-bold" style={{ color: brand.primary }}>
                          ${job.orders?.final_price.toFixed(2)}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
