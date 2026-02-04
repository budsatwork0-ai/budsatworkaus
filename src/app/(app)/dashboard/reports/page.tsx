import { brand } from '@/app/ui/theme';

const glass = 'bg-white/80 backdrop-blur-2xl border shadow-[0_10px_30px_rgba(2,6,23,0.08)]';

type ReportCard = {
  title: string;
  description: string;
  period: string;
  metrics: { label: string; value: string; trend?: 'up' | 'down' | 'flat' }[];
};

const REPORTS: ReportCard[] = [
  {
    title: 'Revenue Overview',
    description: 'Total income across all services and subscriptions.',
    period: 'This month',
    metrics: [
      { label: 'Total revenue', value: '$4,820', trend: 'up' },
      { label: 'Subscriptions', value: '$1,260', trend: 'up' },
      { label: 'One-off jobs', value: '$3,560', trend: 'flat' },
    ],
  },
  {
    title: 'Jobs Completed',
    description: 'Breakdown of completed jobs by service type.',
    period: 'Last 30 days',
    metrics: [
      { label: 'Total jobs', value: '67', trend: 'up' },
      { label: 'Cleaning', value: '24' },
      { label: 'Yard & lawns', value: '18' },
      { label: 'Bin cleans', value: '14' },
      { label: 'Other', value: '11' },
    ],
  },
  {
    title: 'Customer Metrics',
    description: 'Satisfaction and retention indicators.',
    period: 'Last 30 days',
    metrics: [
      { label: 'Avg rating', value: '4.9/5', trend: 'flat' },
      { label: 'Repeat rate', value: '72%', trend: 'up' },
      { label: 'New customers', value: '19', trend: 'up' },
    ],
  },
  {
    title: 'Team & Compliance',
    description: 'Onboarding and operational health.',
    period: 'Current',
    metrics: [
      { label: 'Active team', value: '6' },
      { label: 'Inductions pending', value: '2', trend: 'down' },
      { label: 'SLA on-time', value: '94%', trend: 'up' },
    ],
  },
];

const TREND_ICON: Record<string, { symbol: string; color: string }> = {
  up: { symbol: '\u2191', color: '#22c55e' },
  down: { symbol: '\u2193', color: '#ef4444' },
  flat: { symbol: '\u2192', color: '#94a3b8' },
};

export default function ReportsPage() {
  return (
    <div className="min-h-screen" style={{ background: brand.bg }}>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold" style={{ color: brand.primary }}>Reports</h1>
        <p className="text-sm mt-1" style={{ color: brand.muted }}>
          Performance, revenue, and compliance snapshots.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {REPORTS.map(report => (
          <div key={report.title} className={`${glass} rounded-2xl p-4`} style={{ borderColor: brand.border, background: brand.card }}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-semibold" style={{ color: brand.text }}>{report.title}</div>
                <div className="text-xs" style={{ color: brand.muted }}>{report.description}</div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex-shrink-0">{report.period}</span>
            </div>

            <div className="space-y-2">
              {report.metrics.map(m => (
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

            <button
              className="mt-3 w-full text-xs py-2 rounded-lg border transition hover:bg-white"
              style={{ borderColor: brand.border, color: brand.primary }}
            >
              Export CSV
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs mt-6" style={{ color: brand.muted }}>
        Design-only. Metrics are sample data. CSV/PDF export will connect to live data when the database is wired.
      </p>
    </div>
  );
}
