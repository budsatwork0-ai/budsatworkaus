'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { dashboardTheme } from '@/lib/design-system/themes';
import { formatCurrency } from '@/lib/dashboard/utils';
import OrderInvoice from './shared/OrderInvoice';

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Windows',
  cleaning: 'Cleaning',
  yard: 'Yard care',
  dump: 'Dump run',
  auto: 'Auto detailing',
  laundry_sneakers: 'Laundry',
};

type MobileOrder = {
  id: string;
  customer_name: string;
  service_type: string;
  scheduled_time: string | null;
  estimated_duration_minutes: number | null;
  assigned_crew_id: string | null;
  final_price: number;
};

type Crew = { id: string; name?: string; full_name?: string; first_name?: string; status?: string };

function crewName(c: Crew) {
  return c.name || c.full_name || c.first_name || 'Crew';
}

function formatTime(t: string | null) {
  if (!t) return 'No time';
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}${suffix}`;
}

/** Simple phone layout for the Jobs page: the day's jobs as cards, plus the unscheduled queue. */
export default function MobileDaySchedule({ date }: { date: string }) {
  const [orders, setOrders] = useState<MobileOrder[]>([]);
  const [queue, setQueue] = useState<MobileOrder[]>([]);
  const [crew, setCrew] = useState<Crew[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<string | null>(null);
  const [bookCrew, setBookCrew] = useState('');
  const [bookTime, setBookTime] = useState('09:00');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/crew/employees')
      .then((r) => r.json())
      .then((data) => setCrew((data.employees || []).filter((e: Crew) => e.status === 'active')))
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/orders?date_from=${date}&date_to=${date}&limit=200`).then((r) => r.json()),
      fetch(`/api/orders?unscheduled=true&limit=200`).then((r) => r.json()),
    ])
      .then(([day, unsch]) => {
        const dayOrders: MobileOrder[] = (day.orders || []).filter((o: { status?: string }) => o.status !== 'cancelled');
        dayOrders.sort((a, b) => (a.scheduled_time || '99').localeCompare(b.scheduled_time || '99'));
        setOrders(dayOrders);
        setQueue(unsch.orders || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => { load(); }, [load]);

  async function book(order: MobileOrder) {
    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduled_date: date,
          scheduled_time: bookTime,
          estimated_duration_minutes: order.estimated_duration_minutes || 120,
          assigned_crew_id: bookCrew || null,
          status: 'scheduled',
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to book job');
      }
      toast.success('Job booked');
      setBooking(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to book job');
    } finally {
      setSaving(false);
    }
  }

  const crewById = new Map(crew.map((c) => [c.id, crewName(c)]));
  const card = { background: 'white', border: `1px solid ${dashboardTheme.color.border}` };

  const renderCard = (o: MobileOrder, queued: boolean) => (
    <div key={o.id} className="rounded-xl p-3.5" style={card}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold" style={{ color: dashboardTheme.color.muted }}>
            {queued ? 'Not booked' : formatTime(o.scheduled_time)}
            {!queued && o.assigned_crew_id && crewById.get(o.assigned_crew_id) ? ` · ${crewById.get(o.assigned_crew_id)}` : ''}
          </p>
          <p className="text-base font-semibold truncate" style={{ color: dashboardTheme.color.text }}>{o.customer_name}</p>
          <p className="text-sm" style={{ color: dashboardTheme.color.muted }}>{SERVICE_LABELS[o.service_type] || o.service_type}</p>
        </div>
        <p className="text-base font-semibold tabular-nums shrink-0" style={{ color: dashboardTheme.color.text }}>{formatCurrency(o.final_price)}</p>
      </div>

      {queued && (booking === o.id ? (
        <div className="mt-3 space-y-2">
          <select value={bookCrew} onChange={(e) => setBookCrew(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: dashboardTheme.color.border }}>
            <option value="">No crew</option>
            {crew.map((c) => <option key={c.id} value={c.id}>{crewName(c)}</option>)}
          </select>
          <input type="time" value={bookTime} onChange={(e) => setBookTime(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: dashboardTheme.color.border }} />
          <div className="flex gap-2">
            <button type="button" onClick={() => setBooking(null)} className="flex-1 rounded-lg border py-2 text-sm font-semibold" style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.muted }}>Cancel</button>
            <button type="button" disabled={saving} onClick={() => void book(o)} className="flex-1 rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: dashboardTheme.color.primary }}>
              {saving ? 'Booking…' : 'Book for this day'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => { setBooking(o.id); setBookCrew(crew[0]?.id || ''); setBookTime('09:00'); }} className="mt-3 w-full rounded-lg border py-2 text-sm font-semibold" style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.primary }}>
          Book for this day
        </button>
      ))}

      <div className="mt-3"><OrderInvoice orderId={o.id} /></div>
    </div>
  );

  if (loading) {
    return <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: dashboardTheme.color.surfaceAlt }} />)}</div>;
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        {orders.length === 0 ? (
          <p className="rounded-xl p-4 text-sm text-center" style={{ ...card, color: dashboardTheme.color.muted }}>No jobs booked this day</p>
        ) : orders.map((o) => renderCard(o, false))}
      </section>
      {queue.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: dashboardTheme.color.muted }}>Queue · {queue.length}</p>
          {queue.map((o) => renderCard(o, true))}
        </section>
      )}
    </div>
  );
}
