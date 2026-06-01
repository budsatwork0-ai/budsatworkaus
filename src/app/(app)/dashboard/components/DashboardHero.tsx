'use client';

import Link from 'next/link';
import { brand } from '@/app/ui/theme';
import { formatCurrency } from '@/lib/dashboard/utils';
import type { DashboardMetrics, ActivityItem, DashboardCrewMember } from '@/types/dashboard';

const CARD = 'rounded-[26px] border border-black/5 bg-white p-6 shadow-[0_8px_26px_rgba(2,6,23,0.05)]';
const SERVICE_SHADES = ['#1C7C54', '#2e9d68', '#3fae77', '#88a596', '#14543a'];

function pct(n: number): string {
  const r = Math.round(n * 10) / 10;
  return `${r > 0 ? '+' : ''}${r}%`;
}

function initials(name: string | null): string {
  if (!name) return '–';
  return name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '–';
}

function Delta({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span
      className="ml-2 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 align-middle text-[11.5px] font-semibold"
      style={up
        ? { background: brand.accentSoft, color: brand.accent }
        : { background: '#fbe9e8', color: '#d9534f' }}
    >
      {up ? '↗' : '↘'} {pct(Math.abs(value)).replace('+', '')}
    </span>
  );
}

function KpiTile({ label, value, delta, note, highlighted }: {
  label: string;
  value: string;
  delta?: number;
  note?: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-[20px] border border-black/5 px-5 py-4 ${highlighted ? 'bg-white shadow-[0_6px_20px_rgba(2,6,23,0.06)]' : 'bg-[#fafafa]'}`}
    >
      <div className="text-[13px] text-slate-500">{label}</div>
      <div className="mt-1.5 flex items-baseline">
        <span className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: brand.primary }}>{value}</span>
        {typeof delta === 'number' && <Delta value={delta} />}
      </div>
      <div className="mt-0.5 text-[12px] text-slate-400">{note ?? 'vs last month'}</div>
    </div>
  );
}

export function DashboardHero({ metrics, recentActivity, crew }: {
  metrics: DashboardMetrics;
  recentActivity: ActivityItem[];
  crew: DashboardCrewMember[];
}) {
  const trend = metrics.revenueTrend ?? [];
  const maxRev = Math.max(1, ...trend.map((t) => t.revenue));
  const peakIdx = trend.length
    ? trend.reduce((best, t, i, arr) => (t.revenue > arr[best].revenue ? i : best), 0)
    : -1;
  const services = [...(metrics.revenueByService ?? [])].sort((a, b) => b.amount - a.amount).slice(0, 5);
  const crewAvatars = crew.slice(0, 5);
  const activity = recentActivity.slice(0, 4);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* Left column */}
      <div className="space-y-5">
        {/* Overview */}
        <section className={CARD}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight" style={{ color: brand.primary }}>Overview</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-black/5 px-3.5 py-2 text-[12.5px] text-slate-500">This month</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <KpiTile
              highlighted
              label="Revenue · MTD"
              value={formatCurrency(metrics.goals.currentRevenue)}
              delta={metrics.goals.revenueChange}
            />
            <KpiTile
              label="Net profit"
              value={formatCurrency(metrics.netProfit.amount)}
              delta={metrics.netProfit.change}
              note={`${metrics.netProfit.margin}% margin`}
            />
          </div>
          {crewAvatars.length > 0 && (
            <div className="mt-5">
              <div className="text-[16px] font-semibold" style={{ color: brand.primary }}>
                {metrics.operationsSnapshot.jobsCompleted} jobs completed this month
              </div>
              <div className="mt-0.5 text-[13px] text-slate-500">{crewAvatars.length} crew on the tools.</div>
              <div className="mt-3 flex items-center gap-4">
                {crewAvatars.map((c) => (
                  <div key={c.id} className="text-center">
                    <div className="mx-auto flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[#e6efe9] text-[15px] font-semibold" style={{ color: brand.primary }}>
                      {initials(c.full_name)}
                    </div>
                    <div className="mt-1.5 max-w-[60px] truncate text-[12px] text-slate-500">{(c.full_name ?? '—').split(' ')[0]}</div>
                  </div>
                ))}
                <Link href="/dashboard/crew" className="text-center">
                  <div className="mx-auto flex h-[54px] w-[54px] items-center justify-center rounded-full border border-black/10 text-slate-400 transition hover:bg-slate-50">→</div>
                  <div className="mt-1.5 text-[12px] text-slate-500">View all</div>
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Revenue view */}
        {trend.length > 0 && (
          <section className={CARD}>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight" style={{ color: brand.primary }}>Revenue view</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-black/5 px-3.5 py-2 text-[12.5px] text-slate-500">Last {trend.length} months</span>
            </div>
            <div className="relative flex h-52 items-end gap-3 pt-8">
              {trend.map((t, i) => (
                <div
                  key={`${t.month}-${i}`}
                  className="relative flex-1 rounded-t-[9px] rounded-b-[7px]"
                  style={{ height: `${Math.max(6, (t.revenue / maxRev) * 100)}%`, background: i === peakIdx ? brand.accent : '#e6efe9' }}
                >
                  {i === peakIdx && (
                    <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#111827] px-2 py-0.5 text-[11px] font-semibold text-white">
                      {formatCurrency(t.revenue)}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-3">
              {trend.map((t, i) => (
                <div key={`label-${t.month}-${i}`} className="flex-1 truncate text-center text-[10.5px] text-slate-400">{t.month}</div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Right rail */}
      <div className="space-y-5">
        {services.length > 0 && (
          <section className={CARD}>
            <h2 className="mb-3 text-lg font-bold tracking-tight" style={{ color: brand.primary }}>Popular services</h2>
            {services.map((s, i) => (
              <div key={`${s.service}-${i}`} className="flex items-center gap-3 border-t border-black/5 py-3 first:border-t-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] text-white" style={{ background: SERVICE_SHADES[i % SERVICE_SHADES.length] }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 11l18-5v12L3 14v-3z" /></svg>
                </div>
                <div className="min-w-0 text-[13.5px] font-medium text-slate-900">{s.service}</div>
                <div className="ml-auto text-[13.5px] font-semibold" style={{ color: brand.primary }}>{formatCurrency(s.amount)}</div>
              </div>
            ))}
            <Link href="/dashboard/reports" className="mt-3.5 block rounded-2xl border border-black/5 py-3 text-center text-[13px] text-slate-500 transition hover:bg-slate-50">
              All services
            </Link>
          </section>
        )}

        {activity.length > 0 && (
          <section className={CARD}>
            <h2 className="mb-3 text-lg font-bold tracking-tight" style={{ color: brand.primary }}>Recent activity</h2>
            {activity.map((item) => (
              <div key={item.id} className="flex items-start gap-3 border-t border-black/5 py-3 first:border-t-0">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: brand.accent }} />
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-medium text-slate-900">{item.title}</div>
                  {item.description && <div className="truncate text-[12px] text-slate-500">{item.description}</div>}
                </div>
                {item.amount !== undefined && (
                  <div className="ml-auto text-[13px] font-semibold" style={{ color: brand.primary }}>{formatCurrency(item.amount)}</div>
                )}
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
