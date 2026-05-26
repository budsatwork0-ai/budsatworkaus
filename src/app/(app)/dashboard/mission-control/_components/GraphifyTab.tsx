'use client';

import React, { useEffect, useState } from 'react';
import type { GraphifyResponse } from '@/app/api/bud/graphify/route';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">{title}</h3>
      {children}
    </div>
  );
}

export function GraphifyTab() {
  const [data, setData] = useState<GraphifyResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/bud/graphify')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ available: false, reason: 'Request failed.' }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-white/40">
        Reading Graphify output…
      </div>
    );
  }

  if (!data || !data.available) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-8 text-center">
        <p className="text-sm font-medium text-white/60">Graphify evidence unavailable.</p>
        <p className="mt-1 text-xs text-white/35">
          {(!data || !data.available) ? ((data as { available: false; reason: string } | null)?.reason ?? 'Run graphify update . locally to generate the report.') : 'Run graphify update . locally to generate the report.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/[0.06] to-teal-500/[0.03] p-6">
        <div className="pointer-events-none absolute -top-12 right-0 h-40 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300/80">Graphify · Knowledge Graph</span>
            {data.isStale && (
              <span className="rounded-full border border-amber-400/30 bg-amber-400/[0.08] px-2 py-0.5 text-[10px] font-medium text-amber-300">
                stale — run graphify update .
              </span>
            )}
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Architecture Intelligence</h2>
          <p className="mt-1 text-sm text-white/50">
            Report from {data.reportDate} · built from commit <code className="rounded bg-white/[0.06] px-1 text-xs text-white/70">{data.builtFromCommit}</code>
            {data.currentCommit !== 'unknown' && data.currentCommit !== data.builtFromCommit && (
              <span className="ml-2 text-white/35">· HEAD is <code className="rounded bg-white/[0.06] px-1 text-xs">{data.currentCommit}</code></span>
            )}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip label={`${data.stats.nodes.toLocaleString()} nodes`} color="emerald" />
            <Chip label={`${data.stats.edges.toLocaleString()} edges`} color="teal" />
            <Chip label={`${data.stats.communities} communities`} color="sky" />
            <Chip label={`${data.stats.extractionPct}% extracted`} color="muted" />
          </div>
        </div>
      </section>

      {/* ── God nodes (hotspots) ───────────────────────────────────────────── */}
      {data.godNodes.length > 0 && (
        <Section title="Dependency hotspots — most connected nodes">
          <div className="space-y-1.5">
            {data.godNodes.map((node) => (
              <div key={node.rank} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/[0.03]">
                <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-white/25">{node.rank}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-white/80">{node.name}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-white/35">{node.edges} edges</span>
                <div
                  className="h-1 w-16 shrink-0 rounded-full bg-white/10"
                  title={`${node.edges} edges`}
                >
                  <div
                    className="h-full rounded-full bg-emerald-400/50"
                    style={{ width: `${Math.min(100, (node.edges / (data.godNodes[0]?.edges ?? 1)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Surprising connections ─────────────────────────────────────────── */}
      {data.surprisingConnections.length > 0 && (
        <Section title="Surprising cross-file connections">
          <div className="space-y-3">
            {data.surprisingConnections.map((conn, i) => (
              <div key={i} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-4 py-3">
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="text-white/80">{conn.from}</span>
                  <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/45">{conn.relation}</span>
                  <span className="text-white/80">{conn.to}</span>
                </div>
                {conn.note && (
                  <p className="mt-1 truncate text-[11px] text-white/35">{conn.note}</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Hyperedges ─────────────────────────────────────────────────────── */}
      {data.hyperedges.length > 0 && (
        <Section title="Group relationships">
          <div className="space-y-2">
            {data.hyperedges.map((h, i) => (
              <p key={i} className="text-sm text-white/65">{h}</p>
            ))}
          </div>
        </Section>
      )}

      <p className="text-center text-[11px] text-white/25">
        Report generated {new Date(data.reportUpdatedAt).toLocaleString()} · update with <code className="rounded bg-white/[0.05] px-1">graphify update .</code>
      </p>
    </div>
  );
}

function Chip({ label, color }: { label: string; color: 'emerald' | 'teal' | 'sky' | 'muted' }) {
  const styles = {
    emerald: 'border-emerald-400/30 bg-emerald-500/[0.08] text-emerald-300',
    teal:    'border-teal-400/30    bg-teal-500/[0.08]    text-teal-300',
    sky:     'border-sky-400/30     bg-sky-500/[0.08]     text-sky-300',
    muted:   'border-white/15       bg-white/[0.03]       text-white/55',
  };
  return (
    <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${styles[color]}`}>
      {label}
    </span>
  );
}
