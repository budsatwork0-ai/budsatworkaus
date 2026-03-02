'use client';

import { useEffect, useState } from 'react';
import { brand } from '@/app/ui/theme';

const glass = 'bg-white/80 backdrop-blur-2xl border shadow-[0_10px_30px_rgba(2,6,23,0.08)]';

type OrderRow = {
  id: string;
  customer_name: string;
  service_type: string;
  status: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  completed_at: string | null;
};

type Stage = {
  key: string;
  label: string;
  color: string;
  statuses: string[];
  todayOnly?: boolean;
};

const STAGES: Stage[] = [
  { key: 'queued',      label: 'Queued',      color: '#8b5cf6', statuses: ['pending', 'confirmed'] },
  { key: 'scheduled',   label: 'Scheduled',   color: '#3b82f6', statuses: ['scheduled'] },
  { key: 'in_progress', label: 'In Progress', color: '#f59e0b', statuses: ['in_progress'] },
  { key: 'done',        label: 'Done Today',  color: '#22c55e', statuses: ['completed'], todayOnly: true },
];

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Window cleaning',
  cleaning: 'Cleaning',
  yard: 'Yard care',
  dump: 'Dump run',
  auto: 'Auto detailing',
  laundry_sneakers: 'Laundry / Sneakers',
};

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function shortId(id: string): string {
  return `J-${id.slice(0, 4).toUpperCase()}`;
}

function Skeleton() {
  return (
    <div className={`${glass} rounded-xl p-3 animate-pulse`} style={{ borderColor: brand.border, background: brand.card }}>
      <div className="h-3 w-16 bg-slate-200 rounded mb-2" />
      <div className="h-4 w-24 bg-slate-100 rounded mb-1" />
      <div className="h-3 w-20 bg-slate-100 rounded" />
    </div>
  );
}

export default function PipelinesPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/orders?limit=200');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setOrders(data.orders || []);
      } catch (err) {
        console.error(err);
        setError('Failed to load orders.');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  function getStageOrders(stage: Stage): OrderRow[] {
    return orders.filter(o => {
      if (!stage.statuses.includes(o.status)) return false;
      if (stage.todayOnly) return isToday(o.completed_at);
      return true;
    });
  }

  const completedToday = orders.filter(o => o.status === 'completed' && isToday(o.completed_at)).length;
  const activeJobs = orders.filter(o => !['completed', 'cancelled'].includes(o.status)).length;

  return (
    <div className="min-h-screen" style={{ background: brand.bg }}>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold" style={{ color: brand.primary }}>Workflows</h1>
        <p className="text-sm mt-1" style={{ color: brand.muted }}>
          Job pipelines from scheduling through to completion.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6">
        {[
          { label: 'Total jobs', value: isLoading ? '—' : String(orders.filter(o => o.status !== 'cancelled').length), color: brand.text },
          { label: 'Active', value: isLoading ? '—' : String(activeJobs), color: brand.primary },
          { label: 'Completed today', value: isLoading ? '—' : String(completedToday), color: '#22c55e' },
          { label: 'Stages', value: String(STAGES.length), color: brand.muted },
        ].map(s => (
          <div key={s.label} className={`${glass} rounded-2xl p-3`} style={{ borderColor: brand.border, background: brand.card }}>
            <div className="text-[11px] uppercase tracking-wide" style={{ color: brand.muted }}>{s.label}</div>
            <div className="text-xl font-semibold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl p-4 bg-red-50 border border-red-100 text-sm text-red-700">{error}</div>
      )}

      {/* Kanban board */}
      <div className="overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex gap-3 min-w-[800px]">
          {STAGES.map(stage => {
            const stageOrders = getStageOrders(stage);
            return (
              <div key={stage.key} className="flex-1 min-w-[180px]">
                <div className="flex items-center gap-2 mb-2.5 px-1">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                  <div className="text-xs font-semibold" style={{ color: brand.text }}>{stage.label}</div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{isLoading ? '…' : stageOrders.length}</span>
                </div>

                <div className="space-y-2">
                  {isLoading
                    ? [1, 2].map(i => <Skeleton key={i} />)
                    : stageOrders.length === 0
                      ? (
                        <div className="rounded-xl border border-dashed p-4 text-center" style={{ borderColor: brand.border }}>
                          <div className="text-xs" style={{ color: brand.muted }}>No jobs</div>
                        </div>
                      )
                      : stageOrders.map(order => (
                        <div
                          key={order.id}
                          className={`${glass} rounded-xl p-3`}
                          style={{ borderColor: brand.border, background: brand.card, borderLeftWidth: 3, borderLeftColor: stage.color }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-medium" style={{ color: brand.muted }}>{shortId(order.id)}</span>
                            <span className="text-[10px]" style={{ color: brand.muted }}>
                              {order.scheduled_time || order.scheduled_date || '—'}
                            </span>
                          </div>
                          <div className="text-sm font-medium" style={{ color: brand.text }}>{order.customer_name}</div>
                          <div className="text-[11px]" style={{ color: brand.muted }}>
                            {SERVICE_LABELS[order.service_type] || order.service_type}
                          </div>
                        </div>
                      ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
