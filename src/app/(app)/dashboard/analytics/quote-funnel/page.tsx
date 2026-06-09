'use client';

import { Suspense, useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { dashboardTheme } from '@/lib/design-system/themes';
import { SummaryCard, Panel, StatRow } from '../../components/shared';
import { useTabbedNav } from '../../hooks/useTabbedNav';

// ─── Types ────────────────────────────────────────────────────────────────────

type DateRange = '7d' | '30d' | '90d' | 'all';

type FunnelStage = {
  stage: string;
  label: string;
  sessions: number;
  conversionFromPrev: number | null;
  dropoffPct: number | null;
};

type ServiceRow = {
  service: string;
  views: number;
  configStarts: number;
  addToQuotes: number;
  submissions: number;
  submissionRate: number;
};

type QuoteFunnelData = {
  overview: {
    totalSessions: number;
    quoteSubmissions: number;
    conversionPct: number;
    avgTimeToAddSeconds: number | null;
  };
  funnel: FunnelStage[];
  services: ServiceRow[];
  timeAnalysis: {
    avgTimeSeconds: number | null;
    medianTimeSeconds: number | null;
    avgConfigChanges: number | null;
  };
  insights: {
    biggestDropoffStage: string | null;
    biggestDropoffPct: number | null;
    bestService: string | null;
    worstService: string | null;
    bestServiceRate: number | null;
    worstServiceRate: number | null;
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeDateRange(v: string | null): DateRange {
  if (v === '7d' || v === '30d' || v === '90d' || v === 'all') return v;
  return '30d';
}

const RANGE_LABELS: Record<DateRange, string> = {
  '7d':  'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  'all': 'All time',
};

function daysParam(r: DateRange): string {
  return r === 'all' ? 'all' : r.replace('d', '');
}

const SERVICE_LABELS: Record<string, string> = {
  cleaning:         'Cleaning',
  windows:          'Window Cleaning',
  yard:             'Yard Care',
  auto:             'Car Detailing',
  dump:             'Dump Runs',
  laundry:          'Laundry',
  laundry_sneakers: 'Sneaker Cleaning',
  ndis:             'NDIS Support',
};

function serviceLabel(s: string): string {
  return SERVICE_LABELS[s] ?? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

function formatSeconds(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const rem = secs % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

// ─── Funnel tooltip ───────────────────────────────────────────────────────────

type TooltipItem = {
  value: number;
  name: string;
  color: string;
  payload: FunnelStage;
};

function FunnelTooltip({ active, payload }: { active?: boolean; payload?: TooltipItem[] }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-xl border border-black/10 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-slate-700 mb-1">{item.label}</p>
      <p className="text-slate-600">{item.sessions.toLocaleString()} sessions</p>
      {item.conversionFromPrev != null && (
        <p className="text-slate-500 mt-0.5">{item.conversionFromPrev}% converted from previous stage</p>
      )}
      {item.dropoffPct != null && (
        <p className="text-red-500 mt-0.5">{item.dropoffPct}% dropped off</p>
      )}
    </div>
  );
}

// ─── Content component ────────────────────────────────────────────────────────

function QuoteFunnelContent() {
  const [range, setRange] = useTabbedNav<DateRange>('range', sanitizeDateRange);
  const [data, setData]   = useState<QuoteFunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/analytics/quote-funnel?days=${daysParam(range)}`)
      .then(r => r.json())
      .then((d: QuoteFunnelData & { error?: string }) => {
        if (cancelled) return;
        if (d.error) setError(d.error);
        else setData(d);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Failed to load analytics data.');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [range]);

  const hasData = !loading && !error && data != null && data.overview.totalSessions > 0;
  const isEmpty = !loading && !error && data != null && data.overview.totalSessions === 0;

  // Build plain-English insights
  const insightTexts: string[] = [];
  if (data) {
    if (data.insights.biggestDropoffStage && data.insights.biggestDropoffPct != null) {
      insightTexts.push(
        `${data.insights.biggestDropoffPct}% of sessions dropped off at "${data.insights.biggestDropoffStage}" — the largest drop in the funnel.`
      );
    }
    if (
      data.insights.bestService &&
      data.insights.worstService &&
      data.insights.bestService !== data.insights.worstService &&
      data.insights.bestServiceRate != null &&
      data.insights.worstServiceRate != null &&
      data.insights.worstServiceRate > 0
    ) {
      const ratio = (data.insights.bestServiceRate / data.insights.worstServiceRate).toFixed(1);
      insightTexts.push(
        `${serviceLabel(data.insights.bestService)} converts ${ratio}× better than ${serviceLabel(data.insights.worstService)} (${data.insights.bestServiceRate}% vs ${data.insights.worstServiceRate}%).`
      );
    }
    if (data.timeAnalysis.avgTimeSeconds != null) {
      insightTexts.push(
        `Customers spend an average of ${formatSeconds(data.timeAnalysis.avgTimeSeconds)} configuring a service before adding to quote.`
      );
    }
    if (
      data.insights.bestService &&
      data.insights.bestServiceRate != null &&
      data.services.length > 1
    ) {
      insightTexts.push(
        `${serviceLabel(data.insights.bestService)} is the top-converting service at ${data.insights.bestServiceRate}% submission rate.`
      );
    }
  }

  return (
    <div className="px-4 sm:px-6 py-6 max-w-6xl mx-auto space-y-6">

      {/* Date filter */}
      <div className="flex flex-wrap gap-2">
        {(['7d', '30d', '90d', 'all'] as DateRange[]).map(r => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
              range === r
                ? 'text-white shadow-sm'
                : 'bg-white border border-black/10 text-slate-600 hover:border-black/20 hover:bg-slate-50'
            }`}
            style={range === r ? { backgroundColor: dashboardTheme.color.primary } : undefined}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-[22px] border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Overview cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <SummaryCard
          label="Total Sessions"
          value={data ? data.overview.totalSessions.toLocaleString() : '—'}
          hint={RANGE_LABELS[range].toLowerCase()}
          isLoading={loading}
        />
        <SummaryCard
          label="Quote Submissions"
          value={data ? data.overview.quoteSubmissions.toLocaleString() : '—'}
          isLoading={loading}
        />
        <SummaryCard
          label="Conversion Rate"
          value={data ? `${data.overview.conversionPct}%` : '—'}
          hint="Sessions → submitted quote"
          isLoading={loading}
        />
        <SummaryCard
          label="Avg Time to Add"
          value={
            data?.overview.avgTimeToAddSeconds != null
              ? formatSeconds(data.overview.avgTimeToAddSeconds)
              : '—'
          }
          hint="Card open → add to quote"
          isLoading={loading}
        />
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className="rounded-[22px] border border-black/5 bg-white px-5 py-14 text-center shadow-[0_8px_26px_rgba(2,6,23,0.05)]">
          <p className="text-sm font-medium text-slate-600">No funnel data yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Data appears once customers start using the quote builder.
          </p>
        </div>
      )}

      {/* Conversion funnel */}
      {hasData && data && (
        <Panel
          title="Conversion Funnel"
          subtitle="Unique sessions that reached each stage"
        >
          <div className="mt-2">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={data.funnel}
                layout="vertical"
                margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                <YAxis
                  dataKey="label"
                  type="category"
                  tick={{ fontSize: 12, fill: '#64748B' }}
                  width={140}
                  axisLine={false}
                  tickLine={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickLine={false}
                />
                <Tooltip content={<FunnelTooltip />} />
                <Bar
                  dataKey="sessions"
                  fill={dashboardTheme.color.primary}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Stage breakdown */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-black/5">
                  <th className="pb-2 text-left font-medium text-slate-400 pr-4">Stage</th>
                  <th className="pb-2 text-right font-medium text-slate-400 pr-4">Sessions</th>
                  <th className="pb-2 text-right font-medium text-slate-400 pr-4">Conversion</th>
                  <th className="pb-2 text-right font-medium text-slate-400">Drop-off</th>
                </tr>
              </thead>
              <tbody>
                {data.funnel.map((f, i) => (
                  <tr
                    key={f.stage}
                    className={i < data.funnel.length - 1 ? 'border-b border-black/[0.04]' : ''}
                  >
                    <td className="py-2 font-medium text-slate-700 pr-4">{f.label}</td>
                    <td className="py-2 text-right pr-4 font-semibold" style={{ color: dashboardTheme.color.primary }}>
                      {f.sessions.toLocaleString()}
                    </td>
                    <td className="py-2 text-right pr-4 text-slate-500">
                      {f.conversionFromPrev != null ? `${f.conversionFromPrev}%` : '—'}
                    </td>
                    <td className="py-2 text-right">
                      {f.dropoffPct != null ? (
                        <span className={f.dropoffPct > 40 ? 'text-red-500 font-medium' : 'text-slate-500'}>
                          {f.dropoffPct}%
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Service performance */}
      {hasData && data && data.services.length > 0 && (
        <Panel
          title="Service Performance"
          subtitle="Sessions sorted by quote submissions"
        >
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-black/5">
                  <th className="pb-2 text-left font-medium text-slate-400 pr-4">Service</th>
                  <th className="pb-2 text-right font-medium text-slate-400 pr-3">Views</th>
                  <th className="pb-2 text-right font-medium text-slate-400 pr-3">Config Starts</th>
                  <th className="pb-2 text-right font-medium text-slate-400 pr-3">Add to Quote</th>
                  <th className="pb-2 text-right font-medium text-slate-400 pr-3">Submissions</th>
                  <th className="pb-2 text-right font-medium text-slate-400">Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.services.map((s, i) => (
                  <tr
                    key={s.service}
                    className={i < data.services.length - 1 ? 'border-b border-black/[0.04]' : ''}
                  >
                    <td className="py-2 font-medium text-slate-700 pr-4">{serviceLabel(s.service)}</td>
                    <td className="py-2 text-right text-slate-600 pr-3">{s.views.toLocaleString()}</td>
                    <td className="py-2 text-right text-slate-600 pr-3">{s.configStarts.toLocaleString()}</td>
                    <td className="py-2 text-right text-slate-600 pr-3">{s.addToQuotes.toLocaleString()}</td>
                    <td className="py-2 text-right text-slate-600 pr-3">{s.submissions.toLocaleString()}</td>
                    <td className="py-2 text-right font-semibold" style={{ color: dashboardTheme.color.primary }}>
                      {s.submissionRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Bottom row: timing + insights */}
      {hasData && data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Panel title="Timing Analysis" subtitle="Time spent configuring before adding to quote">
            <div className="mt-1 space-y-2">
              <StatRow
                label="Average time to add"
                value={data.timeAnalysis.avgTimeSeconds != null ? formatSeconds(data.timeAnalysis.avgTimeSeconds) : '—'}
              />
              <StatRow
                label="Median time to add"
                value={data.timeAnalysis.medianTimeSeconds != null ? formatSeconds(data.timeAnalysis.medianTimeSeconds) : '—'}
              />
              <StatRow
                label="Avg config changes"
                value={data.timeAnalysis.avgConfigChanges != null ? data.timeAnalysis.avgConfigChanges.toFixed(1) : '—'}
              />
            </div>
          </Panel>

          <Panel title="Drop-off Insights" subtitle="Automatically identified patterns">
            {insightTexts.length > 0 ? (
              <ul className="mt-1 space-y-3">
                {insightTexts.map((text, i) => (
                  <li key={i} className="flex gap-2.5 text-xs text-slate-600 leading-relaxed">
                    <span
                      className="mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: dashboardTheme.color.primary }}
                    />
                    {text}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400 mt-2">No patterns detected yet.</p>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

// ─── Page shell (Suspense required for useTabbedNav → useSearchParams) ────────

export default function QuoteFunnelPage() {
  return (
    <Suspense fallback={<div className="min-h-[320px]" />}>
      <QuoteFunnelContent />
    </Suspense>
  );
}
