'use client';

// -----------------------------------------------------------------------------
// Response Performance
// -----------------------------------------------------------------------------
// Module 7 — the most operationally important panel.
//
// Surfaces:
//   · average + median first response time
//   · fastest and slowest channels (where channel = lead source)
//   · estimated missed leads (no response after 24h)
//   · conversion correlation with response speed (<1h vs >6h)
//
// Conversion correlation is the headline insight — if booked rate is
// dramatically higher for sub-1h replies, the panel says so plainly.
// -----------------------------------------------------------------------------

import { dashboardTheme } from '@/lib/design-system/themes';
import { NightPanel, NightStat, NightChip, NightEmpty, SourceTag } from './NightPrimitives';
import type { ResponseMetrics } from '../lib/types';

export function ResponsePerformance({ metrics }: { metrics: ResponseMetrics }) {
  const hasData = metrics.avgFirstResponseHours !== null;
  if (!hasData) {
    return (
      <NightPanel
        title="Response performance"
        subtitle="How fast we get back to leads — the strongest predictor of conversion."
      >
        <NightEmpty
          title="No response data yet"
          detail="Once we start replying to quotes, this panel will show average response time per channel and how speed correlates with bookings."
        />
      </NightPanel>
    );
  }

  const liftMultiplier =
    metrics.slowResponseConversion > 0
      ? metrics.fastResponseConversion / metrics.slowResponseConversion
      : metrics.fastResponseConversion > 0
        ? Infinity
        : 0;
  const liftPct = Math.round((metrics.fastResponseConversion - metrics.slowResponseConversion) * 100);

  return (
    <NightPanel
      title="Response performance"
      subtitle="How fast we get back to leads — the strongest predictor of conversion."
      right={metrics.missedLeadEstimate > 0 ? <NightChip tone="hot">{metrics.missedLeadEstimate} likely missed</NightChip> : null}
    >
      {/* Top KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <NightStat
          label="Avg first reply"
          value={formatHours(metrics.avgFirstResponseHours)}
          hint={metrics.medianFirstResponseHours !== null ? `Median ${formatHours(metrics.medianFirstResponseHours)}` : undefined}
          tone={accentForResponseHours(metrics.avgFirstResponseHours)}
        />
        <NightStat
          label="Fastest channel"
          value={
            metrics.fastestChannel ? (
              <span className="inline-flex items-center gap-2 text-base">
                {formatHours(metrics.fastestChannel.hours)}
              </span>
            ) : '—'
          }
          hint={metrics.fastestChannel ? <SourceTag source={metrics.fastestChannel.source} /> : undefined}
          tone="accent"
        />
        <NightStat
          label="Slowest channel"
          value={metrics.slowestChannel ? formatHours(metrics.slowestChannel.hours) : '—'}
          hint={metrics.slowestChannel ? <SourceTag source={metrics.slowestChannel.source} /> : undefined}
          tone="warning"
        />
        <NightStat
          label="Missed leads"
          value={metrics.missedLeadEstimate}
          hint="Aged > 24h, never responded"
          tone={metrics.missedLeadEstimate > 0 ? 'critical' : 'accent'}
        />
      </div>

      {/* Conversion-by-speed callout */}
      <div
        className="mt-5 grid gap-4 rounded-xl border px-4 py-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center"
        style={{ background: 'rgba(255,255,255,0.025)', borderColor: dashboardTheme.night!.color.border }}
      >
        <SpeedBucket label="Replied < 1h" rate={metrics.fastResponseConversion} tone="accent" />
        <div className="hidden sm:block">
          <p className="text-center text-[10px] uppercase tracking-[0.18em]" style={{ color: dashboardTheme.night!.color.subtle }}>vs</p>
        </div>
        <SpeedBucket label="Replied > 6h" rate={metrics.slowResponseConversion} tone="warning" rightAlign />
      </div>

      {liftPct !== 0 && Number.isFinite(liftMultiplier) ? (
        <p className="mt-3 text-[12px] leading-5" style={{ color: dashboardTheme.night!.color.muted }}>
          {liftPct > 0 ? (
            <>
              Replying within the hour wins{' '}
              <span className="font-semibold" style={{ color: '#7CE0B0' }}>+{liftPct} points</span> of conversion
              {liftMultiplier >= 1.5 ? (
                <>
                  {' '}— a <span className="font-semibold" style={{ color: dashboardTheme.night!.color.text }}>{liftMultiplier.toFixed(1)}×</span> uplift over slow replies.
                </>
              ) : '.'}
            </>
          ) : (
            <>
              Slow replies are converting better than fast ones in this window — likely a sample-size artifact. Worth confirming once more leads have run through.
            </>
          )}
        </p>
      ) : null}

      {/* Channel table */}
      {metrics.channelBreakdown.length > 0 ? (
        <div className="mt-6">
          <p className="mb-2 text-[10px] uppercase tracking-[0.18em]" style={{ color: dashboardTheme.night!.color.subtle }}>
            By channel
          </p>
          <div className="overflow-hidden rounded-xl border" style={{ borderColor: dashboardTheme.night!.color.border }}>
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.025)' }}>
                  <th className="px-3 py-2 text-left font-medium" style={{ color: dashboardTheme.night!.color.subtle }}>Channel</th>
                  <th className="px-3 py-2 text-right font-medium" style={{ color: dashboardTheme.night!.color.subtle }}>Avg reply</th>
                  <th className="px-3 py-2 text-right font-medium" style={{ color: dashboardTheme.night!.color.subtle }}>Leads</th>
                  <th className="px-3 py-2 text-right font-medium" style={{ color: dashboardTheme.night!.color.subtle }}>Booked</th>
                  <th className="px-3 py-2 text-right font-medium" style={{ color: dashboardTheme.night!.color.subtle }}>Rate</th>
                </tr>
              </thead>
              <tbody>
                {metrics.channelBreakdown.map((row, idx) => (
                  <tr
                    key={row.source}
                    style={{
                      borderTop: idx === 0 ? 'none' : `1px solid ${dashboardTheme.night!.color.divider}`,
                    }}
                  >
                    <td className="px-3 py-2">
                      <SourceTag source={row.source} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: dashboardTheme.night!.color.text }}>
                      {row.avgHours !== null ? formatHours(row.avgHours) : <span style={{ color: dashboardTheme.night!.color.subtle }}>—</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: dashboardTheme.night!.color.muted }}>{row.leads}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: dashboardTheme.night!.color.muted }}>{row.booked}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: row.bookedRate >= 0.4 ? '#7CE0B0' : dashboardTheme.night!.color.text }}>
                      {Math.round(row.bookedRate * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </NightPanel>
  );
}

function SpeedBucket({
  label,
  rate,
  tone,
  rightAlign,
}: {
  label: string;
  rate: number;
  tone: 'accent' | 'warning';
  rightAlign?: boolean;
}) {
  const color = tone === 'accent' ? '#7CE0B0' : '#FFD089';
  return (
    <div className={rightAlign ? 'sm:text-right' : ''}>
      <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: dashboardTheme.night!.color.subtle }}>{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums" style={{ color }}>
        {Math.round(rate * 100)}<span className="text-sm font-medium" style={{ color: dashboardTheme.night!.color.muted }}>% booked</span>
      </p>
    </div>
  );
}

function formatHours(hours: number | null): string {
  if (hours === null || !Number.isFinite(hours) || hours < 0) return '—';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 24) return `${hours.toFixed(hours < 3 ? 1 : 0)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function accentForResponseHours(hours: number | null): 'accent' | 'warning' | 'critical' | 'neutral' {
  if (hours === null) return 'neutral';
  if (hours < 1) return 'accent';
  if (hours < 6) return 'warning';
  return 'critical';
}
