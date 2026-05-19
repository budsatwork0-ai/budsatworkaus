'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { BudState, BudActivityEvent, BudApprovalItem } from '@/lib/bud/types';
import { scoreAgentHealth, type AgentHealthLabel, type GlobalHealthCheck } from '@/lib/bud/health';
import { BudStateDisplay } from './_components/BudStateDisplay';
import { BudActivityFeed } from './_components/BudActivityFeed';
import { AgentHierarchy } from './_components/AgentHierarchy';
import { BudApprovalQueue } from './_components/BudApprovalQueue';

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
  status: 'running' | 'succeeded' | 'failed' | 'needs_approval' | 'needs_repair' | 'cancelled';
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

type AgentLifecycleState = 'active' | 'idle' | 'awaiting_review' | 'degraded' | 'blocked' | 'overloaded' | 'dormant' | 'retired';

type Props = {
  agents: AgentRow[];
  runs: RunRow[];
  actions: ActionRow[];
  github: GithubEventRow[];
  memory: MemoryDoc[];
  insights: InsightRow[];
  metrics: Metrics;
  agentStatsMap: Record<string, AgentStats>;
  supabaseConnected: boolean;
  vercelConnected: boolean;
  budState?: BudState;
  budStatus?: 'nominal' | 'elevated' | 'critical';
  budSummary?: string | null;
  budActivity?: BudActivityEvent[];
  budApprovals?: BudApprovalItem[];
  globalHealth: GlobalHealthCheck;
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

async function delegateToBud(runId: string, agentId: string, agentName: string): Promise<void> {
  const res = await fetch('/api/bud/investigate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ runId, agentId, agentName }),
  });
  if (res.ok) {
    toast.success(`Delegated to Bud — investigating ${agentName}`);
  } else {
    toast.error('Failed to delegate to Bud');
  }
}

function buildGithubIssueUrl(run: RunRow, agent: AgentRow | undefined, githubRepo: string | null): string {
  const label = agent?.name ?? run.agent_id;
  const title = encodeURIComponent(`Agent ${run.status}: ${label}`);
  const body = encodeURIComponent(
    `**Agent:** ${label}\n**Status:** ${run.status}\n**Run ID:** ${run.id}\n**Time:** ${run.started_at}\n\n**Output:**\n${run.summary ?? '(none)'}`,
  );
  const base = githubRepo ? `https://github.com/${githubRepo}/issues/new` : `https://github.com/issues/new`;
  return `${base}?title=${title}&body=${body}`;
}

// Compact button class helpers
const BTN = 'text-[11px] font-medium rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-40';
const BTN_SLATE  = `${BTN} text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200`;
const BTN_BLUE   = `${BTN} text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100`;
const BTN_VIOLET = `${BTN} text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-100`;
const BTN_RED    = `${BTN} text-red-600 bg-red-50 hover:bg-red-100 border border-red-100`;
const BTN_GHOST  = `${BTN} text-slate-400 hover:text-slate-600 hover:bg-slate-50 border border-transparent`;

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

function StatusBar({
  m,
  liveCount,
  isConnected,
  globalHealth,
}: {
  m: Metrics;
  liveCount: number;
  isConnected: boolean;
  globalHealth: GlobalHealthCheck;
}) {
  const healthLabel = globalHealth.status === 'nominal'
    ? 'All systems nominal'
    : globalHealth.status === 'degraded'
      ? 'Degraded'
      : 'Attention required';
  const healthColor = globalHealth.status === 'nominal'
    ? 'text-emerald-600'
    : globalHealth.status === 'degraded'
      ? 'text-amber-600'
      : 'text-red-600';

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
  onArchive,
  onDelegate,
}: {
  run: RunRow;
  agent: AgentRow | undefined;
  githubRepo: string | null;
  onRerun: (agentId: string) => Promise<void>;
  onArchive: (runId: string) => Promise<void>;
  onDelegate: (runId: string, agentId: string, agentName: string) => Promise<void>;
}) {
  const [rerunning, setRerunning] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [delegating, setDelegating] = useState(false);
  const [debugCopied, setDebugCopied] = useState(false);
  const analysis = analyzeFailure(run, agent);

  async function handleRerun() {
    setRerunning(true);
    try { await onRerun(run.agent_id); } finally { setRerunning(false); }
  }

  async function handleArchive() {
    setArchiving(true);
    try { await onArchive(run.id); } finally { setArchiving(false); }
  }

  async function copyDebug() {
    await navigator.clipboard.writeText(analysis.debugPrompt);
    setDebugCopied(true);
    toast.success('Debug prompt copied to clipboard');
    setTimeout(() => setDebugCopied(false), 2500);
  }

  async function handleDelegate() {
    setDelegating(true);
    try { await onDelegate(run.id, run.agent_id, agent?.name ?? run.agent_id); }
    finally { setDelegating(false); }
  }

  const issueUrl = buildGithubIssueUrl(run, agent, githubRepo);

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
      <div className="flex items-center gap-1.5 flex-wrap">
        <Link href={`/dashboard/agents/${run.agent_id}`} className={BTN_SLATE}>
          View output
        </Link>
        <button disabled={rerunning} onClick={handleRerun} className={BTN_BLUE}>
          {rerunning ? 'Retrying…' : 'Rerun'}
        </button>
        <button onClick={copyDebug} className={BTN_VIOLET}>
          {debugCopied ? '✓ Copied' : 'Debug'}
        </button>
        <button disabled={delegating} onClick={handleDelegate} className={`${BTN} text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-100`}>
          {delegating ? 'Delegating…' : 'Delegate to Bud'}
        </button>
        <a href={issueUrl} target="_blank" rel="noopener noreferrer" className={BTN_SLATE}>
          GitHub issue ↗
        </a>
        <button disabled={archiving} onClick={handleArchive} className={`${BTN_GHOST} ml-auto`}>
          {archiving ? '…' : 'Archive'}
        </button>
      </div>
    </div>
  );
}

// ─── Agent Feed: Approval row ─────────────────────────────────────────────────

function ApprovalRow({
  run,
  agent,
  githubRepo,
  onRerun,
  onArchive,
  onDelegate,
}: {
  run: RunRow;
  agent: AgentRow | undefined;
  githubRepo: string | null;
  onRerun: (agentId: string) => Promise<void>;
  onArchive: (runId: string) => Promise<void>;
  onDelegate: (runId: string, agentId: string, agentName: string) => Promise<void>;
}) {
  const [rerunning, setRerunning] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [debugCopied, setDebugCopied] = useState(false);
  const [delegating, setDelegating] = useState(false);

  async function handleRerun() {
    setRerunning(true);
    try { await onRerun(run.agent_id); } finally { setRerunning(false); }
  }

  async function handleArchive() {
    setArchiving(true);
    try { await onArchive(run.id); } finally { setArchiving(false); }
  }

  async function copyDebug() {
    const text = `Debug: ${agent?.name ?? run.agent_id} — ${run.summary ?? 'needs_approval'}`;
    await navigator.clipboard.writeText(text);
    setDebugCopied(true);
    toast.success('Debug prompt copied');
    setTimeout(() => setDebugCopied(false), 2500);
  }

  async function handleDelegate() {
    setDelegating(true);
    try { await onDelegate(run.id, run.agent_id, agent?.name ?? run.agent_id); }
    finally { setDelegating(false); }
  }

  const issueUrl = buildGithubIssueUrl(run, agent, githubRepo);

  return (
    <div className="px-5 py-3.5 border-b border-black/[0.04] last:border-0">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
        <span className="text-[11px] font-semibold text-slate-900 truncate">{agent?.name ?? run.agent_id}</span>
        {agent?.category && <CategoryChip category={agent.category} />}
        <span className="ml-auto text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-1.5 py-0.5 flex-shrink-0">
          Needs approval
        </span>
        <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">{rel(run.started_at)}</span>
      </div>
      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mb-2.5">
        {run.summary ?? 'Proposed an action and is awaiting your approval'}
      </p>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Link href={`/dashboard/agents/${run.agent_id}`} className={BTN_SLATE}>
          View output
        </Link>
        <button disabled={rerunning} onClick={handleRerun} className={BTN_BLUE}>
          {rerunning ? 'Running…' : 'Rerun'}
        </button>
        <button onClick={copyDebug} className={BTN_VIOLET}>
          {debugCopied ? '✓ Copied' : 'Debug'}
        </button>
        <button disabled={delegating} onClick={handleDelegate} className={`${BTN} text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-100`}>
          {delegating ? 'Delegating…' : 'Delegate to Bud'}
        </button>
        <a href={issueUrl} target="_blank" rel="noopener noreferrer" className={BTN_SLATE}>
          GitHub issue ↗
        </a>
        <button disabled={archiving} onClick={handleArchive} className={`${BTN_GHOST} ml-auto`}>
          {archiving ? '…' : 'Archive'}
        </button>
      </div>
    </div>
  );
}

// ─── Agent Feed: Useful run row ───────────────────────────────────────────────

function UsefulRow({
  run,
  agent,
  githubRepo,
  onRerun,
  onArchive,
  onDelegate,
}: {
  run: RunRow;
  agent: AgentRow | undefined;
  githubRepo: string | null;
  onRerun: (agentId: string) => Promise<void>;
  onArchive: (runId: string) => Promise<void>;
  onDelegate: (runId: string, agentId: string, agentName: string) => Promise<void>;
}) {
  const [rerunning, setRerunning] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [debugCopied, setDebugCopied] = useState(false);
  const [delegating, setDelegating] = useState(false);

  async function handleRerun() {
    setRerunning(true);
    try { await onRerun(run.agent_id); } finally { setRerunning(false); }
  }

  async function handleArchive() {
    setArchiving(true);
    try { await onArchive(run.id); } finally { setArchiving(false); }
  }

  async function copyDebug() {
    const text = `Analyze this agent run and suggest improvements:\n\nAgent: ${agent?.name ?? run.agent_id}\nOutput: ${run.summary ?? '(none)'}`;
    await navigator.clipboard.writeText(text);
    setDebugCopied(true);
    toast.success('Debug prompt copied');
    setTimeout(() => setDebugCopied(false), 2500);
  }

  async function handleDelegate() {
    setDelegating(true);
    try { await onDelegate(run.id, run.agent_id, agent?.name ?? run.agent_id); }
    finally { setDelegating(false); }
  }

  const issueUrl = buildGithubIssueUrl(run, agent, githubRepo);

  return (
    <div className="px-5 py-3.5 border-b border-black/[0.04] last:border-0 hover:bg-black/[0.01] transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
        <span className="text-[11px] font-semibold text-slate-900 truncate">{agent?.name ?? run.agent_id}</span>
        {agent?.category && <CategoryChip category={agent.category} />}
        <span className="ml-auto text-[10px] font-mono text-slate-400 flex-shrink-0">{rel(run.started_at)}</span>
      </div>
      <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2 mb-1 pl-3.5">{run.summary}</p>
      <p className="text-[10px] text-slate-400 mb-2.5 pl-3.5">
        {usefulImpactLabel(agent?.category ?? '')} update
        {run.cost_cents ? ` · ${fmtCost(run.cost_cents)}` : ''}
        {run.duration_ms ? ` · ${fmtDuration(run.duration_ms)}` : ''}
      </p>
      <div className="flex items-center gap-1.5 flex-wrap pl-3.5">
        <Link href={`/dashboard/agents/${run.agent_id}`} className={BTN_SLATE}>
          View output
        </Link>
        <button disabled={rerunning} onClick={handleRerun} className={BTN_BLUE}>
          {rerunning ? 'Running…' : 'Rerun'}
        </button>
        <button onClick={copyDebug} className={BTN_VIOLET}>
          {debugCopied ? '✓ Copied' : 'Debug'}
        </button>
        <button disabled={delegating} onClick={handleDelegate} className={`${BTN} text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-100`}>
          {delegating ? 'Delegating…' : 'Delegate to Bud'}
        </button>
        <a href={issueUrl} target="_blank" rel="noopener noreferrer" className={BTN_SLATE}>
          GitHub issue ↗
        </a>
        <button disabled={archiving} onClick={handleArchive} className={`${BTN_GHOST} ml-auto`}>
          {archiving ? '…' : 'Archive'}
        </button>
      </div>
    </div>
  );
}

// ─── Agent Feed: Quiet runs (no-op) section ───────────────────────────────────

function QuietRuns({
  noopsByAgent,
  agentMap,
  onArchive,
}: {
  noopsByAgent: Map<string, { count: number; latest: RunRow }>;
  agentMap: Map<string, AgentRow>;
  onArchive: (runId: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const groups = Array.from(noopsByAgent.entries());
  const totalRuns = groups.reduce((s, [, g]) => s + g.count, 0);

  if (groups.length === 0) return null;

  async function handleArchive(runId: string) {
    setArchivingId(runId);
    try { await onArchive(runId); } finally { setArchivingId(null); }
  }

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
              const isArchiving = archivingId === latest.id;
              return (
                <div
                  key={agentId}
                  className="flex items-center gap-3 px-5 py-2 border-t border-black/[0.03] hover:bg-black/[0.01] transition-colors group"
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
                  <button
                    disabled={isArchiving}
                    onClick={() => handleArchive(latest.id)}
                    className="text-[10px] text-slate-300 hover:text-slate-500 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-40"
                    title="Archive this run"
                  >
                    {isArchiving ? '…' : '×'}
                  </button>
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
  onArchive,
  onDelegate,
}: {
  runs: RunRow[];
  agentMap: Map<string, AgentRow>;
  githubRepo: string | null;
  onRerun: (agentId: string) => Promise<void>;
  onArchive: (runId: string) => Promise<void>;
  onDelegate: (runId: string, agentId: string, agentName: string) => Promise<void>;
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
          <p className="text-[11px] text-slate-400">Agents have not run yet, or all runs are quiet</p>
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
                  onArchive={onArchive}
                  onDelegate={onDelegate}
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
                <ApprovalRow
                  key={run.id}
                  run={run}
                  agent={agentMap.get(run.agent_id)}
                  githubRepo={githubRepo}
                  onRerun={onRerun}
                  onArchive={onArchive}
                  onDelegate={onDelegate}
                />
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
                <UsefulRow
                  key={run.id}
                  run={run}
                  agent={agentMap.get(run.agent_id)}
                  githubRepo={githubRepo}
                  onRerun={onRerun}
                  onArchive={onArchive}
                  onDelegate={onDelegate}
                />
              ))}
            </div>
          )}

          {/* Section: Quiet (no-op) runs — collapsed */}
          <QuietRuns noopsByAgent={noopsByAgent} agentMap={agentMap} onArchive={onArchive} />
        </>
      )}
    </Panel>
  );
}

// ─── Next Actions ─────────────────────────────────────────────────────────────

function NextActions({
  actions: initialActions,
  insights,
  agentMap,
  onDecide,
}: {
  actions: ActionRow[];
  insights: InsightRow[];
  agentMap: Map<string, AgentRow>;
  onDecide: (id: string, decision: 'approve' | 'reject') => Promise<void>;
}) {
  const [actions, setActions] = useState<ActionRow[]>(initialActions);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [savingObsidian, setSavingObsidian] = useState<Set<string>>(new Set());
  const [delegatingId, setDelegatingId] = useState<string | null>(null);

  // Keep actions in sync if parent updates (new actions from realtime)
  useEffect(() => { setActions(initialActions); }, [initialActions]);

  async function decide(id: string, decision: 'approve' | 'reject') {
    setBusy((s) => new Set(s).add(id));
    try { await onDecide(id, decision); }
    finally {
      setBusy((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  }

  function startEdit(action: ActionRow) {
    setEditingId(action.id);
    setEditText(action.preview);
  }

  async function saveEdit(id: string) {
    setBusy((s) => new Set(s).add(id));
    try {
      const res = await fetch(`/api/agents/actions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preview: editText }),
      });
      if (res.ok) {
        setActions((prev) => prev.map((a) => a.id === id ? { ...a, preview: editText } : a));
        setEditingId(null);
        toast.success('Action updated');
      } else {
        toast.error('Failed to save — try again');
      }
    } finally {
      setBusy((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  }

  async function delegateActionToBud(action: ActionRow) {
    const agentName = agentMap.get(action.agent_id)?.name ?? action.agent_id;
    setDelegatingId(action.id);
    try {
      await delegateToBud(action.id, action.agent_id, agentName);
    } finally {
      setDelegatingId(null);
    }
  }

  async function saveToObsidian(action: ActionRow) {
    setSavingObsidian((s) => new Set(s).add(action.id));
    try {
      const agentName = agentMap.get(action.agent_id)?.name ?? action.agent_id;
      const res = await fetch('/api/memory/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'admin',
          title: `Agent action: ${action.action_type} (${agentName})`,
          content: action.preview,
          tags: ['agent-action', action.action_type],
          source: 'human',
        }),
      });
      if (res.ok) {
        toast.success('Saved to Obsidian memory');
      } else if (res.status === 409) {
        toast('Already saved — duplicate detected');
      } else {
        toast.error('Failed to save to memory');
      }
    } finally {
      setSavingObsidian((s) => { const n = new Set(s); n.delete(action.id); return n; });
    }
  }

  async function saveInsightToObsidian(insight: InsightRow) {
    setSavingObsidian((s) => new Set(s).add(insight.id));
    try {
      const res = await fetch('/api/memory/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'admin',
          title: insight.title,
          content: `Severity: ${insight.severity}\nCategory: ${insight.category}\nDetected: ${insight.created_at}`,
          tags: ['agent-insight', insight.severity, insight.category],
          source: 'human',
        }),
      });
      if (res.ok) {
        toast.success('Saved to Obsidian memory');
      } else if (res.status === 409) {
        toast('Already saved — duplicate detected');
      } else {
        toast.error('Failed to save to memory');
      }
    } finally {
      setSavingObsidian((s) => { const n = new Set(s); n.delete(insight.id); return n; });
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
            {actions.map((action) => {
              const isEditing = editingId === action.id;
              const isBusy = busy.has(action.id);
              const isSavingObs = savingObsidian.has(action.id);
              return (
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

                  {/* Preview or inline editor */}
                  {isEditing ? (
                    <div className="mb-2.5">
                      <textarea
                        className="w-full text-[11px] text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-slate-300"
                        rows={4}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        autoFocus
                      />
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <button
                          disabled={isBusy || !editText.trim()}
                          onClick={() => saveEdit(action.id)}
                          className="text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 disabled:opacity-40 rounded-lg px-2.5 py-1.5 transition-colors"
                        >
                          {isBusy ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className={BTN_GHOST}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-600 line-clamp-2 mb-2.5 leading-relaxed">{action.preview}</p>
                  )}

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400 mr-1">
                      {agentMap.get(action.agent_id)?.name ?? action.agent_id} · {rel(action.created_at)}
                    </span>
                    <button
                      disabled={isBusy}
                      onClick={() => decide(action.id, 'approve')}
                      className="text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 disabled:opacity-40 rounded-lg px-2.5 py-1.5 transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      disabled={isBusy}
                      onClick={() => decide(action.id, 'reject')}
                      className={BTN_RED}
                    >
                      Reject
                    </button>
                    {!isEditing && (
                      <button onClick={() => startEdit(action)} className={BTN_SLATE}>
                        Edit
                      </button>
                    )}
                    <button
                      disabled={delegatingId === action.id}
                      onClick={() => delegateActionToBud(action)}
                      className={BTN_VIOLET}
                    >
                      {delegatingId === action.id ? 'Delegating…' : 'Delegate to Bud'}
                    </button>
                    <button
                      disabled={isSavingObs}
                      onClick={() => saveToObsidian(action)}
                      className={BTN_SLATE}
                    >
                      {isSavingObs ? 'Saving…' : 'Save to Obsidian'}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {urgentInsights.slice(0, 4).map((insight) => {
            const isSavingObs = savingObsidian.has(insight.id);
            return (
              <div key={insight.id} className="px-5 py-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${insight.severity === 'critical' ? 'bg-red-500' : 'bg-orange-400'}`} />
                  <span className="text-[11px] font-semibold text-slate-900 line-clamp-1">{insight.title}</span>
                  <span className={`ml-auto text-[9px] font-semibold uppercase tracking-wide border rounded-full px-1.5 py-0.5 flex-shrink-0 ${insight.severity === 'critical' ? 'text-red-700 bg-red-50 border-red-100' : 'text-orange-700 bg-orange-50 border-orange-100'}`}>
                    {insight.severity}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-[10px] text-slate-400 mr-1">{insight.category} · {rel(insight.created_at)}</span>
                  <Link
                    href={insight.agent_id ? `/dashboard/agents/${insight.agent_id}` : '/dashboard/agents'}
                    className={BTN_SLATE}
                  >
                    Investigate →
                  </Link>
                  {insight.agent_id && (
                    <button
                      onClick={() => delegateToBud(insight.id, insight.agent_id!, insight.title)}
                      className={BTN_VIOLET}
                    >
                      Queue repair
                    </button>
                  )}
                  <button
                    disabled={isSavingObs}
                    onClick={() => saveInsightToObsidian(insight)}
                    className={BTN_SLATE}
                  >
                    {isSavingObs ? 'Saving…' : 'Save to Obsidian'}
                  </button>
                </div>
              </div>
            );
          })}
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
    .map((a) => {
      const agentRuns = runs.filter((run) => run.agent_id === a.id);
      const scored = scoreAgentHealth(agentRuns, []);
      const statsHealth = getHealth(agentStatsMap[a.id]);
      const health = HEALTH[scored.label].order < HEALTH[statsHealth].order ? scored.label : statsHealth;
      return {
        ...a,
        stats: agentStatsMap[a.id],
        health,
        lastOutput: lastOutputMap.get(a.id) ?? null,
      };
    })
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

const INTEL_SOURCES = [
  { key: 'obsidian', name: 'Obsidian', icon: '◆', hint: 'Connect Obsidian vault' },
  { key: 'github',   name: 'GitHub',   icon: '⬡', hint: 'Sync GitHub activity' },
  { key: 'claude',   name: 'Claude',   icon: '◉', hint: null },
  { key: 'vercel',   name: 'Vercel',   icon: '▲', hint: 'Connect Vercel' },
  { key: 'supabase', name: 'Supabase', icon: '◈', hint: 'Connect Supabase' },
  { key: 'crawler',  name: 'Crawler',  icon: '⊕', hint: 'Import site context' },
];

const SETUP_ACTIONS = [
  { key: 'obsidian', label: 'Sync Obsidian vault',     desc: 'Pull design docs, ADRs and dev logs into memory',      icon: '◆' },
  { key: 'agents',   label: 'Activate Bud',            desc: 'Run Bud to analyse agent health and build intel',       icon: '◉' },
  { key: 'crawler',  label: 'Crawl site pages',        desc: 'Index public pages as memory for AI reference',        icon: '⊕' },
  { key: 'github',   label: 'Sync GitHub activity',    desc: 'Connect repo webhooks for PR and deploy events',       icon: '⬡' },
];

function IntelCard({
  label,
  color,
  title,
  meta,
  empty,
}: {
  label: string;
  color: string;
  title?: string | null;
  meta?: string | null;
  empty: string;
}) {
  return (
    <div className="rounded-xl border border-black/[0.05] bg-slate-50/50 px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`text-[8px] font-semibold uppercase tracking-widest ${color}`}>{label}</span>
        {meta && <span className="ml-auto text-[9px] font-mono text-slate-400 flex-shrink-0">{meta}</span>}
      </div>
      {title ? (
        <p className="text-[11px] text-slate-700 line-clamp-2 leading-relaxed">{title}</p>
      ) : (
        <p className="text-[11px] text-slate-400 italic">{empty}</p>
      )}
    </div>
  );
}

// ─── Memory empty state (setup wizard) ───────────────────────────────────────

type SetupKey = 'agents' | 'obsidian' | 'github' | 'crawler';

const GITHUB_SECRETS_INSTRUCTIONS = `To sync GitHub activity into Mission Control:

1. Go to your GitHub repo → Settings → Secrets and variables → Actions
2. Add secret: BUDS_WEBHOOK_URL = https://budsatwork.com/api/webhooks/github
3. Add secret: BUDS_WEBHOOK_SECRET = (generate with: openssl rand -hex 32)
4. Go to Vercel → Project → Environment Variables
5. Add: GITHUB_WEBHOOK_SECRET = (same value as step 3)

Every future push, PR, and deploy will then populate Memory & Intelligence automatically.`;

const OBSIDIAN_INSTRUCTIONS = `To sync your Obsidian vault:

The GitHub Actions workflow (obsidian-events.yml) is already in your repo.
It needs two secrets set in GitHub → Settings → Secrets → Actions:

  BUDS_WEBHOOK_URL     = https://budsatwork.com/api/webhooks/github
  BUDS_WEBHOOK_SECRET  = (generate with: openssl rand -hex 32)

Then set GITHUB_WEBHOOK_SECRET to the same value in Vercel env vars.
Once done, every push to main will write vault notes automatically.`;

function MemoryEmptyState() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [expanded, setExpanded] = useState<SetupKey | null>(null);

  async function activateBud() {
    setRunning(true);
    const toastId = toast.loading('Bud is thinking — analysing agent workforce…');
    try {
      const res = await fetch('/api/agents/bud', { method: 'POST' });
      if (res.ok) {
        toast.success('Bud activated — loading intel…', { id: toastId, duration: 4000 });
        setTimeout(() => router.refresh(), 1500);
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.error ?? 'Bud activation failed', { id: toastId, duration: 5000 });
      }
    } catch {
      toast.error('Network error — try again', { id: toastId, duration: 5000 });
    } finally {
      setRunning(false);
    }
  }

  async function syncObsidian() {
    setSyncing(true);
    try {
      const res = await fetch('/api/memory/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Vault synced — ${data.sync?.inserted ?? 0} inserted, ${data.sync?.updated ?? 0} updated`);
        setTimeout(() => router.refresh(), 1200);
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.error ?? 'Sync failed');
      }
    } catch {
      toast.error('Network error — try again');
    } finally {
      setSyncing(false);
    }
  }

  async function runCrawler() {
    setCrawling(true);
    try {
      const res = await fetch('/api/crawl', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Crawled ${(data.inserted ?? 0) + (data.updated ?? 0)} pages`);
        setTimeout(() => router.refresh(), 1200);
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.error ?? 'Crawl failed');
      }
    } catch {
      toast.error('Network error — try again');
    } finally {
      setCrawling(false);
    }
  }

  function handleClick(key: SetupKey) {
    if (key === 'agents') { activateBud(); return; }
    if (key === 'obsidian') { syncObsidian(); return; }
    if (key === 'crawler') { runCrawler(); return; }
    setExpanded((prev) => (prev === key ? null : key));
  }

  const instructions: Record<SetupKey, string> = {
    agents:   '',
    obsidian: '',
    github:   GITHUB_SECRETS_INSTRUCTIONS,
    crawler:  '',
  };

  return (
    <Panel label="Memory & Intelligence" className="h-full">
      <div className="flex flex-col h-full px-5 py-6">
        <div className="flex items-center justify-center mb-5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-50 to-blue-50 border border-violet-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
            </svg>
          </div>
        </div>

        <p className="text-[13px] font-semibold text-slate-700 text-center mb-1">No intelligence saved yet</p>
        <p className="text-[11px] text-slate-400 text-center leading-relaxed mb-5 max-w-[200px] mx-auto">
          Activate Bud or connect a data source to get started.
        </p>

        <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-2.5">Get started</p>
        <div className="space-y-1.5">
          {SETUP_ACTIONS.map((action) => {
            const key = action.key as SetupKey;
            const isExpanded = expanded === key;
            const isBusy =
              (key === 'agents' && running) ||
              (key === 'obsidian' && syncing) ||
              (key === 'crawler' && crawling);
            const busyLabel =
              key === 'agents' ? 'Activating Bud…' :
              key === 'obsidian' ? 'Syncing vault…' :
              key === 'crawler' ? 'Crawling pages…' :
              action.label;
            return (
              <div key={key}>
                <button
                  disabled={isBusy}
                  onClick={() => handleClick(key)}
                  className="w-full flex items-center gap-3 text-left rounded-xl border border-black/[0.06] bg-slate-50/80 hover:bg-white hover:border-black/10 disabled:opacity-60 px-3 py-2.5 transition-all group"
                >
                  <span className="text-[11px] text-slate-400 flex-shrink-0 font-mono">{action.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-slate-700">
                      {isBusy ? busyLabel : action.label}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{action.desc}</p>
                  </div>
                  {key === 'github' ? (
                    <span className="text-[10px] text-slate-400 flex-shrink-0 transition-transform" style={{ display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'none' }}>→</span>
                  ) : (
                    <span className="text-[10px] font-medium text-violet-600 flex-shrink-0">
                      {isBusy ? '…' : 'Run now'}
                    </span>
                  )}
                </button>

                {/* Inline instructions for github only */}
                <AnimatePresence initial={false}>
                  {isExpanded && instructions[key] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <pre className="mt-1.5 text-[9.5px] leading-relaxed text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 whitespace-pre-wrap font-mono">
                        {instructions[key]}
                      </pre>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function MemoryIntelligence({
  memory,
  insights,
  github,
  runs,
  supabaseConnected,
  vercelConnected,
}: {
  memory: MemoryDoc[];
  insights: InsightRow[];
  github: GithubEventRow[];
  runs: RunRow[];
  supabaseConnected: boolean;
  vercelConnected: boolean;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [crawling, setCrawling] = useState(false);

  async function syncObsidian() {
    setSyncing(true);
    try {
      const res = await fetch('/api/memory/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Vault synced — ${data.sync?.inserted ?? 0} inserted`);
        setTimeout(() => router.refresh(), 1200);
      } else {
        toast.error('Sync failed');
      }
    } catch { toast.error('Network error'); }
    finally { setSyncing(false); }
  }

  async function runCrawler() {
    setCrawling(true);
    try {
      const res = await fetch('/api/crawl', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Crawled ${(data.inserted ?? 0) + (data.updated ?? 0)} pages`);
        setTimeout(() => router.refresh(), 1200);
      } else {
        toast.error('Crawl failed');
      }
    } catch { toast.error('Network error'); }
    finally { setCrawling(false); }
  }

  const sourceActions: Record<string, (() => void) | null> = {
    obsidian: syncObsidian,
    crawler:  runCrawler,
    github:   null,
    vercel:   null,
    supabase: null,
    claude:   null,
  };

  const sourceLabels: Record<string, string> = {
    obsidian: syncing  ? 'Syncing…' : 'Sync vault',
    crawler:  crawling ? 'Crawling…' : 'Crawl pages',
    github:   'Set up GitHub webhook',
    vercel:   'Connect Vercel',
    supabase: 'Connect Supabase',
    claude:   'Connect Claude',
  };

  const hasInsights = insights.length > 0;
  const hasMemory = memory.length > 0;
  const hasGithub = github.length > 0;
  const hasCrawler = memory.some((d) => d.vault_path?.startsWith('site/'));
  const hasAnyData = hasInsights || hasMemory || hasGithub || supabaseConnected;

  const connected: Record<string, boolean> = {
    obsidian: hasMemory,
    github: hasGithub,
    claude: hasInsights || runs.length > 0,
    vercel: vercelConnected,
    supabase: supabaseConnected,
    crawler: hasCrawler,
  };

  const lastInsight = insights[0] ?? null;
  const lastRec = insights.find((i) => i.agent_id != null) ?? null;
  const designCats = new Set(['design', 'ux', 'architecture']);
  const lastDesign = memory.find((d) => designCats.has(d.category)) ?? null;

  const missingSources = INTEL_SOURCES.filter((s) => s.hint && !connected[s.key]);

  // ── Empty state ──
  if (!hasAnyData) {
    return <MemoryEmptyState />;
  }

  // ── Data state ──
  return (
    <Panel label="Memory & Intelligence" className="h-full">
      {/* Last known intelligence */}
      <div className="px-5 pt-4 pb-3.5 border-b border-black/[0.04]">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-2.5">Last known</p>
        <div className="space-y-1.5">
          <IntelCard
            label="Site insight"
            color="text-blue-500"
            title={lastInsight?.title}
            meta={lastInsight ? rel(lastInsight.created_at) : undefined}
            empty="No insights recorded yet"
          />
          <IntelCard
            label="Agent recommendation"
            color="text-violet-500"
            title={lastRec?.title}
            meta={lastRec ? `${rel(lastRec.created_at)} · ${lastRec.category}` : undefined}
            empty="No agent recommendations yet"
          />
          <IntelCard
            label="Design decision"
            color="text-pink-500"
            title={lastDesign?.title}
            meta={lastDesign ? `${lastDesign.category} · ${rel(lastDesign.created_at)}` : undefined}
            empty="No design decisions in vault"
          />
        </div>
      </div>

      {/* Connected sources */}
      <div className="px-5 pt-3.5 pb-3.5 border-b border-black/[0.04]">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-2.5">Connected sources</p>
        <div className="grid grid-cols-3 gap-1.5">
          {INTEL_SOURCES.map((src) => {
            const on = connected[src.key];
            return (
              <div
                key={src.key}
                className={`flex flex-col gap-1 rounded-xl px-2.5 py-2 border transition-colors ${on ? 'border-emerald-100 bg-emerald-50/50' : 'border-black/[0.04] bg-slate-50/40'}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${on ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                  <span className={`text-[10px] font-semibold ${on ? 'text-slate-800' : 'text-slate-400'}`}>{src.name}</span>
                </div>
                <span className={`text-[9px] ${on ? 'text-emerald-600' : 'text-slate-300'}`}>
                  {on ? 'Connected' : 'Not set up'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Missing setup steps */}
      {missingSources.length > 0 && (
        <div className="px-5 pt-3.5 pb-4">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Setup needed</p>
          <div className="space-y-1.5">
            {missingSources.map((src) => {
              const action = sourceActions[src.key];
              const isBusy = (src.key === 'obsidian' && syncing) || (src.key === 'crawler' && crawling);
              const label = sourceLabels[src.key] ?? src.hint;
              return (
                <button
                  key={src.key}
                  disabled={isBusy}
                  onClick={action ?? undefined}
                  className="w-full flex items-center gap-2.5 text-left rounded-xl border border-black/[0.05] bg-slate-50/60 hover:bg-white hover:border-black/[0.09] disabled:opacity-60 px-3 py-2 transition-all group"
                >
                  <span className="text-[10px] text-slate-300 flex-shrink-0 font-mono group-hover:text-slate-500 transition-colors">
                    {src.icon}
                  </span>
                  <p className="text-[10px] font-medium text-slate-500 group-hover:text-slate-700 transition-colors flex-1">
                    {src.hint}
                  </p>
                  <span className="text-[9px] font-medium text-violet-600 group-hover:text-violet-700 transition-colors flex-shrink-0">
                    {action ? (isBusy ? '…' : label) : '→'}
                  </span>
                </button>
              );
            })}
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
  supabaseConnected,
  vercelConnected,
  budState = 'idle',
  budStatus = 'nominal',
  budSummary = null,
  budActivity = [],
  budApprovals = [],
  globalHealth,
}: Props) {
  const [runs, setRuns] = useState<RunRow[]>(initialRuns);
  const [actions, setActions] = useState<ActionRow[]>(initialActions);
  const [metrics, setMetrics] = useState<Metrics>(initialMetrics);
  const [isConnected, setIsConnected] = useState(false);

  const agentMap = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const liveCount = runs.filter((r) => r.status === 'running').length;
  const githubRepo = github[0]?.repo ?? null;

  // Compute lifecycle states from recent run data
  const agentStates = useMemo<Record<string, AgentLifecycleState>>(() => {
    const states: Record<string, AgentLifecycleState> = {};
    const now = Date.now();
    const recentMs = 3_600_000;
    for (const run of runs) {
      if (states[run.agent_id]) continue;
      const isRecent = now - new Date(run.started_at).getTime() < recentMs;
      if (run.status === 'running') states[run.agent_id] = 'active';
      else if (run.status === 'failed' && isRecent) states[run.agent_id] = 'degraded';
      else if (run.status === 'needs_approval') states[run.agent_id] = 'awaiting_review';
      else if (run.status === 'needs_repair') states[run.agent_id] = 'degraded';
      else if (run.status === 'succeeded' && isRecent) states[run.agent_id] = 'active';
      else states[run.agent_id] = 'idle';
    }
    return states;
  }, [runs]);

  // Compute agent health from stats
  const agentHealthMap = useMemo<Record<string, { label: AgentHealthLabel; score: number }>>(() => {
    const health: Record<string, { label: AgentHealthLabel; score: number }> = {};
    for (const agent of agents) {
      const scored = scoreAgentHealth(runs.filter((run) => run.agent_id === agent.id), []);
      health[agent.id] = { label: scored.label, score: scored.score };
    }
    return health;
  }, [agents, runs]);

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
      body: JSON.stringify({ agent_id: agentId, input: 'Manual rerun from Mission Control' }),
    });
    if (res.ok) {
      toast.success('Agent queued for rerun');
    } else {
      toast.error('Failed to queue rerun — check agent config');
    }
  }, []);

  const handleArchive = useCallback(async (runId: string) => {
    const res = await fetch(`/api/agents/runs/${runId}/archive`, { method: 'POST' });
    if (res.ok) {
      setRuns((prev) => prev.filter((r) => r.id !== runId));
      toast.success('Run archived');
    } else {
      toast.error('Failed to archive run');
    }
  }, []);

  const handleDelegate = useCallback(async (runId: string, agentId: string, agentName: string) => {
    await delegateToBud(runId, agentId, agentName);
  }, []);

  return (
    <div className="flex flex-col gap-4 pb-6" style={{ minHeight: 'calc(100vh - 160px)' }}>
      {/* Bud state banner */}
      <BudStateDisplay
        initialState={budState}
        initialStatus={budStatus}
        initialSummary={budSummary}
      />

      <StatusBar m={metrics} liveCount={liveCount} isConnected={isConnected} globalHealth={globalHealth} />

      {/* Main row: Agent Feed (2/3) | Next Actions + GitHub stacked (1/3) */}
      <div className="grid grid-cols-3 gap-4" style={{ minHeight: '520px' }}>
        <div className="col-span-2">
          <AgentFeed
            runs={runs}
            agentMap={agentMap}
            githubRepo={githubRepo}
            onRerun={handleRerun}
            onArchive={handleArchive}
            onDelegate={handleDelegate}
          />
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex-1" style={{ minHeight: '200px' }}>
            <Panel label="Bud Approval Queue" className="h-full">
              <BudApprovalQueue initial={budApprovals} />
            </Panel>
          </div>
          <div className="flex-1" style={{ minHeight: '200px' }}>
            <NextActions
              actions={actions}
              insights={insights}
              agentMap={agentMap}
              onDecide={handleDecide}
            />
          </div>
          <div className="flex-1" style={{ minHeight: '180px' }}>
            <GitHubActivity events={github} />
          </div>
        </div>
      </div>

      {/* Bud row: Agent Hierarchy (1/3) | Bud Activity Feed (2/3) */}
      <div className="grid grid-cols-3 gap-4" style={{ minHeight: '360px' }}>
        <div>
          <Panel label="Agent Hierarchy" className="h-full">
            <div className="px-3 py-3">
              <AgentHierarchy
                agents={agents}
                agentStates={agentStates}
                agentHealth={agentHealthMap}
              />
            </div>
          </Panel>
        </div>
        <div className="col-span-2">
          <Panel label="Bud Activity" className="h-full">
            <BudActivityFeed initial={budActivity} />
          </Panel>
        </div>
      </div>

      {/* Bottom row: Agent Health (2/3) | Memory & Intelligence (1/3) */}
      <div className="grid grid-cols-3 gap-4" style={{ minHeight: '340px' }}>
        <div className="col-span-2">
          <AgentHealth agents={agents} agentStatsMap={agentStatsMap} runs={runs} />
        </div>
        <MemoryIntelligence memory={memory} insights={insights} github={github} runs={initialRuns} supabaseConnected={supabaseConnected} vercelConnected={vercelConnected} />
      </div>
    </div>
  );
}
