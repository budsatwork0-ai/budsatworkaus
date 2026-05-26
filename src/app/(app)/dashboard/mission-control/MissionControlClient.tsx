'use client';

/**
 * Buds OS — Mission Control
 *
 * Sections:
 *   Overview  - operator cockpit (presence, vitals, work queue)
 *   Dev OS    - development agent layer reference
 *   Terminal  - Bud chat terminal
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { toast } from 'sonner';
import type { BudActivityEvent, BudApprovalItem } from '@/lib/bud/types';
import type { MissionControlHealth } from '@/lib/bud/health';
import {
  buildRepairWorkspace,
  type BudOsAutonomyCapability,
  type BudOsMemoryLayer,
  type BudOsQueueItem,
  type BudOsStateLabel,
  type BudOsWorkforceCluster,
} from '@/lib/bud/os-view-model';
import type { UxEvolutionRecommendation } from '@/lib/bud/ux-evolution-engine';
import type { BudAuthority } from '@/lib/bud/authority';
import type { BudCapability } from '@/lib/bud/capabilities';
import type { BudInitiative } from '@/lib/bud/initiatives';
import type { StructuredFailure } from '@/lib/bud/structured-failure';
import type { BudThought } from '@/lib/bud/thought-stream';
import type { DevOsResponse } from '@/app/api/dev-os/route';
import { OverviewV2 } from './_components/OverviewV2';
import { BudTerminal } from './_components/BudTerminal';
import { GraphifyTab } from './_components/GraphifyTab';
import { ObsidianTab } from './_components/ObsidianTab';
import { EvidenceTab } from './_components/EvidenceTab';
import { deriveGlobalTruth } from '@/lib/bud/overview-v2';

type AgentRow = { id: string; name: string; status: string; category: string; autonomy: string };
type RunRow = {
  id: string;
  agent_id: string;
  status: 'running' | 'succeeded' | 'failed' | 'needs_approval' | 'needs_repair' | 'cancelled';
  summary: string | null;
  started_at: string;
};
type ActionRow = { id: string; agent_id: string; action_type: string; preview: string; created_at: string };
type MemoryDoc = { id: string; category: string; title: string; vault_path: string; created_at: string };
type InsightRow = {
  id: string;
  agent_id: string | null;
  category: string;
  severity: string;
  title: string;
  created_at: string;
};

type RepairExecutionRow = {
  id: string;
  task_id: string | null;
  status: string;
  root_cause_type: string | null;
  root_cause_summary: string | null;
  repair_strategy: Record<string, unknown> | null;
  diff_summary: string | null;
  deployment_url: string | null;
  verification_status: string;
  ci_conclusion: string | null;
  ci_run_url: string | null;
  taste_score: number | null;
  taste_pass: boolean | null;
  taste_violations: string[] | null;
  taste_suggestions: string[] | null;
  browser_tests_passed: number | null;
  browser_tests_failed: number | null;
  browser_tests_total: number | null;
  browser_test_status: string | null;
  pr_url: string | null;
  issue_url: string | null;
  created_at: string;
};
type RepairStepRow = {
  id: string;
  execution_id: string;
  state: string;
  status: string;
  summary: string;
  started_at: string;
};
type RepairLogRow = { id: number; execution_id: string; level: string; message: string; created_at: string };

type Props = {
  agents?: AgentRow[];
  runs?: RunRow[];
  actions?: ActionRow[];
  memory?: MemoryDoc[];
  insights?: InsightRow[];
  budActivity?: BudActivityEvent[];
  budApprovals?: BudApprovalItem[];
  commandState: MissionControlHealth;
  budOs: {
    state: { label: BudOsStateLabel; summary: string; hasIssues: boolean };
    actionQueue: BudOsQueueItem[];
    workforce: BudOsWorkforceCluster[];
    memoryLayer: BudOsMemoryLayer;
    autonomy: BudOsAutonomyCapability[];
    uxEvolution: UxEvolutionRecommendation[];
    repairExecutions: RepairExecutionRow[];
    repairSteps: RepairStepRow[];
    changeRequests: Array<{ id: string; task_id: string | null; branch_name: string | null; issue_url: string | null; pr_url: string | null; status: string }>;
    authority: BudAuthority;
    capabilities: BudCapability[];
    initiatives: BudInitiative[];
    structuredFailures: StructuredFailure[];
    thoughtStream: BudThought[];
    githubConnected: boolean;
    circuit: { state: 'closed' | 'open' | 'half_open'; resetsAt: string | null; failureStreak: number; label: string };
    efficiencyFindings: Array<{
      id: string;
      domain: string;
      title: string;
      severity: string;
      priority: string;
      body: string | null;
      affected_agents: string[];
      proposed_fix: string | null;
      estimated_saving: string | null;
      automation_candidate: boolean;
      created_at: string;
    }>;
  };
  devOs: DevOsResponse;
  pipelinePanel?: React.ReactNode;
};

/* ── Tabs ─────────────────────────────────────────────────────────────────── */

const TABS = [
  { key: 'overview',  label: 'Overview' },
  { key: 'dev-os',    label: 'Dev OS' },
  { key: 'terminal',  label: 'Terminal' },
  { key: 'graphify',  label: 'Graphify' },
  { key: 'memory',    label: 'Memory' },
  { key: 'evidence',  label: 'Evidence' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

/* ────────────────────────────────────────────────────────────────────────── */
/*                              DEV OS STATIC DATA                             */
/* ────────────────────────────────────────────────────────────────────────── */

const DEV_OS_AGENTS = [
  {
    id: 'bud-researcher',
    name: 'Bud Researcher',
    role: 'Impact mapping',
    category: 'research' as const,
    trigger: 'Before any feature, fix, or refactor — maps blast radius, identifies existing patterns, sets risk level',
    requiredFor: ['Every non-trivial change'],
  },
  {
    id: 'bud-pricing-guard',
    name: 'Bud Pricing Guard',
    role: 'Pricing integrity',
    category: 'guard' as const,
    trigger: 'Whenever a change touches quotes, rates, multipliers, sqm logic, caps, or service pricing',
    requiredFor: ['Pricing changes', 'Price optimizer approvals'],
  },
  {
    id: 'bud-architect',
    name: 'Bud Architect',
    role: 'Implementation strategy',
    category: 'design' as const,
    trigger: 'After Researcher — produces the minimal batch plan with approval gates marked before any code is written',
    requiredFor: ['Feature builds', 'Refactor batches'],
  },
  {
    id: 'bud-taste',
    name: 'Bud Taste',
    role: 'UX consistency',
    category: 'review' as const,
    trigger: 'After any UI change — checks glass tokens, brand colours, mobile layout, cognitive load, and footer consistency',
    requiredFor: ['All front-end changes'],
  },
  {
    id: 'bud-qa',
    name: 'Bud QA',
    role: 'Quality gate',
    category: 'quality' as const,
    trigger: 'Before marking work complete — runs TypeScript, ESLint, and Next.js build in sequence',
    requiredFor: ['Every implementation batch'],
  },
  {
    id: 'bud-memory',
    name: 'Bud Memory',
    role: 'Architecture memory',
    category: 'memory' as const,
    trigger: 'End of session — updates graphify knowledge graph, writes the dev log, captures new conventions',
    requiredFor: ['End of significant sessions'],
  },
  {
    id: 'bud-factory',
    name: 'Bud Factory',
    role: 'Workflow orchestrator',
    category: 'orchestration' as const,
    trigger: 'Full feature builds — orchestrates the complete workflow and enforces the approval pause before implementation',
    requiredFor: ['New features', 'Multi-batch refactors'],
  },
] as const;

const FACTORY_PIPELINE: Array<{
  label: string; dot: string; note: string; approval: boolean; optional: boolean; agent: string | null;
}> = [
  { label: 'Research',      dot: 'bg-sky-400',     note: 'bud-researcher',  approval: false, optional: false, agent: 'bud-researcher'    },
  { label: 'Pricing Guard', dot: 'bg-amber-400',   note: 'if pricing risk', approval: false, optional: true,  agent: 'bud-pricing-guard' },
  { label: 'Architect',     dot: 'bg-violet-400',  note: 'bud-architect',   approval: false, optional: false, agent: 'bud-architect'     },
  { label: 'Approve plan',  dot: 'bg-yellow-300',  note: 'hard pause',      approval: true,  optional: false, agent: null                },
  { label: 'Build',         dot: 'bg-white/40',    note: 'main claude',     approval: false, optional: false, agent: null                },
  { label: 'Taste',         dot: 'bg-pink-400',    note: 'if UI changed',   approval: false, optional: true,  agent: 'bud-taste'         },
  { label: 'QA',            dot: 'bg-emerald-400', note: 'bud-qa',          approval: false, optional: false, agent: 'bud-qa'            },
  { label: 'Memory',        dot: 'bg-teal-400',    note: 'bud-memory',      approval: false, optional: false, agent: 'bud-memory'        },
];

const CONSTITUTION_RULES = [
  { rule: 'Surgical changes only', detail: 'Minimal footprint, no broad rewrites — stable systems stay stable' },
  { rule: 'Pricing requires approval', detail: 'Formula changes, rate alterations, or cap modifications need explicit sign-off before implementation' },
  { rule: 'Shared components cascade', detail: 'SummaryCard, Panel, StatRow, StatusChip — update all call sites in the same commit' },
  { rule: 'Read before writing', detail: 'graphify query first, grep second, write last — never skip the research step' },
  { rule: 'No invented colours', detail: 'brand.accent, brand.text, brand.muted only — no raw hex codes or off-system Tailwind colours' },
  { rule: 'Three QA gates, no exceptions', detail: 'tsc --noEmit, eslint, next build — all three must pass before marking work done' },
  { rule: 'glass is a string', detail: 'Spread it as className={glass} or className={`${glass} extra`} — never style={{...glass}}' },
] as const;

const DEV_OS_HOW = [
  {
    title: 'Auto-trigger',
    body: 'Claude Code reads each agent\'s description and invokes the right one based on your request. Say what you need — the agents self-select.',
    example: '"add a late-cancel fee to cleaning quotes"',
  },
  {
    title: 'Name it directly',
    body: 'Prefix with the agent name to force-invoke a specific check without running the full factory workflow.',
    example: '"Use Bud Pricing Guard to review this diff"',
  },
  {
    title: 'Bud Factory',
    body: 'Full workflow mode. Runs Research → plan → approval pause → build → taste → QA → memory. Use for new features and multi-batch refactors.',
    example: '"Use Bud Factory to build the gift card feature"',
  },
] as const;

/* ────────────────────────────────────────────────────────────────────────── */
/*                               DEV OS TAB                                   */
/* ────────────────────────────────────────────────────────────────────────── */

const CAT_DOT: Record<typeof DEV_OS_AGENTS[number]['category'], string> = {
  research: 'bg-sky-400',
  guard: 'bg-amber-400',
  design: 'bg-violet-400',
  review: 'bg-pink-400',
  quality: 'bg-emerald-400',
  memory: 'bg-teal-400',
  orchestration: 'bg-white/50',
};

const CAT_CHIP: Record<typeof DEV_OS_AGENTS[number]['category'], string> = {
  research: 'border-sky-400/30 text-sky-300',
  guard: 'border-amber-400/30 text-amber-300',
  design: 'border-violet-400/30 text-violet-300',
  review: 'border-pink-400/30 text-pink-300',
  quality: 'border-emerald-400/30 text-emerald-300',
  memory: 'border-teal-400/30 text-teal-300',
  orchestration: 'border-white/20 text-white/65',
};

function DevOsTab({ devOs }: { devOs: DevOsResponse }) {
  const { sessions, agentStats, totalSessions, conventionCount } = devOs;
  const hasData = totalSessions > 0;

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl border border-sky-400/20 bg-gradient-to-br from-sky-500/[0.06] to-violet-500/[0.04] p-6">
        <div className="pointer-events-none absolute -top-16 right-0 h-48 w-64 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-sky-400" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300/80">Claude Code Dev OS</span>
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Development Agent Layer</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">
            7 specialised Claude Code subagents that run during development sessions — distinct from the runtime Bud fleet on Vercel cron. They enforce the constitution: surgical changes, pricing integrity, UX consistency, and QA gates before anything ships.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-sky-400/30 bg-sky-500/[0.08] px-3 py-1 text-[11px] font-medium text-sky-300">7 agents</span>
            <span className="rounded-full border border-violet-400/30 bg-violet-500/[0.08] px-3 py-1 text-[11px] font-medium text-violet-300">
              {totalSessions} session{totalSessions === 1 ? '' : 's'} logged
            </span>
            {conventionCount > 0 && (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/[0.08] px-3 py-1 text-[11px] font-medium text-emerald-300">
                {conventionCount} convention{conventionCount === 1 ? '' : 's'} captured
              </span>
            )}
            <span className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-white/55">.claude/agents/ · always ready</span>
          </div>
        </div>
      </section>

      {/* ── Factory pipeline ─────────────────────────────────────────────────── */}
      <Card
        title="Bud Factory workflow"
        subtitle="Full sequence for non-trivial feature builds. Approve plan is a hard pause — human must sign off before implementation starts."
      >
        <div className="px-5 py-4">
          <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap sm:overflow-x-auto sm:pb-2">
            {FACTORY_PIPELINE.map((step, idx) => {
              const stat = step.agent ? agentStats[step.agent] : null;
              return (
                <React.Fragment key={step.label}>
                  {idx > 0 && <span className="mt-4 shrink-0 text-[11px] text-white/20">→</span>}
                  <div
                    className={`shrink-0 rounded-xl border px-3 py-2.5 text-center ${
                      step.approval
                        ? 'border-yellow-300/40 bg-yellow-300/[0.06]'
                        : step.optional
                          ? 'border-white/[0.05] bg-white/[0.01]'
                          : 'border-white/[0.07] bg-white/[0.02]'
                    }`}
                    style={{ minWidth: 88 }}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${step.dot}`} />
                      <span className={`text-[11px] font-semibold ${step.approval ? 'text-yellow-200' : step.optional ? 'text-white/55' : 'text-white/85'}`}>
                        {step.label}
                      </span>
                      {step.optional && <span className="text-[9px] text-white/30">?</span>}
                    </div>
                    <p className={`mt-1 text-[10px] ${step.approval ? 'text-yellow-300/70' : 'text-white/35'}`}>
                      {step.note}
                    </p>
                    {stat && (
                      <p className="mt-1 text-[9px] text-white/30">{stat.runCount}×</p>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-white/35">
            Pricing Guard fires only when Researcher detects pricing risk. Taste skips when no UI changed. Bud Factory handles routing.
          </p>
        </div>
      </Card>

      {/* ── Agent roster ───────────────────────────────────────────────────────── */}
      <Card
        title="Agent roster"
        subtitle="Invoke by name, or describe the task and the right agent auto-triggers. Run counts update after each Claude Code session."
      >
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {DEV_OS_AGENTS.map((agent) => {
            const stat = agentStats[agent.id];
            const hasRun = Boolean(stat?.runCount);
            return (
              <div key={agent.id} className="rounded-xl border border-white/[0.07] bg-white/[0.015] p-4">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${CAT_DOT[agent.category]}`} />
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{agent.name}</p>
                  {hasRun ? (
                    <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-500/[0.08] px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">
                      {stat!.runCount}×
                    </span>
                  ) : (
                    <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${CAT_CHIP[agent.category]}`}>
                      ready
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-white/35">{agent.role}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-white/65">{agent.trigger}</p>
                {stat?.lastRunAt && (
                  <p className="mt-2 text-[10px] text-white/35">last run {rel(stat.lastRunAt)}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1">
                  {agent.requiredFor.map((r) => (
                    <span key={r} className="rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-white/45">{r}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Session history ───────────────────────────────────────────────────── */}
      <Card
        title="Session history"
        subtitle="Logged by vault-log.ts after each Claude Code session. Shows which agents ran, what was changed, and the risk level detected."
      >
        {!hasData ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-white/40">No sessions logged yet.</p>
            <p className="mt-1 text-xs text-white/30">Sessions appear here after your next Claude Code stop event that invokes a Dev OS agent.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {sessions.slice(0, 10).map((session) => (
              <div key={session.id} className="px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-wrap gap-1">
                    {session.agents_used.map((agentId) => {
                      const agent = DEV_OS_AGENTS.find((a) => a.id === agentId);
                      return agent ? (
                        <span key={agentId} className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CAT_CHIP[agent.category]}`}>
                          {agent.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                  {session.risk_level && (
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      session.risk_level === 'HIGH'   ? 'border-red-400/40 text-red-300'    :
                      session.risk_level === 'MEDIUM' ? 'border-amber-400/30 text-amber-300' :
                      'border-emerald-400/30 text-emerald-300'
                    }`}>
                      {session.risk_level}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-white/35">{rel(session.created_at)}</span>
                </div>
                {session.task && (
                  <p className="mt-1.5 text-sm text-white/80 line-clamp-1">{session.task}</p>
                )}
                {session.files_changed.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {session.files_changed.slice(0, 6).map((f) => (
                      <span key={f} className="rounded border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 font-mono text-[9px] text-white/45">
                        {f.split('/').pop()}
                      </span>
                    ))}
                    {session.files_changed.length > 6 && (
                      <span className="text-[9px] text-white/30">+{session.files_changed.length - 6} more</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Constitution + How to invoke ─────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Card title="Constitution" subtitle="Non-negotiable rules. Always active — never togglable.">
          <div className="divide-y divide-white/[0.05]">
            {CONSTITUTION_RULES.map((item) => (
              <div key={item.rule} className="flex items-start gap-3 px-5 py-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/20" />
                <div>
                  <p className="text-sm font-semibold text-white">{item.rule}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/55">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="How to invoke" subtitle="Three ways to work with Dev OS agents.">
          <div className="divide-y divide-white/[0.05]">
            {DEV_OS_HOW.map((item) => (
              <div key={item.title} className="px-5 py-4">
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-white/60">{item.body}</p>
                <p className="mt-2.5 rounded-md border border-white/[0.06] bg-black/25 px-2.5 py-1.5 font-mono text-[10px] text-white/45">{item.example}</p>
              </div>
            ))}
          </div>
        </Card>

        <CaptureLearningCard />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                           CAPTURE LEARNING CARD                            */
/* ────────────────────────────────────────────────────────────────────────── */

function CaptureLearningCard() {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [files, setFiles] = useState('');
  const [patterns, setPatterns] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !summary.trim()) return;
    setStatus('saving');
    setErrorMsg('');
    try {
      const res = await fetch('/api/bud/learning', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          summary: summary.trim(),
          filesChanged: files.split(',').map(s => s.trim()).filter(Boolean),
          patterns: patterns.split(',').map(s => s.trim()).filter(Boolean),
        }),
      });
      const data = await res.json() as { success: boolean; error?: string };
      if (data.success) {
        setStatus('saved');
        setTitle('');
        setSummary('');
        setFiles('');
        setPatterns('');
        setTimeout(() => setStatus('idle'), 3000);
      } else {
        setStatus('error');
        setErrorMsg(data.error ?? 'Unknown error');
      }
    } catch (e) {
      setStatus('error');
      setErrorMsg(String(e));
    }
  }

  return (
    <Card title="Capture session learning" subtitle="Write a learning note to the Obsidian vault and evidence store.">
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 px-5 py-4">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-white/50">Title</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Archived stale repair tasks to fix false critical state"
            required
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-white/20"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-white/50">Summary — what changed and why</label>
          <textarea
            value={summary}
            onChange={e => setSummary(e.target.value)}
            placeholder="What changed, why it was needed, what the outcome was."
            required
            rows={3}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-white/20"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-white/50">Files changed (comma-separated)</label>
            <input
              value={files}
              onChange={e => setFiles(e.target.value)}
              placeholder="src/lib/bud/health.ts, migrations/073..."
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-white/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-white/50">Reusable patterns (comma-separated)</label>
            <input
              value={patterns}
              onChange={e => setPatterns(e.target.value)}
              placeholder="archive stale rows before resetting lobby state..."
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-white/20"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={status === 'saving' || !title.trim() || !summary.trim()}
            className="rounded-lg border border-teal-400/30 bg-teal-500/[0.10] px-4 py-2 text-sm font-medium text-teal-300 transition hover:bg-teal-500/[0.18] disabled:opacity-40"
          >
            {status === 'saving' ? 'Saving…' : 'Save to vault'}
          </button>
          {status === 'saved' && <span className="text-sm text-emerald-400">Saved to Obsidian + evidence store</span>}
          {status === 'error' && <span className="text-sm text-red-400">{errorMsg}</span>}
        </div>
      </form>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                                 PRIMITIVES                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function rel(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function Card({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm shadow-[0_24px_70px_-30px_rgba(0,0,0,0.6)] ${className}`}
    >
      {(title || action) && (
        <div className="flex items-start gap-3 border-b border-white/[0.05] px-5 py-3.5">
          <div className="min-w-0">
            {title && <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">{title}</h2>}
            {subtitle && <p className="mt-1 text-xs text-white/45">{subtitle}</p>}
          </div>
          {action && <div className="ml-auto shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                                   PAGE                                     */
/* ────────────────────────────────────────────────────────────────────────── */

type ActivityEvent = { id: string; event_type: string; narrative: string; actor: string; created_at: string; metadata?: Record<string, unknown>; target?: string };

export function MissionControlClient({
  commandState,
  budOs,
  budActivity = [],
  devOs,
}: Props) {
  const router = useRouter();
  const search = useSearchParams();

  const rawTab = search?.get('tab');
  const initialTab: TabKey = TABS.some((t) => t.key === rawTab)
    ? (rawTab as TabKey)
    : 'overview';
  const [tab, setTab] = useState<TabKey>(initialTab);

  const [queue, setQueue] = useState<BudOsQueueItem[]>(budOs.actionQueue);
  const [selectedId, setSelectedId] = useState<string | null>(budOs.actionQueue[0]?.id ?? null);
  const [liveActivity, setLiveActivity] = useState<BudActivityEvent[]>(budActivity.slice(0, 12));
  const [investigatingIds, setInvestigatingIds] = useState<Set<string>>(new Set());
  const actionedIdsRef = useRef<Set<string>>(new Set());

  const [lazyRepairData, setLazyRepairData] = useState<{
    logs: RepairLogRow[];
    steps: RepairStepRow[];
    rollbackEvents: Array<{ id: string; execution_id: string | null; agent_id: string | null; trigger: string; created_at: string }>;
  } | null>(null);

  const selected = queue.find((item) => item.id === selectedId) ?? queue[0] ?? null;

  const incomingQueueKey = budOs.actionQueue.map((i) => i.id).join(',');
  useEffect(() => {
    const filtered = budOs.actionQueue.filter((i) => !actionedIdsRef.current.has(i.id));
    setQueue(filtered);
    setSelectedId((prev) =>
      filtered.find((i) => i.id === prev) ? prev : (filtered[0]?.id ?? null),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingQueueKey]);

  useEffect(() => {
    const taskId = selected?.task_id ?? (selected?.source === 'bud_task' ? selected?.source_id : null);
    const execution = taskId
      ? budOs.repairExecutions.find((e) => e.task_id === taskId)
      : null;
    if (!execution) { setLazyRepairData(null); return; }
    void fetch(`/api/bud/repairs/logs?execution_id=${execution.id}`)
      .then((r) => r.json())
      .then((d) => setLazyRepairData(d))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, budOs.repairExecutions]);

  const workspace = useMemo(
    () =>
      buildRepairWorkspace({
        selectedItem: selected,
        commandState,
        executions: budOs.repairExecutions,
        steps: lazyRepairData?.steps ?? budOs.repairSteps,
        logs: lazyRepairData?.logs ?? [],
        activity: budActivity,
        rollbackEvents: lazyRepairData?.rollbackEvents ?? [],
        changeRequests: budOs.changeRequests,
      }),
    [selected, commandState, budOs.repairExecutions, budOs.repairSteps, lazyRepairData, budActivity, budOs.changeRequests],
  );

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(interval);
  }, [router]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url.toString());
  }, [tab]);

  useEffect(() => {
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const channel = supabase
      .channel('bud-live-activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bud_activity_feed' }, (payload) => {
        const row = payload.new as ActivityEvent;
        setLiveActivity((prev) => [{
          id: row.id,
          event_type: row.event_type as BudActivityEvent['event_type'],
          narrative: row.narrative,
          actor: row.actor ?? null,
          target: row.target ?? null,
          metadata: row.metadata ?? {},
          created_at: row.created_at,
        }, ...prev].slice(0, 20));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bud_approval_queue' }, () => {
        router.refresh();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bud_tasks' }, () => {
        router.refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  function refreshHint() {
    router.refresh();
  }

  async function dismiss(item: BudOsQueueItem) {
    try {
      const res = await fetch('/api/bud/actions/dismiss', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source: item.source, id: item.source_id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Dismiss failed');
      actionedIdsRef.current.add(item.id);
      setQueue((prev) => prev.filter((entry) => entry.id !== item.id));
      toast.success('Bud dismissed the item');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Dismiss failed');
    }
  }

  async function approve(item: BudOsQueueItem, notes = '') {
    if (item.approval && item.approval.readiness !== 'ready') {
      toast.error(`Not ready: ${item.approval.readiness_summary}`);
      return;
    }
    try {
      const url = item.source === 'agent_action' ? `/api/agents/actions/${item.source_id}` : '/api/bud/approval';
      const body = item.source === 'agent_action'
        ? { decision: 'approve', notes: notes || undefined }
        : { id: item.source_id, decision: 'approved', notes: notes || undefined };
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? 'Approval failed');
      actionedIdsRef.current.add(item.id);
      setQueue((prev) => prev.filter((entry) => entry.id !== item.id));
      toast.success(notes ? 'Approved with note' : 'Bud approval recorded');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Approval failed');
    }
  }

  async function investigate(item: BudOsQueueItem) {
    setInvestigatingIds((prev) => new Set([...prev, item.id]));
    try {
      if (item.source === 'agent_run' && item.agent_id) {
        const res = await fetch('/api/bud/investigate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ runId: item.source_id, agentId: item.agent_id, agentName: item.agent_name ?? item.agent_id }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error ?? 'Investigation failed');
      } else {
        const res = await fetch('/api/bud/command', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ command: `Investigate and propose a fix: ${item.title}. ${item.detail}` }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error ?? 'Bud command failed');
      }
      setInvestigatingIds((prev) => { const s = new Set(prev); s.delete(item.id); return s; });
      actionedIdsRef.current.add(item.id);
      setQueue((prev) => prev.filter((e) => e.id !== item.id));
      const agentLabel = item.agent_name ?? item.title;
      toast.success(`Bud is on it — investigating ${agentLabel}. Check the approvals queue.`);
      router.refresh();
    } catch (error) {
      setInvestigatingIds((prev) => { const s = new Set(prev); s.delete(item.id); return s; });
      toast.error(error instanceof Error ? error.message : 'Investigation failed');
    }
  }

  const truth = deriveGlobalTruth(commandState);
  const truthDot = {
    healthy: 'bg-emerald-400',
    degraded: 'bg-amber-400',
    approval: 'bg-yellow-300',
    recovering: 'bg-sky-400',
    blocked: 'bg-red-400',
  }[truth.state];

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-black text-white">
      <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6">

        {/* Header */}
        <header className="flex flex-wrap items-center gap-3 pb-4">
          <div className="flex items-center gap-3">
            <span className={`inline-flex h-2.5 w-2.5 rounded-full ${truthDot}`} />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">Bud · {truth.headline}</p>
              <h1 className="text-2xl font-semibold tracking-tight">Mission Control</h1>
            </div>
          </div>
          <button
            onClick={() => router.refresh()}
            className="ml-auto rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-white/70 hover:bg-white/[0.08]"
          >
            Refresh
          </button>
        </header>

        {/* Tabs */}
        <nav className="sticky top-0 z-10 -mx-4 mb-5 border-b border-white/[0.07] bg-slate-950/85 px-4 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map((entry) => {
              const active = tab === entry.key;
              return (
                <button
                  key={entry.key}
                  onClick={() => setTab(entry.key)}
                  className={`relative shrink-0 border-b-2 px-3.5 py-2.5 text-[12px] font-semibold uppercase tracking-wider transition ${
                    active ? 'border-sky-400 text-white' : 'border-transparent text-white/55 hover:text-white/85'
                  }`}
                >
                  {entry.label}
                  {active && <span className="pointer-events-none absolute inset-x-2 -bottom-px h-px bg-gradient-to-r from-transparent via-sky-400 to-transparent" />}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Tab content */}
        <div className="space-y-4">
          {tab === 'overview' && (
            <OverviewV2
              commandState={commandState}
              queue={queue}
              workspace={workspace}
              failures={budOs.structuredFailures}
              thoughts={budOs.thoughtStream}
              activity={liveActivity}
              uxEvolution={budOs.uxEvolution}
              selectedId={selected?.id ?? null}
              investigatingIds={investigatingIds}
              onSelect={(item) => setSelectedId(item.id)}
              onApprove={(item) => void approve(item)}
              onInvestigate={(item) => void investigate(item)}
              onDismiss={(item) => void dismiss(item)}
            />
          )}

          {tab === 'dev-os' && <DevOsTab devOs={devOs} />}

          {tab === 'terminal' && <BudTerminal />}

          {tab === 'graphify' && <GraphifyTab />}

          {tab === 'memory' && <ObsidianTab />}

          {tab === 'evidence' && <EvidenceTab />}
        </div>

        <footer className="mt-8 flex flex-wrap items-center gap-3 border-t border-white/[0.05] pt-4 text-[11px] text-white/40">
          <span>Buds OS · operational intelligence layer</span>
          <span className="ml-auto">{truth.headline} · {truth.detail}</span>
        </footer>
      </div>
    </div>
  );
}
