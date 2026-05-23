'use client';

// -----------------------------------------------------------------------------
// Bud Leads — top-level workspace
// -----------------------------------------------------------------------------
// Orchestrates every Bud Leads module on a single dark cinematic surface.
//
// Data flow:
//   useDashboardData (existing) → quotes[] → quotesToLeads(quotes) → Lead[]
//                                              ├→ LiveLeadsFeed
//                                              ├→ buildAttentionQueue → NeedsAttentionPanel
//                                              ├→ buildFunnelSnapshot → LeadFunnel
//                                              ├→ buildResponseMetrics → ResponsePerformance
//                                              └→ buildSuburbInsights → SuburbHeatmap
//
// All adapter calls are memoised so adding/removing modules doesn't cascade.
// -----------------------------------------------------------------------------

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cx, night, nightSurface } from '@/app/ui/theme';
import { useDashboardData } from '../../hooks/useDashboardData';
import { LiveLeadsFeed } from './components/LiveLeadsFeed';
import { NeedsAttentionPanel } from './components/NeedsAttentionPanel';
import { LeadFunnel } from './components/LeadFunnel';
import { ResponsePerformance } from './components/ResponsePerformance';
import { SuburbHeatmap } from './components/SuburbHeatmap';
import { PulseDot } from './components/NightPrimitives';
import {
  quotesToLeads,
  buildAttentionQueue,
  buildSuburbInsights,
  buildFunnelSnapshot,
  buildResponseMetrics,
  formatLeadMoney,
} from './lib/leadAdapter';

export default function BudLeadsWorkspace() {
  const { quotes, isLoading, error } = useDashboardData('full');

  // Single fixed "now" per render so adapter outputs are stable across the
  // child components in this pass (otherwise each memo recomputes against
  // a slightly different timestamp).
  const now = useMemo(() => new Date(), [quotes]);

  const leads = useMemo(() => quotesToLeads(quotes, now), [quotes, now]);
  const attention = useMemo(() => buildAttentionQueue(leads), [leads]);
  const funnel = useMemo(() => buildFunnelSnapshot(leads, null), [leads]); // visitor count = null until PostHog wired
  const responseMetrics = useMemo(() => buildResponseMetrics(leads), [leads]);
  const suburbs = useMemo(() => buildSuburbInsights(leads), [leads]);

  // Header KPIs
  const hotCount = useMemo(() => leads.filter((l) => l.temperature === 'HOT').length, [leads]);
  const warmCount = useMemo(() => leads.filter((l) => l.temperature === 'WARM').length, [leads]);
  const newToday = useMemo(() => {
    const cutoff = now.getTime() - 24 * 3_600_000;
    return leads.filter((l) => new Date(l.createdAt).getTime() >= cutoff).length;
  }, [leads, now]);
  const pipelineValue = useMemo(
    () => leads.filter((l) => l.responseStatus !== 'lost' && l.responseStatus !== 'completed')
      .reduce((sum, l) => sum + l.value, 0),
    [leads]
  );

  return (
    <div
      className={cx(nightSurface, 'rounded-[28px] border')}
      style={{ borderColor: night.border, background: night.bg }}
    >
      {/* Top bar */}
      <header className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
        <div>
          <div className="flex items-center gap-2">
            <PulseDot tone={hotCount > 0 ? 'hot' : 'warm'} />
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.24em]"
              style={{ color: night.accent }}
            >
              Bud Leads · Mission Control
            </p>
          </div>
          <h2 className="mt-1.5 text-2xl font-semibold tracking-tight" style={{ color: night.text }}>
            Every lead. Every signal. Every action.
          </h2>
          <p className="mt-1 max-w-2xl text-sm" style={{ color: night.muted }}>
            Hot leads pulse. Cold ones surface for follow-up. The funnel and response panels show exactly where the next booked job is hiding.
          </p>
        </div>

        {/* Header KPI strip */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <HeaderKpi label="HOT" value={hotCount} tone={hotCount > 0 ? 'hot' : 'neutral'} pulse={hotCount > 0} />
          <HeaderKpi label="WARM" value={warmCount} tone="warm" />
          <HeaderKpi label="New · 24h" value={newToday} tone="accent" />
          <HeaderKpi label="Pipeline" value={formatLeadMoney(pipelineValue)} tone="neutral" wide />
        </div>
      </header>

      {/* Subtle divider — ties header to grid below without a hard line */}
      <div className="mx-5 sm:mx-7" style={{ borderTop: `1px solid ${night.border}` }} />

      {/* Body grid */}
      <div className="grid gap-5 p-5 sm:p-7">
        {error && quotes.length === 0 ? (
          <div
            className="rounded-2xl border px-4 py-4 text-sm"
            style={{
              background: 'rgba(255,90,69,0.06)',
              borderColor: 'rgba(255,90,69,0.25)',
              color: '#FFD6CD',
            }}
          >
            Couldn&rsquo;t load lead data: {error}. The rest of the dashboard tabs should still work.
          </div>
        ) : null}

        {isLoading && quotes.length === 0 ? (
          <LoadingSkeleton />
        ) : (
          <>
            {/* Row 1: feed (wide) + attention (narrow) */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,1fr)]"
            >
              <LiveLeadsFeed leads={leads} />
              <NeedsAttentionPanel items={attention} />
            </motion.div>

            {/* Row 2: funnel + response */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="grid gap-5 xl:grid-cols-2"
            >
              <LeadFunnel stages={funnel} visitorCountKnown={false} />
              <ResponsePerformance metrics={responseMetrics} />
            </motion.div>

            {/* Row 3: suburb intelligence — full width */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <SuburbHeatmap suburbs={suburbs} />
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}

function HeaderKpi({
  label,
  value,
  tone,
  pulse,
  wide,
}: {
  label: string;
  value: number | string;
  tone: 'hot' | 'warm' | 'accent' | 'neutral';
  pulse?: boolean;
  wide?: boolean;
}) {
  const color =
    tone === 'hot' ? night.hot
    : tone === 'warm' ? night.warm
    : tone === 'accent' ? '#7CE0B0'
    : night.text;

  return (
    <div
      className={cx(
        'rounded-xl border px-3 py-2.5 sm:px-3.5',
        wide ? 'col-span-2 sm:col-span-1' : ''
      )}
      style={{
        background: 'rgba(255,255,255,0.025)',
        borderColor: pulse ? 'rgba(255,90,69,0.35)' : night.border,
        boxShadow: pulse ? `0 0 24px ${night.hot}33` : undefined,
      }}
    >
      <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: night.subtle }}>{label}</p>
      <p className="mt-1.5 text-xl font-semibold tabular-nums" style={{ color }}>{value}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,1fr)]">
        <SkeletonBlock height={420} />
        <SkeletonBlock height={420} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <SkeletonBlock height={320} />
        <SkeletonBlock height={320} />
      </div>
      <SkeletonBlock height={280} />
    </div>
  );
}

function SkeletonBlock({ height }: { height: number }) {
  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ height, borderColor: night.border, background: 'rgba(255,255,255,0.02)' }}
    >
      <motion.div
        initial={{ x: '-100%' }}
        animate={{ x: '100%' }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
        className="h-full w-1/2"
        style={{
          background: `linear-gradient(90deg, transparent, ${night.border}, transparent)`,
        }}
      />
    </div>
  );
}
