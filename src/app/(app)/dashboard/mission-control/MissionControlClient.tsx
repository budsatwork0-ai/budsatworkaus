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

type AgentStats = { runs: number; successes: number; failures: number; costCents: number; avgDurationMs: number };

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

function isUsefulSummary(summary: string | null): boolean {
  if (!summary || summary.trim().length < 15) return false;
  const s = summary.toLowerCase();
  const noise = [
    'logged 0', 'found 0', '0 results', '0 findings', 'no findings', 'no results',
    'nothing found', 'no new', 'no items', 'no changes', 'no data', 'no records',
    '0 issues', '0 records', '0 items', '0 alerts', '0 matches',
    'completed with no', 'ran successfully with no', 'nothing to report',
    'no recent completed', 'proposed 0', 'checked 0', 'wrote 0', 'sent 0',
  ];
  return !noise.some((p) => s.includes(p));
}

type RunCategory = 'failure' | 'approval' | 'useful' | 'noop';

function categorize(run: RunRow): RunCategory {
  if (run.status === 'failed') return 'failure';
  if (run.status === 'needs_approval') return 'approval';
  if (run.status === 'succeeded' && isUsefulSummary(run.summary)) return 'useful';
  return 'noop';
}

type FailureAnalysis = {
  what: string;
  impact: string;
  fix: string;
  debugPrompt: string;
};

function analyzeFailure(run: RunRow, agent: AgentRow | undefined): FailureAnalysis {
  const summary = run.summary ?? '';
  const s = summary.toLowerCase();
  const name = agent?.name ?? run.agent_id;
  const category = agent?.category ?? '';

  let what: string;
  let fix: string;

  if ((s.includes('could not parse') || s.includes('failed to parse')) && s.includes('json')) {
    what = 'JSON parsing failed — the agent received malformed or structurally unexpected JSON';
    fix = 'Open the agent that feeds data into this one and check its last raw output. The output schema may have changed. Look for missing fields, unexpected nulls, or a changed key name.';
  } else if (s.includes('could not parse') || s.includes('failed to parse')) {
    what = "Output parsing failed — the agent couldn't interpret the response it received";
    fix = "Compare what this agent expects to receive against what the upstream agent actually returned last run. The schema likely drifted — check the agent definition's output type.";
  } else if (s.includes('timeout') || s.includes('timed out')) {
    what = 'Request timed out — the agent exceeded the 30-second LLM response window';
    fix = 'Reduce the amount of data passed to the agent in a single run. If processing a list, try capping it at 20–30 items. Also check if an external API it calls is slow.';
  } else if (s.includes('rate limit') || s.includes('429')) {
    what = 'Rate limit hit — too many AI API requests fired in a short window';
    fix = 'Wait 10–15 minutes before retrying. If this is a recurring cron agent, reduce its frequency or add a staggered delay between agents in the same category.';
  } else if (s.includes('network') || s.includes('fetch failed') || s.includes('econnrefused') || s.includes('connection refused')) {
    what = "Network error — the agent couldn't reach an external service or API";
    fix = 'Check if the external service (Supabase, Stripe, or a third-party API) is up. This is usually transient — retry once. If it recurs, verify the endpoint URL in the agent definition.';
  } else if (s.includes('unauthorized') || s.includes('403') || s.includes('401')) {
    what = 'Authentication failed — the API key or token used by this agent was rejected';
    fix = 'Go to environment settings and verify the relevant API key. Keys expire, get rotated, or can lose scope. Regenerate and redeploy if needed.';
  } else if (s.includes('not found') || s.includes('404')) {
    what = "Resource not found — the agent tried to access something that doesn't exist at that path";
    fix = 'Check the data ID, URL, or table name referenced in the agent. It may have been deleted, renamed, or the record was never created.';
  } else if (s.includes('recursion') || s.includes('depth limit')) {
    what = 'Recursion limit hit — the agent called sub-agents more than 5 levels deep';
    fix = 'Review the callAgent() chain in this agent. Look for a cycle where Agent A calls Agent B which calls Agent A, or a deeply nested workflow that can be flattened.';
  } else if (s.includes('cost budget') || s.includes('budget exceeded')) {
    what = 'Cost cap exceeded — the run was stopped mid-flight to prevent overspend';
    fix = "Review how much data this agent is processing per run. Cap the input list, reduce token-heavy context, or raise the per-run budget in the agent's config if the work is genuinely worth it.";
  } else if (s.includes('dangerous') || s.includes('human review')) {
    what = 'Blocked by safety guardrail — the agent proposed a high-risk action that requires a human decision';
    fix = 'Review the proposed action in the approval queue below. If it looks right, approve it to allow the agent to proceed. If not, reject and consider tightening the agent prompt to avoid triggering this again.';
  } else if (summary.length > 20 && summary.length < 300) {
    what = summary;
    fix = 'Review the full run output in the agent detail, then decide whether to retry or adjust the agent configuration.';
  } else {
    what = 'Unexpected error — no structured failure reason was captured';
    fix = 'Open the agent detail page and check the raw run log. Enable more verbose logging in the agent definition if needed.';
  }

  const impact = agentImpact(category, name);

  const debugPrompt = [
    `I need help debugging a failing agent in my Buds At Work app.`,
    ``,
    `Agent: ${name}`,
    `Category: ${category || 'general'}`,
    `Run ID: ${run.id}`,
    `Failed at: ${run.started_at}`,
    `Trigger: ${run.trigger ?? 'manual'}`,
    ``,
    `Error output:`,
    summary || '(no output recorded)',
    ``,
    `Likely failure: ${what}`,
    ``,
    `Please help me:`,
    `1. Diagnose the root cause`,
    `2. Suggest specific changes to the agent definition, input, or environment`,
    `3. Explain what I should verify before retrying`,
  ].join('\n');

  return { what, impact, fix, debugPrompt };
}

function agentImpact(category: string, name: string): string {
  const c = (category || '').toLowerCase();
  if (c === 'sales') return 'Lead qualification or follow-up may be stalled until resolved';
  if (c === 'finance') return 'Cash flow data or reconciliation may be incomplete';
  if (c === 'ops') return 'Job scheduling or crew coordination may have gaps';
  if (c === 'support') return 'Customer messages may not be auto-routed or replied to';
  if (c === 'compliance') return 'Safety and compliance checks may not be running';
  if (c === 'hiring') return 'Applicant screening pipeline may be paused';
  return `${name} output is missing — downstream agents or data may be affected`;
}

function usefulImpactLabel(category: string): string {
  const c = (category || '').toLowerCase();
  if (c === 'sales') return 'Sales';
  if (c === 'finance') return 'Finance';
  if (c === 'ops') return 'Ops';
  if (c === 'support') return 'Support';
  if (c === 'compliance') return 'Compliance';
  if (c === 'hiring') return 'Hiring';
  return 'Output';
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
    accent === 'red' ? 'border-red-100'
    : accent === 'green' ? 'border-emerald-100'
    : accent === 'amber' ? 'border-amber-100'
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

// ─── Shared chip ──────────────────────────────────────────────────────────────

function CategoryChip({ category }: { category: string }) {
  const style = CATEGORY_COLOR[category] ?? 'text-slate-500 bg-slate-50 border-slate-100';
  return (
    <span className={`text-[9px] font-semibold uppercase tracking-wide border rounded-full px-1.5 py-0.5 ${style}`}>
      {category}
    </span>
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

function StatusBar({ m, liveCount, isConnected }: { m: Metrics; liveCount: number; isConnected: boolean }) {
  const healthLabel = m.successRate7d >= 90 ? 'Healthy' : m.successRate7d >= 70 ? 'Degraded' : 'Critical';
  const healthColor = m.successRate7d >= 90 ? 'text-emerald-600' : m.successRate7d >= 70 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="flex items-center gap-5 px-5 py-3.5 rounded-2xl border border-black/[0.06] bg-white/92 backdrop-blur-xl shadow-[0_2px_16px_rgba(2,6,23,0.06)] flex-shrink-0">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
        <span className="text-[11px] font-medium text-slate-600">{isConnected ? 'Live' : 'Offline'}</span>
      </div>
      <div className="w-px h-4 bg-black/10" />
      <div className="flex items-center gap-1.5">
        <span className={`text-[11px] font-semibold ${healthColor}`}>{healthLabel}</span>
        <span className="text-[11px] text-slate-400">· {m.successRate7d}% success (7d)</span>
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
            <span className="text-[11px] font-medium text-amber-700">{m.pendingActions} awaiting approval</span>
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
        <Link href="/dashboard/agents" className="text-[11px] font-medium text-slate-400 hover:text-slate-700 transition-colors">
          All agents →
        </Link>
      </div>
    </div>
  );
}

// ─── Agent Feed: Failure card ─────────────────────────────────────────────────

function FailureCard({
  run,
  agent,
  githubRepo,
  onRerun,
}: {
  run: RunRow;
  agent: AgentRow | undefined;
  githubRepo: string | null;
  onRerun: (agentId: string) => Promise<void>;
}) {
  const [rerunning, setRerunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const analysis = analyzeFailure(run, agent);

  async function handleRerun() {
    setRerunning(true);
    try { await onRerun(run.agent_id); } finally { setRerunning(false); }
  }

  async function copyDebug() {
    await navigator.clipboard.writeText(analysis.debugPrompt);
    setCopied(true);
    toast.success('Debug prompt copied to clipboard');
    setTimeout(() => setCopied(false), 2500);
  }

  const issueTitle = encodeURIComponent(`Agent failure: ${agent?.name ?? run.agent_id}`);
  const issueBody = encodeURIComponent(
    `**Agent:** ${agent?.name ?? run.agent_id}\n**Failure:** ${analysis.what}\n**Run ID:** ${run.id}\n**Time:** ${run.started_at}`,
  );
  const issueUrl = githubRepo
    ? `https://github.com/${githubRepo}/issues/new?title=${issueTitle}&body=${issueBody}`
    : `https://github.com/issues/new?title=${issueTitle}&body=${issueBody}`;

  return (
    <div className="px-5 py-4 border-b border-black/[0.04] last:border-0">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
        <span className="text-[12px] font-semibold text-slate-900">{agent?.name ?? run.agent_id}</span>
        {agent?.category && <CategoryChip category={agent.category} />}
        <span className="ml-auto text-[10px] font-mono text-slate-400 flex-shrink-0">{rel(run.started_at)}</span>
      </div>

      {/* Q1: What happened */}
      <div className="bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5 mb-2.5">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-red-400 mb-1">What failed</p>
        <p className="text-[11px] text-red-800 leading-relaxed">{analysis.what}</p>
      </div>

      {/* Raw output preview (collapsible) */}
      {run.summary && (
        <details className="mb-2.5 group">
          <summary className="text-[10px] font-medium text-slate-400 hover:text-slate-600 transition-colors cursor-pointer select-none list-none flex items-center gap-1.5">
            <span className="group-open:hidden">▸</span>
            <span className="hidden group-open:inline">▾</span>
            Raw output
          </summary>
          <div className="mt-1.5 bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5">
            <p className="text-[10px] font-mono text-slate-600 leading-relaxed break-words line-clamp-5">
              {run.summary}
            </p>
          </div>
        </details>
      )}

      {/* Q2: Why it matters */}
      <p className="text-[11px] text-slate-500 mb-1.5 leading-relaxed">
        <span className="font-semibold text-slate-700">Impact: </span>
        {analysis.impact}
      </p>

      {/* Q3: What to do next */}
      <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
        <span className="font-semibold text-slate-700">Fix: </span>
        {analysis.fix}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link
          href={`/dashboard/agents/${run.agent_id}`}
          className="text-[11px] font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors"
        >
          View run
        </Link>
        <button
          disabled={rerunning}
          onClick={handleRerun}
          className="text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 disabled:opacity-40 rounded-lg px-3 py-1.5 transition-colors"
        >
          {rerunning ? 'Retrying…' : 'Retry'}
        </button>
        <button
          onClick={copyDebug}
          className="text-[11px] font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-100 rounded-lg px-3 py-1.5 transition-colors"
        >
          {copied ? '✓ Copied' : 'Copy debug prompt'}
        </button>
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
}

// ─── Agent Feed: Approval row ─────────────────────────────────────────────────

function ApprovalRow({ run, agent }: { run: RunRow; agent: AgentRow | undefined }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-black/[0.04] last:border-0">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[11px] font-semibold text-slate-900 truncate">{agent?.name ?? run.agent_id}</span>
          {agent?.category && <CategoryChip category={agent.category} />}
        </div>
        <p className="text-[10px] text-slate-500 line-clamp-1 leading-relaxed">
          {run.summary ?? 'Proposed an action and is awaiting your approval'}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-1.5 py-0.5">
          Needs approval
        </span>
        <span className="text-[10px] font-mono text-slate-400">{rel(run.started_at)}</span>
      </div>
    </div>
  );
}

// ─── Agent Feed: Useful run row ───────────────────────────────────────────────

function UsefulRow({ run, agent }: { run: RunRow; agent: AgentRow | undefined }) {
  return (
    <div className="flex items-start gap-3 px-5 py-3.5 border-b border-black/[0.04] last:border-0 hover:bg-black/[0.01] transition-colors">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 mt-1" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-semibold text-slate-900 truncate">{agent?.name ?? run.agent_id}</span>
          {agent?.category && <CategoryChip category={agent.category} />}
          <span className="ml-auto text-[10px] font-mono text-slate-400 flex-shrink-0">{rel(run.started_at)}</span>
        </div>
        {/* Q1: What happened */}
        <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2 mb-1.5">{run.summary}</p>
        {/* Q2: Why it matters */}
        <p className="text-[10px] text-slate-400">
          {usefulImpactLabel(agent?.category ?? '')} update · {run.cost_cents ? fmtCost(run.cost_cents) : null}
          {run.duration_ms ? ` · ${fmtDuration(run.duration_ms)}` : null}
        </p>
      </div>
      {/* Q3: What to do next */}
      <Link
        href={`/dashboard/agents/${run.agent_id}`}
        className="text-[11px] font-medium text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0 mt-0.5"
      >
        View →
      </Link>
    </div>
  );
}

// ─── Agent Feed: Quiet runs (no-op) section ───────────────────────────────────

function QuietRuns({
  noopsByAgent,
  agentMap,
}: {
  noopsByAgent: Map<string, { count: number; latest: RunRow }>;
  agentMap: Map<string, AgentRow>;
}) {
  const [expanded, setExpanded] = useState(false);
  const groups = Array.from(noopsByAgent.entries());
  const totalRuns = groups.reduce((s, [, g]) => s + g.count, 0);

  if (groups.length === 0) return null;

  return (
    <div className="border-t border-black/[0.04]">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2.5 px-5 py-3 hover:bg-black/[0.01] transition-colors text-left"
      >
        <span className="text-[10px] text-slate-400 tabular-nums font-mono w-3">
          {expanded ? '▾' : '▸'}
        </span>
        <span className="text-[11px] font-medium text-slate-500">
          Quiet runs
        </span>
        <span className="text-[10px] font-mono text-slate-400">
          {groups.length} agents · {totalRuns} runs
        </span>
        <span className="ml-auto text-[10px] text-slate-400">
          No findings — no action needed
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            {groups.map(([agentId, { count, latest }]) => {
              const agent = agentMap.get(agentId);
              return (
                <div
                  key={agentId}
                  className="flex items-center gap-3 px-5 py-2 border-t border-black/[0.03] hover:bg-black/[0.01] transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-200 flex-shrink-0" />
                  <span className="text-[11px] text-slate-500 flex-1 truncate">
                    {agent?.name ?? agentId}
                  </span>
                  {agent?.category && <CategoryChip category={agent.category} />}
                  <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                    {count}× · {rel(latest.started_at)}
                  </span>
                  <Link
                    href={`/dashboard/agents/${agentId}`}
                    className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    View →
                  </Link>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Agent Feed ───────────────────────────────────────────────────────────────

function AgentFeed({
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
  // Group by category, deduplicating failures per agent (latest only)
  const seenFailures = new Set<string>();
  const failures: RunRow[] = [];
  const approvals: RunRow[] = [];
  const useful: RunRow[] = [];
  const noops: RunRow[] = [];

  for (const run of runs) {
    const cat = categorize(run);
    if (cat === 'failure') {
      if (!seenFailures.has(run.agent_id)) {
        failures.push(run);
        seenFailures.add(run.agent_id);
      }
    } else if (cat === 'approval') {
      approvals.push(run);
    } else if (cat === 'useful') {
      useful.push(run);
    } else {
      noops.push(run);
    }
  }

  // Collapse no-ops: one entry per agent showing run count
  const noopsByAgent = new Map<string, { count: number; latest: RunRow }>();
  for (const run of noops) {
    const entry = noopsByAgent.get(run.agent_id);
    if (!entry) {
      noopsByAgent.set(run.agent_id, { count: 1, latest: run });
    } else {
      entry.count += 1;
    }
  }

  const failureCount = failures.length;
  const approvalCount = approvals.length;
  const usefulCount = useful.length;
  const noopAgentCount = noopsByAgent.size;

  const isEmpty = failureCount === 0 && approvalCount === 0 && usefulCount === 0 && noopAgentCount === 0;

  return (
    <Panel
      label="Agent Feed"
      accent={failureCount > 0 ? 'red' : undefined}
      badge={
        failureCount > 0 ? (
          <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-100 rounded-full px-2 py-0.5">
            {failureCount} failed
          </span>
        ) : approvalCount > 0 ? (
          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">
            {approvalCount} need approval
          </span>
        ) : null
      }
      action={
        <Link href="/dashboard/agents" className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors">
          All runs →
        </Link>
      }
      className="h-full"
    >
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 py-10">
          <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <p className="text-[13px] font-semibold text-slate-700">Nothing to report</p>
          <p className="text-[11px] text-slate-400">Agents haven't run yet, or all runs are quiet</p>
        </div>
      ) : (
        <>
          {/* Section: Failures */}
          {failures.length > 0 && (
            <div>
              <div className="px-5 pt-4 pb-2 flex items-center gap-2">
                <span className="text-[9px] font-semibold uppercase tracking-widest text-red-500">Failed</span>
                <span className="text-[9px] text-slate-400">— review required</span>
              </div>
              {failures.slice(0, 5).map((run) => (
                <FailureCard
                  key={run.id}
                  run={run}
                  agent={agentMap.get(run.agent_id)}
                  githubRepo={githubRepo}
                  onRerun={onRerun}
                />
              ))}
            </div>
          )}

          {/* Section: Needs approval */}
          {approvals.length > 0 && (
            <div className={failures.length > 0 ? 'border-t border-black/[0.06]' : ''}>
              <div className="px-5 pt-4 pb-2 flex items-center gap-2">
                <span className="text-[9px] font-semibold uppercase tracking-widest text-amber-500">Needs review</span>
                <span className="text-[9px] text-slate-400">— approve or reject in the queue</span>
              </div>
              {approvals.slice(0, 4).map((run) => (
                <ApprovalRow key={run.id} run={run} agent={agentMap.get(run.agent_id)} />
              ))}
            </div>
          )}

          {/* Section: Useful output */}
          {useful.length > 0 && (
            <div className={(failures.length > 0 || approvals.length > 0) ? 'border-t border-black/[0.06]' : ''}>
              <div className="px-5 pt-4 pb-2 flex items-center gap-2">
                <span className="text-[9px] font-semibold uppercase tracking-widest text-emerald-600">Produced output</span>
                <span className="text-[9px] text-slate-400">— results worth reviewing</span>
              </div>
              {useful.slice(0, 6).map((run) => (
                <UsefulRow key={run.id} run={run} agent={agentMap.get(run.agent_id)} />
              ))}
            </div>
          )}

          {/* Section: Quiet (no-op) runs — collapsed */}
          <QuietRuns noopsByAgent={noopsByAgent} agentMap={agentMap} />
        </>
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
    try { await onDecide(id, decision); }
    finally {
      setBusy((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  }

  const urgentInsights = insights.filter((i) => i.severity === 'critical' || i.severity === 'high');
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
        <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
          <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center">
            <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                  <span className="text-[11px] font-semibold text-slate-900">{action.action_type}</span>
                  <span className="ml-auto text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-1.5 py-0.5 flex-shrink-0">
                    Approval
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 line-clamp-2 mb-2.5 leading-relaxed">{action.preview}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">
                    {agentMap.get(action.agent_id)?.name ?? action.agent_id} · {rel(action.created_at)}
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
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${insight.severity === 'critical' ? 'bg-red-500' : 'bg-orange-400'}`} />
                <span className="text-[11px] font-semibold text-slate-900 line-clamp-1">{insight.title}</span>
                <span className={`ml-auto text-[9px] font-semibold uppercase tracking-wide border rounded-full px-1.5 py-0.5 flex-shrink-0 ${insight.severity === 'critical' ? 'text-red-700 bg-red-50 border-red-100' : 'text-orange-700 bg-orange-50 border-orange-100'}`}>
                  {insight.severity}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] text-slate-400">{insight.category} · {rel(insight.created_at)}</span>
                <Link
                  href={insight.agent_id ? `/dashboard/agents/${insight.agent_id}` : '/dashboard/agents'}
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

type HealthStatus = 'healthy' | 'watch' | 'needs_repair' | 'broken' | 'inactive';

function getHealth(stats: AgentStats | undefined): HealthStatus {
  if (!stats || stats.runs === 0) return 'inactive';
  const rate = stats.successes / stats.runs;
  if (rate === 0) return 'broken';
  if (rate >= 0.8) return 'healthy';
  if (rate >= 0.6) return 'watch';
  return 'needs_repair';
}

const HEALTH: Record<HealthStatus, { dot: string; badge: string; label: string; order: number }> = {
  broken:       { dot: 'bg-red-600',     badge: 'text-red-800 bg-red-50 border-red-200',          label: 'Broken',       order: 0 },
  needs_repair: { dot: 'bg-red-500',     badge: 'text-red-700 bg-red-50 border-red-100',           label: 'Needs repair', order: 1 },
  watch:        { dot: 'bg-amber-400',   badge: 'text-amber-700 bg-amber-50 border-amber-100',     label: 'Watch',        order: 2 },
  healthy:      { dot: 'bg-emerald-500', badge: 'text-emerald-700 bg-emerald-50 border-emerald-100', label: 'Healthy',    order: 3 },
  inactive:     { dot: 'bg-slate-300',   badge: 'text-slate-500 bg-slate-50 border-slate-100',     label: 'Inactive',     order: 4 },
};

function recommendAction(stats: AgentStats): string | null {
  const rate = stats.runs > 0 ? stats.successes / stats.runs : 0;
  const pct = Math.round(rate * 100);
  if (pct === 0 && stats.runs > 0) return 'All runs failing — check error logs and fix agent config';
  if (pct < 60 && stats.runs >= 15) return 'Review output schema and reduce empty/no-op runs';
  if (pct < 60 && stats.failures > stats.successes) return 'More failures than successes — review recent error logs';
  if (pct < 60) return 'Diagnose the failure pattern — check recent run outputs';
  if (pct < 80) return 'Monitor — review recent failures for emerging patterns';
  return null;
}

function AgentHealth({
  agents,
  agentStatsMap,
  runs,
}: {
  agents: AgentRow[];
  agentStatsMap: Record<string, AgentStats>;
  runs: RunRow[];
}) {
  const lastOutputMap = new Map<string, string>();
  for (const run of runs) {
    if (run.status === 'succeeded' && isUsefulSummary(run.summary) && !lastOutputMap.has(run.agent_id)) {
      lastOutputMap.set(run.agent_id, run.summary!);
    }
  }

  const rows = agents
    .map((a) => ({
      ...a,
      stats: agentStatsMap[a.id],
      health: getHealth(agentStatsMap[a.id]),
      lastOutput: lastOutputMap.get(a.id) ?? null,
    }))
    .filter((a) => a.stats && a.stats.runs > 0)
    .sort((a, b) => HEALTH[a.health].order - HEALTH[b.health].order)
    .slice(0, 20);

  const criticalCount = rows.filter((r) => r.health === 'broken' || r.health === 'needs_repair').length;
  const watchCount = rows.filter((r) => r.health === 'watch').length;

  return (
    <Panel
      label="Agent Health"
      badge={
        criticalCount > 0 ? (
          <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-100 rounded-full px-2 py-0.5">
            {criticalCount} need attention
          </span>
        ) : watchCount > 0 ? (
          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">
            {watchCount} to watch
          </span>
        ) : null
      }
      action={
        <Link href="/dashboard/agents" className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors">
          Manage →
        </Link>
      }
      className="h-full"
    >
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 py-10">
          <p className="text-[12px] font-semibold text-slate-500">No run data yet</p>
          <p className="text-[11px] text-slate-400">Agent health appears after first runs</p>
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-black/[0.06] bg-slate-50/60 sticky top-0">
                {['Agent', 'Status', 'Success', 'Last useful output', 'Cost 7d', 'Avg dur', 'Action'].map((col) => (
                  <th
                    key={col}
                    className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 text-left px-3 py-2.5 first:pl-5 last:pr-5 whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const s = row.stats;
                const pct = s && s.runs > 0 ? Math.round((s.successes / s.runs) * 100) : 0;
                const h = HEALTH[row.health];
                const action = recommendAction(s);
                const rateColor =
                  pct === 0 ? 'text-red-600'
                  : pct < 60 ? 'text-red-500'
                  : pct < 80 ? 'text-amber-600'
                  : 'text-emerald-600';

                return (
                  <tr
                    key={row.id}
                    className="border-b border-black/[0.04] hover:bg-black/[0.015] transition-colors group"
                  >
                    {/* Agent */}
                    <td className="pl-5 pr-3 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${h.dot}`} />
                        <span className="text-[12px] font-medium text-slate-900">{row.name}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <span className={`text-[9px] font-semibold uppercase tracking-wide border rounded-full px-2 py-0.5 ${h.badge}`}>
                        {h.label}
                      </span>
                    </td>

                    {/* Success rate */}
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <span className={`text-[13px] font-semibold font-mono tabular-nums ${rateColor}`}>
                        {pct}%
                      </span>
                      <span className="text-[9px] text-slate-400 ml-1.5 font-mono tabular-nums">
                        {s?.successes ?? 0}/{s?.runs ?? 0}
                      </span>
                    </td>

                    {/* Last useful output */}
                    <td className="px-3 py-3.5" style={{ maxWidth: '260px' }}>
                      {row.lastOutput ? (
                        <p className="text-[11px] text-slate-600 truncate leading-relaxed">{row.lastOutput}</p>
                      ) : (
                        <span className="text-[11px] text-slate-300 italic">No useful output yet</span>
                      )}
                    </td>

                    {/* Cost 7d */}
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <span className="text-[12px] font-mono text-slate-700 tabular-nums">
                        {fmtCost(s?.costCents ?? 0)}
                      </span>
                    </td>

                    {/* Avg duration */}
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <span className="text-[12px] font-mono text-slate-700 tabular-nums">
                        {s?.avgDurationMs && s.avgDurationMs > 0 ? fmtDuration(s.avgDurationMs) : '—'}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="pl-3 pr-5 py-3.5">
                      <div className="flex items-start gap-3">
                        {action ? (
                          <p className="text-[10px] text-slate-500 leading-snug" style={{ maxWidth: '220px' }}>
                            {action}
                          </p>
                        ) : (
                          <span className="text-[10px] font-medium text-emerald-600">Running well</span>
                        )}
                        <Link
                          href={`/dashboard/agents/${row.id}`}
                          className="text-[10px] font-medium text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0 ml-auto opacity-0 group-hover:opacity-100 pt-0.5"
                        >
                          View →
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

  const lowInsights = insights.filter((i) => i.severity === 'medium' || i.severity === 'low');
  const hasAnyData = memory.length > 0 || lowInsights.length > 0;

  return (
    <Panel label="Memory & Intelligence" className="h-full">
      <div className="px-5 pt-4 pb-3.5 border-b border-black/[0.04]">
        <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-2.5">Connected sources</p>
        <div className="grid grid-cols-2 gap-1.5">
          {SOURCES.map((src) => {
            const on = connected[src.key as keyof typeof connected];
            return (
              <div
                key={src.key}
                className={`flex items-center gap-2 rounded-xl px-2.5 py-2 border transition-opacity ${on ? 'border-emerald-100 bg-emerald-50/60' : 'border-black/[0.04] bg-slate-50/60 opacity-50'}`}
              >
                <span className={`text-[11px] ${on ? 'text-emerald-600' : 'text-slate-400'}`}>{src.icon}</span>
                <div className="min-w-0">
                  <p className={`text-[10px] font-semibold ${on ? 'text-slate-800' : 'text-slate-500'}`}>{src.name}</p>
                  <p className={`text-[9px] ${on ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {on ? 'Connected' : 'Not connected'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {lowInsights.length > 0 && (
        <>
          <p className="px-5 pt-3.5 pb-1 text-[10px] uppercase tracking-widest text-slate-400">Insights</p>
          {lowInsights.slice(0, 3).map((i) => (
            <div key={i.id} className="flex items-start gap-2.5 px-5 py-2.5 border-b border-black/[0.04] hover:bg-black/[0.015] transition-colors">
              <span className={`text-[9px] font-semibold uppercase border rounded px-1.5 py-0.5 flex-shrink-0 mt-0.5 ${i.severity === 'medium' ? 'text-amber-700 bg-amber-50 border-amber-100' : 'text-slate-500 bg-slate-50 border-slate-100'}`}>
                {i.severity}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] text-slate-700 line-clamp-2 leading-relaxed">{i.title}</p>
                <p className="text-[9px] font-mono text-slate-400 mt-0.5">{rel(i.created_at)} · {i.category}</p>
              </div>
            </div>
          ))}
        </>
      )}

      {memory.length > 0 && (
        <>
          <p className="px-5 pt-3.5 pb-1 text-[10px] uppercase tracking-widest text-slate-400">Vault</p>
          {memory.slice(0, 4).map((doc) => (
            <div key={doc.id} className="flex items-start gap-2.5 px-5 py-2.5 border-b border-black/[0.04] hover:bg-black/[0.015] transition-colors">
              <span className={`text-[9px] font-mono flex-shrink-0 pt-0.5 min-w-[44px] ${MEM_COLOR[doc.category] ?? 'text-slate-400'}`}>
                {doc.category}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] text-slate-700 line-clamp-1">{doc.title}</p>
                <p className="text-[9px] font-mono text-slate-400 mt-0.5">{rel(doc.created_at)}</p>
              </div>
            </div>
          ))}
        </>
      )}

      {!hasAnyData && !connected.github && (
        <div className="px-5 py-4">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-3">How to connect</p>
          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              <span className="text-[10px] font-mono text-slate-300 flex-shrink-0 mt-0.5">01</span>
              <div>
                <p className="text-[11px] font-semibold text-slate-700">Obsidian Vault</p>
                <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">
                  Sync via GitHub Actions — design docs, ADRs and dev logs surface here automatically.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="text-[10px] font-mono text-slate-300 flex-shrink-0 mt-0.5">02</span>
              <div>
                <p className="text-[11px] font-semibold text-slate-700">GitHub Webhooks</p>
                <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">
                  Add the webhook to your repo to track PRs, deployments, and releases.
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
    if (evt.event_type === 'deployment_status' && evt.action === 'success') return 'bg-emerald-500';
    if (evt.event_type === 'pull_request' && evt.action === 'opened') return 'bg-blue-500';
    if (evt.event_type === 'pull_request' && (evt.action === 'closed' || evt.action === 'merged')) return 'bg-emerald-500';
    return 'bg-slate-300';
  }

  function title(evt: GithubEventRow): string {
    const m = evt.metadata;
    if (!m) return evt.event_type;
    if (evt.event_type === 'pull_request') return m.pr_title ?? `PR #${m.pr_number ?? '?'}`;
    if (evt.event_type === 'deployment_status') return `${m.environment ?? 'production'} — ${evt.action ?? ''}`;
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
        <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors">
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
          <div key={evt.id} className="flex items-start gap-3 px-5 py-3 border-b border-black/[0.04] hover:bg-black/[0.015] transition-colors">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${d}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[9px] font-mono font-semibold uppercase tracking-wide text-slate-400">{label}</span>
                {evt.action && (
                  <>
                    <span className="text-[9px] text-slate-300">·</span>
                    <span className="text-[9px] text-slate-400">{evt.action}</span>
                  </>
                )}
                <span className="ml-auto text-[9px] font-mono text-slate-400 flex-shrink-0">{rel(evt.created_at)}</span>
              </div>
              {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium text-slate-800 hover:text-blue-600 transition-colors line-clamp-1 block">
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

  const agentMap = React.useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const liveCount = runs.filter((r) => r.status === 'running').length;
  const githubRepo = github[0]?.repo ?? null;

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

      {/* Main row: Agent Feed (2/3) | Next Actions + GitHub stacked (1/3) */}
      <div className="grid grid-cols-3 gap-4" style={{ minHeight: '520px' }}>
        <div className="col-span-2">
          <AgentFeed
            runs={runs}
            agentMap={agentMap}
            githubRepo={githubRepo}
            onRerun={handleRerun}
          />
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex-1" style={{ minHeight: '240px' }}>
            <NextActions
              actions={actions}
              insights={insights}
              agentMap={agentMap}
              onDecide={handleDecide}
            />
          </div>
          <div className="flex-1" style={{ minHeight: '240px' }}>
            <GitHubActivity events={github} />
          </div>
        </div>
      </div>

      {/* Bottom row: Agent Health (2/3) | Memory & Intelligence (1/3) */}
      <div className="grid grid-cols-3 gap-4" style={{ minHeight: '340px' }}>
        <div className="col-span-2">
          <AgentHealth agents={agents} agentStatsMap={agentStatsMap} runs={runs} />
        </div>
        <MemoryIntelligence memory={memory} insights={insights} github={github} />
      </div>
    </div>
  );
}
