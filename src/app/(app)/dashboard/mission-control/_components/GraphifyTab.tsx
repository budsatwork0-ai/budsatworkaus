'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { GraphifyResponse } from '@/app/api/bud/graphify/route';
import { BRIDGE_BASE } from './BridgeStatus';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">{title}</h3>
      {children}
    </div>
  );
}

type ExtractMode = 'update' | 'extract_wiki' | 'extract_deep';
type ExtractState = 'idle' | 'running' | 'done' | 'error' | 'vercel';

export function GraphifyTab() {
  const [data, setData] = useState<GraphifyResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Extract panel state
  const [extractState, setExtractState] = useState<ExtractState>('idle');
  const [extractLog, setExtractLog] = useState<{ line: string; stderr?: boolean }[]>([]);
  const [extractError, setExtractError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const loadGraph = useCallback(() => {
    setLoading(true);
    fetch('/api/bud/graphify')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ available: false, reason: 'Request failed.' }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [extractLog]);

  async function runExtract(mode: ExtractMode) {
    setExtractState('running');
    setExtractLog([]);
    setExtractError(null);

    const isVercel = typeof window !== 'undefined' && window.location.hostname !== 'localhost';

    // On Vercel: try the local bridge first, fall back to API (which will explain if unavailable)
    let endpoint = '/api/bud/graphify/extract';
    if (isVercel) {
      try {
        const ping = await fetch(`${BRIDGE_BASE}/health`, { signal: AbortSignal.timeout(1000) });
        if (ping.ok) endpoint = `${BRIDGE_BASE}/graphify/extract`;
      } catch { /* bridge not running — use API which returns 422 with instructions */ }
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });

    if (res.status === 422) {
      const d = await res.json() as { error: string };
      setExtractState('vercel');
      setExtractError(d.error);
      return;
    }

    if (!res.ok || !res.body) {
      setExtractState('error');
      setExtractError(`HTTP ${res.status}`);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop() ?? '';
      for (const part of parts) {
        const line = part.replace(/^data: /, '').trim();
        if (!line) continue;
        try {
          const msg = JSON.parse(line) as { type: string; line?: string; stderr?: boolean; ok?: boolean; message?: string };
          if (msg.type === 'log' && msg.line) {
            setExtractLog(prev => [...prev, { line: msg.line!, stderr: msg.stderr }]);
          } else if (msg.type === 'done') {
            setExtractState(msg.ok ? 'done' : 'error');
            if (msg.ok) loadGraph();
          } else if (msg.type === 'error') {
            setExtractState('error');
            setExtractError(msg.message ?? 'Unknown error');
          }
        } catch { /* skip malformed */ }
      }
    }
  }

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

      {/* ── Extract panel ──────────────────────────────────────────────────── */}
      <Section title="Re-extract knowledge graph">
        <p className="mb-3 text-[12px] text-white/45">
          Run from your local machine. <strong className="text-white/70">Quick update</strong> is AST-only (fast, free).{' '}
          <strong className="text-white/70">Deep extract</strong> uses Claude to add semantic relationships and builds the agent wiki.
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            disabled={extractState === 'running'}
            onClick={() => void runExtract('update')}
            className="rounded-lg border border-white/[0.10] bg-white/[0.04] px-3.5 py-2 text-[12px] font-medium text-white/70 hover:bg-white/[0.08] disabled:opacity-40"
          >
            Quick update (AST)
          </button>
          <button
            disabled={extractState === 'running'}
            onClick={() => void runExtract('extract_wiki')}
            className="rounded-lg border border-emerald-400/25 bg-emerald-500/[0.08] px-3.5 py-2 text-[12px] font-medium text-emerald-300 hover:bg-emerald-500/[0.14] disabled:opacity-40"
          >
            {extractState === 'running' ? 'Extracting…' : 'Deep extract (Claude + wiki)'}
          </button>
          <button
            disabled={extractState === 'running'}
            onClick={() => void runExtract('extract_deep')}
            className="rounded-lg border border-violet-400/25 bg-violet-500/[0.07] px-3.5 py-2 text-[12px] font-medium text-violet-300 hover:bg-violet-500/[0.12] disabled:opacity-40"
          >
            Full deep + dedup
          </button>
        </div>

        {extractState === 'vercel' && (
          <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-500/[0.07] p-3 space-y-1.5">
            <p className="text-[12px] font-medium text-amber-300">Start the local bridge to run from here:</p>
            <pre className="rounded bg-black/30 px-3 py-2 text-[11px] text-amber-200/80 select-all">node scripts/bud-bridge.js</pre>
            <p className="text-[11px] text-amber-200/50">Once running, the "bridge live" badge appears in the header and these buttons work from budsatwork.com.</p>
          </div>
        )}

        {(extractState === 'running' || extractLog.length > 0) && (
          <div
            ref={logRef}
            className="mt-3 h-48 overflow-y-auto rounded-lg border border-white/[0.07] bg-black/40 p-3 font-mono text-[11px] leading-relaxed"
          >
            {extractLog.map((entry, i) => (
              <div key={i} className={entry.stderr ? 'text-amber-300/70' : 'text-white/60'}>
                {entry.line}
              </div>
            ))}
            {extractState === 'running' && (
              <div className="mt-1 animate-pulse text-emerald-400/60">▋</div>
            )}
          </div>
        )}

        {extractState === 'done' && (
          <p className="mt-2 text-[12px] text-emerald-400">
            ✓ Complete — graph reloaded above.
          </p>
        )}
        {extractState === 'error' && extractError && (
          <p className="mt-2 text-[12px] text-red-400">{extractError}</p>
        )}
      </Section>

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
