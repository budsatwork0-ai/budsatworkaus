'use client';

import React, { useEffect, useState } from 'react';
import type { EvidenceResponse, EvidenceRow } from '@/app/api/bud/evidence/route';

const SOURCE_STYLE: Record<string, string> = {
  terminal:   'border-sky-400/30 bg-sky-500/[0.08] text-sky-300',
  deployment: 'border-violet-400/30 bg-violet-500/[0.08] text-violet-300',
  evidence:   'border-teal-400/30 bg-teal-500/[0.08] text-teal-300',
};

const STATUS_DOT: Record<string, string> = {
  passed:   'bg-emerald-400',
  failed:   'bg-red-400',
  blocked:  'bg-amber-400',
  recorded: 'bg-white/30',
};

function EvidenceRow({ row }: { row: EvidenceRow }) {
  const [expanded, setExpanded] = useState(false);
  const chipStyle = SOURCE_STYLE[row.source_type] ?? SOURCE_STYLE.evidence;
  const dot = STATUS_DOT[row.status] ?? STATUS_DOT.recorded;
  const hasBody = Boolean(row.body?.trim() || row.stderr?.trim());

  return (
    <div
      className={`rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 ${hasBody ? 'cursor-pointer hover:border-white/[0.10]' : ''}`}
      onClick={() => hasBody && setExpanded(e => !e)}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-1 inline-flex h-2 w-2 shrink-0 rounded-full ${dot}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm text-white/80">{row.label}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${chipStyle}`}>
              {row.source_type}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-white/30">
            {new Date(row.recorded_at).toLocaleString()} · {row.status}
          </p>
        </div>
        {hasBody && (
          <span className="shrink-0 text-[10px] text-white/30">{expanded ? '▲' : '▼'}</span>
        )}
      </div>
      {expanded && hasBody && (
        <div className="mt-3 space-y-2">
          {row.body && (
            <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-[11px] leading-relaxed text-white/60">
              {row.body.slice(0, 3_000)}{row.body.length > 3_000 ? '\n…(truncated)' : ''}
            </pre>
          )}
          {row.stderr && (
            <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg bg-red-950/30 p-3 text-[11px] leading-relaxed text-red-300/70">
              {row.stderr.slice(0, 1_000)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export function EvidenceTab() {
  const [data, setData] = useState<EvidenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'terminal' | 'deployment' | 'evidence'>('all');

  const load = () => {
    setLoading(true);
    fetch('/api/bud/evidence')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ available: false, reason: 'Request failed.' }))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-white/40">
        Loading evidence…
      </div>
    );
  }

  if (!data || !data.available) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-8 text-center">
        <p className="text-sm font-medium text-white/60">No evidence available.</p>
        <p className="mt-1 text-xs text-white/35">
          {(!data || !data.available) ? ((data as { available: false; reason: string } | null)?.reason ?? '') : ''}
        </p>
      </div>
    );
  }

  const visible = filter === 'all'
    ? data.rows
    : data.rows.filter(r => r.source_type === filter);

  const counts = {
    terminal:   data.rows.filter(r => r.source_type === 'terminal').length,
    deployment: data.rows.filter(r => r.source_type === 'deployment').length,
    evidence:   data.rows.filter(r => r.source_type === 'evidence').length,
  };

  return (
    <div className="space-y-4">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl border border-teal-400/20 bg-gradient-to-br from-teal-500/[0.06] to-cyan-500/[0.03] p-6">
        <div className="pointer-events-none absolute -top-12 right-0 h-40 w-56 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-teal-400" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-300/80">Evidence · Operational Record</span>
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Evidence Store</h2>
          <p className="mt-1 text-sm text-white/50">
            {data.total} records · every claim links back to real output
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-sky-400/30 bg-sky-500/[0.08] px-3 py-1 text-[11px] font-medium text-sky-300">{counts.terminal} terminal</span>
            <span className="rounded-full border border-violet-400/30 bg-violet-500/[0.08] px-3 py-1 text-[11px] font-medium text-violet-300">{counts.deployment} deployments</span>
            <span className="rounded-full border border-teal-400/30 bg-teal-500/[0.08] px-3 py-1 text-[11px] font-medium text-teal-300">{counts.evidence} evidence</span>
          </div>
        </div>
      </section>

      {/* ── Filter + refresh ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'terminal', 'deployment', 'evidence'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
              filter === f
                ? 'border-white/20 bg-white/[0.08] text-white'
                : 'border-white/[0.06] text-white/45 hover:text-white/70'
            }`}
          >
            {f === 'all' ? `All (${data.total})` : f}
          </button>
        ))}
        <button
          onClick={load}
          className="ml-auto rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/50 hover:bg-white/[0.06]"
        >
          Refresh
        </button>
      </div>

      {/* ── Evidence list ──────────────────────────────────────────────────── */}
      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-white/35">No evidence recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {visible.map((row, i) => (
            <EvidenceRow key={`${row.source_id}-${i}`} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}
