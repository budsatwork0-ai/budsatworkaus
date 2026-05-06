'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { brand } from '@/app/ui/theme';
import { useDashboardData } from '../hooks/useDashboardData';
import JobsTab from '../components/tabs/JobsTab';
import DayScheduler from '../components/DayScheduler';

const SERVICE_COLORS: Record<string, string> = {
  windows: '#3B82F6', cleaning: '#8B5CF6', yard: '#10B981',
  dump: '#F59E0B', auto: '#EC4899', laundry_sneakers: '#6366F1',
};

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Windows', cleaning: 'Cleaning', yard: 'Yard',
  dump: 'Dump', auto: 'Auto', laundry_sneakers: 'Laundry',
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Order = {
  id: string;
  customer_name: string;
  service_type: string;
  status: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  final_price: number;
};

type View = 'day' | 'calendar' | 'list';

function sanitizeView(v: string | null): View {
  if (v === 'calendar' || v === 'list') return v;
  return 'day';
}

function sanitizeScheduleState(v: string | null): 'all' | 'scheduled' | 'unscheduled' {
  if (v === 'scheduled' || v === 'unscheduled') return v;
  return 'all';
}

function sanitizeDate(v: string | null): string {
  if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return new Date().toISOString().split('T')[0];
}

function getWeekDates(offset: number): Date[] {
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

// View toggle icons
const DayIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
    <rect x="7" y="14" width="4" height="4" rx="0.5" fill="currentColor" strokeWidth="0"/>
  </svg>
);
const WeekIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
    <line x1="9" y1="10" x2="9" y2="22"/><line x1="15" y1="10" x2="15" y2="22"/>
  </svg>
);
const ListIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/>
    <circle cx="4" cy="6" r="1.5" fill="currentColor" strokeWidth="0"/>
    <circle cx="4" cy="12" r="1.5" fill="currentColor" strokeWidth="0"/>
    <circle cx="4" cy="18" r="1.5" fill="currentColor" strokeWidth="0"/>
  </svg>
);

function SchedulePageContent() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const today = new Date().toISOString().split('T')[0];

  const [view, setView] = useState<View>(() => sanitizeView(searchParams?.get('view') ?? null));
  const [date, setDate] = useState(() => sanitizeDate(searchParams?.get('date') ?? null));
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekOrders, setWeekOrders] = useState<Order[]>([]);
  const [weekLoading, setWeekLoading] = useState(false);
  const [isMutating, setIsMutating] = useState<string | null>(null);

  const { jobs, isLoading: jobsLoading, refetch, orderIdToQuoteId } = useDashboardData();
  const scheduleState = sanitizeScheduleState(searchParams?.get('scheduleState') ?? null);

  useEffect(() => {
    const v = sanitizeView(searchParams?.get('view') ?? null);
    const d = sanitizeDate(searchParams?.get('date') ?? null);
    setView(v);
    setDate(d);
  }, [searchParams]);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const weekStart = weekDates[0].toISOString().split('T')[0];
  const weekEnd = weekDates[6].toISOString().split('T')[0];

  useEffect(() => {
    if (view !== 'calendar') return;
    setWeekLoading(true);
    fetch(`/api/orders?date_from=${weekStart}&date_to=${weekEnd}&limit=200`)
      .then((r) => r.json())
      .then((data) => setWeekOrders(data.orders || []))
      .catch(() => {})
      .finally(() => setWeekLoading(false));
  }, [weekStart, weekEnd, view]);

  const ordersByDate = useMemo(() => {
    const map: Record<string, Order[]> = {};
    weekOrders.forEach((o) => {
      if (o.scheduled_date) {
        if (!map[o.scheduled_date]) map[o.scheduled_date] = [];
        map[o.scheduled_date].push(o);
      }
    });
    return map;
  }, [weekOrders]);

  const unscheduled = useMemo(() => jobs.filter((job) => !job.scheduledDate), [jobs]);

  const dayLabel = useMemo(
    () => new Date(date + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }),
    [date]
  );

  const weekLabel = `${weekDates[0].toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} – ${weekDates[6].toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  function pushParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    Object.entries(updates).forEach(([k, v]) => params.set(k, v));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function setViewNav(nextView: View) {
    setView(nextView);
    pushParams({ view: nextView });
  }

  function handleDateChange(newDate: string) {
    setDate(newDate);
    pushParams({ date: newDate, view: 'day' });
    if (view !== 'day') setView('day');
  }

  function prevDay() {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    handleDateChange(d.toISOString().split('T')[0]);
  }

  function nextDay() {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    handleDateChange(d.toISOString().split('T')[0]);
  }

  async function cancelWeekJob(orderId: string) {
    setIsMutating(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to cancel');
      }
      await refetch();
      toast.success('Job cancelled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setIsMutating(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Unified toolbar ── */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-xl"
        style={{ background: 'white', border: `1px solid ${brand.border}` }}
      >
        {/* View toggle */}
        <div
          className="inline-flex p-0.5 rounded-lg gap-0.5"
          style={{ background: brand.surfaceAlt, border: `1px solid ${brand.border}` }}
        >
          {([
            ['day', 'Day', <DayIcon key="d" />],
            ['calendar', 'Week', <WeekIcon key="w" />],
            ['list', 'List', <ListIcon key="l" />],
          ] as const).map(([key, label, icon]) => {
            const active = view === key;
            return (
              <button
                key={key}
                onClick={() => setViewNav(key as View)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                style={active
                  ? { background: brand.primary, color: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }
                  : { color: brand.muted }
                }
              >
                {icon}{label}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="w-px h-4 rounded-full" style={{ background: brand.border }} />

        {/* Day navigation */}
        {view === 'day' && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={prevDay}
              className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-black/5"
              style={{ color: brand.muted }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>

            <label className="flex items-center gap-1.5 cursor-pointer group px-2 py-1 rounded-md hover:bg-black/5 transition-colors select-none">
              <span className="text-sm font-semibold" style={{ color: brand.text }}>{dayLabel}</span>
              <svg className="opacity-25 group-hover:opacity-50 transition-opacity shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <input type="date" value={date} onChange={(e) => handleDateChange(e.target.value)} className="sr-only" />
            </label>

            <button
              onClick={nextDay}
              className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-black/5"
              style={{ color: brand.muted }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>

            {date !== today && (
              <button
                onClick={() => handleDateChange(today)}
                className="ml-1 px-2.5 py-1 rounded-md text-[11px] font-semibold"
                style={{ background: brand.primary, color: 'white' }}
              >
                Today
              </button>
            )}
          </div>
        )}

        {/* Week navigation */}
        {view === 'calendar' && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-black/5"
              style={{ color: brand.muted }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span className="text-sm font-semibold px-2" style={{ color: brand.text }}>{weekLabel}</span>
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-black/5"
              style={{ color: brand.muted }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                className="ml-1 px-2.5 py-1 rounded-md text-[11px] font-semibold"
                style={{ background: brand.primary, color: 'white' }}
              >
                Today
              </button>
            )}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Unscheduled indicator (day + week views) */}
        {view !== 'list' && unscheduled.length > 0 && (
          <div
            className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md"
            style={{ color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a' }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {unscheduled.length} unscheduled
          </div>
        )}
      </div>

      {/* ── Content ── */}
      {view === 'day' ? (
        <DayScheduler date={date} onDateChange={handleDateChange} />
      ) : view === 'list' ? (
        <JobsTab
          jobs={jobs}
          isLoading={jobsLoading}
          onRowClick={() => {}}
          initialScheduleState={scheduleState}
          orderIdToQuoteId={orderIdToQuoteId}
        />
      ) : (
        /* ── Week view: 7-day grid + queue panel ── */
        <div className="flex gap-3 items-start">
          {/* 7-day grid */}
          <div className="flex-1 min-w-0">
            {weekLoading ? (
              <div className="grid grid-cols-7 gap-1.5">
                {DAYS.map((d) => (
                  <div key={d} className="h-48 rounded-xl animate-pulse" style={{ background: brand.surfaceAlt }} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-7 gap-1.5">
                {weekDates.map((wDate, i) => {
                  const dateStr = wDate.toISOString().split('T')[0];
                  const dayOrders = ordersByDate[dateStr] || [];
                  const isToday = dateStr === today;
                  return (
                    <div
                      key={dateStr}
                      className="rounded-xl p-2.5 min-h-[180px] cursor-pointer transition-shadow hover:shadow-sm group"
                      style={isToday
                        ? { background: 'white', border: `2px solid ${brand.primary}` }
                        : { background: 'white', border: `1px solid ${brand.border}` }
                      }
                      onClick={() => { handleDateChange(dateStr); }}
                    >
                      {/* Day header */}
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: isToday ? brand.primary : brand.muted }}
                        >
                          {DAYS[i]}
                        </span>
                        <span
                          className="text-xs font-bold tabular-nums w-5 h-5 flex items-center justify-center rounded-full"
                          style={isToday
                            ? { background: brand.primary, color: 'white' }
                            : { color: brand.text }
                          }
                        >
                          {wDate.getDate()}
                        </span>
                      </div>

                      {/* Job pills */}
                      <div className="space-y-0.5">
                        {dayOrders.slice(0, 5).map((order) => {
                          const color = SERVICE_COLORS[order.service_type] || '#6B7280';
                          const timeLabel = order.scheduled_time
                            ? (() => {
                                const [h, m] = order.scheduled_time.split(':').map(Number);
                                return m === 0
                                  ? `${h % 12 || 12}${h >= 12 ? 'pm' : 'am'}`
                                  : `${h % 12 || 12}:${m.toString().padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`;
                              })()
                            : null;
                          return (
                            <Link
                              key={order.id}
                              href={`/dashboard/schedule?view=day&date=${dateStr}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1.5 py-0.5 px-1 rounded-md hover:bg-black/5 transition-colors"
                            >
                              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                              <p className="text-[10px] truncate leading-snug flex-1" style={{ color: brand.text }}>
                                {order.customer_name}
                              </p>
                              {timeLabel && (
                                <span className="text-[9px] tabular-nums shrink-0" style={{ color: brand.muted }}>{timeLabel}</span>
                              )}
                            </Link>
                          );
                        })}
                        {dayOrders.length > 5 && (
                          <p className="text-[10px] px-1" style={{ color: brand.muted }}>+{dayOrders.length - 5} more</p>
                        )}
                        {dayOrders.length === 0 && (
                          <p className="text-[10px] text-center py-5" style={{ color: `${brand.muted}50` }}>—</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Queue panel */}
          <div
            className="w-56 shrink-0 rounded-xl overflow-hidden"
            style={{ border: `1px solid ${brand.border}`, background: 'white' }}
          >
            <div
              className="px-3.5 py-2.5 border-b flex items-center justify-between"
              style={{ borderColor: brand.border, background: brand.surfaceAlt }}
            >
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: brand.muted }}>Queue</span>
              {unscheduled.length > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: `${brand.primary}15`, color: brand.primary }}>
                  {unscheduled.length}
                </span>
              )}
            </div>

            {unscheduled.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: brand.surfaceAlt }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={brand.muted} strokeWidth="1.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <p className="text-xs font-medium" style={{ color: brand.muted }}>All caught up</p>
              </div>
            ) : (
              <div className="p-2 space-y-1.5 max-h-96 overflow-y-auto">
                {unscheduled.map((job) => {
                  const colorKey = Object.entries(SERVICE_LABELS).find(([, label]) => label === job.service)?.[0];
                  const color = SERVICE_COLORS[colorKey || ''] || '#6B7280';
                  return (
                    <div
                      key={job.id}
                      className="rounded-lg px-2.5 py-2"
                      style={{ background: brand.bg, border: `1px solid ${brand.border}` }}
                    >
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-0.5" style={{ background: color }} />
                          <span className="text-[9px] font-bold uppercase tracking-wide truncate" style={{ color }}>{job.service}</span>
                        </div>
                        <span className="text-[11px] font-semibold shrink-0 tabular-nums" style={{ color: brand.text }}>${job.amount.toFixed(0)}</span>
                      </div>
                      <p className="text-xs font-medium truncate" style={{ color: brand.text }}>{job.customer}</p>
                      <div className="mt-2 flex gap-1.5">
                        <button
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded border"
                          style={{ color: '#dc2626', borderColor: '#fca5a5', background: '#fff5f5' }}
                          disabled={isMutating === job.id}
                          onClick={() => void cancelWeekJob(job.id)}
                        >
                          Cancel
                        </button>
                        <button
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded border"
                          style={{ color: brand.primary, borderColor: brand.border, background: 'white' }}
                          onClick={() => handleDateChange(today)}
                        >
                          Schedule
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduleSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="h-11 rounded-xl" style={{ background: 'white', border: `1px solid ${brand.border}` }} />
      <div className="flex gap-3">
        <div className="flex-1 h-[480px] rounded-xl" style={{ background: 'white', border: `1px solid ${brand.border}` }} />
        <div className="w-56 h-[480px] rounded-xl" style={{ background: 'white', border: `1px solid ${brand.border}` }} />
      </div>
    </div>
  );
}

export default function SchedulePage() {
  return (
    <Suspense fallback={<ScheduleSkeleton />}>
      <SchedulePageContent />
    </Suspense>
  );
}
