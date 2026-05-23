'use client';

// -----------------------------------------------------------------------------
// Lead Funnel
// -----------------------------------------------------------------------------
// Module 3 — conversion funnel from Visitors → Completed.
//
// We deliberately avoid the standard Recharts <FunnelChart>: it looks like
// every other SaaS dashboard. Instead, a custom stepped bar layout shows
// each stage's count and the *drop-off* from the previous stage, with the
// biggest leak called out explicitly.
//
// "Visitors" requires a visitor count — when unknown, the stage shows "—"
// and downstream conversion % from visitors is suppressed.
// -----------------------------------------------------------------------------

import { motion } from 'framer-motion';
import { night } from '@/app/ui/theme';
import { NightPanel, NightChip, NightEmpty } from './NightPrimitives';
import type { FunnelSnapshot } from '../lib/types';

const STAGE_HINTS: Record<FunnelSnapshot['stage'], string> = {
  visitors: 'Sessions on budsatwork.com',
  quote_started: 'Opened the quote flow',
  quote_submitted: 'Completed the quote form',
  contacted: 'Buds At Work replied at least once',
  booked: 'Quote converted to a paid order',
  completed: 'Job finished',
};

export function LeadFunnel({
  stages,
  visitorCountKnown,
}: {
  stages: FunnelSnapshot[];
  visitorCountKnown: boolean;
}) {
  // For the bar width, normalize to the largest stage count.
  const peak = stages.reduce((max, s) => Math.max(max, s.count), 0) || 1;
  const biggestLeak = stages.find((s) => s.isBiggestDropOff);

  if (stages.every((s) => s.count === 0)) {
    return (
      <NightPanel title="Lead funnel" subtitle="Where leads come in, where they leave.">
        <NightEmpty
          title="Not enough lead data yet"
          detail="Once quotes start flowing through, the funnel here will show the exact stage where leads drop off."
        />
      </NightPanel>
    );
  }

  return (
    <NightPanel
      title="Lead funnel"
      subtitle="From visitor to completed job. The biggest leak is called out below."
      right={
        biggestLeak ? (
          <NightChip tone="warm">
            Biggest leak: {biggestLeak.label}
          </NightChip>
        ) : null
      }
    >
      <div className="grid gap-3">
        {stages.map((stage, idx) => {
          const widthPct = Math.max(4, (stage.count / peak) * 100);
          const isFirst = idx === 0;
          const showConv =
            !isFirst && (stage.stage !== 'quote_started' || visitorCountKnown);

          return (
            <div key={stage.stage} className="grid gap-1.5">
              <div className="flex items-end justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      color: night.muted,
                      border: `1px solid ${night.border}`,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: night.text }}>{stage.label}</p>
                    <p className="text-[11px]" style={{ color: night.subtle }}>{STAGE_HINTS[stage.stage]}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-base font-semibold tabular-nums" style={{ color: night.text }}>
                    {stage.count > 0 ? stage.count.toLocaleString() : '—'}
                  </p>
                  {showConv ? (
                    <p
                      className="text-[11px] font-semibold"
                      style={{
                        color: stage.isBiggestDropOff ? night.hot : night.muted,
                      }}
                    >
                      {Math.round(stage.conversionFromPrev * 100)}% kept
                      {stage.isBiggestDropOff
                        ? ` · ${Math.round(stage.dropOff * 100)}% leak`
                        : ''}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Bar */}
              <div
                className="relative h-2.5 overflow-hidden rounded-full"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${widthPct}%` }}
                  transition={{ duration: 0.7, delay: idx * 0.06, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{
                    background: stage.isBiggestDropOff
                      ? `linear-gradient(90deg, ${night.warm}, ${night.hot})`
                      : `linear-gradient(90deg, ${night.accent}, ${night.cold})`,
                    boxShadow: stage.isBiggestDropOff ? `0 0 24px ${night.hot}66` : `0 0 18px ${night.accent}44`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Leak callout */}
      {biggestLeak && biggestLeak.dropOff > 0 ? (
        <div
          className="mt-5 rounded-xl border px-4 py-3 text-[12px] leading-5"
          style={{
            background: 'rgba(255,90,69,0.06)',
            borderColor: 'rgba(255,90,69,0.25)',
            color: '#FFD6CD',
          }}
        >
          <span className="font-semibold" style={{ color: night.hot }}>{Math.round(biggestLeak.dropOff * 100)}%</span> of leads
          are dropping off at <span className="font-semibold" style={{ color: night.text }}>{biggestLeak.label}</span>.
          {' '}
          {leakRecommendation(biggestLeak.stage)}
        </div>
      ) : null}
    </NightPanel>
  );
}

function leakRecommendation(stage: FunnelSnapshot['stage']): string {
  switch (stage) {
    case 'quote_started':
      return 'Visitors are bouncing before opening the quote form — review the home page CTA and trust signals above the fold.';
    case 'quote_submitted':
      return 'People are abandoning the quote form mid-way — check step length, mobile friction, and address autocomplete.';
    case 'contacted':
      return 'Leads come in, but we are not replying fast enough — the Response Performance panel will tell you which channel is slow.';
    case 'booked':
      return 'Quotes are sent but not closing — review pricing, deposit ask, and follow-up cadence.';
    case 'completed':
      return 'Booked jobs are not making it to completion — check scheduling, no-shows, and crew capacity.';
    default:
      return '';
  }
}
