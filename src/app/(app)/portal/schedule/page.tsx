'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { brand } from '@/app/ui/theme';

const SERVICE_ICONS: Record<string, string> = {
  windows: '🚿', cleaning: '🧹', yard: '🌿',
  dump: '🚛', auto: '🚗', laundry_sneakers: '👟',
};
const SERVICE_LABELS: Record<string, string> = {
  windows: 'Window Cleaning', cleaning: 'Home Cleaning', yard: 'Yard Care',
  dump: 'Dump Run', auto: 'Auto Detailing', laundry_sneakers: 'Laundry & Sneakers',
};
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  confirmed:   { bg: '#EFF6FF', text: '#1E40AF' },
  scheduled:   { bg: '#ECFDF5', text: '#065F46' },
  in_progress: { bg: '#FFF7ED', text: '#C2410C' },
  active:      { bg: '#ECFDF5', text: '#065F46' },
  pending:     { bg: '#F1F5F9', text: '#475569' },
};

const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

type CalEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  label: string;
  icon: string;
  status: string;
  kind: 'order' | 'subscription';
  href: string;
};

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseDate(val: string | null | undefined): string | null {
  if (!val) return null;
  return String(val).slice(0, 10);
}

const glass = 'bg-white/80 backdrop-blur-2xl border border-black/8 shadow-[0_10px_30px_rgba(2,6,23,0.08)] rounded-2xl';

export default function SchedulePage() {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toYMD(today), [today]);

  const [events, setEvents]         = useState<CalEvent[]>([]);
  const [loading, setLoading]       = useState(true);
  const [viewYear, setViewYear]     = useState(today.getFullYear());
  const [viewMonth, setViewMonth]   = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr);

  // Fetch orders + subscriptions once.
  useEffect(() => {
    Promise.all([
      fetch('/api/orders?limit=200').then((r) => r.json()).catch(() => ({ orders: [] })),
      fetch('/api/subscriptions?limit=100').then((r) => r.json()).catch(() => ({ subscriptions: [] })),
    ]).then(([od, sd]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orderEvents: CalEvent[] = (od.orders ?? []).flatMap((o: any) => {
        const date = parseDate(o.scheduled_date);
        if (!date || ['cancelled', 'completed'].includes(o.status)) return [];
        return [{
          id: o.id, date,
          label: SERVICE_LABELS[o.service_type] ?? o.service_type,
          icon:  SERVICE_ICONS[o.service_type]  ?? '📋',
          status: o.status, kind: 'order', href: '/portal/orders',
        }];
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subEvents: CalEvent[] = (sd.subscriptions ?? []).flatMap((s: any) => {
        const date = parseDate(s.next_service_date);
        if (!date || s.status !== 'active') return [];
        return [{
          id: s.id, date,
          label: SERVICE_LABELS[s.service_type] ?? s.service_type,
          icon:  SERVICE_ICONS[s.service_type]  ?? '🔄',
          status: s.status, kind: 'subscription', href: '/portal/subscriptions',
        }];
      });

      setEvents([...orderEvents, ...subEvents]);
    }).finally(() => setLoading(false));
  }, []);

  // Calendar grid for the current view month.
  const calendarCells = useMemo(() => {
    const firstDow    = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (number | null)[] = Array(firstDow).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) {
      map.set(e.date, [...(map.get(e.date) ?? []), e]);
    }
    return map;
  }, [events]);

  const upcomingEvents = useMemo(
    () => events.filter((e) => e.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12),
    [events, todayStr],
  );

  const selectedEvents = selectedDate ? (eventsByDate.get(selectedDate) ?? []) : [];

  function prevMonth() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }
  function goToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDate(todayStr);
  }

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold" style={{ color: brand.primary }}>Schedule</h1>
        <p className="text-sm mt-1" style={{ color: brand.muted }}>Your upcoming services at a glance</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">

        {/* ── Calendar card ── */}
        <div className={`${glass} p-5`}>

          {/* Month nav */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" aria-label="Previous month">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <h2 className="text-sm font-semibold min-w-[150px] text-center" style={{ color: brand.text }}>
                {MONTHS[viewMonth]} {viewYear}
              </h2>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" aria-label="Next month">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
              </button>
            </div>
            <button
              onClick={goToday}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:bg-slate-50"
              style={{ color: brand.primary, borderColor: 'rgba(0,0,0,0.1)' }}
            >
              Today
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[11px] font-semibold py-1" style={{ color: brand.muted }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-px bg-black/5 rounded-xl overflow-hidden">
            {calendarCells.map((day, i) => {
              if (day === null) {
                return <div key={`e-${i}`} className="bg-white/40 min-h-[52px]" />;
              }

              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayEvts = eventsByDate.get(dateStr) ?? [];
              const isToday    = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const isPast     = dateStr < todayStr;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                  className="min-h-[52px] p-1.5 flex flex-col items-center gap-1 transition-colors hover:bg-emerald-50/60"
                  style={{ background: isSelected ? `${brand.primary}12` : 'white' }}
                >
                  <span
                    className="text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full"
                    style={{
                      background: isToday ? brand.primary : 'transparent',
                      color: isToday ? '#fff' : isPast ? '#CBD5E1' : brand.text,
                      fontWeight: isToday || isSelected ? 700 : 400,
                    }}
                  >
                    {day}
                  </span>
                  {/* Event dots — up to 3 */}
                  {dayEvts.length > 0 && (
                    <div className="flex gap-0.5 flex-wrap justify-center">
                      {dayEvts.slice(0, 3).map((_, j) => (
                        <div key={j} className="w-1.5 h-1.5 rounded-full" style={{ background: brand.primary }} />
                      ))}
                      {dayEvts.length > 3 && (
                        <span className="text-[9px] leading-none" style={{ color: brand.muted }}>+{dayEvts.length - 3}</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected-day detail */}
          {selectedDate && (
            <div className="mt-5 pt-4 border-t border-black/6">
              <p className="text-xs font-semibold mb-3" style={{ color: brand.muted }}>
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-AU', {
                  weekday: 'long', day: 'numeric', month: 'long',
                })}
              </p>
              {selectedEvents.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: brand.muted }}>No services on this day.</p>
              ) : (
                <div className="space-y-2">
                  {selectedEvents.map((e) => {
                    const c = STATUS_COLORS[e.status] ?? STATUS_COLORS.pending;
                    return (
                      <Link
                        key={e.id}
                        href={e.href}
                        className="flex items-center gap-3 p-3 rounded-xl border transition-colors hover:bg-slate-50/60"
                        style={{ borderColor: 'rgba(0,0,0,0.06)' }}
                      >
                        <span className="text-xl shrink-0">{e.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: brand.text }}>{e.label}</p>
                          {e.kind === 'subscription' && (
                            <p className="text-[11px]" style={{ color: brand.muted }}>Recurring subscription</p>
                          )}
                        </div>
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 capitalize"
                          style={{ background: c.bg, color: c.text }}
                        >
                          {e.status.replace('_', ' ')}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Upcoming sidebar ── */}
        <div className={`${glass} p-5`}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: brand.text }}>Upcoming</h2>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : upcomingEvents.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm" style={{ color: brand.muted }}>No upcoming services.</p>
              <Link
                href="/services"
                className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl text-white shadow-sm"
                style={{ background: brand.primary }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                Book a service
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map((event) => {
                const eventDate = new Date(event.date + 'T12:00:00');
                const isEventToday = event.date === todayStr;
                const isTomorrow   = event.date === (() => { const t = new Date(today); t.setDate(t.getDate() + 1); return toYMD(t); })();
                const dayLabel = isEventToday
                  ? 'Today'
                  : isTomorrow
                  ? 'Tomorrow'
                  : eventDate.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });

                const c = STATUS_COLORS[event.status] ?? STATUS_COLORS.pending;

                return (
                  <button
                    key={event.id}
                    onClick={() => {
                      setSelectedDate(event.date);
                      setViewYear(eventDate.getFullYear());
                      setViewMonth(eventDate.getMonth());
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors hover:bg-slate-50/60"
                    style={{ borderColor: 'rgba(0,0,0,0.06)' }}
                  >
                    <span className="text-lg shrink-0">{event.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: brand.text }}>{event.label}</p>
                      <p className="text-[11px]" style={{ color: brand.muted }}>{dayLabel}</p>
                    </div>
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 capitalize"
                      style={{ background: c.bg, color: c.text }}
                    >
                      {event.status.replace('_', ' ')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {upcomingEvents.length > 0 && (
            <div className="mt-4 pt-4 border-t border-black/6">
              <Link
                href="/services"
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md"
                style={{ background: brand.primary }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                Book another service
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
