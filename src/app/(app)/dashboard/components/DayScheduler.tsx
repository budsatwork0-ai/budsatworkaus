'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { brand, glass } from '@/app/ui/theme';

// Timeline: 7am – 5pm
const DAY_START = 7;
const DAY_END = 17;
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

// Availability format: "mon:09:00-15:00"
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
  return `${formatDisplayTime(minutesToTime(range.startMin))} – ${formatDisplayTime(minutesToTime(range.endMin))}`;
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

export default function DayScheduler() {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [orders, setOrders] = useState<DayOrder[]>([]);
  const [unscheduled, setUnscheduled] = useState<DayOrder[]>([]);
  const [selectedJob, setSelectedJob] = useState<DayOrder | null>(null);
  const [modal, setModal] = useState<AssignModal | null>(null);
  const [isMutating, setIsMutating] = useState<string | null>(null);
  const [crewLoading, setCrewLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
      toast.success('Job moved back to unscheduled');
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
      toast.error(
        `${member.full_name} is only available ${formatAvailRange(avail)} on this day.`
      );
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

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

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

  return (
    <div className="flex flex-col gap-5">
      {/* Date picker header */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const d = new Date(date + 'T12:00:00');
              d.setDate(d.getDate() - 1);
              setDate(d.toISOString().split('T')[0]);
            }}
            className="p-1.5 rounded-lg border hover:bg-slate-50 transition-colors"
            style={{ borderColor: brand.border }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-sm font-medium rounded-lg border px-3 py-1.5 outline-none"
            style={{ borderColor: brand.border, color: brand.text }}
          />
          <button
            onClick={() => {
              const d = new Date(date + 'T12:00:00');
              d.setDate(d.getDate() + 1);
              setDate(d.toISOString().split('T')[0]);
            }}
            className="p-1.5 rounded-lg border hover:bg-slate-50 transition-colors"
            style={{ borderColor: brand.border }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
          <button
            onClick={() => setDate(today)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={date === today ? { background: brand.primary, color: 'white' } : { border: `1px solid ${brand.border}`, color: brand.muted }}
          >
            Today
          </button>
          <span className="text-sm font-medium hidden sm:block" style={{ color: brand.text }}>{dateLabel}</span>
        </div>

        {selectedJob && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium animate-pulse"
            style={{ borderColor: SERVICE_COLORS[selectedJob.service_type] || brand.primary, color: SERVICE_COLORS[selectedJob.service_type] || brand.primary, background: `${SERVICE_COLORS[selectedJob.service_type] || brand.primary}10` }}
          >
            <div className="w-2 h-2 rounded-full" style={{ background: SERVICE_COLORS[selectedJob.service_type] || brand.primary }} />
            {selectedJob.customer_name} — {SERVICE_LABELS[selectedJob.service_type] || selectedJob.service_type}
            <span className="text-xs opacity-70">· click an available crew slot to place</span>
            <button onClick={() => setSelectedJob(null)} className="ml-1 opacity-60 hover:opacity-100">✕</button>
          </div>
        )}
      </div>

      {/* Timeline grid */}
      <div className={`${glass} overflow-x-auto`}>
        {crewLoading || ordersLoading ? (
          <div className="flex items-center justify-center h-48 text-sm" style={{ color: brand.muted }}>
            Loading schedule…
          </div>
        ) : crew.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <p className="text-sm font-medium" style={{ color: brand.muted }}>No active crew members found.</p>
            <p className="text-xs" style={{ color: brand.muted }}>Add crew from the Crew section to start scheduling.</p>
          </div>
        ) : (
          <div className="flex min-w-max">
            {/* Time axis */}
            <div className="sticky left-0 z-10 bg-white/90 backdrop-blur-sm border-r" style={{ borderColor: brand.border }}>
              <div className="h-12 border-b flex items-center px-3" style={{ borderColor: brand.border }}>
                <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: brand.muted }}>Time</span>
              </div>
              <div className="relative" style={{ height: TIMELINE_HEIGHT }}>
                {timeLabels.map(({ label, min }) => (
                  <div
                    key={min}
                    className="absolute left-0 right-0 flex items-start px-3"
                    style={{ top: minutesToPx(min) - 8 }}
                  >
                    <span className="text-[10px] font-medium" style={{ color: brand.muted }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Crew columns */}
            {crew.map((member) => {
              const memberOrders = orders.filter((o) => o.assigned_crew_id === member.id);
              const isClickable = !!selectedJob;
              const avail = member.availability?.length
                ? parseAvailabilityForDate(member.availability, date)
                : null;

              // Unavailable zone heights
              const beforeAvailPx = avail ? Math.max(0, minutesToPx(avail.startMin)) : 0;
              const afterAvailTop = avail ? minutesToPx(avail.endMin) : 0;
              const afterAvailHeight = avail ? TIMELINE_HEIGHT - afterAvailTop : 0;
              const wholeColumnUnavail = member.availability?.length && !avail;

              return (
                <div key={member.id} className="flex flex-col border-r last:border-r-0" style={{ minWidth: 180, borderColor: brand.border }}>
                  {/* Column header */}
                  <div className="h-12 border-b flex items-center px-3 gap-2 bg-white/50" style={{ borderColor: brand.border }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ background: brand.primary }}>
                      {member.full_name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold truncate block" style={{ color: brand.text }}>{member.full_name}</span>
                      {avail && (
                        <span className="text-[9px]" style={{ color: brand.muted }}>
                          {formatAvailRange(avail)}
                        </span>
                      )}
                      {wholeColumnUnavail && (
                        <span className="text-[9px] text-amber-600">Off today</span>
                      )}
                    </div>
                    <span className="ml-auto text-[10px] shrink-0" style={{ color: brand.muted }}>
                      {memberOrders.length} job{memberOrders.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Timeline column */}
                  <div
                    ref={(el) => { columnRefs.current[member.id] = el; }}
                    className="relative select-none"
                    style={{
                      height: TIMELINE_HEIGHT,
                      cursor: isClickable ? 'crosshair' : 'default',
                      background: isClickable ? `${brand.primary}04` : undefined,
                    }}
                    onClick={(e) => handleColumnClick(e, member)}
                  >
                    {/* Hour grid lines */}
                    {timeLabels.map(({ min }) => (
                      <div
                        key={min}
                        className="absolute left-0 right-0 border-t"
                        style={{ top: minutesToPx(min), borderColor: `${brand.border}80` }}
                      />
                    ))}

                    {/* Half-hour dashed lines */}
                    {Array.from({ length: HOURS }, (_, i) => (
                      <div
                        key={i}
                        className="absolute left-0 right-0 border-t border-dashed"
                        style={{ top: minutesToPx((DAY_START + i) * 60 + 30), borderColor: `${brand.border}40` }}
                      />
                    ))}

                    {/* Unavailable overlay — before availability window */}
                    {avail && beforeAvailPx > 0 && (
                      <div
                        className="absolute left-0 right-0 z-[5] pointer-events-none"
                        style={{
                          top: 0,
                          height: beforeAvailPx,
                          background: 'repeating-linear-gradient(-45deg, #e2e8f030, #e2e8f030 3px, #f1f5f940 3px, #f1f5f940 8px)',
                        }}
                      >
                        <span className="absolute bottom-1 left-2 text-[9px] font-medium text-slate-400">Unavailable</span>
                      </div>
                    )}

                    {/* Available window highlight */}
                    {avail && (
                      <div
                        className="absolute left-0 right-0 z-[4] pointer-events-none border-l-2"
                        style={{
                          top: minutesToPx(avail.startMin),
                          height: minutesToPx(avail.endMin) - minutesToPx(avail.startMin),
                          borderColor: `${brand.primary}40`,
                          background: `${brand.primary}06`,
                        }}
                      />
                    )}

                    {/* Unavailable overlay — after availability window */}
                    {avail && afterAvailHeight > 0 && (
                      <div
                        className="absolute left-0 right-0 z-[5] pointer-events-none"
                        style={{
                          top: afterAvailTop,
                          height: afterAvailHeight,
                          background: 'repeating-linear-gradient(-45deg, #e2e8f030, #e2e8f030 3px, #f1f5f940 3px, #f1f5f940 8px)',
                        }}
                      >
                        <span className="absolute top-1 left-2 text-[9px] font-medium text-slate-400">Unavailable</span>
                      </div>
                    )}

                    {/* Whole column unavailable (has availability set, but not this day) */}
                    {wholeColumnUnavail && (
                      <div
                        className="absolute inset-0 z-[5] pointer-events-none flex items-center justify-center"
                        style={{
                          background: 'repeating-linear-gradient(-45deg, #e2e8f030, #e2e8f030 3px, #f1f5f940 3px, #f1f5f940 8px)',
                        }}
                      >
                        <span className="text-xs font-medium text-slate-400 bg-white/80 px-2 py-1 rounded">Off today</span>
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
                            className="absolute left-1 right-1 rounded-lg text-left overflow-hidden shadow-sm hover:shadow-md transition-shadow z-10"
                            style={{ top, height, background: `${color}18`, border: `1.5px solid ${color}60` }}
                          >
                            <div className="p-1.5 h-full flex flex-col justify-between" style={{ borderLeft: `3px solid ${color}` }}>
                              <div>
                                <p className="text-[10px] font-semibold truncate leading-tight" style={{ color }}>
                                  {SERVICE_LABELS[order.service_type] || order.service_type}
                                </p>
                                {height > 40 && (
                                  <p className="text-[10px] truncate leading-tight text-slate-600">{order.customer_name}</p>
                                )}
                              </div>
                              {height > 56 && (
                                <p className="text-[9px] text-slate-400 leading-tight">
                                  {formatDisplayTime(order.scheduled_time)} · {duration}m
                                </p>
                              )}
                            </div>
                          </button>
                          <div
                            className="absolute left-1 right-1 z-10 rounded-b overflow-hidden"
                            style={{
                              top: top + height,
                              height: travelHeight,
                              background: 'repeating-linear-gradient(-45deg, #94a3b820, #94a3b820 2px, transparent 2px, transparent 6px)',
                              borderLeft: '2px dashed #94a3b840',
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Unscheduled jobs panel */}
      {unscheduled.length > 0 && (
        <div className={`${glass} p-5`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold" style={{ color: brand.text }}>
              Unscheduled Jobs ({unscheduled.length})
            </h2>
            <p className="text-xs" style={{ color: brand.muted }}>Select a job, then click within a crew member's available hours</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {unscheduled.map((job) => {
              const color = SERVICE_COLORS[job.service_type] || '#6B7280';
              const isSelected = selectedJob?.id === job.id;
              return (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => setSelectedJob(isSelected ? null : job)}
                  className="rounded-xl border p-3 text-left transition-all"
                  style={isSelected
                    ? { borderColor: color, background: `${color}15`, borderWidth: 2 }
                    : { borderColor: brand.border, background: 'white' }
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium inline-block mb-1"
                        style={{ background: `${color}15`, color }}
                      >
                        {SERVICE_LABELS[job.service_type] || job.service_type}
                      </span>
                      <p className="text-sm font-medium truncate" style={{ color: brand.text }}>{job.customer_name}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: brand.muted }}>
                        ~{(job.estimated_duration_minutes || DEFAULT_DURATIONS[job.service_type] || 120) / 60}h est.
                      </p>
                    </div>
                    <p className="text-sm font-semibold shrink-0" style={{ color: brand.text }}>
                      ${job.final_price.toFixed(0)}
                    </p>
                  </div>
                  {isSelected && (
                    <p className="text-[10px] mt-2 font-medium" style={{ color }}>
                      ↑ Now click within a crew member's available hours
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {unscheduled.length === 0 && !ordersLoading && (
        <div className={`${glass} p-5 text-center`}>
          <p className="text-sm" style={{ color: brand.muted }}>All jobs are scheduled — nothing in the queue.</p>
        </div>
      )}

      {/* Assignment / Edit modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.35)' }}>
          <div className={`${glass} w-full max-w-sm p-6 rounded-2xl`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold" style={{ color: brand.text }}>
                  {modal.mode === 'assign' ? 'Assign Job' : 'Edit Assignment'}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: brand.muted }}>
                  {modal.order.customer_name} · {SERVICE_LABELS[modal.order.service_type] || modal.order.service_type}
                </p>
              </div>
              <button onClick={() => setModal(null)} className="p-1 rounded-lg hover:bg-slate-100">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="space-y-3 mb-5">
              {/* Crew (read-only in this flow) */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: brand.muted }}>Crew Member</label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium" style={{ borderColor: brand.border, color: brand.text }}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: brand.primary }}>
                    {modal.crewName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <span>{modal.crewName}</span>
                    {modal.crewAvail && (
                      <span className="ml-2 text-[10px] font-normal" style={{ color: brand.muted }}>
                        Available {formatAvailRange(modal.crewAvail)}
                      </span>
                    )}
                    {modal.crewAvail === null && (() => {
                      const member = crew.find(c => c.id === modal.crewId);
                      return member?.availability?.length ? (
                        <span className="ml-2 text-[10px] font-normal text-amber-600">Off today</span>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: brand.muted }}>Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                  style={{ borderColor: brand.border, color: brand.text }}
                />
              </div>

              {/* Time */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: brand.muted }}>Start Time</label>
                <input
                  type="time"
                  min={modal.crewAvail ? minutesToTime(modal.crewAvail.startMin) : '07:00'}
                  max={modal.crewAvail ? minutesToTime(modal.crewAvail.endMin) : '17:00'}
                  step={30 * 60}
                  value={modal.time}
                  onChange={(e) => setModal((m) => m ? { ...m, time: e.target.value } : null)}
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                  style={{ borderColor: brand.border, color: brand.text }}
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: brand.muted }}>
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  min={30}
                  max={600}
                  step={30}
                  value={modal.duration}
                  onChange={(e) => setModal((m) => m ? { ...m, duration: parseInt(e.target.value) || 120 } : null)}
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                  style={{ borderColor: brand.border, color: brand.text }}
                />
                <p className="text-[10px] mt-0.5" style={{ color: brand.muted }}>
                  Finishes ~{formatDisplayTime(minutesToTime(timeToMinutes(modal.time) + modal.duration))}
                  {' · '}Next slot {formatDisplayTime(minutesToTime(timeToMinutes(modal.time) + modal.duration + TRAVEL_MIN))} (after 30m travel)
                </p>
              </div>

              {/* Availability violation — hard block */}
              {isAvailViolation && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
                  <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <p className="text-xs font-medium text-amber-800">
                    Outside availability — {modal.crewName} is only available{' '}
                    {modal.crewAvail ? formatAvailRange(modal.crewAvail) : 'not available today'}.
                    You cannot assign work outside their set hours.
                  </p>
                </div>
              )}

              {/* Conflict warning */}
              {isConflict && !isAvailViolation && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200">
                  <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <p className="text-xs font-medium text-red-700">
                    Double booking — this overlaps an existing job or travel buffer for {modal.crewName}. Adjust the time or choose a different crew member.
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
                  className="flex-1 py-2 rounded-xl border text-sm font-medium transition-colors hover:bg-red-50 disabled:opacity-50"
                  style={{ borderColor: '#fca5a5', color: '#dc2626' }}
                >
                  Unschedule
                </button>
              )}
              <button
                type="button"
                onClick={() => setModal(null)}
                className="flex-1 py-2 rounded-xl border text-sm font-medium transition-colors hover:bg-slate-50"
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
                className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: (isAvailViolation || isConflict) ? '#9ca3af' : brand.primary }}
              >
                {isMutating === modal.order.id ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
