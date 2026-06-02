'use client';

import { useEffect, useState } from 'react';
import { crewTheme } from '@/lib/design-system/themes';

const glass = `${crewTheme.glass} rounded-2xl`;

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Window Cleaning', cleaning: 'Home Cleaning', yard: 'Yard Care',
  dump: 'Dump Run', auto: 'Auto Detailing', laundry_sneakers: 'Laundry & Sneakers',
};

type EarningsData = {
  thisWeek: number;
  thisFortnight: number;
  thisMonth: number;
  allTime: number;
  jobs: Array<{
    id: string;
    serviceType: string;
    customerName: string;
    amount: number;
    completedAt: string | null;
  }>;
};

export default function EarningsPage() {
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/crew/earnings')
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Build daily earnings for last 7 days bar chart
  const dailyEarnings: { day: string; amount: number }[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayLabel = date.toLocaleDateString('en-AU', { weekday: 'short' });
    const amount = (data?.jobs || [])
      .filter((j) => j.completedAt && j.completedAt.startsWith(dateStr))
      .reduce((sum, j) => sum + j.amount, 0);
    dailyEarnings.push({ day: dayLabel, amount });
  }
  const maxDaily = Math.max(...dailyEarnings.map((d) => d.amount), 1);

  const summaryCards = [
    { label: 'This Week', value: data?.thisWeek ?? 0, color: crewTheme.color.primary },
    { label: 'This Fortnight', value: data?.thisFortnight ?? 0, color: '#3B82F6' },
    { label: 'This Month', value: data?.thisMonth ?? 0, color: '#8B5CF6' },
    { label: 'All Time', value: data?.allTime ?? 0, color: '#10B981' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: crewTheme.color.primary }}>Earnings</h1>
        <p className="text-sm mt-1" style={{ color: crewTheme.color.muted }}>Track your earnings from completed jobs.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summaryCards.map((card) => (
          <div key={card.label} className={`${glass} p-4`}>
            <p className="text-[11px] uppercase tracking-wider" style={{ color: crewTheme.color.muted }}>{card.label}</p>
            {loading ? (
              <div className="h-7 w-16 rounded bg-slate-100 animate-pulse mt-1" />
            ) : (
              <p className="text-xl font-bold mt-1" style={{ color: card.color }}>${card.value.toFixed(0)}</p>
            )}
          </div>
        ))}
      </div>

      {/* Daily Earnings Chart */}
      <div className={`${glass} p-5`}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: crewTheme.color.text }}>Last 7 Days</h2>
        <div className="flex items-end gap-2 h-32">
          {dailyEarnings.map((day) => (
            <div key={day.day} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] font-medium" style={{ color: day.amount > 0 ? crewTheme.color.primary : crewTheme.color.muted }}>
                {day.amount > 0 ? `$${day.amount.toFixed(0)}` : ''}
              </span>
              <div
                className="w-full rounded-t-lg transition-all"
                style={{
                  height: `${Math.max((day.amount / maxDaily) * 100, 4)}%`,
                  background: day.amount > 0 ? crewTheme.color.primary : '#E2E8F0',
                  minHeight: '4px',
                }}
              />
              <span className="text-[10px]" style={{ color: crewTheme.color.muted }}>{day.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Jobs List */}
      <div className={`${glass} overflow-hidden`}>
        <div className="p-4 border-b border-black/5">
          <h2 className="text-sm font-semibold" style={{ color: crewTheme.color.text }}>Completed Jobs</h2>
        </div>
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((n) => <div key={n} className="h-12 rounded bg-slate-100 animate-pulse" />)}
          </div>
        ) : !data?.jobs?.length ? (
          <div className="p-8 text-center">
            <p className="text-sm" style={{ color: crewTheme.color.muted }}>No completed jobs yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-black/5">
            {data.jobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium" style={{ color: crewTheme.color.text }}>
                    {SERVICE_LABELS[job.serviceType] || job.serviceType}
                  </p>
                  <p className="text-[11px]" style={{ color: crewTheme.color.muted }}>
                    {job.customerName} · {job.completedAt ? new Date(job.completedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : ''}
                  </p>
                </div>
                <p className="text-sm font-bold" style={{ color: '#10B981' }}>${job.amount.toFixed(2)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
