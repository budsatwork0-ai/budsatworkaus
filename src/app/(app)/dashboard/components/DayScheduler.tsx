'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { brand } from '@/app/ui/theme';

// ── Hour range ──────────────────────────────────────────────────────────────
// Change DAY_START / DAY_END (24-hour integers) to extend the visible day.
// e.g. DAY_START = 6 adds a 6am row; DAY_END = 19 adds rows through 7pm.
const DAY_START = 7;   // first visible hour (inclusive)
const DAY_END = 17;    // last visible hour  (exclusive — 17 = up to 5pm)
// ────────────────────────────────────────────────────────────────────────────
const HOURS = DAY_END - DAY_START;
const PX_PER_HOUR = 72;
const TRAVEL_MIN = 30;
const TIMELINE_HEIGHT = HOURS * PX_PER_HOUR;

const SERVICE_COLORS: Record<string, string> = {
  windows: '#3B82F6',
  cleaning: '#8B5CF6',
  yard: '#10B981',
  dump: '#F59E0B',
  auto: '#EC4899',
  laundry_sneakers: '#6366F1',
};

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Windows',
  cleaning: 'Cleaning',
  yard: 'Yard care',
  dump: 'Dump run',
  auto: 'Auto detailing',
  laundry_sneakers: 'Laundry',
};

const DEFAULT_DURATIONS: Record<string, number> = {
  windows: 120,
  cleaning: 180,
  yard: 120,
  dump: 120,
  auto: 180,
  laundry_sneakers: 120,
};

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function parseAvailabilityForDate(
  availability: string[],
  dateStr: string
): { startMin: number; endMin: number } | null {
  const dayKey = DAY_KEYS[new Date(dateStr + 'T12:00:00').getDay()];
  const slot = availability.find((s) => s.startsWith(dayKey + ':'));
  if (!slot) return null;
  const rest = slot.slice(dayKey.length + 1);
  const dash = rest.indexOf('-');
  if (dash === -1) return null;
  return {
    startMin: timeToMinutes(rest.slice(0, dash)),
    endMin: timeToMinutes(rest.slice(dash + 1)),
  };
}

function formatAvailRange(range: { startMin: number; endMin: number }): string {
  return `${formatDisplayTime(minutesToTime(range.startMin))}–${formatDisplayTime(minutesToTime(range.endMin))}`;
}

type CrewMember = {
  id: string;
  full_name: string;
  services: string[] | null;
  status: string;
  availability: string[] | null;
};

type DayOrder = {
  id: string;
  customer_name: string;
  service_type: string;
  status: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  estimated_duration_minutes: number;
  assigned_crew_id: string | null;
  final_price: number;
  notes: string | null;
};

type AssignModal = {
  order: DayOrder;
  crewId: string;
  crewName: string;
  crewAvail: { startMin: number; endMin: number } | null;
  time: string;
  duration: number;
  mode: 'assign' | 'edit';
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, '0');
  const m = (min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function minutesToPx(min: number): number {
  return ((min - DAY_START * 60) / 60) * PX_PER_HOUR;
}

function pxToMinutes(px: number): number {
  const raw = DAY_START * 60 + (px / PX_PER_HOUR) * 60;
  return Math.max(DAY_START * 60, Math.min(DAY_END * 60 - 30, Math.round(raw / 30) * 30));
}

function hasConflict(
  orders: DayOrder[],
  crewId: string,
  excludeId: string | null,
  startMin: number,
  durationMin: number
): boolean {
  const relevant = orders.filter(
    (o) => o.assigned_crew_id === crewId && o.scheduled_time && o.id !== excludeId
  );
  const newEnd = startMin + durationMin + TRAVEL_MIN;
  for (const o of relevant) {
    const s = timeToMinutes(o.scheduled_time!);
    const e = s + (o.estimated_duration_minutes || 120) + TRAVEL_MIN;
    if (startMin < e && newEnd > s) return true;
  }
  return false;
}

function isOutsideAvailability(
  avail: { startMin: number; endMin: number } | null,
  startMin: number,
  durationMin: number
): boolean {
  if (!avail) return false;
  return startMin < avail.startMin || startMin + durationMin > avail.endMin;
}

function formatDisplayTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour}${period}` : `${hour}:${m.toString().padStart(2, '0')}${period}`;
}

interface DaySchedulerProps {
  date: string;
  onDateChange: (d: string) => void;
}

export default function DayScheduler({ date, onDateChange }: DaySchedulerProps) {
  const today = new Date().toISOString().split('T')[0];
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [orders, setOrders] = useState<DayOrder[]>([]);
  const [unscheduled, setUnscheduled] = useState<DayOrder[]>([]);
  const [selectedJob, setSelectedJob] = useState<DayOrder | null>(null);
  const [modal, setModal] = useState<AssignModal | null>(null);
  const [isMutating, setIsMutating] = useState<string | null>(null);
  const [crewLoading, setCrewLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [hiddenCrewIds, setHiddenCrewIds] = useState<Set<string>>(new Set());
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});

  function toggleCrew(id: string) {
    setHiddenCrewIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    setCrewLoading(true);
    fetch('/api/crew/employees')
      .then((r) => r.json())
      .then((data) => {
        setCrew((data.employees || []).filter((e: CrewMember) => e.status === 'active'));
      })
      .catch(() => {})
      .finally(() => setCrewLoading(false));
  }, []);

  const fetchOrders = useCallback(() => {
    setOrdersLoading(true);
    Promise.all([
      fetch(`/api/orders?date_from=${date}&date_to=${date}&limit=200`).then((r) => r.json()),
      fetch(`/api/orders?unscheduled=true&limit=200`).then((r) => r.json()),
    ])
      .then(([dayData, unschData]) => {
        setOrders(dayData.orders || []);
        setUnscheduled(unschData.orders || []);
      })
      .catch(() => {})
      .finally(() => setOrdersLoading(false));
  }, [date]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  async function applyAssignment(payload: {
    orderId: string;
    scheduledDate: string;
    scheduledTime: string;
    estimatedDuration: number;
    crewId: string | null;
  }) {
    setIsMutating(payload.orderId);
    try {
      const res = await fetch(`/api/orders/${payload.orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduled_date: payload.scheduledDate,
          scheduled_time: payload.scheduledTime,
          estimated_duration_minutes: payload.estimatedDuration,
          assigned_crew_id: payload.crewId,
          status: 'scheduled',
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to update job');
      }
      toast.success('Job scheduled');
      setSelectedJob(null);
      setModal(null);
      fetchOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update job');
    } finally {
      setIsMutating(null);
    }
  }

  async function unscheduleJob(orderId: string) {
    setIsMutating(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduled_date: null,
          scheduled_time: null,
          assigned_crew_id: null,
          status: 'confirmed',
        }),
      });
      if (!res.ok) throw new Error('Failed to unschedule');
      toast.success('Job moved back to queue');
      setModal(null);
      fetchOrders();
    } catch {
      toast.error('Failed to unschedule job');
    } finally {
      setIsMutating(null);
    }
  }

  function handleColumnClick(e: React.MouseEvent<HTMLDivElement>, member: CrewMember) {
    if (!selectedJob) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutes = pxToMinutes(y);
    const duration = selectedJob.estimated_duration_minutes || DEFAULT_DURATIONS[selectedJob.service_type] || 120;
    const avail = member.availability?.length
      ? parseAvailabilityForDate(member.availability, date)
      : null;

    if (avail && isOutsideAvailability(avail, minutes, duration)) {
      toast.error(`${member.full_name} is only available ${formatAvailRange(avail)} today.`);
      return;
    }

    setModal({
      order: selectedJob,
      crewId: member.id,
      crewName: member.full_name,
      crewAvail: avail,
      time: minutesToTime(minutes),
      duration,
      mode: 'assign',
    });
  }

  function handleJobBlockClick(e: React.MouseEvent, order: DayOrder, member: CrewMember) {
    e.stopPropagation();
    setSelectedJob(null);
    const avail = member.availability?.length
      ? parseAvailabilityForDate(member.availability, date)
      : null;
    setModal({
      order,
      crewId: member.id,
      crewName: member.full_name,
      crewAvail: avail,
      time: order.scheduled_time || '09:00',
      duration: order.estimated_duration_minutes || 120,
      mode: 'edit',
    });
  }

  const isConflict = modal
    ? hasConflict(orders, modal.crewId, modal.mode === 'edit' ? modal.order.id : null, timeToMinutes(modal.time), modal.duration)
    : false;

  const isAvailViolation = modal
    ? isOutsideAvailability(modal.crewAvail, timeToMinutes(modal.time), modal.duration)
    : false;

  const timeLabels = Array.from({ length: HOURS + 1 }, (_, i) => {
    const h = DAY_START + i;
    return { label: h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`, min: h * 60 };
  });

  const isLoading = crewLoading || ordersLoading;
  const visibleCrew = crew.filter((m) => !hiddenCrewIds.has(m.id));

  return (
    <div className="flex flex-col gap-2">

      {/* ── Crew filter strip — only when 2+ active members ── */}
      {!crewLoading && crew.length >= 2 && (
        <div
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
          style={{ background: 'white', border: `1px solid ${brand.border}` }}
        >
          <span className="text-[10px] font-bold uppercase tracking-widest shrink-0" style={{ color: brand.muted }}>
            Crew
          </span>
          <div className="flex items-center gap-1.5 flex-wrap flex-1">
            {crew.map((member) => {
              const hidden = hiddenCrewIds.has(member.id);
              const avail = member.availability?.length
                ? parseAvailabilityForDate(member.availability, date)
                : null;
              const offToday = member.availability?.length && !avail;
              return (
                <button
                  key={member.id}
                  onClick={() => toggleCrew(member.id)}
                  title={hidden ? `Show ${member.full_name}` : `Hide ${member.full_name}`}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all select-none"
                  style={hidden
                    ? { background: 'transparent', border: `1px solid ${brand.border}`, color: brand.muted, opacity: 0.45 }
                    : { background: brand.surfaceAlt, border: `1px solid ${brand.border}`, color: brand.text }
                  }
                >
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                    style={{ background: hidden ? '#94a3b8' : offToday ? '#94a3b8' : brand.primary }}
                  >
                    {member.full_name.charAt(0)}
                  </div>
                  <span>{member.full_name.split(' ')[0]}</span>
                  {offToday && !hidden && (
                    <span className="text-[9px] font-semibold" style={{ color: '#b45309' }}>off</span>
                  )}
                </button>
              );
            })}
          </div>
          {hiddenCrewIds.size > 0 && (
            <button
              onClick={() => setHiddenCrewIds(new Set())}
              className="shrink-0 text-[11px] font-semibold transition-opacity hover:opacity-70"
              style={{ color: brand.primary }}
            >
              Show all
            </button>
          )}
        </div>
      )}

    <div className="flex gap-2">
      {/* ── Timeline card ── */}
      <div
        className="flex-1 min-w-0 rounded-xl overflow-hidden"
        style={{ border: `1px solid ${brand.border}`, background: 'white' }}
      >
        {/* Placement instruction strip */}
        {selectedJob && (
          <div
            className="flex items-center gap-2.5 px-4 py-2 border-b text-xs font-medium"
            style={{
              borderColor: SERVICE_COLORS[selectedJob.service_type] || brand.primary,
              background: `${SERVICE_COLORS[selectedJob.service_type] || brand.primary}08`,
              color: SERVICE_COLORS[selectedJob.service_type] || brand.primary,
            }}
          >
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: SERVICE_COLORS[selectedJob.service_type] || brand.primary }} />
            <span className="font-semibold">{selectedJob.customer_name}</span>
            <span className="opacity-60">·</span>
            <span>{SERVICE_LABELS[selectedJob.service_type] || selectedJob.service_type}</span>
            <span className="opacity-50">— click a crew column to place</span>
            <button
              onClick={() => setSelectedJob(null)}
              className="ml-auto opacity-40 hover:opacity-80 transition-opacity"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-sm" style={{ color: brand.muted }}>
            <svg className="animate-spin mr-2 opacity-40" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-6-8.485"/></svg>
            Loading schedule…
          </div>
        ) : crew.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-center px-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-1" style={{ background: brand.surfaceAlt }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={brand.muted} strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            </div>
            <p className="text-sm font-semibold" style={{ color: brand.text }}>No active crew</p>
            <p className="text-xs" style={{ color: brand.muted }}>Add crew members in the Crew section to start scheduling.</p>
          </div>
        ) : (
          /* Timeline grid.
             IMPORTANT: horizontal scroll lives on the INNER wrapper, not the card.
             Putting overflow-x: auto on the card forces overflow-y: auto too
             (CSS quirk where a visible axis is computed as auto when the other
             axis isn't visible) — that captured the page's wheel events and broke
             vertical scrolling. The inner wrapper explicitly sets overflow-y: hidden
             so it never becomes a vertical scroll container. */
          <div
            className="overflow-x-auto"
            style={{ overflowY: 'hidden', overscrollBehaviorX: 'contain' }}
          >
            {/* min-w-full keeps the grid filling the card when crew count is low.
                Each crew column uses flex: '1 0 200px' so columns expand to fill
                available space; overflow-x-auto kicks in only when many columns
                force the content wider than the card. */}
            <div className="flex" style={{ minWidth: '100%' }}>
              {/* Time axis */}
              <div
                className="sticky left-0 z-10 border-r"
                style={{
                  borderColor: brand.border,
                  minWidth: 72,
                  background: 'white',
                }}
              >
                <div
                  className="h-12 border-b flex items-end pb-2.5 px-3"
                  style={{ borderColor: brand.border, background: brand.surfaceAlt }}
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: brand.muted }}>Time</span>
                </div>
                {/* overflow-hidden keeps labels from bleeding into the header above */}
                <div className="relative overflow-hidden" style={{ height: TIMELINE_HEIGHT }}>
                  {timeLabels.map(({ label, min }) => {
                    const raw = minutesToPx(min) - 8;
                    // First label: clamp to 2 so it sits at the top edge, not behind the header.
                    // Last label: clamp so the text doesn't get clipped by the container bottom.
                    const top = raw <= 0 ? 2 : Math.min(TIMELINE_HEIGHT - 14, raw);
                    return (
                      <div
                        key={min}
                        className="absolute left-0 right-0 flex items-start justify-end pr-3"
                        style={{ top }}
                      >
                        <span className="text-[11px] tabular-nums font-medium leading-none" style={{ color: brand.muted }}>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Crew columns — filtered by visibility toggle */}
              {visibleCrew.map((member) => {
                const memberOrders = orders.filter((o) => o.assigned_crew_id === member.id);
                const isClickable = !!selectedJob;
                const avail = member.availability?.length
                  ? parseAvailabilityForDate(member.availability, date)
                  : null;

                const beforeAvailPx = avail ? Math.max(0, minutesToPx(avail.startMin)) : 0;
                const afterAvailTop = avail ? minutesToPx(avail.endMin) : 0;
                const afterAvailHeight = avail ? TIMELINE_HEIGHT - afterAvailTop : 0;
                const wholeColumnUnavail = member.availability?.length && !avail;

                // Concise status for the header
                const headerStatus = (() => {
                  if (wholeColumnUnavail) return { text: 'Unavailable today', color: '#b45309' };
                  if (avail) return { text: formatAvailRange(avail), color: brand.muted };
                  return null;
                })();

                return (
                  <div key={member.id} className="flex flex-col border-r last:border-r-0" style={{ flex: '1 0 200px', borderColor: brand.border }}>
                    {/* Column header */}
                    <div
                      className="h-12 border-b flex items-center px-3 gap-2.5"
                      style={{ borderColor: brand.border, background: brand.surfaceAlt }}
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ background: wholeColumnUnavail ? '#94a3b8' : brand.primary }}
                      >
                        {member.full_name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-semibold truncate block leading-tight" style={{ color: brand.text }}>{member.full_name}</span>
                        {headerStatus && (
                          <span className="text-[10px] leading-tight" style={{ color: headerStatus.color }}>{headerStatus.text}</span>
                        )}
                      </div>
                      {!wholeColumnUnavail && (
                        <span
                          className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums"
                          style={memberOrders.length > 0
                            ? { background: `${brand.primary}15`, color: brand.primary }
                            : { background: 'rgba(0,0,0,0.04)', color: brand.muted }
                          }
                        >
                          {memberOrders.length}
                        </span>
                      )}
                    </div>

                    {/* Timeline column */}
                    <div
                      ref={(el) => { columnRefs.current[member.id] = el; }}
                      className="relative select-none"
                      style={{
                        height: TIMELINE_HEIGHT,
                        cursor: isClickable ? 'crosshair' : 'default',
                        background: isClickable ? `${brand.primary}05` : `${brand.bg}90`,
                      }}
                      onClick={(e) => handleColumnClick(e, member)}
                    >
                      {/* Hour grid lines */}
                      {timeLabels.map(({ min }) => (
                        <div
                          key={min}
                          className="absolute left-0 right-0 border-t"
                          style={{ top: minutesToPx(min), borderColor: `${brand.border}90` }}
                        />
                      ))}

                      {/* Half-hour dashed lines */}
                      {Array.from({ length: HOURS }, (_, i) => (
                        <div
                          key={i}
                          className="absolute left-0 right-0 border-t border-dashed"
                          style={{ top: minutesToPx((DAY_START + i) * 60 + 30), borderColor: `${brand.border}50` }}
                        />
                      ))}

                      {/* Unavailable overlay — before window */}
                      {avail && beforeAvailPx > 0 && (
                        <div
                          className="absolute left-0 right-0 z-[5] pointer-events-none"
                          style={{
                            top: 0,
                            height: beforeAvailPx,
                            background: 'repeating-linear-gradient(-45deg, #e2e8f025, #e2e8f025 3px, #f8fafc50 3px, #f8fafc50 10px)',
                          }}
                        />
                      )}

                      {/* Available window highlight */}
                      {avail && (
                        <div
                          className="absolute left-0 right-0 z-[4] pointer-events-none border-l-2"
                          style={{
                            top: minutesToPx(avail.startMin),
                            height: minutesToPx(avail.endMin) - minutesToPx(avail.startMin),
                            borderColor: `${brand.primary}35`,
                            background: `${brand.primary}04`,
                          }}
                        />
                      )}

                      {/* Unavailable overlay — after window */}
                      {avail && afterAvailHeight > 0 && (
                        <div
                          className="absolute left-0 right-0 z-[5] pointer-events-none"
                          style={{
                            top: afterAvailTop,
                            height: afterAvailHeight,
                            background: 'repeating-linear-gradient(-45deg, #e2e8f025, #e2e8f025 3px, #f8fafc50 3px, #f8fafc50 10px)',
                          }}
                        />
                      )}

                      {/* Whole-column unavailable */}
                      {wholeColumnUnavail && (
                        <div
                          className="absolute inset-0 z-[5] pointer-events-none flex items-center justify-center"
                          style={{
                            background: 'repeating-linear-gradient(-45deg, #e2e8f020, #e2e8f020 3px, #f8fafc40 3px, #f8fafc40 10px)',
                          }}
                        >
                          <span className="text-[10px] font-semibold text-slate-400 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-lg border border-slate-200/60">
                            Unavailable today
                          </span>
                        </div>
                      )}

                      {/* Job blocks */}
                      {memberOrders.map((order) => {
                        if (!order.scheduled_time) return null;
                        const startMin = timeToMinutes(order.scheduled_time);
                        const duration = order.estimated_duration_minutes || 120;
                        const top = minutesToPx(startMin);
                        const height = Math.max((duration / 60) * PX_PER_HOUR, 24);
                        const travelHeight = (TRAVEL_MIN / 60) * PX_PER_HOUR;
                        const color = SERVICE_COLORS[order.service_type] || '#6B7280';

                        return (
                          <div key={order.id}>
                            <button
                              type="button"
                              onClick={(e) => handleJobBlockClick(e, order, member)}
                              disabled={isMutating === order.id}
                              className="absolute left-1 right-1 rounded-lg text-left overflow-hidden hover:brightness-95 transition-all z-10"
                              style={{ top, height, background: `${color}16`, border: `1px solid ${color}45` }}
                            >
                              <div className="p-1.5 h-full flex flex-col justify-between" style={{ borderLeft: `2.5px solid ${color}` }}>
                                <div>
                                  <p className="text-[10px] font-bold truncate leading-tight" style={{ color }}>
                                    {SERVICE_LABELS[order.service_type] || order.service_type}
                                  </p>
                                  {height > 38 && (
                                    <p className="text-[10px] truncate leading-tight" style={{ color: brand.text }}>{order.customer_name}</p>
                                  )}
                                </div>
                                {height > 54 && (
                                  <p className="text-[9px] tabular-nums" style={{ color: brand.muted }}>
                                    {formatDisplayTime(order.scheduled_time)} · {duration}m
                                  </p>
                                )}
                              </div>
                            </button>
                            {/* Travel buffer */}
                            <div
                              className="absolute left-1 right-1 z-[8] rounded-b overflow-hidden pointer-events-none"
                              style={{
                                top: top + height,
                                height: travelHeight,
                                background: 'repeating-linear-gradient(-45deg, #94a3b818, #94a3b818 2px, transparent 2px, transparent 6px)',
                                borderLeft: '2px dashed #94a3b835',
                              }}
                            />
                          </div>
                        );
                      })}

                      {/* "Now" line — only on today */}
                      {date === today && (() => {
                        const now = new Date();
                        const nowMin = now.getHours() * 60 + now.getMinutes();
                        if (nowMin < DAY_START * 60 || nowMin > DAY_END * 60) return null;
                        const nowTop = minutesToPx(nowMin);
                        return (
                          <div
                            className="absolute left-0 right-0 z-[15] pointer-events-none"
                            style={{ top: nowTop }}
                            aria-hidden
                          >
                            <div className="absolute -left-1 -top-1.5 w-3 h-3 rounded-full" style={{ background: '#ef4444', boxShadow: '0 0 0 2px white' }} />
                            <div className="border-t" style={{ borderColor: '#ef4444', borderTopWidth: 1.5 }} />
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Queue panel ── */}
      <div
        className="w-64 shrink-0 flex flex-col rounded-r-xl overflow-hidden"
        style={{
          borderTop: `1px solid ${brand.border}`,
          borderRight: `1px solid ${brand.border}`,
          borderBottom: `1px solid ${brand.border}`,
          borderLeft: `1px solid ${brand.border}`,
          marginLeft: 8,
          background: 'white',
          // Match timeline height
          minHeight: TIMELINE_HEIGHT + (selectedJob ? 88 : 48) + 2,
        }}
      >
        {/* Queue header */}
        <div
          className="px-3.5 py-2.5 border-b flex items-center justify-between shrink-0"
          style={{ borderColor: brand.border, background: brand.surfaceAlt }}
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: brand.muted }}>Queue</span>
            {unscheduled.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: `${brand.primary}15`, color: brand.primary }}>
                {unscheduled.length}
              </span>
            )}
          </div>
          {selectedJob && (
            <span className="text-[10px] font-medium" style={{ color: brand.muted }}>click a column →</span>
          )}
        </div>

        {/* Queue instruction */}
        {!selectedJob && unscheduled.length > 0 && (
          <div className="px-3.5 py-2 border-b" style={{ borderColor: brand.border }}>
            <p className="text-[10px]" style={{ color: brand.muted }}>Select a job, then click a crew slot to schedule it.</p>
          </div>
        )}

        {/* Queue jobs */}
        <div className="flex-1 overflow-y-auto">
          {ordersLoading ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-lg animate-pulse" style={{ background: brand.surfaceAlt }} />
              ))}
            </div>
          ) : unscheduled.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 px-4 text-center">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: brand.surfaceAlt }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={brand.muted} strokeWidth="1.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <p className="text-xs font-medium" style={{ color: brand.muted }}>All caught up</p>
              <p className="text-[10px]" style={{ color: `${brand.muted}80` }}>No unscheduled jobs</p>
            </div>
          ) : (
            <div className="p-2 space-y-1.5">
              {unscheduled.map((job) => {
                const color = SERVICE_COLORS[job.service_type] || '#6B7280';
                const isSelected = selectedJob?.id === job.id;
                const durationH = (job.estimated_duration_minutes || DEFAULT_DURATIONS[job.service_type] || 120) / 60;
                return (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => setSelectedJob(isSelected ? null : job)}
                    className="w-full text-left rounded-lg px-2.5 py-2 transition-all"
                    style={isSelected
                      ? { background: `${color}12`, border: `1.5px solid ${color}55` }
                      : { background: brand.bg, border: `1px solid ${brand.border}` }
                    }
                  >
                    <div className="flex items-start justify-between gap-1.5 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-0.5" style={{ background: color }} />
                        <span className="text-[10px] font-bold uppercase tracking-wide truncate" style={{ color }}>
                          {SERVICE_LABELS[job.service_type] || job.service_type}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold shrink-0 tabular-nums" style={{ color: brand.text }}>
                        ${job.final_price.toFixed(0)}
                      </span>
                    </div>
                    <p className="text-xs font-medium truncate leading-tight" style={{ color: brand.text }}>{job.customer_name}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: brand.muted }}>~{durationH}h est.</p>
                    {isSelected && (
                      <p className="text-[10px] mt-1.5 font-semibold" style={{ color }}>
                        ↑ Click a crew column to place
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Assignment / Edit modal ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.3)' }}>
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6"
            style={{ border: `1px solid ${brand.border}`, boxShadow: '0 20px 60px rgba(2,6,23,0.16)' }}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold" style={{ color: brand.text }}>
                  {modal.mode === 'assign' ? 'Assign Job' : 'Edit Assignment'}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: brand.muted }}>
                  {modal.order.customer_name} · {SERVICE_LABELS[modal.order.service_type] || modal.order.service_type}
                </p>
              </div>
              <button onClick={() => setModal(null)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" style={{ color: brand.muted }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="space-y-3 mb-5">
              {/* Crew */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: brand.muted }}>Crew Member</label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium" style={{ borderColor: brand.border, color: brand.text }}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ background: brand.primary }}>
                    {modal.crewName.charAt(0)}
                  </div>
                  <span>{modal.crewName}</span>
                  {modal.crewAvail && (
                    <span className="ml-auto text-[10px]" style={{ color: brand.muted }}>
                      {formatAvailRange(modal.crewAvail)}
                    </span>
                  )}
                  {modal.crewAvail === null && (() => {
                    const member = crew.find(c => c.id === modal.crewId);
                    return member?.availability?.length ? (
                      <span className="ml-auto text-[10px] text-amber-600">Unavailable today</span>
                    ) : null;
                  })()}
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: brand.muted }}>Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => onDateChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-xs outline-none"
                  style={{ borderColor: brand.border, color: brand.text }}
                />
              </div>

              {/* Time */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: brand.muted }}>Start Time</label>
                <input
                  type="time"
                  min={modal.crewAvail ? minutesToTime(modal.crewAvail.startMin) : '07:00'}
                  max={modal.crewAvail ? minutesToTime(modal.crewAvail.endMin) : '17:00'}
                  step={30 * 60}
                  value={modal.time}
                  onChange={(e) => setModal((m) => m ? { ...m, time: e.target.value } : null)}
                  className="w-full px-3 py-2 rounded-lg border text-xs outline-none"
                  style={{ borderColor: brand.border, color: brand.text }}
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: brand.muted }}>Duration (minutes)</label>
                <input
                  type="number"
                  min={30}
                  max={600}
                  step={30}
                  value={modal.duration}
                  onChange={(e) => setModal((m) => m ? { ...m, duration: parseInt(e.target.value) || 120 } : null)}
                  className="w-full px-3 py-2 rounded-lg border text-xs outline-none"
                  style={{ borderColor: brand.border, color: brand.text }}
                />
                <p className="text-[10px] mt-1" style={{ color: brand.muted }}>
                  Ends {formatDisplayTime(minutesToTime(timeToMinutes(modal.time) + modal.duration))}
                  {' · '}Next slot free at {formatDisplayTime(minutesToTime(timeToMinutes(modal.time) + modal.duration + TRAVEL_MIN))}
                </p>
              </div>

              {/* Availability violation */}
              {isAvailViolation && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                  <svg className="shrink-0 mt-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <p className="text-[11px] font-medium text-amber-800">
                    Outside availability — {modal.crewName} is only available{' '}
                    {modal.crewAvail ? formatAvailRange(modal.crewAvail) : 'not available today'}.
                  </p>
                </div>
              )}

              {/* Conflict warning */}
              {isConflict && !isAvailViolation && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg" style={{ background: '#fff5f5', border: '1px solid #fecaca' }}>
                  <svg className="shrink-0 mt-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <p className="text-[11px] font-medium text-red-700">
                    Double booking — overlaps an existing job or travel buffer.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {modal.mode === 'edit' && (
                <button
                  type="button"
                  disabled={isMutating === modal.order.id}
                  onClick={() => void unscheduleJob(modal.order.id)}
                  className="flex-1 py-2 rounded-xl border text-xs font-semibold transition-colors hover:bg-red-50 disabled:opacity-50"
                  style={{ borderColor: '#fca5a5', color: '#dc2626' }}
                >
                  Unschedule
                </button>
              )}
              <button
                type="button"
                onClick={() => setModal(null)}
                className="flex-1 py-2 rounded-xl border text-xs font-semibold transition-colors hover:bg-slate-50"
                style={{ borderColor: brand.border, color: brand.muted }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isAvailViolation || isConflict || isMutating === modal.order.id}
                onClick={() => void applyAssignment({
                  orderId: modal.order.id,
                  scheduledDate: date,
                  scheduledTime: modal.time,
                  estimatedDuration: modal.duration,
                  crewId: modal.crewId,
                })}
                className="flex-1 py-2 rounded-xl text-xs font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: (isAvailViolation || isConflict) ? '#9ca3af' : brand.primary }}
              >
                {isMutating === modal.order.id ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
