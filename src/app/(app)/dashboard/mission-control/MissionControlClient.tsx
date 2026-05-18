'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

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
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function fmtCost(cents: number): string {
  if (cents === 0) return '—';
  if (cents < 100) return `${cents}¢`;
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function parseFailureReason(summary: string | null): string {
  if (!summary) return 'No details recorded — check agent logs';
  const s = summary.toLowerCase();
  if (s.includes('timeout') || s.includes('timed out')) return 'Timed out — the agent took too long to complete';
  if (s.includes('rate limit') || s.includes('429')) return 'Rate limit hit — too many requests to the AI provider';
  if (s.includes('invalid json') || s.includes('parse error') || s.includes('json parse')) return 'Malformed response — agent returned an invalid data format';
  if (s.includes('network') || s.includes('fetch failed') || s.includes('econnrefused')) return "Network error — couldn't reach an external service";
  if (s.includes('unauthorized') || s.includes('403') || s.includes('401')) return 'Auth error — API credentials may be invalid or expired';
  if (s.includes('not found') || s.includes('404')) return 'Resource not found — endpoint or data may have moved';
  if (s.includes('recursion') || s.includes('depth limit')) return 'Recursion limit — agent chain went too deep (max 5 hops)';
  if (s.includes('cost budget') || s.includes('budget exceeded')) return 'Cost cap hit — run was stopped to prevent overspend';
  if (s.includes('dangerous') || s.includes('human review')) return 'Flagged for human review — action requires approval before proceeding';
  if (summary.length > 20 && summary.length < 200) return summary;
  return 'Unexpected error — review the full run output for details';
}

function suggestNextAction(summary: string | null): string {
  if (!summary) return 'Check agent logs and rerun manually';
  const r = summary.toLowerCase();
  if (r.includes('timeout')) return 'Rerun with a narrower scope, or increase timeout in agent config';
  if (r.includes('rate limit')) return 'Wait 10 min then rerun — or reduce cron frequency';
  if (r.includes('auth') || r.includes('api key') || r.includes('unauthorized')) return 'Verify API credentials in environment settings';
  if (r.includes('network') || r.includes('fetch failed')) return 'Check external service status and retry';
  if (r.includes('cost budget')) return 'Review agent scope — it may be processing too much data per run';
  if (r.includes('recursion')) return 'Review callAgent() usage in this agent — check for circular calls';
  if (r.includes('dangerous') || r.includes('human review')) return 'Review and approve the action in the queue below';
  return 'Review the full run output, then rerun or pause the agent if not critical';
}

function isUsefulSummary(summary: string | null): boolean {
  if (!summary || summary.trim().length < 15) return false;
  const s = summary.toLowerCase();
  const noise = [
    'logged 0', 'found 0', '0 results', '0 findings', 'no findings', 'no results',
    'nothing found', 'no new', 'no items', 'no changes', 'no data', 'no records',
    '0 issues', '0 records', '0 items', '0 alerts', '0 matches',
    'completed with no', 'ran successfully with no', 'nothing to report',
  ];
  return !noise.some((p) => s.includes(p));
}

const CATEGORY_COLOR: Record<string, string> = {
  sales: 'text-emerald-600 bg-emerald-50 border-emerald-100',
  support: 'text-blue-600 bg-blue-50 border-blue-100',
  ops: 'text-orange-600 bg-orange-50 border-orange-100',
  hiring: 'text-violet-600 bg-violet-50 border-violet-100',
  finance: 'text-teal-600 bg-teal-50 border-teal-100',
  compliance: 'text-red-600 bg-red-50 border-red-100',
};

const GH_LABEL: Record<string, string> = {
  pull_request: 'PR',
  push: 'Push',
  deployment_status: 'Deploy',
  deployment_failure: 'Deploy failed',
  adr_flag: 'ADR',
  release: 'Release',
};

// ─── Panel ────────────────────────────────────────────────────────────────────

function Panel({
  label,
  badge,
  action,
  children,
  className = '',
  accent,
}: {
  label: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  accent?: 'red' | 'green' | 'amber';
}) {
  const border =
    accent === 'red'
      ? 'border-red-100'
      : accent === 'green'
        ? 'border-emerald-100'
        : accent === 'amber'
          ? 'border-amber-100'
          : 'border-black/[0.06]';
  return (
    <div
      className={`flex flex-col rounded-2xl overflow-hidden border ${border} bg-white/92 backdrop-blur-xl shadow-[0_2px_16px_rgba(2,6,23,0.06)] ${className}`}
    >
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-black/[0.04] flex-shrink-0">
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

// ─── Status Bar ───────────────────────────────────────────────────────────────

function StatusBar({
  m,
  liveCount,
  isConnected,
}: {
  m: Metrics;
  liveCount: number;
  isConnected: boolean;
}) {
  const healthLabel =
    m.successRate7d >= 90 ? 'Healthy' : m.successRate7d >= 70 ? 'Degraded' : 'Critical';
  const healthColor =
    m.successRate7d >= 90
      ? 'text-emerald-600'
      : m.successRate7d >= 70
        ? 'text-amber-600'
        : 'text-red-600';

  return (
    <div className="flex items-center gap-5 px-5 py-3.5 rounded-2xl border border-black/[0.06] bg-white/92 backdrop-blur-xl shadow-[0_2px_16px_rgba(2,6,23,0.06)] flex-shrink-0">
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}
        />
        <span className="text-[11px] font-medium text-slate-600">
          {isConnected ? 'Live' : 'Offline'}
        </span>
      </div>

      <div className="w-px h-4 bg-black/10" />

      <div className="flex items-center gap-1.5">
        <span className={`text-[11px] font-semibold ${healthColor}`}>{healthLabel}</span>
        <span className="text-[11px] text-slate-400">
          · {m.successRate7d}% success (7d)
        </span>
      </div>

      <div className="w-px h-4 bg-black/10" />

      {[
        { label: 'Runs', value: m.totalRuns7d.toLocaleString() },
        { label: 'Cost', value: fmtCost(m.totalCostCents7d) },
        { label: 'Active', value: `${m.activeAgents}/${m.totalAgents} agents` },
      ].map((item) => (
        <span key={item.label} className="text-[11px] text-slate-500">
          <span className="font-semibold text-slate-800">{item.value}</span>
          <span className="ml-1 text-slate-400">{item.label}</span>
        </span>
      ))}

      {m.pendingActions > 0 && (
        <>
          <div className="w-px h-4 bg-black/10" />
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-[11px] font-medium text-amber-700">
              {m.pendingActions} awaiting approval
            </span>
          </div>
        </>
      )}

      {liveCount > 0 && (
        <>
          <div className="w-px h-4 bg-black/10" />
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[11px] font-medium text-blue-600">{liveCount} running</span>
          </div>
        </>
      )}

      <div className="ml-auto flex items-center gap-4">
        <LiveClock />
        <Link
          href="/dashboard/agents"
          className="text-[11px] font-medium text-slate-400 hover:text-slate-700 transition-colors"
        >
          All agents →
        </Link>
      </div>
    </div>
  );
}

// ─── Needs Attention ──────────────────────────────────────────────────────────

function NeedsAttention({
  runs,
  agentMap,
  githubRepo,
  onRerun,
}: {
  runs: RunRow[];
  agentMap: Map<string, AgentRow>;
  githubRepo: string | null;
  onRerun: (agentId: string) => Promise<void>;
}) {
  const [rerunning, setRerunning] = useState<Set<string>>(new Set());

  const failedMap = new Map<string, RunRow>();
  for (const run of runs) {
    if (run.status === 'failed' && !failedMap.has(run.agent_id)) {
      failedMap.set(run.agent_id, run);
    }
  }
  const failed = Array.from(failedMap.values()).slice(0, 6);

  async function handleRerun(agentId: string) {
    setRerunning((s) => new Set(s).add(agentId));
    try {
      await onRerun(agentId);
    } finally {
      setRerunning((s) => {
        const n = new Set(s);
        n.delete(agentId);
        return n;
      });
    }
  }

  if (failed.length === 0) {
    return (
      <Panel label="Needs Attention" accent="green" className="h-full">
        <div className="flex flex-col items-center justify-center h-full gap-2 py-10">
          <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-emerald-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <p className="text-[13px] font-semibold text-slate-700">All clear</p>
          <p className="text-[11px] text-slate-400">No failed agents in recent runs</p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      label="Needs Attention"
      accent="red"
      badge={
        <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-100 rounded-full px-2 py-0.5">
          {failed.length}
        </span>
      }
      className="h-full"
    >
      <div className="divide-y divide-black/[0.04]">
        {failed.map((run) => {
          const agent = agentMap.get(run.agent_id);
          const agentName = agent?.name ?? run.agent_id;
          const reason = parseFailureReason(run.summary);
          const next = suggestNextAction(run.summary);
          const issueTitle = encodeURIComponent(`Agent failure: ${agentName}`);
          const issueBody = encodeURIComponent(
            `**Agent:** ${agentName}\n**Reason:** ${reason}\n**Run ID:** ${run.id}\n**Time:** ${run.started_at}`,
          );
          const issueUrl = githubRepo
            ? `https://github.com/${githubRepo}/issues/new?title=${issueTitle}&body=${issueBody}`
            : `https://github.com/issues/new?title=${issueTitle}&body=${issueBody}`;

          return (
            <div key={run.id} className="px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                <span className="text-[12px] font-semibold text-slate-900">{agentName}</span>
                {agent?.category && (
                  <span
                    className={`text-[9px] font-semibold uppercase tracking-wide border rounded-full px-1.5 py-0.5 ${CATEGORY_COLOR[agent.category] ?? 'text-slate-500 bg-slate-50 border-slate-100'}`}
                  >
                    {agent.category}
                  </span>
                )}
                <span className="ml-auto text-[10px] font-mono text-slate-400 flex-shrink-0">
                  {rel(run.started_at)}
                </span>
              </div>

              <div className="bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5 mb-2">
                <p className="text-[11px] text-red-700 leading-relaxed">{reason}</p>
              </div>

              <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                <span className="font-medium text-slate-700">Suggested: </span>
                {next}
              </p>

              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/dashboard/agents/${run.agent_id}`}
                  className="text-[11px] font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors"
                >
                  View run
                </Link>
                <button
                  disabled={rerunning.has(run.agent_id)}
                  onClick={() => handleRerun(run.agent_id)}
                  className="text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 disabled:opacity-40 rounded-lg px-3 py-1.5 transition-colors"
                >
                  {rerunning.has(run.agent_id) ? 'Running…' : 'Rerun'}
                </button>
                <Link
                  href={`/dashboard/agents/${run.agent_id}`}
                  className="text-[11px] font-medium text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors"
                >
                  Debug
                </Link>
                <a
                  href={issueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-medium text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors"
                >
                  GitHub issue ↗
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ─── Recent Useful Work ───────────────────────────────────────────────────────

function RecentWork({
  runs,
  agentMap,
}: {
  runs: RunRow[];
  agentMap: Map<string, AgentRow>;
}) {
  const useful = runs
    .filter((r) => r.status === 'succeeded' && isUsefulSummary(r.summary))
    .slice(0, 8);

  return (
    <Panel
      label="Recent Useful Work"
      action={
        <Link
          href="/dashboard/agents"
          className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
        >
          All runs →
        </Link>
      }
      className="h-full"
    >
      {useful.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 py-10">
          <p className="text-[12px] font-semibold text-slate-500">Nothing to show yet</p>
          <p className="text-[11px] text-slate-400 text-center max-w-[200px] leading-relaxed">
            Successful agent outputs with real results will appear here
          </p>
        </div>
      ) : (
        <div className="divide-y divide-black/[0.04]">
          {useful.map((run) => {
            const agent = agentMap.get(run.agent_id);
            return (
              <div
                key={run.id}
                className="px-5 py-3.5 hover:bg-black/[0.01] transition-colors"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                  <span className="text-[11px] font-semibold text-slate-800">
                    {agent?.name ?? run.agent_id}
                  </span>
                  {agent?.category && (
                    <span
                      className={`text-[9px] font-semibold uppercase tracking-wide border rounded-full px-1.5 py-0.5 ${CATEGORY_COLOR[agent.category] ?? 'text-slate-500 bg-slate-50 border-slate-100'}`}
                    >
                      {agent.category}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] font-mono text-slate-400 flex-shrink-0">
                    {rel(run.started_at)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">
                  {run.summary}
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  {run.cost_cents != null && run.cost_cents > 0 && (
                    <span className="text-[10px] font-mono text-slate-400">
                      {fmtCost(run.cost_cents)}
                    </span>
                  )}
                  {run.duration_ms != null && (
                    <span className="text-[10px] font-mono text-slate-400">
                      {fmtDuration(run.duration_ms)}
                    </span>
                  )}
                  <Link
                    href={`/dashboard/agents/${run.agent_id}`}
                    className="text-[10px] font-medium text-slate-400 hover:text-slate-700 transition-colors ml-auto"
                  >
                    View →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// ─── Next Actions ─────────────────────────────────────────────────────────────

function NextActions({
  actions,
  insights,
  agentMap,
  onDecide,
}: {
  actions: ActionRow[];
  insights: InsightRow[];
  agentMap: Map<string, AgentRow>;
  onDecide: (id: string, decision: 'approve' | 'reject') => Promise<void>;
}) {
  const [busy, setBusy] = useState<Set<string>>(new Set());

  async function decide(id: string, decision: 'approve' | 'reject') {
    setBusy((s) => new Set(s).add(id));
    try {
      await onDecide(id, decision);
    } finally {
      setBusy((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  }

  const urgentInsights = insights.filter(
    (i) => i.severity === 'critical' || i.severity === 'high',
  );
  const totalCount = actions.length + urgentInsights.length;

  return (
    <Panel
      label="Next Actions"
      accent={totalCount > 0 ? 'amber' : undefined}
      badge={
        totalCount > 0 ? (
          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">
            {totalCount}
          </span>
        ) : null
      }
      className="h-full"
    >
      {totalCount === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 py-10">
          <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-slate-300"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-[12px] font-semibold text-slate-500">Queue clear</p>
          <p className="text-[11px] text-slate-400">No approvals or urgent alerts</p>
        </div>
      ) : (
        <div className="divide-y divide-black/[0.04]">
          <AnimatePresence>
            {actions.map((action) => (
              <motion.div
                key={action.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, x: -12, transition: { duration: 0.15 } }}
                className="px-5 py-4"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                  <span className="text-[11px] font-semibold text-slate-900">
                    {action.action_type}
                  </span>
                  <span className="ml-auto text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-1.5 py-0.5 flex-shrink-0">
                    Needs approval
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 line-clamp-2 mb-2.5 leading-relaxed">
                  {action.preview}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">
                    {agentMap.get(action.agent_id)?.name ?? action.agent_id} ·{' '}
                    {rel(action.created_at)}
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <button
                      disabled={busy.has(action.id)}
                      onClick={() => decide(action.id, 'approve')}
                      className="text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 disabled:opacity-40 rounded-lg px-3 py-1.5 transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      disabled={busy.has(action.id)}
                      onClick={() => decide(action.id, 'reject')}
                      className="text-[11px] font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 disabled:opacity-40 rounded-lg px-3 py-1.5 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {urgentInsights.slice(0, 4).map((insight) => (
            <div key={insight.id} className="px-5 py-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${insight.severity === 'critical' ? 'bg-red-500' : 'bg-orange-400'}`}
                />
                <span className="text-[11px] font-semibold text-slate-900 line-clamp-1">
                  {insight.title}
                </span>
                <span
                  className={`ml-auto text-[9px] font-semibold uppercase tracking-wide border rounded-full px-1.5 py-0.5 flex-shrink-0 ${
                    insight.severity === 'critical'
                      ? 'text-red-700 bg-red-50 border-red-100'
                      : 'text-orange-700 bg-orange-50 border-orange-100'
                  }`}
                >
                  {insight.severity}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] text-slate-400">
                  {insight.category} · {rel(insight.created_at)}
                </span>
                <Link
                  href={
                    insight.agent_id
                      ? `/dashboard/agents/${insight.agent_id}`
                      : '/dashboard/agents'
                  }
                  className="ml-auto text-[11px] font-medium text-blue-600 hover:text-blue-800 transition-colors"
                >
                  Investigate →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ─── Agent Health ─────────────────────────────────────────────────────────────

type HealthStatus = 'healthy' | 'degraded' | 'needs_repair' | 'inactive';

function getHealth(stats: AgentStats | undefined): HealthStatus {
  if (!stats || stats.runs === 0) return 'inactive';
  const rate = stats.successes / stats.runs;
  if (rate >= 0.8) return 'healthy';
  if (rate >= 0.6) return 'degraded';
  return 'needs_repair';
}

const HEALTH: Record<HealthStatus, { dot: string; badge: string; label: string; order: number }> = {
  needs_repair: {
    dot: 'bg-red-500',
    badge: 'text-red-700 bg-red-50 border-red-100',
    label: 'Needs repair',
    order: 0,
  },
  degraded: {
    dot: 'bg-amber-400',
    badge: 'text-amber-700 bg-amber-50 border-amber-100',
    label: 'Degraded',
    order: 1,
  },
  healthy: {
    dot: 'bg-emerald-500',
    badge: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    label: 'Healthy',
    order: 2,
  },
  inactive: {
    dot: 'bg-slate-300',
    badge: 'text-slate-500 bg-slate-50 border-slate-100',
    label: 'Inactive',
    order: 3,
  },
};

function AgentHealth({
  agents,
  agentStatsMap,
  runs,
}: {
  agents: AgentRow[];
  agentStatsMap: Record<string, AgentStats>;
  runs: RunRow[];
}) {
  const lastSuccessMap = new Map<string, RunRow>();
  for (const run of runs) {
    if (
      run.status === 'succeeded' &&
      isUsefulSummary(run.summary) &&
      !lastSuccessMap.has(run.agent_id)
    ) {
      lastSuccessMap.set(run.agent_id, run);
    }
  }

  const cards = agents
    .map((a) => ({
      ...a,
      stats: agentStatsMap[a.id],
      health: getHealth(agentStatsMap[a.id]),
      lastSuccess: lastSuccessMap.get(a.id),
    }))
    .filter((a) => a.stats && a.stats.runs > 0)
    .sort((a, b) => HEALTH[a.health].order - HEALTH[b.health].order)
    .slice(0, 14);

  const needsRepair = cards.filter((c) => c.health === 'needs_repair').length;
  const degraded = cards.filter((c) => c.health === 'degraded').length;

  return (
    <Panel
      label="Agent Health"
      badge={
        needsRepair > 0 ? (
          <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-100 rounded-full px-2 py-0.5">
            {needsRepair} need repair
          </span>
        ) : degraded > 0 ? (
          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">
            {degraded} degraded
          </span>
        ) : null
      }
      action={
        <Link
          href="/dashboard/agents"
          className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
        >
          Manage →
        </Link>
      }
      className="h-full"
    >
      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 py-10">
          <p className="text-[12px] font-semibold text-slate-500">No run data yet</p>
          <p className="text-[11px] text-slate-400">Health cards appear after first runs</p>
        </div>
      ) : (
        <div className="divide-y divide-black/[0.04]">
          {cards.map((a) => {
            const rate =
              a.stats && a.stats.runs > 0
                ? Math.round((a.stats.successes / a.stats.runs) * 100)
                : null;
            const h = HEALTH[a.health];
            return (
              <Link
                key={a.id}
                href={`/dashboard/agents/${a.id}`}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-black/[0.015] transition-colors block"
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${h.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[12px] font-medium text-slate-900 truncate">
                      {a.name}
                    </span>
                    <span
                      className={`text-[9px] font-semibold uppercase tracking-wide border rounded-full px-1.5 py-0.5 flex-shrink-0 ${h.badge}`}
                    >
                      {h.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 line-clamp-1 leading-relaxed">
                    {a.lastSuccess?.summary ?? 'No successful output yet'}
                  </p>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0 text-right">
                  {rate !== null && (
                    <div>
                      <div
                        className={`text-[13px] font-semibold font-mono tabular-nums ${rate < 60 ? 'text-red-600' : rate < 80 ? 'text-amber-600' : 'text-emerald-600'}`}
                      >
                        {rate}%
                      </div>
                      <div className="text-[9px] text-slate-400 uppercase tracking-wide">
                        success
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="text-[13px] font-semibold font-mono tabular-nums text-slate-700">
                      {a.stats?.runs ?? 0}
                    </div>
                    <div className="text-[9px] text-slate-400 uppercase tracking-wide">runs</div>
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold font-mono tabular-nums text-slate-700">
                      {fmtCost(a.stats?.costCents ?? 0)}
                    </div>
                    <div className="text-[9px] text-slate-400 uppercase tracking-wide">cost</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// ─── Memory & Intelligence ────────────────────────────────────────────────────

const SOURCES = [
  { key: 'obsidian', name: 'Obsidian', icon: '◆', desc: 'Design decisions, ADRs, dev logs' },
  { key: 'github', name: 'GitHub', icon: '⬡', desc: 'PRs, deployments, releases' },
  { key: 'supabase', name: 'Supabase', icon: '◈', desc: 'Database events, schema changes' },
  { key: 'vercel', name: 'Vercel', icon: '▲', desc: 'Build logs, deployment status' },
];

const MEM_COLOR: Record<string, string> = {
  ux: 'text-violet-600',
  admin: 'text-blue-600',
  design: 'text-pink-600',
  analytics: 'text-emerald-600',
  deployments: 'text-orange-600',
  bugs: 'text-red-600',
  architecture: 'text-slate-600',
  sops: 'text-teal-600',
};

function MemoryIntelligence({
  memory,
  insights,
  github,
}: {
  memory: MemoryDoc[];
  insights: InsightRow[];
  github: GithubEventRow[];
}) {
  const connected = {
    obsidian: memory.length > 0,
    github: github.length > 0,
    supabase: false,
    vercel: false,
  };

  const lowInsights = insights.filter(
    (i) => i.severity === 'medium' || i.severity === 'low',
  );

  return (
    <Panel label="Memory & Intelligence" className="h-full">
      {/* Source grid */}
      <div className="px-5 pt-4 pb-3.5 border-b border-black/[0.04]">
        <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-2.5">
          Connected sources
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {SOURCES.map((src) => {
            const on = connected[src.key as keyof typeof connected];
            return (
              <div
                key={src.key}
                className={`flex items-center gap-2 rounded-xl px-2.5 py-2 border transition-opacity ${
                  on
                    ? 'border-emerald-100 bg-emerald-50/60'
                    : 'border-black/[0.04] bg-slate-50/60 opacity-50'
                }`}
              >
                <span className={`text-[11px] ${on ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {src.icon}
                </span>
                <div className="min-w-0">
                  <p
                    className={`text-[10px] font-semibold ${on ? 'text-slate-800' : 'text-slate-500'}`}
                  >
                    {src.name}
                  </p>
                  <p className={`text-[9px] ${on ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {on ? 'Connected' : 'Not connected'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Insights (medium/low — high/critical are in Next Actions) */}
      {lowInsights.length > 0 && (
        <>
          <p className="px-5 pt-3.5 pb-1 text-[10px] uppercase tracking-widest text-slate-400">
            Insights
          </p>
          {lowInsights.slice(0, 3).map((i) => (
            <div
              key={i.id}
              className="flex items-start gap-2.5 px-5 py-2.5 border-b border-black/[0.04] hover:bg-black/[0.015] transition-colors"
            >
              <span
                className={`text-[9px] font-semibold uppercase border rounded px-1.5 py-0.5 flex-shrink-0 mt-0.5 ${
                  i.severity === 'medium'
                    ? 'text-amber-700 bg-amber-50 border-amber-100'
                    : 'text-slate-500 bg-slate-50 border-slate-100'
                }`}
              >
                {i.severity}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] text-slate-700 line-clamp-2 leading-relaxed">
                  {i.title}
                </p>
                <p className="text-[9px] font-mono text-slate-400 mt-0.5">
                  {rel(i.created_at)} · {i.category}
                </p>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Memory vault */}
      {memory.length > 0 && (
        <>
          <p className="px-5 pt-3.5 pb-1 text-[10px] uppercase tracking-widest text-slate-400">
            Vault
          </p>
          {memory.slice(0, 4).map((doc) => (
            <div
              key={doc.id}
              className="flex items-start gap-2.5 px-5 py-2.5 border-b border-black/[0.04] hover:bg-black/[0.015] transition-colors"
            >
              <span
                className={`text-[9px] font-mono flex-shrink-0 pt-0.5 min-w-[44px] ${MEM_COLOR[doc.category] ?? 'text-slate-400'}`}
              >
                {doc.category}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] text-slate-700 line-clamp-1">{doc.title}</p>
                <p className="text-[9px] font-mono text-slate-400 mt-0.5">
                  {rel(doc.created_at)}
                </p>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Empty state when nothing is connected */}
      {!connected.obsidian && !connected.github && lowInsights.length === 0 && (
        <div className="px-5 py-4">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-3">
            How to connect
          </p>
          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              <span className="text-[10px] font-mono text-slate-300 flex-shrink-0 mt-0.5">
                01
              </span>
              <div>
                <p className="text-[11px] font-semibold text-slate-700">Obsidian Vault</p>
                <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">
                  Sync your vault via the GitHub Actions workflow — design docs, ADRs and dev
                  logs will surface here automatically.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="text-[10px] font-mono text-slate-300 flex-shrink-0 mt-0.5">
                02
              </span>
              <div>
                <p className="text-[11px] font-semibold text-slate-700">GitHub Webhooks</p>
                <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">
                  Add the webhook to your repo to track PRs, deployments, and releases in real
                  time.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

// ─── GitHub Activity ──────────────────────────────────────────────────────────

function GitHubActivity({ events }: { events: GithubEventRow[] }) {
  function dot(evt: GithubEventRow): string {
    if (evt.event_type === 'deployment_failure') return 'bg-red-500';
    if (evt.event_type === 'adr_flag') return 'bg-amber-400';
    if (evt.event_type === 'deployment_status' && evt.action === 'success')
      return 'bg-emerald-500';
    if (evt.event_type === 'pull_request' && evt.action === 'opened') return 'bg-blue-500';
    if (
      evt.event_type === 'pull_request' &&
      (evt.action === 'closed' || evt.action === 'merged')
    )
      return 'bg-emerald-500';
    return 'bg-slate-300';
  }

  function title(evt: GithubEventRow): string {
    const m = evt.metadata;
    if (!m) return evt.event_type;
    if (evt.event_type === 'pull_request') return m.pr_title ?? `PR #${m.pr_number ?? '?'}`;
    if (evt.event_type === 'deployment_status')
      return `${m.environment ?? 'production'} — ${evt.action ?? ''}`;
    if (evt.event_type === 'deployment_failure') return `Deploy failed — ${m.branch ?? 'main'}`;
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
      label="GitHub"
      action={
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
        >
          Open →
        </a>
      }
      className="h-full"
    >
      {events.slice(0, 12).map((evt) => {
        const url = prUrl(evt);
        const label = GH_LABEL[evt.event_type] ?? evt.event_type;
        const t = title(evt);
        const d = dot(evt);
        return (
          <div
            key={evt.id}
            className="flex items-start gap-3 px-5 py-3 border-b border-black/[0.04] hover:bg-black/[0.015] transition-colors"
          >
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${d}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[9px] font-mono font-semibold uppercase tracking-wide text-slate-400">
                  {label}
                </span>
                {evt.action && (
                  <>
                    <span className="text-[9px] text-slate-300">·</span>
                    <span className="text-[9px] text-slate-400">{evt.action}</span>
                  </>
                )}
                <span className="ml-auto text-[9px] font-mono text-slate-400 flex-shrink-0">
                  {rel(evt.created_at)}
                </span>
              </div>
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-medium text-slate-800 hover:text-blue-600 transition-colors line-clamp-1 block"
                >
                  {t}
                </a>
              ) : (
                <p className="text-[11px] font-medium text-slate-800 line-clamp-1">{t}</p>
              )}
            </div>
          </div>
        );
      })}
      {events.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full gap-2 py-10">
          <p className="text-[12px] font-semibold text-slate-500">No events yet</p>
          <p className="text-[11px] text-slate-400 text-center max-w-[160px] leading-relaxed">
            Connect GitHub webhooks to see activity here
          </p>
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

  const agentMap = React.useMemo(
    () => new Map(agents.map((a) => [a.id, a])),
    [agents],
  );

  const liveCount = runs.filter((r) => r.status === 'running').length;
  const githubRepo = github[0]?.repo ?? null;

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const ch = supabase
      .channel('mc-runs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_runs' },
        (p) => {
          const r = p.new as RunRow;
          setRuns((prev) => [r, ...prev].slice(0, 50));
          if (r.status === 'needs_approval') {
            setMetrics((m) => ({ ...m, pendingActions: m.pendingActions + 1 }));
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'agent_runs' },
        (p) => {
          const r = p.new as RunRow;
          setRuns((prev) => prev.map((x) => (x.id === r.id ? { ...x, ...r } : x)));
        },
      )
      .subscribe((status) => setIsConnected(status === 'SUBSCRIBED'));

    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const handleDecide = useCallback(
    async (id: string, decision: 'approve' | 'reject') => {
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
    },
    [],
  );

  const handleRerun = useCallback(async (agentId: string) => {
    const res = await fetch('/api/agents/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, input: 'Manual rerun from Mission Control' }),
    });
    if (res.ok) {
      toast.success('Agent queued for rerun');
    } else {
      toast.error('Failed to queue rerun — check agent config');
    }
  }, []);

  return (
    <div className="flex flex-col gap-4 pb-6" style={{ minHeight: 'calc(100vh - 160px)' }}>
      <StatusBar m={metrics} liveCount={liveCount} isConnected={isConnected} />

      {/* Row 1: Needs Attention (2/3) | GitHub (1/3) */}
      <div className="grid grid-cols-3 gap-4" style={{ minHeight: '260px' }}>
        <div className="col-span-2">
          <NeedsAttention
            runs={runs}
            agentMap={agentMap}
            githubRepo={githubRepo}
            onRerun={handleRerun}
          />
        </div>
        <GitHubActivity events={github} />
      </div>

      {/* Row 2: Recent Useful Work (1/2) | Next Actions (1/2) */}
      <div className="grid grid-cols-2 gap-4" style={{ minHeight: '280px' }}>
        <RecentWork runs={runs} agentMap={agentMap} />
        <NextActions
          actions={actions}
          insights={insights}
          agentMap={agentMap}
          onDecide={handleDecide}
        />
      </div>

      {/* Row 3: Agent Health (2/3) | Memory & Intelligence (1/3) */}
      <div className="grid grid-cols-3 gap-4" style={{ minHeight: '340px' }}>
        <div className="col-span-2">
          <AgentHealth agents={agents} agentStatsMap={agentStatsMap} runs={runs} />
        </div>
        <MemoryIntelligence memory={memory} insights={insights} github={github} />
      </div>
    </div>
  );
}
