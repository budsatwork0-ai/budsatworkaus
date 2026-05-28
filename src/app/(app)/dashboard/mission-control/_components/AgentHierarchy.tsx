'use client';

import React, { useMemo } from 'react';

type AgentRow = {
  id: string;
  name: string;
  status: string;
  category: string;
  autonomy: string;
  last_run_at?: string | null;
  last_success_at?: string | null;
};

interface Props {
  agents: AgentRow[];
  latestRuns?: Record<string, { confidence_score: number | null; finished_at: string | null }>;
}

const CATEGORY_META: Record<string, { label: string; dot: string; chip: string }> = {
  sales:      { label: 'Sales',      dot: 'bg-emerald-400', chip: 'border-emerald-400/30 text-emerald-300' },
  support:    { label: 'Support',    dot: 'bg-sky-400',     chip: 'border-sky-400/30 text-sky-300' },
  ops:        { label: 'Ops',        dot: 'bg-amber-400',   chip: 'border-amber-400/30 text-amber-300' },
  hiring:     { label: 'Hiring',     dot: 'bg-violet-400',  chip: 'border-violet-400/30 text-violet-300' },
  finance:    { label: 'Finance',    dot: 'bg-teal-400',    chip: 'border-teal-400/30 text-teal-300' },
  compliance: { label: 'Compliance', dot: 'bg-rose-400',    chip: 'border-rose-400/30 text-rose-300' },
  growth:     { label: 'Growth',     dot: 'bg-pink-400',    chip: 'border-pink-400/30 text-pink-300' },
  ux:         { label: 'UX',         dot: 'bg-indigo-400',  chip: 'border-indigo-400/30 text-indigo-300' },
};

const FALLBACK_META = { label: 'Other', dot: 'bg-white/30', chip: 'border-white/15 text-white/50' };

const STATUS_STYLE: Record<string, string> = {
  enabled:  'bg-emerald-400/15 text-emerald-400 border-emerald-400/25',
  disabled: 'bg-white/[0.04] text-white/30 border-white/[0.08]',
  paused:   'bg-amber-400/10 text-amber-400 border-amber-400/20',
  planned:  'bg-zinc-400/10 text-zinc-400 border-zinc-400/20',
  idle:     'bg-amber-400/10 text-amber-300 border-amber-400/20',
  watch:    'bg-sky-400/10 text-sky-300 border-sky-400/20',
};

/** Statuses that count as "active" for the fleet summary line */
const ACTIVE_STATUSES = new Set(['enabled', 'idle', 'watch']);

function formatRunAt(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const diffHrs = (Date.now() - d.getTime()) / 3_600_000;
  if (diffHrs < 1) return '<1h ago';
  if (diffHrs < 24) return `${Math.floor(diffHrs)}h ago`;
  if (diffHrs < 48) return 'yesterday';
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export function AgentHierarchy({ agents, latestRuns = {} }: Props) {
  const byCategory = useMemo(() => {
    const map = new Map<string, AgentRow[]>();
    for (const agent of agents) {
      const cat = agent.category ?? 'other';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(agent);
    }
    const order = ['sales', 'support', 'ops', 'finance', 'hiring', 'compliance', 'growth', 'ux'];
    return [...map.entries()].sort(([a], [b]) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [agents]);

  const activeCount = agents.filter(a => ACTIVE_STATUSES.has(a.status)).length;
  const plannedCount = agents.filter(a => a.status === 'planned').length;

  if (agents.length === 0) return null;

  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm shadow-[0_24px_70px_-30px_rgba(0,0,0,0.6)]">
      <div className="flex items-start gap-3 border-b border-white/[0.05] px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">Runtime agent fleet</h2>
          <p className="mt-1 text-xs text-white/45">
            {activeCount} of {agents.length} agents active
            {plannedCount > 0 && ` · ${plannedCount} planned (awaiting integration)`}
            {' · runs on Vercel cron, separate from the Dev OS layer'}
          </p>
        </div>
      </div>

      <div className="space-y-5 px-5 py-4">
        {byCategory.map(([cat, catAgents]) => {
          const meta = CATEGORY_META[cat] ?? FALLBACK_META;
          const activeInCat = catAgents.filter(a => ACTIVE_STATUSES.has(a.status)).length;
          return (
            <div key={cat}>
              <div className="mb-2 flex items-center gap-2">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${meta.chip}`}>
                  {meta.label}
                </span>
                <span className="text-[10px] text-white/30">{activeInCat}/{catAgents.length} active</span>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {catAgents.map(agent => {
                  const statusStyle = STATUS_STYLE[agent.status] ?? STATUS_STYLE.disabled;
                  const latest = latestRuns[agent.id];
                  const runAt = agent.last_run_at ?? latest?.finished_at;
                  const conf = latest?.confidence_score;
                  return (
                    <div
                      key={agent.id}
                      className="flex flex-col gap-1 rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-[12px] text-white/75">{agent.name}</span>
                        <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${statusStyle}`}>
                          {agent.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-white/30">
                        <span suppressHydrationWarning>{formatRunAt(runAt)}</span>
                        {conf != null && (
                          <span className="text-white/25">·</span>
                        )}
                        {conf != null && (
                          <span className={conf >= 0.75 ? 'text-emerald-400/60' : conf >= 0.5 ? 'text-amber-400/60' : 'text-rose-400/60'}>
                            {Math.round(conf * 100)}% conf
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
