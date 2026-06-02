'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { dashboardTheme } from '@/lib/design-system/themes';
import { useDashboardData } from '../../hooks/useDashboardData';

type ScheduleOrder = {
  id: string;
  customer_name: string;
  service_type: string;
  status: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  final_price: number;
};

const SERVICE_COLORS: Record<string, string> = {
  windows: '#3B82F6', cleaning: '#8B5CF6', yard: '#10B981',
  dump: '#F59E0B', auto: '#EC4899', laundry_sneakers: '#6366F1',
};

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Windows', cleaning: 'Cleaning', yard: 'Yard',
  dump: 'Dump', auto: 'Auto', laundry_sneakers: 'Laundry',
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const glass = 'bg-white/80 backdrop-blur-2xl border border-black/8 shadow-[0_10px_30px_rgba(2,6,23,0.08)] rounded-2xl';

function getWeekDates(offset: number): Date[] {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export default function ScheduleTab() {
  const [orders, setOrders] = useState<ScheduleOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [isMutating, setIsMutating] = useState<string | null>(null);

  const { jobs, refetch } = useDashboardData();

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const weekStart = weekDates[0].toISOString().split('T')[0];
  const weekEnd = weekDates[6].toISOString().split('T')[0];

  useEffect(() => {
    setLoading(true);
    fetch(`/api/orders?date_from=${weekStart}&date_to=${weekEnd}&limit=200`)
      .then((r) => r.json())
      .then((data) => setOrders(data.orders || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [weekStart, weekEnd]);

  const ordersByDate = useMemo(() => {
    const map: Record<string, ScheduleOrder[]> = {};
    orders.forEach((o) => {
      if (o.scheduled_date) {
        if (!map[o.scheduled_date]) map[o.scheduled_date] = [];
        map[o.scheduled_date].push(o);
      }
    });
    return map;
  }, [orders]);

  const unscheduled = useMemo(
    () => jobs.filter((job) => !job.scheduledDate),
    [jobs]
  );
  const today = new Date().toISOString().split('T')[0];

  const weekLabel = `${weekDates[0].toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} — ${weekDates[6].toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  async function updateScheduleOrder(
    orderId: string,
    payload: { status?: 'confirmed' | 'cancelled'; scheduled_date?: string | null; scheduled_time?: string | null },
    successMessage: string
  ) {
    setIsMutating(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update order');
      }

      setOrders((prev) => prev.filter((order) => order.id !== orderId));
      await refetch();
      toast.success(successMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update order');
    } finally {
      setIsMutating(null);
    }
  }

  return (
    <div className="grid gap-6">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Weekly dispatch board for job scheduling.</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="px-3 py-1.5 rounded-lg border text-sm hover:bg-slate-50"
            style={{ borderColor: dashboardTheme.color.border }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={weekOffset === 0
              ? { background: dashboardTheme.color.primary, color: 'white' }
              : { border: `1px solid ${dashboardTheme.color.border}`, color: dashboardTheme.color.muted }}
          >
            Today
          </button>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="px-3 py-1.5 rounded-lg border text-sm hover:bg-slate-50"
            style={{ borderColor: dashboardTheme.color.border }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <span className="text-sm font-medium ml-2" style={{ color: dashboardTheme.color.text }}>{weekLabel}</span>
        </div>
      </div>

      {/* Week Grid */}
      {loading ? (
        <div className="grid grid-cols-7 gap-2">
          {DAYS.map((d) => <div key={d} className="h-48 rounded-xl bg-white/50 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
          {weekDates.map((date, i) => {
            const dateStr = date.toISOString().split('T')[0];
            const dayOrders = ordersByDate[dateStr] || [];
            const isToday = dateStr === today;
            return (
              <div
                key={dateStr}
                className={`rounded-2xl border p-3 min-h-[200px] bg-white/80 ${isToday ? 'border-2' : 'border-black/5'}`}
                style={isToday ? { borderColor: dashboardTheme.color.primary } : undefined}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold" style={{ color: isToday ? dashboardTheme.color.primary : dashboardTheme.color.muted }}>
                    {DAYS[i]}
                  </span>
                  <span
                    className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${isToday ? 'text-white' : ''}`}
                    style={isToday ? { background: dashboardTheme.color.primary } : { color: dashboardTheme.color.muted }}
                  >
                    {date.getDate()}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {dayOrders.map((order) => {
                    const color = SERVICE_COLORS[order.service_type] || '#6B7280';
                    return (
                      <div
                        key={order.id}
                        className="rounded-lg p-2 text-[11px]"
                        style={{ background: `${color}15`, borderLeft: `3px solid ${color}` }}
                      >
                        <p className="font-medium truncate" style={{ color }}>
                          {SERVICE_LABELS[order.service_type] || order.service_type}
                        </p>
                        <p className="truncate text-slate-600">{order.customer_name}</p>
                        {order.scheduled_time && <p className="text-slate-400">{order.scheduled_time}</p>}
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isMutating === order.id}
                            onClick={() => void updateScheduleOrder(
                              order.id,
                              { status: 'confirmed', scheduled_date: null, scheduled_time: null },
                              'Job moved back to unscheduled'
                            )}
                            className="rounded-md border border-black/10 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Unschedule
                          </button>
                          <button
                            type="button"
                            disabled={isMutating === order.id}
                            onClick={() => void updateScheduleOrder(
                              order.id,
                              { status: 'cancelled' },
                              'Scheduled job cancelled'
                            )}
                            className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {dayOrders.length === 0 && (
                    <p className="text-[10px] text-center py-4 text-slate-300">No jobs</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Unscheduled Jobs */}
      {unscheduled.length > 0 && (
        <div className={`${glass} p-5`}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: dashboardTheme.color.text }}>
            Unscheduled Jobs ({unscheduled.length})
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {unscheduled.slice(0, 9).map((order) => {
              const serviceKey = Object.entries(SERVICE_LABELS).find(([, label]) => label === order.service)?.[0] || '';
              const color = SERVICE_COLORS[serviceKey] || '#6B7280';
              return (
                <div key={order.id} className="rounded-xl border border-black/5 p-3 bg-white/60">
                  <div className="flex items-start justify-between">
                    <div>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                        style={{ background: `${color}15`, color }}
                      >
                        {order.service}
                      </span>
                      <p className="text-sm font-medium mt-1" style={{ color: dashboardTheme.color.text }}>{order.customer}</p>
                    </div>
                    <p className="text-sm font-semibold" style={{ color: dashboardTheme.color.text }}>${order.amount.toFixed(0)}</p>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isMutating === order.id}
                      onClick={() => void updateScheduleOrder(
                        order.id,
                        { status: 'cancelled' },
                        'Unscheduled job cancelled'
                      )}
                      className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
