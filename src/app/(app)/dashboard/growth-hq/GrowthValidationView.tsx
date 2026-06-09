'use client';

import { useEffect, useState } from 'react';
import { dashboardTheme } from '@/lib/design-system/themes';

interface ValidationData {
  journals:           number;
  oppsCreated:        number;
  oppsConverted:      number;
  ideasCreated:       number;
  scriptsCreated:     number;
  publishedContent:   number;
  leadsGenerated:     number;
  customersGenerated: number;
  revenueGenerated:   number;
}

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return '—';
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function fmtRevenue(amount: number): string {
  if (amount === 0) return 'A$0';
  return new Intl.NumberFormat('en-AU', {
    style:                 'currency',
    currency:              'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function conversionColor(rate: number): { bg: string; fg: string } {
  if (rate === 0)   return { bg: '#F8FAFC', fg: '#94A3B8' };
  if (rate >= 50)   return { bg: '#F0FDF4', fg: '#15803D' };
  if (rate >= 20)   return { bg: '#FFFBEB', fg: '#D97706' };
  return               { bg: '#FEF2F2', fg: '#DC2626' };
}

interface Stage {
  label:      string;
  value:      string;
  count:      number;
  isRevenue?: boolean;
}

interface Arrow {
  label: string;
  rate:  number;
}

function buildFunnel(d: ValidationData): Array<Stage | Arrow> {
  const convJournalOpp   = d.journals > 0        ? (d.oppsCreated      / d.journals)      * 100 : 0;
  const convOppConverted = d.oppsCreated > 0      ? (d.oppsConverted    / d.oppsCreated)   * 100 : 0;
  const convConvIdea     = d.oppsConverted > 0    ? (d.ideasCreated     / d.oppsConverted) * 100 : 0;
  const convIdeaScript   = d.ideasCreated > 0     ? (d.scriptsCreated   / d.ideasCreated)  * 100 : 0;
  const convScriptPub    = d.scriptsCreated > 0   ? (d.publishedContent / d.scriptsCreated)* 100 : 0;
  const convPubLead      = d.publishedContent > 0 ? (d.leadsGenerated   / d.publishedContent)*100: 0;
  const convLeadCust     = d.leadsGenerated > 0   ? (d.customersGenerated/d.leadsGenerated)* 100 : 0;

  return [
    { label: 'Journal Entries',        value: String(d.journals),            count: d.journals },
    { label: 'Opp → Journal',          rate: convJournalOpp },
    { label: 'Opportunities Created',  value: String(d.oppsCreated),         count: d.oppsCreated },
    { label: 'Converted → Created',    rate: convOppConverted },
    { label: 'Opportunities Converted',value: String(d.oppsConverted),       count: d.oppsConverted },
    { label: 'Idea → Converted Opp',   rate: convConvIdea },
    { label: 'Ideas Created',          value: String(d.ideasCreated),        count: d.ideasCreated },
    { label: 'Script → Idea',          rate: convIdeaScript },
    { label: 'Scripts Created',        value: String(d.scriptsCreated),      count: d.scriptsCreated },
    { label: 'Published → Script',     rate: convScriptPub },
    { label: 'Published Content',      value: String(d.publishedContent),    count: d.publishedContent },
    { label: 'Lead → Published',       rate: convPubLead },
    { label: 'Leads Generated',        value: String(d.leadsGenerated),      count: d.leadsGenerated },
    { label: 'Customer → Lead',        rate: convLeadCust },
    { label: 'Customers Generated',    value: String(d.customersGenerated),  count: d.customersGenerated },
    { label: 'Revenue',                value: fmtRevenue(d.revenueGenerated), count: d.revenueGenerated, isRevenue: true },
  ] as Array<Stage | Arrow>;
}

function isArrow(item: Stage | Arrow): item is Arrow {
  return 'rate' in item;
}

function ConversionArrow({ label, rate }: Arrow) {
  const colors = conversionColor(rate);
  const display = rate === 0 ? '—' : `${Math.round(rate)}%`;

  return (
    <div className="flex items-center gap-3 px-6 py-1">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center">
        <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
          <path d="M5 0v11M1 7l4 5 4-5" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <span
        className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
        style={{ background: colors.bg, color: colors.fg }}
      >
        {display}
      </span>
      <span className="text-[11px]" style={{ color: dashboardTheme.color.muted }}>
        {label}
      </span>
    </div>
  );
}

function StageRow({ label, value, count, isRevenue }: Stage) {
  const isEmpty = count === 0 && !isRevenue;

  return (
    <div
      className="flex items-center justify-between gap-4 rounded-[20px] border border-black/5 bg-white/90 px-5 py-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]"
    >
      <span className="text-sm font-medium" style={{ color: isEmpty ? dashboardTheme.color.muted : dashboardTheme.color.primary }}>
        {label}
      </span>
      <span
        className="text-2xl font-bold tabular-nums tracking-[-0.02em]"
        style={{ color: isEmpty ? '#CBD5E1' : (isRevenue ? '#047857' : dashboardTheme.color.primary) }}
      >
        {value}
      </span>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-[20px] border border-black/5 bg-white/90" />
      ))}
    </div>
  );
}

function SummaryStrip({ d }: { d: ValidationData }) {
  const endToEnd = d.journals > 0
    ? pct(d.customersGenerated, d.journals)
    : '—';
  const leadClose = pct(d.customersGenerated, d.leadsGenerated);
  const contentROI = d.publishedContent > 0
    ? pct(d.leadsGenerated, d.publishedContent)
    : '—';

  const stats = [
    { label: 'End-to-end',     value: endToEnd,  detail: 'Journal → Customer' },
    { label: 'Lead close',     value: leadClose,  detail: 'Lead → Customer' },
    { label: 'Content → Lead', value: contentROI, detail: 'Published → Lead' },
    { label: 'Revenue (30d)',   value: fmtRevenue(d.revenueGenerated), detail: 'Completed orders' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {stats.map(({ label, value, detail }) => (
        <div
          key={label}
          className="rounded-[20px] border border-black/5 bg-white/90 p-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: dashboardTheme.color.muted }}>
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums tracking-[-0.02em]" style={{ color: dashboardTheme.color.primary }}>
            {value}
          </p>
          <p className="mt-1 text-[11px]" style={{ color: dashboardTheme.color.muted }}>{detail}</p>
        </div>
      ))}
    </div>
  );
}

export default function GrowthValidationView() {
  const [data,      setData]      = useState<ValidationData | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetch('/api/growth-validation')
      .then((r) => {
        if (!r.ok) throw new Error('failed');
        return r.json() as Promise<ValidationData>;
      })
      .then(setData)
      .catch(() => setLoadError(true));
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-[20px] border border-black/5 bg-white/80 px-5 py-4">
        <p className="text-xs font-medium" style={{ color: dashboardTheme.color.muted }}>
          Last 30 days · Read-only · Measures whether Growth activity is creating business outcomes
        </p>
      </div>

      {loadError && (
        <div className="rounded-[20px] border border-red-100 bg-red-50 px-5 py-4">
          <p className="text-sm text-red-700">Failed to load metrics. Refresh to try again.</p>
        </div>
      )}

      {!data && !loadError && <Skeleton />}

      {data && (
        <>
          <SummaryStrip d={data} />

          <div className="flex flex-col gap-0.5">
            {buildFunnel(data).map((item, i) =>
              isArrow(item) ? (
                <ConversionArrow key={i} {...item} />
              ) : (
                <StageRow key={i} {...item} />
              ),
            )}
          </div>
        </>
      )}
    </div>
  );
}
