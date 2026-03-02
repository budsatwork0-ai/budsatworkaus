'use client';

import { useEffect, useState } from 'react';
import { brand } from '@/app/ui/theme';
import { exportCsv, formatCurrency, type CsvColumn } from '@/lib/dashboard/utils';
import type { DashboardData } from '@/app/api/dashboard/route';

const glass = 'bg-white/80 backdrop-blur-2xl border shadow-[0_10px_30px_rgba(2,6,23,0.08)]';

const TREND_ICON: Record<string, { symbol: string; color: string }> = {
  up: { symbol: '\u2191', color: '#22c55e' },
  down: { symbol: '\u2193', color: '#ef4444' },
  flat: { symbol: '\u2192', color: '#94a3b8' },
};

function Skeleton() {
  return (
    <div className={`${glass} rounded-2xl p-4 animate-pulse`} style={{ borderColor: brand.border, background: brand.card }}>
      <div className="h-4 w-32 bg-slate-200 rounded mb-3" />
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-8 bg-slate-100 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

type MetricRow = { label: string; value: string; trend?: 'up' | 'down' | 'flat' };

function ReportCard({
  title,
  description,
  period,
  metrics,
  onExport,
}: {
  title: string;
  description: string;
  period: string;
  metrics: MetricRow[];
  onExport?: () => void;
}) {
  return (
    <div className={`${glass} rounded-2xl p-4`} style={{ borderColor: brand.border, background: brand.card }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-semibold" style={{ color: brand.text }}>{title}</div>
          <div className="text-xs" style={{ color: brand.muted }}>{description}</div>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex-shrink-0">{period}</span>
      </div>

      <div className="space-y-2">
        {metrics.map(m => (
          <div key={m.label} className="flex items-center justify-between rounded-lg border p-2" style={{ borderColor: brand.border, background: '#fff' }}>
            <span className="text-sm" style={{ color: brand.muted }}>{m.label}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold" style={{ color: brand.text }}>{m.value}</span>
              {m.trend && (
                <span className="text-xs font-medium" style={{ color: TREND_ICON[m.trend].color }}>
                  {TREND_ICON[m.trend].symbol}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {onExport && (
        <button
          onClick={onExport}
          className="mt-3 w-full text-xs py-2 rounded-lg border transition hover:bg-white"
          style={{ borderColor: brand.border, color: brand.primary }}
        >
          Export CSV
        </button>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [crewCount, setCrewCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const [dashRes, crewRes] = await Promise.all([
          fetch('/api/dashboard').then(r => r.json()),
          fetch('/api/crew/employees').then(r => r.json()).catch(() => ({ employees: [] })),
        ]);
        setData(dashRes);
        setCrewCount((crewRes.employees || []).length);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const m = data?.metrics;

  const totalRevenue = m?.revenueByService.reduce((s, r) => s + r.amount, 0) ?? 0;
  const topService = m?.revenueByService[0];

  // Revenue breakdown by service for CSV
  function exportRevenueCSV() {
    if (!m) return;
    type Row = { service: string; amount: number };
    const columns: CsvColumn<Row>[] = [
      { label: 'Service', getValue: r => r.service },
      { label: 'Revenue (AUD)', getValue: r => r.amount },
    ];
    exportCsv({ data: m.revenueByService, columns, filename: 'revenue-by-service.csv' });
  }

  // Jobs completed breakdown for CSV
  function exportJobsCSV() {
    if (!m) return;
    type Row = { service: string; amount: number };
    const columns: CsvColumn<Row>[] = [
      { label: 'Service', getValue: r => r.service },
      { label: 'Revenue (AUD)', getValue: r => r.amount },
    ];
    exportCsv({ data: m.revenueByService, columns, filename: 'jobs-by-service.csv' });
  }

  const revenueMetrics: MetricRow[] = m
    ? [
        { label: 'Total revenue (MTD)', value: formatCurrency(totalRevenue), trend: totalRevenue > 0 ? 'up' : 'flat' },
        ...(m.revenueByService.slice(0, 3).map(s => ({
          label: s.service,
          value: formatCurrency(s.amount),
        }))),
      ]
    : [];

  const jobsMetrics: MetricRow[] = m
    ? [
        { label: 'Jobs completed (MTD)', value: String(m.operationsSnapshot.jobsCompleted), trend: m.operationsSnapshot.jobsCompleted > 0 ? 'up' : 'flat' },
        { label: 'Avg job value', value: formatCurrency(m.operationsSnapshot.averageJobValue) },
        { label: 'Gross margin', value: `${m.operationsSnapshot.grossMargin}%`, trend: m.operationsSnapshot.grossMargin > 50 ? 'up' : 'flat' },
        ...(topService ? [{ label: `Top: ${topService.service}`, value: formatCurrency(topService.amount) }] : []),
      ]
    : [];

  const goalMetrics: MetricRow[] = m
    ? [
        {
          label: 'Revenue vs target',
          value: `${formatCurrency(m.goals.currentRevenue)} / ${formatCurrency(m.goals.monthlyRevenueTarget)}`,
          trend: m.goals.currentRevenue >= m.goals.monthlyRevenueTarget ? 'up' : 'flat',
        },
        {
          label: 'Jobs vs target',
          value: `${m.goals.currentJobs} / ${m.goals.monthlyJobsTarget}`,
          trend: m.goals.currentJobs >= m.goals.monthlyJobsTarget ? 'up' : 'flat',
        },
      ]
    : [];

  const teamMetrics: MetricRow[] = [
    { label: 'Active team members', value: String(crewCount) },
    { label: 'Outstanding receivables', value: m ? String(m.outstandingReceivables.count) : '-' },
    { label: 'Upcoming payables (30d)', value: m ? String(m.upcomingPayables.count) : '-' },
  ];

  return (
    <div className="min-h-screen" style={{ background: brand.bg }}>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold" style={{ color: brand.primary }}>Reports</h1>
        <p className="text-sm mt-1" style={{ color: brand.muted }}>
          Performance, revenue, and compliance snapshots.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <ReportCard
            title="Revenue Overview"
            description="Total income across all services this month."
            period="This month"
            metrics={revenueMetrics}
            onExport={exportRevenueCSV}
          />
          <ReportCard
            title="Jobs Completed"
            description="Breakdown of completed jobs by service type."
            period="This month"
            metrics={jobsMetrics}
            onExport={exportJobsCSV}
          />
          <ReportCard
            title="Goals & Targets"
            description="Monthly revenue and job targets vs actual."
            period="This month"
            metrics={goalMetrics}
          />
          <ReportCard
            title="Team & Financials"
            description="Active crew and outstanding financial items."
            period="Current"
            metrics={teamMetrics}
          />
        </div>
      )}
    </div>
  );
}
