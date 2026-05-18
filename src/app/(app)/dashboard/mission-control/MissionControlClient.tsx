'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { brand } from '@/app/ui/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentRow = {
  id: string;
  name: string;
  status: string;
  category: string;
  autonomy: string;
};

type RunRow = {
  id: string;
  agent_id: string;
  status: 'running' | 'succeeded' | 'failed' | 'needs_approval' | 'cancelled';
  summary: string | null;
  cost_cents: number | null;
  duration_ms: number | null;
  started_at: string;
  trigger: string | null;
};

type ActionRow = {
  id: string;
  agent_id: string;
  action_type: string;
  preview: string;
  created_at: string;
};

type GithubEventRow = {
  id: string;
  event_type: string;
  action: string | null;
  repo: string | null;
  metadata: Record<string, string> | null;
  status: string;
  created_at: string;
};

type MemoryDoc = {
  id: string;
  category: string;
  title: string;
  vault_path: string;
  created_at: string;
};

type InsightRow = {
  id: string;
  agent_id: string | null;
  category: string;
  severity: string;
  title: string;
  created_at: string;
};

type AgentStats = { runs: number; successes: number; failures: number; costCents: number };

type Metrics = {
  totalRuns7d: number;
  totalCostCents7d: number;
  successRate7d: number;
  activeAgents: number;
  totalAgents: number;
  pendingActions: number;
};

type Props = {
  agents: AgentRow[];
  runs: RunRow[];
  actions: ActionRow[];
  github: GithubEventRow[];
  memory: MemoryDoc[];
  insights: InsightRow[];
  metrics: Metrics;
  agentStatsMap: Record<string, AgentStats>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`;
  return `${Math.floor(ms / 86_400_000)}d`;
}

function fmtCost(cents: number): string {
  if (cents === 0) return '—';
  if (cents < 100) return `${cents}¢`;
  return `$${(cents / 100).toFixed(2)}`;
}

const DOT: Record<string, string> = {
  running: 'bg-blue-500',
  succeeded: 'bg-emerald-500',
  failed: 'bg-red-500',
  needs_approval: 'bg-amber-500',
  cancelled: 'bg-slate-300',
};

const GH_LABEL: Record<string, string> = {
  pull_request: 'PR',
  push: 'Push',
  deployment_status: 'Deploy',
  deployment_failure: 'Fail',
  adr_flag: 'ADR',
  release: 'Release',
};

const GH_DOT: Record<string, string> = {
  deployment_failure: 'bg-red-500',
  adr_flag: 'bg-amber-500',
};

const SEVERITY_CHIP: Record<string, string> = {
  critical: 'text-red-700 bg-red-50 border-red-100',
  high: 'text-orange-700 bg-orange-50 border-orange-100',
  medium: 'text-amber-700 bg-amber-50 border-amber-100',
  low: 'text-slate-500 bg-slate-50 border-slate-100',
};

const MEM_COLOR: Record<string, string> = {
  ux: 'text-violet-600',
  admin: 'text-blue-600',
  design: 'text-pink-600',
  analytics: 'text-emerald-600',
  deployments: 'text-orange-600',
  bugs: 'text-red-600',
  architecture: 'text-slate-600',
  sops: 'text-teal-600',
  pricing: 'text-green-600',
  customers: 'text-indigo-600',
};

// ─── Shared panel shell ───────────────────────────────────────────────────────

function Panel({
  label,
  badge,
  action,
  children,
  className = '',
}: {
  label: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl overflow-hidden border border-black/[0.06] bg-white/92 backdrop-blur-xl shadow-[0_2px_16px_rgba(2,6,23,0.06)] ${className}`}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-black/[0.04] flex-shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 flex-1">
          {label}
        </span>
        {badge}
        {action}
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">{children}</div>
    </div>
  );
}

// ─── Live clock ───────────────────────────────────────────────────────────────

function LiveClock() {
  const [t, setT] = useState('');
  useEffect(() => {
    const fmt = () => new Date().toLocaleTimeString('en-AU', { hour12: false });
    setT(fmt());
    const id = setInterval(() => setT(fmt()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="text-[10px] font-mono text-slate-400 tabular-nums">{t}</span>;
}

// ─── Status bar ───────────────────────────────────────────────────────────────

function StatusBar({ m, liveCount, isConnected }: { m: Metrics; liveCount: number; isConnected: boolean }) {
  const items = [
    { label: 'Agents', value: `${m.activeAgents}/${m.totalAgents}` },
    { label: 'Runs 7d', value: m.totalRuns7d.toLocaleString() },
    { label: 'Success', value: `${m.successRate7d}%`, warn: m.successRate7d < 80, accent: m.successRate7d >= 90 },
    { label: 'Cost 7d', value: fmtCost(m.totalCostCents7d) },
    { label: 'Pending', value: m.pendingActions.toString(), warn: m.pendingActions > 0 },
  ];
  return (
    <div className="flex items-center gap-5 px-5 py-3 rounded-2xl border border-black/[0.06] bg-white/92 backdrop-blur-xl shadow-[0_2px_16px_rgba(2,6,23,0.06)] flex-shrink-0">
      <div className="flex items-center gap-1.5">
        <span
          className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}
        />
        <span className="text-[10px] font-medium text-slate-500">{isConnected ? 'Live' : 'Offline'}</span>
      </div>
      <div className="w-px h-4 bg-black/10" />
      {items.map((item) => (
        <div key={item.label} className="flex flex-col">
          <span
            className={`text-[13px] font-semibold font-mono tabular-nums ${
              item.warn ? 'text-amber-600' : item.accent ? 'text-emerald-600' : 'text-slate-900'
            }`}
          >
            {item.value}
          </span>
          <span className="text-[9px] uppercase tracking-widest text-slate-400">{item.label}</span>
        </div>
      ))}
      {liveCount > 0 && (
        <>
          <div className="w-px h-4 bg-black/10" />
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[11px] font-mono text-blue-600">{liveCount} running</span>
          </div>
        </>
      )}
      <div className="ml-auto flex items-center gap-3">
        <LiveClock />
        <Link
          href="/dashboard/agents"
          className="text-[10px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
        >
          Agents →
        </Link>
      </div>
    </div>
  );
}

// ─── Agent feed ───────────────────────────────────────────────────────────────

function AgentFeed({
  runs,
  agentMap,
  isLive,
}: {
  runs: RunRow[];
  agentMap: Map<string, string>;
  isLive: boolean;
}) {
  return (
    <Panel
      label="Agent Feed"
      badge={
        isLive ? (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-medium text-emerald-600">live</span>
          </span>
        ) : null
      }
      className="h-full"
    >
      <AnimatePresence initial={false}>
        {runs.slice(0, 35).map((run) => (
          <motion.div
            key={run.id}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="flex items-start gap-3 px-4 py-2.5 border-b border-black/[0.04] hover:bg-black/[0.015] transition-colors"
          >
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${DOT[run.status] ?? 'bg-slate-400'} ${run.status === 'running' ? 'animate-pulse' : ''}`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5 mb-0.5">
                <span className="text-[11px] font-medium text-slate-900 truncate">
                  {agentMap.get(run.agent_id) ?? run.agent_id}
                </span>
                {run.trigger && (
                  <span className="text-[9px] font-mono text-slate-400 flex-shrink-0">{run.trigger}</span>
                )}
              </div>
              {run.summary && (
                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{run.summary}</p>
              )}
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-mono text-slate-400">{rel(run.started_at)}</span>
                {run.cost_cents != null && run.cost_cents > 0 && (
                  <span className="text-[10px] font-mono text-slate-400">{fmtCost(run.cost_cents)}</span>
                )}
                {run.duration_ms != null && (
                  <span className="text-[10px] font-mono text-slate-400">
                    {(run.duration_ms / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      {runs.length === 0 && (
        <div className="flex items-center justify-center h-20 text-[11px] text-slate-400">
          No runs yet
        </div>
      )}
    </Panel>
  );
}

// ─── Approval queue ───────────────────────────────────────────────────────────

function ApprovalQueue({
  actions,
  agentMap,
  onDecide,
}: {
  actions: ActionRow[];
  agentMap: Map<string, string>;
  onDecide: (id: string, decision: 'approve' | 'reject') => Promise<void>;
}) {
  const [busy, setBusy] = useState<Set<string>>(new Set());

  async function decide(id: string, decision: 'approve' | 'reject') {
    setBusy((s) => new Set(s).add(id));
    try {
      await onDecide(id, decision);
    } finally {
      setBusy((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  }

  return (
    <Panel
      label="Approval Queue"
      badge={
        actions.length > 0 ? (
          <span className="text-[10px] font-mono font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">
            {actions.length}
          </span>
        ) : null
      }
      action={
        <Link
          href="/dashboard/agents"
          className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
        >
          All →
        </Link>
      }
      className="h-full"
    >
      <AnimatePresence>
        {actions.map((action) => (
          <motion.div
            key={action.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -16, transition: { duration: 0.15 } }}
            className="px-4 py-3 border-b border-black/[0.04]"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-slate-900 truncate">{action.action_type}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {agentMap.get(action.agent_id) ?? action.agent_id} · {rel(action.created_at)}
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 line-clamp-2 mb-2.5 leading-relaxed">{action.preview}</p>
            <div className="flex items-center gap-2">
              <button
                disabled={busy.has(action.id)}
                onClick={() => decide(action.id, 'approve')}
                className="text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 disabled:opacity-40 rounded-lg px-2.5 py-1 transition-colors"
              >
                Approve
              </button>
              <button
                disabled={busy.has(action.id)}
                onClick={() => decide(action.id, 'reject')}
                className="text-[11px] font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 disabled:opacity-40 rounded-lg px-2.5 py-1 transition-colors"
              >
                Reject
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      {actions.length === 0 && (
        <div className="flex items-center justify-center h-20">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Queue clear
          </div>
        </div>
      )}
    </Panel>
  );
}

// ─── GitHub activity ──────────────────────────────────────────────────────────

function GitHubActivity({ events }: { events: GithubEventRow[] }) {
  function dot(evt: GithubEventRow): string {
    if (GH_DOT[evt.event_type]) return GH_DOT[evt.event_type];
    if (evt.event_type === 'deployment_status' && evt.action === 'success') return 'bg-emerald-500';
    if (evt.event_type === 'pull_request' && (evt.action === 'closed' || evt.action === 'merged'))
      return 'bg-emerald-500';
    if (evt.event_type === 'pull_request' && evt.action === 'opened') return 'bg-blue-500';
    return 'bg-slate-400';
  }

  function title(evt: GithubEventRow): string {
    const m = evt.metadata;
    if (!m) return evt.event_type;
    if (evt.event_type === 'pull_request') return m.pr_title ?? `PR #${m.pr_number ?? '?'}`;
    if (evt.event_type === 'deployment_status') return `${m.environment ?? 'production'} — ${evt.action ?? ''}`;
    if (evt.event_type === 'deployment_failure') return `Failed — ${m.branch ?? 'main'}`;
    if (evt.event_type === 'adr_flag') return m.pr_title ?? 'ADR flag';
    if (evt.event_type === 'push') return m.message ?? 'Push';
    if (evt.event_type === 'release') return m.tag_name ?? 'Release';
    return evt.event_type;
  }

  function prUrl(evt: GithubEventRow): string | null {
    if (evt.event_type === 'pull_request' && evt.metadata?.pr_number && evt.repo) {
      return `https://github.com/${evt.repo}/pull/${evt.metadata.pr_number}`;
    }
    return null;
  }

  return (
    <Panel
      label="GitHub Activity"
      action={
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
        >
          GitHub →
        </a>
      }
      className="h-full"
    >
      {events.map((evt) => {
        const url = prUrl(evt);
        const label = GH_LABEL[evt.event_type] ?? evt.event_type;
        const t = title(evt);
        const d = dot(evt);
        return (
          <div
            key={evt.id}
            className="flex items-start gap-3 px-4 py-2.5 border-b border-black/[0.04] hover:bg-black/[0.015] transition-colors"
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${d}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[9px] font-mono font-medium uppercase tracking-wide text-slate-400">
                  {label}
                </span>
                {evt.action && (
                  <span className="text-[9px] text-slate-400">{evt.action}</span>
                )}
              </div>
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-medium text-slate-900 hover:text-blue-600 transition-colors line-clamp-1 block"
                >
                  {t}
                </a>
              ) : (
                <p className="text-[11px] font-medium text-slate-900 line-clamp-1">{t}</p>
              )}
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-mono text-slate-400">{rel(evt.created_at)}</span>
                {evt.repo && (
                  <span className="text-[10px] font-mono text-slate-400 truncate">{evt.repo}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {events.length === 0 && (
        <div className="flex items-center justify-center h-20 text-[11px] text-slate-400">
          No events yet
        </div>
      )}
    </Panel>
  );
}

// ─── Operations health ────────────────────────────────────────────────────────

function OperationsHealth({
  agents,
  metrics,
  agentStatsMap,
}: {
  agents: AgentRow[];
  metrics: Metrics;
  agentStatsMap: Record<string, AgentStats>;
}) {
  const topAgents = agents
    .map((a) => ({ ...a, stats: agentStatsMap[a.id] ?? { runs: 0, successes: 0, failures: 0, costCents: 0 } }))
    .sort((a, b) => b.stats.runs - a.stats.runs)
    .slice(0, 10);

  const categories = agents.reduce<Record<string, { count: number; active: number }>>((acc, a) => {
    if (!acc[a.category]) acc[a.category] = { count: 0, active: 0 };
    acc[a.category].count += 1;
    if (a.status === 'enabled') acc[a.category].active += 1;
    return acc;
  }, {});

  return (
    <Panel label="Operations Health" className="h-full">
      {/* Summary strip */}
      <div className="grid grid-cols-4 divide-x divide-black/[0.04] border-b border-black/[0.04] flex-shrink-0">
        {[
          {
            label: 'Success Rate',
            value: `${metrics.successRate7d}%`,
            warn: metrics.successRate7d < 80,
            accent: metrics.successRate7d >= 90,
          },
          { label: 'Runs (7d)', value: metrics.totalRuns7d.toLocaleString() },
          { label: 'Cost (7d)', value: fmtCost(metrics.totalCostCents7d) },
          { label: 'Active', value: `${metrics.activeAgents} / ${metrics.totalAgents}` },
        ].map((s) => (
          <div key={s.label} className="px-4 py-3">
            <div
              className={`text-[13px] font-semibold font-mono tabular-nums ${
                s.warn ? 'text-amber-600' : s.accent ? 'text-emerald-600' : 'text-slate-900'
              }`}
            >
              {s.value}
            </div>
            <div className="text-[9px] uppercase tracking-widest text-slate-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 divide-x divide-black/[0.04] flex-1 min-h-0">
        {/* Agent leaderboard */}
        <div className="overflow-y-auto p-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Agent leaderboard</div>
          <div className="space-y-2">
            {topAgents.map((a) => {
              const rate =
                a.stats.runs > 0 ? Math.round((a.stats.successes / a.stats.runs) * 100) : null;
              return (
                <div key={a.id} className="flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: a.status === 'enabled' ? brand.accent : '#CBD5E1' }}
                  />
                  <span className="text-[11px] text-slate-700 flex-1 truncate">{a.name}</span>
                  <span className="text-[10px] font-mono text-slate-400 tabular-nums w-10 text-right">
                    {a.stats.runs}r
                  </span>
                  {rate !== null && (
                    <span
                      className={`text-[10px] font-mono tabular-nums w-8 text-right ${
                        rate < 70 ? 'text-red-500' : rate < 90 ? 'text-amber-500' : 'text-emerald-500'
                      }`}
                    >
                      {rate}%
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-slate-400 tabular-nums w-12 text-right">
                    {fmtCost(a.stats.costCents)}
                  </span>
                </div>
              );
            })}
            {topAgents.length === 0 && (
              <p className="text-[11px] text-slate-400">No runs in 7 days</p>
            )}
          </div>
        </div>

        {/* Category breakdown */}
        <div className="p-4 overflow-y-auto">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">By category</div>
          <div className="space-y-2">
            {Object.entries(categories).map(([cat, { count, active }]) => (
              <div key={cat} className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] text-slate-700 capitalize">{cat}</span>
                    <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                      {active}/{count}
                    </span>
                  </div>
                  <div className="h-1 bg-black/[0.04] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(active / count) * 100}%`,
                        background: brand.accent,
                        opacity: 0.7,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

// ─── Memory pulse ─────────────────────────────────────────────────────────────

function MemoryPulse({ memory, insights }: { memory: MemoryDoc[]; insights: InsightRow[] }) {
  return (
    <Panel label="Memory & Intelligence" className="h-full">
      {insights.length > 0 && (
        <>
          <div className="px-4 pt-3 pb-1.5 text-[10px] uppercase tracking-widest text-slate-400">
            Insights
          </div>
          {insights.slice(0, 5).map((i) => (
            <div
              key={i.id}
              className="flex items-start gap-2.5 px-4 py-2 hover:bg-black/[0.015] transition-colors border-b border-black/[0.04]"
            >
              <span
                className={`text-[9px] font-semibold uppercase rounded border px-1.5 py-0.5 flex-shrink-0 mt-0.5 ${SEVERITY_CHIP[i.severity] ?? 'text-slate-500 bg-slate-50 border-slate-100'}`}
              >
                {i.severity}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] text-slate-700 line-clamp-2 leading-relaxed">{i.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[9px] font-mono text-slate-400">{rel(i.created_at)}</span>
                  <span className="text-[9px] text-slate-400">{i.category}</span>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {memory.length > 0 && (
        <>
          <div className="px-4 pt-3 pb-1.5 text-[10px] uppercase tracking-widest text-slate-400">
            Memory Vault
          </div>
          {memory.map((doc) => (
            <div
              key={doc.id}
              className="flex items-start gap-2.5 px-4 py-2 hover:bg-black/[0.015] transition-colors border-b border-black/[0.04]"
            >
              <span
                className={`text-[9px] font-mono flex-shrink-0 pt-0.5 tabular-nums ${MEM_COLOR[doc.category] ?? 'text-slate-500'}`}
              >
                {doc.category}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] text-slate-700 line-clamp-1">{doc.title}</p>
                <span className="text-[10px] font-mono text-slate-400">{rel(doc.created_at)}</span>
              </div>
            </div>
          ))}
        </>
      )}

      {insights.length === 0 && memory.length === 0 && (
        <div className="flex items-center justify-center h-20 text-[11px] text-slate-400">
          No data
        </div>
      )}
    </Panel>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export function MissionControlClient({
  agents,
  runs: initialRuns,
  actions: initialActions,
  github,
  memory,
  insights,
  metrics: initialMetrics,
  agentStatsMap,
}: Props) {
  const [runs, setRuns] = useState<RunRow[]>(initialRuns);
  const [actions, setActions] = useState<ActionRow[]>(initialActions);
  const [metrics, setMetrics] = useState<Metrics>(initialMetrics);
  const [isConnected, setIsConnected] = useState(false);

  const agentMap = React.useMemo(() => new Map(agents.map((a) => [a.id, a.name])), [agents]);
  const liveCount = runs.filter((r) => r.status === 'running').length;

  // Realtime: track agent run inserts and updates
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const ch = supabase
      .channel('mc-runs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_runs' }, (p) => {
        const r = p.new as RunRow;
        setRuns((prev) => [r, ...prev].slice(0, 50));
        if (r.status === 'needs_approval') {
          setMetrics((m) => ({ ...m, pendingActions: m.pendingActions + 1 }));
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'agent_runs' }, (p) => {
        const r = p.new as RunRow;
        setRuns((prev) => prev.map((x) => (x.id === r.id ? { ...x, ...r } : x)));
      })
      .subscribe((status) => setIsConnected(status === 'SUBSCRIBED'));

    return () => { supabase.removeChannel(ch); };
  }, []);

  const handleDecide = useCallback(async (id: string, decision: 'approve' | 'reject') => {
    const res = await fetch(`/api/agents/actions/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    if (res.ok) {
      setActions((prev) => prev.filter((a) => a.id !== id));
      setMetrics((m) => ({ ...m, pendingActions: Math.max(0, m.pendingActions - 1) }));
      toast.success(decision === 'approve' ? 'Action approved' : 'Action rejected');
    } else {
      toast.error('Failed — try again');
    }
  }, []);

  return (
    <div className="flex flex-col gap-3" style={{ minHeight: 'calc(100vh - 160px)' }}>
      <StatusBar m={metrics} liveCount={liveCount} isConnected={isConnected} />

      {/* Main row: agent feed | approval queue | github */}
      <div className="grid grid-cols-3 gap-3" style={{ height: '400px' }}>
        <AgentFeed runs={runs} agentMap={agentMap} isLive={isConnected} />
        <ApprovalQueue actions={actions} agentMap={agentMap} onDecide={handleDecide} />
        <GitHubActivity events={github} />
      </div>

      {/* Bottom row: ops health (2/3) | memory + insights (1/3) */}
      <div className="grid grid-cols-3 gap-3" style={{ height: '320px' }}>
        <div className="col-span-2">
          <OperationsHealth agents={agents} metrics={metrics} agentStatsMap={agentStatsMap} />
        </div>
        <MemoryPulse memory={memory} insights={insights} />
      </div>
    </div>
  );
}
