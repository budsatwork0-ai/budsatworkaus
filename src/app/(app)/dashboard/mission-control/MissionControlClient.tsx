'use client';

/**
 * Buds OS - the unified operational intelligence layer.
 *
 * Sections:
 *   Command   - persistent ask-bar, recommended initiatives
 *   Overview  - presence, vitals, thought stream, work queue
 *   Workforce - agent groups, multi-agent collaboration
 *   Repairs   - repair studio + lifecycle states
 *   Activity  - structured failures + live event stream
 *   Memory    - operational memory
 *   Evolution - UX evolution & redesign proposals
 *   Deployments - deploy + verification engine
 *   Settings  - authority & capability disclosure
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { toast } from 'sonner';
import type { BudActivityEvent, BudApprovalItem } from '@/lib/bud/types';
import type { MissionControlHealth } from '@/lib/bud/health';
import {
  buildRepairWorkspace,
  type BudOsApprovalDetail,
  type BudOsAutonomyCapability,
  type BudOsMemoryLayer,
  type BudOsQueueGroup,
  type BudOsQueueItem,
  type BudOsRepairWorkspace,
  type BudOsStateLabel,
  type BudOsWorkforceCluster,
} from '@/lib/bud/os-view-model';
import type { UxEvolutionRecommendation } from '@/lib/bud/ux-evolution-engine';
import type { BudAuthority, BudAuthorityLevel } from '@/lib/bud/authority';
import { AUTHORITY_LABELS, AUTHORITY_DESCRIPTIONS } from '@/lib/bud/authority';
import type { BudCapability } from '@/lib/bud/capabilities';
import type { BudInitiative } from '@/lib/bud/initiatives';
import type { StructuredFailure } from '@/lib/bud/structured-failure';
import type { BudThought } from '@/lib/bud/thought-stream';

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
  agents: AgentRow[];
  runs: RunRow[];
  actions: ActionRow[];
  memory: MemoryDoc[];
  insights: InsightRow[];
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
    repairLogs: RepairLogRow[];
    authority: BudAuthority;
    capabilities: BudCapability[];
    initiatives: BudInitiative[];
    structuredFailures: StructuredFailure[];
    thoughtStream: BudThought[];
    githubConnected: boolean;
    circuit: { state: 'closed' | 'open' | 'half_open'; resetsAt: string | null; failureStreak: number; label: string };
    resilienceEvents: Array<{
      id: number;
      guard: 'circuit_breaker' | 'zombie_reaper' | 'concurrency_guard';
      event_type: string;
      payload: Record<string, unknown>;
      created_at: string;
    }>;
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
};

type BudCommandResponse = {
  ok: boolean;
  task_id: string;
  intent: string;
  approval_id: string | null;
  status: string;
  bud_response: { message: string; plan: string[]; bud_state: string } | null;
};

/* ────────────────────────────────────────────────────────────────────────── */
/*                                STYLE TOKENS                                */
/* ────────────────────────────────────────────────────────────────────────── */

const GLOBAL_STATUS_TONE: Record<MissionControlHealth['global_status'], { ring: string; text: string; dot: string; label: string }> = {
  nominal: { ring: 'ring-emerald-400/30 bg-emerald-500/[0.06]', text: 'text-emerald-400', dot: 'bg-emerald-400', label: 'NOMINAL' },
  degraded: { ring: 'ring-amber-400/30 bg-amber-500/[0.06]', text: 'text-amber-300', dot: 'bg-amber-400', label: 'DEGRADED' },
  attention_required: { ring: 'ring-red-400/40 bg-red-500/[0.08]', text: 'text-red-300', dot: 'bg-red-400', label: 'ATTENTION REQUIRED' },
  repairing: { ring: 'ring-orange-400/30 bg-orange-500/[0.06]', text: 'text-orange-300', dot: 'bg-orange-400', label: 'REPAIRING' },
  blocked: { ring: 'ring-red-500/50 bg-red-500/[0.10]', text: 'text-red-400', dot: 'bg-red-500', label: 'BLOCKED' },
};

const STATE_PRESENCE: Record<BudOsStateLabel, { dot: string; halo: string }> = {
  Observing: { dot: 'bg-emerald-400', halo: 'shadow-[0_0_24px_rgba(52,211,153,0.35)]' },
  Thinking: { dot: 'bg-sky-400', halo: 'shadow-[0_0_24px_rgba(56,189,248,0.35)]' },
  Investigating: { dot: 'bg-amber-400', halo: 'shadow-[0_0_24px_rgba(251,191,36,0.4)]' },
  Planning: { dot: 'bg-violet-400', halo: 'shadow-[0_0_24px_rgba(167,139,250,0.4)]' },
  'Waiting for approval': { dot: 'bg-yellow-300', halo: 'shadow-[0_0_24px_rgba(253,224,71,0.4)]' },
  Repairing: { dot: 'bg-orange-400', halo: 'shadow-[0_0_24px_rgba(251,146,60,0.4)]' },
  Deploying: { dot: 'bg-blue-400', halo: 'shadow-[0_0_24px_rgba(96,165,250,0.4)]' },
  Verifying: { dot: 'bg-cyan-400', halo: 'shadow-[0_0_24px_rgba(34,211,238,0.4)]' },
  Learning: { dot: 'bg-teal-400', halo: 'shadow-[0_0_24px_rgba(45,212,191,0.4)]' },
  Blocked: { dot: 'bg-red-500', halo: 'shadow-[0_0_24px_rgba(239,68,68,0.45)]' },
};

const SEVERITY_TONE: Record<'low' | 'medium' | 'high' | 'critical', string> = {
  low: 'border-white/10 text-slate-400',
  medium: 'border-amber-400/30 text-amber-300',
  high: 'border-orange-400/40 text-orange-300',
  critical: 'border-red-400/50 text-red-300',
};

const CAPABILITY_TONE: Record<BudCapability['status'], string> = {
  online: 'border-emerald-400/30 bg-emerald-500/[0.06] text-emerald-300',
  partial: 'border-amber-400/30 bg-amber-500/[0.06] text-amber-300',
  blocked: 'border-red-400/40 bg-red-500/[0.08] text-red-300',
};

function CopyButton({ text, label = 'Copy', className = '' }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button
      onClick={copy}
      className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition ${copied ? 'text-emerald-400' : 'text-white/35 hover:text-white/70'} ${className}`}
    >
      {copied ? '✓ copied' : label}
    </button>
  );
}

const TABS = [
  { key: 'command', label: 'Command' },
  { key: 'overview', label: 'Overview' },
  { key: 'workforce', label: 'Workforce' },
  { key: 'repairs', label: 'Repairs' },
  { key: 'activity', label: 'Activity' },
  { key: 'memory', label: 'Memory' },
  { key: 'evolution', label: 'Evolution' },
  { key: 'deployments', label: 'Deployments' },
  { key: 'settings', label: 'Settings' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const EXAMPLES = [
  'Fix broken agents',
  'Investigate quote drop-off',
  'Redesign the admin workflow',
  'Simplify Mission Control',
  'Deploy approved repairs',
  'Improve mobile experience',
  'Reduce dashboard clutter',
  'Analyze operational bottlenecks',
];

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

function clamp(text: string, length = 160): string {
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
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

function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'cool' }) {
  const tones = {
    neutral: 'border-white/10 bg-white/[0.04] text-white/70',
    good: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300',
    warn: 'border-amber-400/30 bg-amber-500/10 text-amber-300',
    bad: 'border-red-400/40 bg-red-500/10 text-red-300',
    cool: 'border-sky-400/30 bg-sky-500/10 text-sky-300',
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tones[tone]}`}>
      {children}
    </span>
  );
}

function StatBlock({ label, value, hint, tone = 'neutral' }: { label: string; value: string | number; hint?: string; tone?: 'neutral' | 'warn' | 'bad' | 'good' }) {
  const toneCls = tone === 'bad' ? 'text-red-300' : tone === 'warn' ? 'text-amber-300' : tone === 'good' ? 'text-emerald-300' : 'text-white';
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
      <div className={`text-[22px] font-semibold tabular-nums leading-none ${toneCls}`}>{value}</div>
      <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">{label}</div>
      {hint && <div className="mt-0.5 text-[11px] text-white/45">{hint}</div>}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                                COMMAND BAR                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function CommandBar({ onCreated, presenceState }: { onCreated: () => void; presenceState: BudOsStateLabel }) {
  const [command, setCommand] = useState('');
  const [busy, setBusy] = useState(false);
  const [budReply, setBudReply] = useState<BudCommandResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit(value = command) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setBusy(true);
    setBudReply(null);
    try {
      const res = await fetch('/api/bud/command', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ command: trimmed }),
      });
      const body = (await res.json().catch(() => ({}))) as BudCommandResponse & { error?: string };
      if (!res.ok) throw new Error(body?.error ?? 'Bud could not accept the command');
      setCommand('');
      setBudReply(body);
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bud command failed');
    } finally {
      setBusy(false);
    }
  }

  const presence = STATE_PRESENCE[presenceState];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5">
      <div className="pointer-events-none absolute -top-20 left-1/2 h-40 w-[120%] -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="relative flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${presence.dot} ${presence.halo}`}>
            <span className={`absolute inset-0 animate-ping rounded-full ${presence.dot} opacity-60`} />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">Bud {presenceState}</span>
        </div>
        <div className="ml-auto text-[11px] text-white/40">{busy ? 'thinking…' : 'ready'}</div>
      </div>
      <div className="relative mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <label htmlFor="bud-command" className="sr-only">
            Ask Bud
          </label>
          <input
            ref={inputRef}
            id="bud-command"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submit();
            }}
            placeholder="Ask Bud to investigate, fix, redesign, simplify, deploy…"
            className="h-12 w-full rounded-md border border-white/[0.08] bg-black/30 px-4 text-[15px] text-white outline-none transition placeholder:text-white/30 focus:border-sky-400/40 focus:bg-black/40"
          />
        </div>
        <button
          disabled={busy || !command.trim()}
          onClick={() => void submit()}
          className="h-12 rounded-md bg-white px-5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Bud is thinking…' : 'Ask Bud'}
        </button>
      </div>
      <div className="relative mt-4 flex gap-2 overflow-x-auto pb-1">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            disabled={busy}
            onClick={() => void submit(example)}
            className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-white/70 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
          >
            {example}
          </button>
        ))}
      </div>

      {(busy || budReply) && (
        <div className="relative mt-4 rounded-md border border-white/[0.06] bg-black/30 p-4">
          {busy && !budReply && (
            <div className="flex items-center gap-3 text-sm text-white/70">
              <span className={`h-2 w-2 animate-pulse rounded-full ${presence.dot}`} />
              Bud is analyzing your request
            </div>
          )}
          {budReply?.bud_response && (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${presence.dot} animate-pulse`} />
                <div>
                  <p className="text-sm font-semibold text-white">{budReply.bud_response.bud_state.replace(/_/g, ' ')}</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/75">{budReply.bud_response.message}</p>
                </div>
              </div>
              {budReply.bud_response.plan.length > 0 && (
                <ol className="space-y-1.5 pl-1">
                  {budReply.bud_response.plan.map((step, index) => (
                    <li key={`${step}-${index}`} className="flex gap-2 text-xs text-white/75">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-white">{index + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              )}
              <div className="flex items-center gap-2">
                {budReply.approval_id && <Pill tone="warn">Needs approval</Pill>}
                <span className="text-[11px] text-white/40">Task {budReply.task_id.slice(0, 8)}</span>
                <button onClick={() => setBudReply(null)} className="ml-auto text-[11px] text-white/40 hover:text-white/70">
                  Dismiss
                </button>
              </div>
            </div>
          )}
          {budReply && !budReply.bud_response && (
            <div className="flex items-center gap-3 text-sm text-white/70">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Bud queued the task.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                              PRESENCE PANEL                                */
/* ────────────────────────────────────────────────────────────────────────── */

function PresencePanel({
  presence,
  commandState,
  authority,
  thoughts,
}: {
  presence: Props['budOs']['state'];
  commandState: MissionControlHealth;
  authority: BudAuthority;
  thoughts: BudThought[];
}) {
  const tone = GLOBAL_STATUS_TONE[commandState.global_status];
  const presenceTone = STATE_PRESENCE[presence.label];
  return (
    <Card title="Bud presence">
      <div className="grid gap-4 px-5 py-4 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <span className={`relative inline-flex h-3 w-3 rounded-full ${presenceTone.dot} ${presenceTone.halo}`}>
              <span className={`absolute inset-0 animate-ping rounded-full ${presenceTone.dot} opacity-40`} />
            </span>
            <p className="text-xl font-semibold text-white">Bud is {presence.label.toLowerCase()}</p>
            <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ${tone.ring} ${tone.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
              {tone.label}
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/65">{presence.summary}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            <StatBlock label="Broken" value={commandState.counts.broken_agents + commandState.counts.needs_repair_agents} tone={commandState.counts.broken_agents > 0 ? 'bad' : 'neutral'} />
            <StatBlock label="Can fix" value={commandState.repair_sessions.length} tone={commandState.repair_sessions.length > 0 ? 'warn' : 'neutral'} />
            <StatBlock label="Needs approval" value={commandState.approvals.total_pending} tone={commandState.approvals.total_pending > 0 ? 'warn' : 'neutral'} />
            <StatBlock label="Learned" value={commandState.memory.recent_count} tone="good" />
          </div>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">Thought stream</p>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-white/40">live</span>
              {thoughts.length > 0 && (
                <CopyButton
                  label="Copy all"
                  text={thoughts.slice(0, 8).map((t) => `[${t.state} · ${rel(t.at)}] ${t.narrative}`).join('\n')}
                />
              )}
            </div>
          </div>
          <ul className="mt-2 max-h-[170px] space-y-2 overflow-auto pr-1">
            {thoughts.slice(0, 8).map((thought) => (
              <li key={thought.id} className="group flex items-start gap-2 text-xs leading-snug text-white/75">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-sky-400" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2">{thought.narrative}</p>
                  <p className="text-[10px] text-white/35">{thought.state} · {rel(thought.at)}</p>
                </div>
                <CopyButton
                  text={`[${thought.state} · ${rel(thought.at)}] ${thought.narrative}`}
                  className="shrink-0 opacity-0 group-hover:opacity-100"
                />
              </li>
            ))}
            {thoughts.length === 0 && <p className="text-xs text-white/40">Bud is observing. No new thoughts.</p>}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/[0.05] px-5 py-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/55">
          <span className="font-semibold text-white/75">Authority</span>
          <Pill tone="cool">{authority.label}</Pill>
          <span>trust {Math.round(authority.trust_score * 100)}%</span>
          <span>·</span>
          <span>{authority.verified_repairs} verified repair{authority.verified_repairs === 1 ? '' : 's'}</span>
          {authority.rolled_back_repairs > 0 && (
            <>
              <span>·</span>
              <span className="text-amber-300">{authority.rolled_back_repairs} rollback{authority.rolled_back_repairs === 1 ? '' : 's'}</span>
            </>
          )}
          <Link href="/dashboard/mission-control?tab=settings" className="ml-auto text-white/55 hover:text-white">
            Adjust authority &rarr;
          </Link>
        </div>
      </div>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                             LIFECYCLE TRACKER                               */
/* ────────────────────────────────────────────────────────────────────────── */

type LifecycleStage = 'detected' | 'investigating' | 'has_plan' | 'needs_approval' | 'done';

function getItemStage(item: BudOsQueueItem, investigatingIds: Set<string>): LifecycleStage {
  if (item.group === 'completed_actions') return 'done';
  if (investigatingIds.has(item.id)) return 'investigating';
  if (item.group === 'needs_approval') {
    const r = item.approval?.readiness;
    if (r === 'ready') return 'needs_approval';
    if (r === 'awaiting_diagnosis') return 'investigating';
    return 'has_plan';
  }
  return 'detected';
}

const LIFECYCLE_STAGES: Array<{ key: LifecycleStage; label: string }> = [
  { key: 'detected', label: 'Detected' },
  { key: 'investigating', label: 'Investigating' },
  { key: 'has_plan', label: 'Plan ready' },
  { key: 'needs_approval', label: 'Needs approval' },
  { key: 'done', label: 'Done' },
];

const STAGE_ORDER: Record<LifecycleStage, number> = {
  detected: 0,
  investigating: 1,
  has_plan: 2,
  needs_approval: 3,
  done: 4,
};

function LifecycleBar({ stage }: { stage: LifecycleStage }) {
  const currentIdx = STAGE_ORDER[stage];
  return (
    <div className="mt-2.5 flex items-center gap-0.5">
      {LIFECYCLE_STAGES.map((s, idx) => {
        const active = idx === currentIdx;
        const past = idx < currentIdx;
        return (
          <React.Fragment key={s.key}>
            <div className={`flex items-center gap-1 ${active ? 'text-sky-300' : past ? 'text-emerald-400' : 'text-white/25'}`}>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bg-sky-400 animate-pulse' : past ? 'bg-emerald-400' : 'bg-white/15'}`} />
              <span className="text-[9px] font-semibold uppercase tracking-wide">{s.label}</span>
            </div>
            {idx < LIFECYCLE_STAGES.length - 1 && (
              <span className="mx-1 text-[9px] text-white/15">›</span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                                ACTION QUEUE                                */
/* ────────────────────────────────────────────────────────────────────────── */

const GROUP_LABEL: Record<BudOsQueueGroup, string> = {
  critical: 'Critical',
  needs_approval: 'Needs your approval',
  suggested_improvements: 'Bud recommends',
  watch_items: 'Bud is watching',
  completed_actions: 'Verified',
};
const GROUP_COPY: Record<BudOsQueueGroup, string> = {
  critical: 'Problems Bud thinks can damage operations.',
  needs_approval: 'Bud is ready, but needs your decision.',
  suggested_improvements: 'Useful improvements Bud can turn into work.',
  watch_items: 'Signals Bud is monitoring before they worsen.',
  completed_actions: 'Work Bud has finished or learned from.',
};

function ActionQueue({
  items,
  selectedId,
  onSelect,
  onDismiss,
  onApprove,
  onInvestigate,
  investigatingIds,
}: {
  items: BudOsQueueItem[];
  selectedId: string | null;
  onSelect: (item: BudOsQueueItem) => void;
  onDismiss: (item: BudOsQueueItem) => void;
  onApprove: (item: BudOsQueueItem) => void;
  onInvestigate: (item: BudOsQueueItem) => void;
  investigatingIds: Set<string>;
}) {
  const groups = useMemo(
    () =>
      (Object.keys(GROUP_LABEL) as BudOsQueueGroup[]).map((group) => ({
        group,
        items: items.filter((item) => item.group === group),
      })),
    [items],
  );

  return (
    <Card title="Action queue" subtitle="One intelligent feed. No scattered logs.">
      <div className="divide-y divide-white/[0.05]">
        {groups.map(({ group, items: groupItems }) => (
          <div key={group} className="px-4 py-3">
            <div className="mb-2 flex items-center gap-2 px-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">{GROUP_LABEL[group]}</p>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-white/60">{groupItems.length}</span>
            </div>
            <p className="mb-2 px-1 text-[11px] text-white/40">{GROUP_COPY[group]}</p>
            <div className="space-y-2">
              {groupItems.length === 0 ? (
                <div className="rounded-md border border-dashed border-white/10 px-3 py-3 text-xs text-white/35">Nothing here right now.</div>
              ) : (
                groupItems.slice(0, 6).map((item) => {
                  const stage = getItemStage(item, investigatingIds);
                  const isInvestigating = investigatingIds.has(item.id);
                  const ready = !item.approval || item.approval.readiness === 'ready';
                  const showLifecycle = ['critical', 'needs_approval', 'watch_items'].includes(item.group);
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelect(item)}
                      className={`block w-full rounded-md border px-3 py-3 text-left transition ${
                        selectedId === item.id
                          ? 'border-sky-400/40 bg-sky-500/[0.08]'
                          : 'border-white/[0.06] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className={`mt-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${SEVERITY_TONE[item.severity]}`}>
                          {item.severity}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold leading-tight text-white">{item.title}</p>
                          <p className="mt-1 text-xs leading-relaxed text-white/55">{clamp(item.detail, 130)}</p>
                          <p className="mt-1 text-[10px] text-white/35">
                            {item.agent_name ?? 'Bud'} · {rel(item.created_at)}
                          </p>
                        </div>
                      </div>

                      {showLifecycle && <LifecycleBar stage={stage} />}

                      {isInvestigating ? (
                        <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-sky-300">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
                          Bud is investigating — results will appear below when ready
                        </div>
                      ) : (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {item.actions.includes('investigate') && (
                            <span
                              onClick={(event) => {
                                event.stopPropagation();
                                onInvestigate(item);
                              }}
                              className="rounded-md border border-sky-400/30 bg-sky-500/[0.08] px-2 py-1 text-[10px] font-medium text-sky-200 hover:bg-sky-500/[0.16]"
                            >
                              Investigate
                            </span>
                          )}
                          {item.actions.includes('fix_with_bud') && (
                            <span
                              onClick={(event) => {
                                event.stopPropagation();
                                onInvestigate(item);
                              }}
                              className="rounded-md border border-orange-400/30 bg-orange-500/[0.08] px-2 py-1 text-[10px] font-medium text-orange-200 hover:bg-orange-500/[0.16]"
                            >
                              Fix with Bud
                            </span>
                          )}
                          {item.actions.includes('approve') && ready && (
                            <span
                              onClick={(event) => {
                                event.stopPropagation();
                                onApprove(item);
                              }}
                              className="rounded-md border border-emerald-400/30 bg-emerald-500/[0.08] px-2 py-1 text-[10px] font-medium text-emerald-200 hover:bg-emerald-500/[0.16]"
                            >
                              Approve
                            </span>
                          )}
                          {item.actions.includes('approve') && !ready && (
                            <span
                              title={item.approval?.readiness_summary}
                              className="rounded-md border border-white/[0.06] bg-white/[0.04] px-2 py-1 text-[10px] font-medium text-white/35 cursor-not-allowed"
                            >
                              Building plan…
                            </span>
                          )}
                          {item.actions.includes('dismiss') && (
                            <span
                              onClick={(event) => {
                                event.stopPropagation();
                                onDismiss(item);
                              }}
                              className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-medium text-white/55 hover:bg-white/[0.06]"
                            >
                              Dismiss
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                                REPAIR STUDIO                               */
/* ────────────────────────────────────────────────────────────────────────── */

function StatusTile({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  const cls =
    tone === 'good'
      ? 'border-emerald-400/30 bg-emerald-500/[0.06] text-emerald-300'
      : tone === 'warn'
        ? 'border-amber-400/30 bg-amber-500/[0.06] text-amber-300'
        : tone === 'bad'
          ? 'border-red-400/40 bg-red-500/[0.08] text-red-300'
          : 'border-white/[0.06] bg-white/[0.02] text-white/80';
  return (
    <div className={`rounded-md border px-3 py-2 ${cls}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">{label}</p>
      <p className="mt-1 line-clamp-2 text-xs font-semibold">{value}</p>
    </div>
  );
}

function RepairStudio({ workspace, onExecute }: { workspace: BudOsRepairWorkspace; onExecute: (taskId: string) => void }) {
  return (
    <Card
      title="Repair studio"
      subtitle="Issue → diagnose → plan → patch → approve → deploy → verify → learn"
      action={
        workspace.task_id ? (
          <button
            onClick={() => onExecute(workspace.task_id!)}
            className="rounded-md bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            Run gated repair
          </button>
        ) : null
      }
    >
      <div className="grid gap-4 px-5 py-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">Problem summary</p>
            <p className="mt-1 text-sm leading-relaxed text-white/85">{workspace.problem_summary}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">Diagnosis</p>
            <p className="mt-1 text-sm leading-relaxed text-white/85">{workspace.diagnosis}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">Proposed plan</p>
            <ol className="mt-2 space-y-1.5">
              {workspace.proposed_plan.map((step, index) => (
                <li key={`${step}-${index}`} className="flex gap-2 text-sm text-white/80">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-[10px] font-semibold text-white/70">{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <StatusTile label="Approval" value={workspace.approval_status} tone={workspace.approval_status.includes('Needs') ? 'warn' : 'neutral'} />
            <StatusTile label="Deployment" value={workspace.deployment_status} />
            <StatusTile label="Verification" value={workspace.verification_status.replaceAll('_', ' ')} tone={workspace.verification_status === 'verified' ? 'good' : 'neutral'} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">Code/config diff</p>
            <p className="mt-1 rounded-md border border-white/[0.06] bg-black/30 px-3 py-3 font-mono text-xs leading-relaxed text-white/65">{workspace.diff_summary}</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-md border border-white/[0.06] bg-black/15">
            <div className="border-b border-white/[0.06] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white/55">Repair steps</div>
            <div className="max-h-[240px] overflow-auto">
              {workspace.steps.length === 0 ? (
                <p className="px-3 py-3 text-xs text-white/40">Bud has not recorded repair steps for this item yet.</p>
              ) : (
                workspace.steps.map((step) => (
                  <div key={step.id} className="border-b border-white/[0.04] px-3 py-2 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white/85">{step.state.replaceAll('_', ' ')}</span>
                      <span className="ml-auto text-[10px] uppercase tracking-wider text-white/40">{step.status}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-white/55">{step.summary}</p>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="rounded-md border border-white/[0.06] bg-black/15">
            <div className="border-b border-white/[0.06] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white/55">Bud explains what it is doing</div>
            <div className="max-h-[260px] overflow-auto">
              {workspace.logs.map((log) => (
                <div key={log.id} className="border-b border-white/[0.04] px-3 py-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{log.level}</span>
                    <span className="ml-auto text-[10px] text-white/35">{rel(log.created_at)}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-white/65">{log.message}</p>
                </div>
              ))}
              {workspace.logs.length === 0 && <p className="px-3 py-3 text-xs text-white/40">Bud has nothing to say about this repair yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                             APPROVAL INSPECTOR                             */
/* ────────────────────────────────────────────────────────────────────────── */

const READINESS_LABEL: Record<BudOsApprovalDetail['readiness'], string> = {
  ready: 'Ready to approve',
  awaiting_plan: 'Waiting on plan',
  awaiting_patch: 'Waiting on patch',
  awaiting_diff: 'Waiting on diff',
  awaiting_repair: 'Waiting on repair',
  awaiting_diagnosis: 'Diagnosing',
  blocked: 'Blocked',
};

const READINESS_TONE: Record<BudOsApprovalDetail['readiness'], 'good' | 'warn' | 'bad' | 'cool' | 'neutral'> = {
  ready: 'good',
  awaiting_plan: 'warn',
  awaiting_patch: 'warn',
  awaiting_diff: 'warn',
  awaiting_repair: 'warn',
  awaiting_diagnosis: 'cool',
  blocked: 'bad',
};

function formatPayload(payload: Record<string, unknown> | null | undefined): string {
  if (!payload || Object.keys(payload).length === 0) return '{ }';
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

function ApprovalInspector({
  item,
  onApprove,
  onReject,
  onInvestigate,
}: {
  item: BudOsQueueItem | null;
  onApprove: (item: BudOsQueueItem, notes: string) => Promise<void>;
  onReject: (item: BudOsQueueItem, reason: string) => Promise<void>;
  onInvestigate: (item: BudOsQueueItem) => void;
}) {
  const [notes, setNotes] = useState('');
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState<null | 'approve' | 'reject'>(null);

  // Reset note state when selection changes.
  useEffect(() => {
    setNotes('');
    setRejectMode(false);
    setRejectReason('');
  }, [item?.id]);

  if (!item || !item.approval) {
    return (
      <Card title="Approval inspector" subtitle="Select an item from the Needs your approval list to see what Bud wants to do.">
        <div className="px-5 py-10 text-center text-sm text-white/45">
          Nothing selected. Click a card on the left.
        </div>
      </Card>
    );
  }

  const approval = item.approval;
  const isReady = approval.readiness === 'ready';
  const dangerLabel = approval.action_type ? approval.action_type.toUpperCase() : 'ACTION';
  const sevTone: 'good' | 'warn' | 'bad' | 'cool' =
    approval.risk_level === 'critical' ? 'bad' : approval.risk_level === 'high' ? 'warn' : approval.risk_level === 'low' ? 'good' : 'cool';

  const handleApprove = async () => {
    setBusy('approve');
    try {
      await onApprove(item, notes.trim());
    } finally {
      setBusy(null);
    }
  };
  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please give a reason so Bud can learn.');
      return;
    }
    setBusy('reject');
    try {
      await onReject(item, rejectReason.trim());
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card
      title="Approval inspector"
      subtitle={`${dangerLabel} · requested ${rel(approval.requested_at)} · ${approval.source_agent ?? 'Bud'}`}
      action={
        <Pill tone={READINESS_TONE[approval.readiness]}>{READINESS_LABEL[approval.readiness]}</Pill>
      }
    >
      <div className="px-5 py-4 space-y-4">
        {/* Top summary row */}
        <div className="rounded-lg border border-white/[0.06] bg-black/20 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={sevTone}>{approval.risk_level ?? 'unknown'} risk</Pill>
            {approval.confidence !== null && <Pill tone="cool">conf {Math.round((approval.confidence ?? 0) * 100)}%</Pill>}
            <span className="text-[10px] uppercase tracking-wider text-white/40">action: <span className="font-mono text-white/70">{approval.action_type}</span></span>
            {approval.target_table && (
              <span className="text-[10px] uppercase tracking-wider text-white/40">
                target: <span className="font-mono text-white/70">{approval.target_table}{approval.target_id ? `#${approval.target_id.slice(0, 8)}` : ''}</span>
              </span>
            )}
          </div>
          <p className="mt-3 text-base font-semibold leading-tight text-white">{item.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-white/75">{approval.full_description}</p>
          {approval.readiness !== 'ready' && (
            <div className="mt-3 rounded-md border border-amber-400/30 bg-amber-500/[0.08] px-3 py-2 text-xs text-amber-200">
              {approval.readiness_summary}
            </div>
          )}
        </div>

        {/* What Bud will do */}
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-md border border-white/[0.06] bg-white/[0.015] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">What Bud will do</p>
            {approval.proposed_plan.length === 0 ? (
              <p className="mt-2 text-xs text-white/45">No plan provided. Bud may execute this as a single step.</p>
            ) : (
              <ol className="mt-2 space-y-1.5">
                {approval.proposed_plan.map((step, index) => (
                  <li key={`${step}-${index}`} className="flex gap-2 text-xs text-white/80">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-[10px] font-semibold text-white/70">{index + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="rounded-md border border-white/[0.06] bg-white/[0.015] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">Affected surfaces</p>
            {approval.affected_files.length === 0 ? (
              <p className="mt-2 text-xs text-white/45">Bud could not infer affected files. Check the payload.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {approval.affected_files.map((file) => (
                  <span key={file} className="rounded border border-white/10 bg-black/25 px-1.5 py-0.5 font-mono text-[10px] text-white/70">{file}</span>
                ))}
              </div>
            )}
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-white/45">Blast radius</p>
            <p className="mt-1 text-xs leading-relaxed text-white/75">{approval.blast_radius}</p>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-white/45">Rollback</p>
            <p className="mt-1 text-xs leading-relaxed text-white/75">{approval.rollback_story}</p>
          </div>
        </div>

        {/* Diff / Payload */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
            {approval.diff_summary ? 'Proposed diff' : 'Payload'}
          </p>
          <pre className="mt-1 max-h-[260px] overflow-auto rounded-md border border-white/[0.06] bg-black/40 px-3 py-3 font-mono text-[11px] leading-relaxed text-white/75">
{approval.diff_summary ?? formatPayload(approval.payload)}
          </pre>
        </div>

        {/* Linked artifacts */}
        {(approval.linked_pr || approval.linked_deployment || approval.linked_issue || approval.linked_memory_note) && (
          <div className="flex flex-wrap items-center gap-2">
            {approval.linked_issue && (
              <a href={approval.linked_issue} target="_blank" rel="noreferrer" className="rounded border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-sky-300 hover:text-sky-200">
                Issue ↗
              </a>
            )}
            {approval.linked_pr && (
              <a href={approval.linked_pr} target="_blank" rel="noreferrer" className="rounded border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-sky-300 hover:text-sky-200">
                Pull request ↗
              </a>
            )}
            {approval.linked_deployment && (
              <a href={approval.linked_deployment} target="_blank" rel="noreferrer" className="rounded border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-sky-300 hover:text-sky-200">
                Deployment ↗
              </a>
            )}
            {approval.linked_memory_note && (
              <span className="rounded border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-white/55">memory: {approval.linked_memory_note}</span>
            )}
          </div>
        )}

        {/* Decision area */}
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
          {!rejectMode ? (
            <>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-white/55">Approval note (optional)</label>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                placeholder="Approved because… (this is logged with the decision)"
                className="mt-1 block w-full resize-none rounded-md border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-sky-400/40"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  disabled={!isReady || busy !== null}
                  onClick={() => void handleApprove()}
                  className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                    isReady && busy === null
                      ? 'bg-emerald-400 text-emerald-950 hover:bg-emerald-300'
                      : 'bg-white/[0.08] text-white/40 cursor-not-allowed'
                  }`}
                  title={isReady ? 'Approve and execute' : approval.readiness_summary}
                >
                  {busy === 'approve' ? 'Approving…' : isReady ? 'Approve' : 'Not ready yet'}
                </button>
                <button
                  disabled={busy !== null}
                  onClick={() => setRejectMode(true)}
                  className="rounded-md border border-red-400/30 bg-red-500/[0.08] px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/[0.15]"
                >
                  Reject
                </button>
                <button
                  disabled={busy !== null}
                  onClick={() => onInvestigate(item)}
                  className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-white/75 hover:bg-white/[0.08]"
                >
                  Ask Bud to investigate first
                </button>
                {!isReady && (
                  <span className="text-[11px] text-amber-300">
                    Bud will let you approve once readiness = ready.
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-white/55">Reason for rejection (required)</label>
              <textarea
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                rows={2}
                placeholder="Tell Bud what to do differently next time…"
                className="mt-1 block w-full resize-none rounded-md border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-red-400/40"
              />
              <div className="mt-3 flex items-center gap-2">
                <button
                  disabled={busy !== null || !rejectReason.trim()}
                  onClick={() => void handleReject()}
                  className="rounded-md bg-red-400 px-4 py-2 text-sm font-semibold text-red-950 hover:bg-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy === 'reject' ? 'Rejecting…' : 'Confirm reject'}
                </button>
                <button
                  disabled={busy !== null}
                  onClick={() => {
                    setRejectMode(false);
                    setRejectReason('');
                  }}
                  className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-white/75 hover:bg-white/[0.08]"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                              WORKFORCE SECTION                             */
/* ────────────────────────────────────────────────────────────────────────── */

function Workforce({ clusters, commandState }: { clusters: BudOsWorkforceCluster[]; commandState: MissionControlHealth }) {
  const agentLookup = new Map(commandState.agents.map((a) => [a.id, a]));
  return (
    <div className="space-y-4">
      <Card title="Agent workforce" subtitle="Grouped by domain. Each agent shows role, task, health, and whether Bud can delegate.">
        <div className="grid gap-3 px-5 py-4 md:grid-cols-2 xl:grid-cols-3">
          {clusters.map((cluster) => {
            const total = cluster.agents.length;
            const healthy = cluster.agents.filter((a) => a.health === 'healthy').length;
            return (
              <div key={cluster.name} className="rounded-lg border border-white/[0.06] bg-white/[0.015]">
                <div className="flex items-center justify-between border-b border-white/[0.05] px-3 py-2">
                  <p className="text-sm font-semibold text-white">{cluster.name}</p>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                    {healthy}/{total} healthy
                  </span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {cluster.agents.slice(0, 5).map((agent) => {
                    const full = agentLookup.get(agent.id);
                    const score = full?.health.score ?? 0;
                    const scoreTone = score >= 80 ? 'good' : score >= 60 ? 'warn' : 'bad';
                    return (
                      <Link key={agent.id} href={`/dashboard/agents/${agent.id}`} className="block px-3 py-3 transition hover:bg-white/[0.03]">
                        <div className="flex items-center gap-2">
                          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{agent.name}</p>
                          <Pill tone={agent.can_delegate ? 'good' : 'bad'}>{agent.can_delegate ? 'delegable' : 'blocked'}</Pill>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-white/55">
                          <Pill tone={scoreTone}>{agent.health}</Pill>
                          <span>{agent.role}</span>
                          <span>·</span>
                          <span>{score} pts</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/55">{agent.current_task}</p>
                        <p className="mt-1 line-clamp-1 text-[11px] text-white/40">last: {agent.last_useful_output}</p>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <Card title="Multi-agent collaboration" subtitle="What Bud has delegated and where consensus lives.">
        <div className="grid gap-3 px-5 py-4 md:grid-cols-2 xl:grid-cols-3">
          {commandState.repair_sessions.slice(0, 6).map((session) => (
            <div key={session.id} className="rounded-md border border-white/[0.06] bg-white/[0.015] p-3">
              <div className="flex items-center gap-2">
                <Pill tone={session.phase === 'awaiting_approval' ? 'warn' : session.phase === 'blocked' ? 'bad' : 'cool'}>{session.phase.replaceAll('_', ' ')}</Pill>
                <span className="text-xs font-semibold text-white">{session.agent_name}</span>
                <span className="ml-auto text-[10px] text-white/35">{rel(session.created_at)}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-white/65">{session.description}</p>
              {(session.linked_pr || session.linked_deployment || session.linked_memory_note) && (
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-wider text-white/55">
                  {session.linked_pr && <span>· PR linked</span>}
                  {session.linked_deployment && <span>· deploy linked</span>}
                  {session.linked_memory_note && <span>· learning saved</span>}
                </div>
              )}
            </div>
          ))}
          {commandState.repair_sessions.length === 0 && (
            <p className="text-sm text-white/40">No collaborations in flight. Bud is observing.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                                ACTIVITY TAB                                */
/* ────────────────────────────────────────────────────────────────────────── */

function ActivityTab({
  thoughts,
  failures,
  liveActivity,
}: {
  thoughts: BudThought[];
  failures: StructuredFailure[];
  liveActivity: BudActivityEvent[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <Card title="Persistent thought stream" subtitle="What Bud has been thinking about, by source.">
        <div className="max-h-[520px] divide-y divide-white/[0.04] overflow-auto px-3">
          {thoughts.map((thought) => (
            <div key={thought.id} className="py-3">
              <div className="flex items-center gap-2">
                <Pill tone="cool">{thought.state}</Pill>
                <span className="text-[10px] uppercase tracking-wider text-white/40">{thought.source}</span>
                <span className="ml-auto text-[10px] text-white/35">{rel(thought.at)}</span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-white/80">{thought.narrative}</p>
            </div>
          ))}
          {thoughts.length === 0 && <p className="py-6 text-center text-sm text-white/40">No thoughts captured.</p>}
        </div>
      </Card>
      <div className="space-y-4">
        <Card title="Structured failures" subtitle="No more 'unexpected error - no structured failure reason captured'.">
          <div className="max-h-[260px] divide-y divide-white/[0.04] overflow-auto px-3">
            {failures.length === 0 && <p className="py-6 text-center text-sm text-white/40">No failures detected.</p>}
            {failures.map((failure) => (
              <div key={failure.runId} className="py-3">
                <div className="flex items-center gap-2">
                  <Pill tone={failure.severity === 'critical' ? 'bad' : failure.severity === 'high' ? 'warn' : 'neutral'}>{failure.errorType}</Pill>
                  <span className="text-xs font-semibold text-white">{failure.agentName}</span>
                  <span className="ml-auto text-[10px] text-white/40">conf {Math.round(failure.confidenceScore * 100)}%</span>
                </div>
                <p className="mt-1 text-xs text-white/65">step <span className="font-mono text-white/80">{failure.failedStep}</span> · {failure.suspectedCause}</p>
                <p className="mt-1 text-[11px] text-white/45">fix: {failure.recommendedFix}</p>
                {failure.affectedFiles.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {failure.affectedFiles.map((file) => (
                      <span key={file} className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-white/60">{file}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
        <Card
          title="Live activity"
          subtitle="Streaming from bud_activity_feed."
          action={liveActivity.length > 0 ? (
            <CopyButton
              label="Copy all"
              text={liveActivity.map((e) => `[${e.event_type} · ${rel(e.created_at)}] ${e.narrative}`).join('\n')}
            />
          ) : undefined}
        >
          <div className="max-h-[240px] divide-y divide-white/[0.04] overflow-auto px-3">
            {liveActivity.length === 0 && <p className="py-6 text-center text-sm text-white/40">Quiet on the wire.</p>}
            {liveActivity.map((event) => (
              <div key={event.id} className="group flex items-start gap-2 py-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400" />
                <div className="flex-1">
                  <p className="text-xs text-white/80">{event.narrative}</p>
                  <p className="text-[10px] text-white/35">{event.event_type} · {rel(event.created_at)}</p>
                </div>
                <CopyButton
                  text={`[${event.event_type} · ${rel(event.created_at)}] ${event.narrative}`}
                  className="shrink-0 opacity-0 group-hover:opacity-100"
                />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                                 MEMORY TAB                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function MemoryTab({ memoryLayer, commandState }: { memoryLayer: BudOsMemoryLayer; commandState: MissionControlHealth }) {
  return (
    <div className="space-y-4">
      <Card title="Operational memory" subtitle="Past repairs, decisions, business rules. Bud references this naturally.">
        <div className="grid gap-3 px-5 py-4 md:grid-cols-2 xl:grid-cols-3">
          {memoryLayer.map((group) => (
            <div key={group.name} className="rounded-md border border-white/[0.06] bg-white/[0.015] p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">{group.name}</p>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45">{group.items.length}</span>
              </div>
              <div className="mt-2 space-y-2">
                {group.items.length === 0 ? (
                  <p className="text-xs text-white/35">Bud has not saved this kind of memory yet.</p>
                ) : (
                  group.items.map((item) => (
                    <div key={item.id} className="rounded-md border border-white/[0.04] bg-black/20 px-3 py-2">
                      <p className="line-clamp-1 text-xs font-semibold text-white/85">{item.title}</p>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-white/55">{item.detail}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Memory vault status">
        <div className="grid gap-3 px-5 py-4 md:grid-cols-4">
          <StatBlock label="Connected" value={commandState.memory.connected ? 'YES' : 'NO'} tone={commandState.memory.connected ? 'good' : 'bad'} />
          <StatBlock label="Records" value={commandState.memory.recent_count} />
          <StatBlock label="Last write" value={commandState.memory.last_write_at ? rel(commandState.memory.last_write_at) : '—'} />
          <StatBlock label="Learning ready" value={commandState.memory.learning_ready ? 'YES' : 'NO'} tone={commandState.memory.learning_ready ? 'good' : 'warn'} />
        </div>
      </Card>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                                EVOLUTION TAB                               */
/* ────────────────────────────────────────────────────────────────────────── */

function EvolutionTab({
  recommendations,
  initiatives,
  efficiencyFindings,
}: {
  recommendations: UxEvolutionRecommendation[];
  initiatives: BudInitiative[];
  efficiencyFindings: Props['budOs']['efficiencyFindings'];
}) {
  const DOMAIN_LABEL: Record<string, string> = {
    agent_fleet: 'Agent fleet',
    workflow_redundancy: 'Workflow redundancy',
    automation_gap: 'Automation gap',
    operational_throughput: 'Throughput',
  };

  return (
    <div className="space-y-4">
      <Card title="Initiative engine" subtitle="Proactive missions Bud has created from repeating signals.">
        <div className="grid gap-3 px-5 py-4 md:grid-cols-2 xl:grid-cols-3">
          {initiatives.length === 0 && <p className="text-sm text-white/40">No initiatives. Workforce is calm.</p>}
          {initiatives.map((initiative) => (
            <div key={initiative.id} className="rounded-md border border-white/[0.06] bg-white/[0.015] p-3">
              <div className="flex items-center gap-2">
                <Pill tone={initiative.severity === 'critical' ? 'bad' : initiative.severity === 'high' ? 'warn' : 'cool'}>{initiative.severity}</Pill>
                <span className="text-[10px] uppercase tracking-wider text-white/40">{initiative.category}</span>
                <span className="ml-auto text-[10px] uppercase tracking-wider text-white/40">conf {Math.round(initiative.confidence * 100)}%</span>
              </div>
              <p className="mt-2 text-sm font-semibold leading-tight text-white">{initiative.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/60">{initiative.why}</p>
              <p className="mt-2 text-[11px] text-white/45">impact: <span className="text-white/70">{initiative.expected_impact}</span></p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {initiative.assigned_agents.map((a) => (
                  <span key={a} className="rounded border border-white/10 bg-black/20 px-1.5 py-0.5 text-[10px] text-white/65">{a}</span>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/45">
                <Pill tone={initiative.status === 'in_progress' ? 'cool' : initiative.status === 'blocked' ? 'bad' : 'neutral'}>{initiative.status.replaceAll('_', ' ')}</Pill>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Self-redesign proposals" subtitle="Bud detects friction, clutter, weak hierarchy, and proposes redesigns.">
        <div className="grid gap-3 px-5 py-4 lg:grid-cols-3">
          <div className="rounded-lg border border-white/[0.06] bg-gradient-to-br from-sky-500/[0.08] to-violet-500/[0.06] p-4 lg:col-span-1">
            <p className="text-sm font-semibold text-white">Bud can redesign Buds OS itself.</p>
            <p className="mt-2 text-xs leading-relaxed text-white/70">
              It surfaces proposals here. Approve to test or deploy. Bud never silently rewrites itself.
            </p>
          </div>
          <div className="space-y-2 lg:col-span-2">
            {recommendations.length === 0 ? (
              <div className="rounded-md border border-dashed border-white/10 px-3 py-6 text-center text-sm text-white/40">No self-improvement recommendations.</div>
            ) : (
              recommendations.slice(0, 8).map((rec) => (
                <div key={rec.id} className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${SEVERITY_TONE[rec.severity]}`}>{rec.severity}</span>
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{rec.title}</p>
                    <span className="text-[10px] text-white/40">{rel(rec.created_at)}</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-white/65">{rec.summary}</p>
                  <p className="mt-2 text-[11px] text-white/45">{rec.affected_area} · {rec.can_queue_approval ? 'ready for approval queue' : 'reference only'}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>

      <Card
        title="Efficiency Architect"
        subtitle="Fleet-wide operational efficiency: cost-per-outcome, redundant agents, automation ROI, throughput bottlenecks."
      >
        {efficiencyFindings.length === 0 ? (
          <div className="px-5 py-6 text-sm text-white/40">
            No efficiency findings yet. Efficiency Architect runs weekly (Sunday 6 am).
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {efficiencyFindings.slice(0, 8).map((f) => {
              const sev = f.severity as 'low' | 'medium' | 'high' | 'critical';
              return (
                <div key={f.id} className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${SEVERITY_TONE[sev]}`}>{f.priority}</span>
                    <span className="rounded border border-white/10 bg-black/20 px-1.5 py-0.5 text-[10px] text-white/55">
                      {DOMAIN_LABEL[f.domain] ?? f.domain}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{f.title}</p>
                    <span className="text-[10px] text-white/35">{rel(f.created_at)}</span>
                  </div>
                  {f.body && (
                    <p className="mt-1.5 text-xs leading-relaxed text-white/60 line-clamp-2">{f.body}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-white/45">
                    {f.proposed_fix && (
                      <span>fix: <span className="text-white/65">{f.proposed_fix}</span></span>
                    )}
                    {f.estimated_saving && (
                      <span className="text-emerald-400/80">saves: {f.estimated_saving}</span>
                    )}
                    {f.automation_candidate && (
                      <Pill tone="cool">automation candidate</Pill>
                    )}
                  </div>
                  {f.affected_agents.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {f.affected_agents.slice(0, 4).map((a) => (
                        <span key={a} className="rounded border border-white/[0.06] bg-black/20 px-1.5 py-0.5 font-mono text-[10px] text-white/50">{a}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                              DEPLOYMENTS TAB                               */
/* ────────────────────────────────────────────────────────────────────────── */

function DeploymentsTab({ commandState, autonomy, circuit, resilienceEvents }: {
  commandState: MissionControlHealth;
  autonomy: BudOsAutonomyCapability[];
  circuit: { state: 'closed' | 'open' | 'half_open'; resetsAt: string | null; failureStreak: number; label: string };
  resilienceEvents: Props['budOs']['resilienceEvents'];
}) {
  const dep = commandState.deployment;
  const tone = dep.status === 'healthy' ? 'good' : dep.status === 'failed' ? 'bad' : dep.status === 'deploying' ? 'warn' : 'neutral';
  const circuitTone = circuit.state === 'closed' ? 'good' : circuit.state === 'open' ? 'bad' : 'warn';
  const circuitDot = circuit.state === 'closed' ? 'bg-emerald-400' : circuit.state === 'open' ? 'bg-red-400 animate-pulse' : 'bg-yellow-400 animate-pulse';

  // Resilience event stats
  const zombieEvents = resilienceEvents.filter((e) => e.guard === 'zombie_reaper');
  const concurrencyEvents = resilienceEvents.filter((e) => e.guard === 'concurrency_guard');
  const circuitEvents = resilienceEvents.filter((e) => e.guard === 'circuit_breaker');
  const totalZombieReaped = zombieEvents.reduce(
    (sum, e) => sum + ((e.payload.reaped_count as number) ?? 0), 0,
  );
  const lastZombieAt = zombieEvents[0]?.created_at ?? null;
  const lastConcurrencyAt = concurrencyEvents[0]?.created_at ?? null;
  const lastCircuitTripAt = circuitEvents[0]?.created_at ?? null;

  return (
    <div className="space-y-4">

      {/* ── Resilience Engine — all three guards in one panel ───────────────── */}
      <Card
        title="Resilience Engine"
        subtitle="Three adaptive guards protect every agent run fleet-wide. They fire automatically — no configuration needed."
      >
        <div className="grid gap-px bg-white/[0.04] md:grid-cols-3">

          {/* Circuit Breaker */}
          <div className="bg-[#0a0f1a] px-5 py-4">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 flex-shrink-0 rounded-full ${circuitDot}`} />
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Circuit Breaker</p>
            </div>
            <p className="mt-2 text-sm font-semibold text-white">{circuit.label}</p>
            {circuit.state === 'open' && circuit.resetsAt && (
              <p className="mt-1 text-xs text-amber-300">Probing resumes {rel(circuit.resetsAt)}</p>
            )}
            {circuit.state === 'half_open' && (
              <p className="mt-1 text-xs text-yellow-300">Probing — 2 successes to close</p>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <StatBlock label="State" value={circuit.state.replace('_', ' ').toUpperCase()} tone={circuitTone} />
              <StatBlock
                label="Streak"
                value={String(circuit.failureStreak)}
                tone={circuit.failureStreak >= 3 ? 'bad' : circuit.failureStreak > 0 ? 'warn' : 'good'}
              />
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-white/45">
              Opens after 5 consecutive fleet-wide failures. All LLM calls pause for 5 min. Auto-recovers.
            </p>
            {lastCircuitTripAt && (
              <p className="mt-2 text-[10px] text-white/35">Last trip: {rel(lastCircuitTripAt)}</p>
            )}
          </div>

          {/* Zombie Reaper */}
          <div className="bg-[#0a0f1a] px-5 py-4">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 flex-shrink-0 rounded-full ${totalZombieReaped > 0 ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Zombie Reaper</p>
            </div>
            <p className="mt-2 text-sm font-semibold text-white">
              {totalZombieReaped > 0
                ? `${totalZombieReaped} zombie run${totalZombieReaped === 1 ? '' : 's'} cleared`
                : 'No stuck runs detected'}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <StatBlock label="Events" value={String(zombieEvents.length)} tone="neutral" />
              <StatBlock label="Reaped" value={String(totalZombieReaped)} tone={totalZombieReaped > 0 ? 'warn' : 'good'} />
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-white/45">
              Finds runs stuck in 'running' past 20 min and marks them failed. Keeps health scores accurate.
            </p>
            {lastZombieAt && (
              <p className="mt-2 text-[10px] text-white/35">Last reap: {rel(lastZombieAt)}</p>
            )}
          </div>

          {/* Concurrency Guard */}
          <div className="bg-[#0a0f1a] px-5 py-4">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 flex-shrink-0 rounded-full ${concurrencyEvents.length > 0 ? 'bg-sky-400' : 'bg-emerald-400'}`} />
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Concurrency Guard</p>
            </div>
            <p className="mt-2 text-sm font-semibold text-white">
              {concurrencyEvents.length > 0
                ? `${concurrencyEvents.length} duplicate run${concurrencyEvents.length === 1 ? '' : 's'} blocked`
                : 'No duplicate runs detected'}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <StatBlock label="Blocks" value={String(concurrencyEvents.length)} tone={concurrencyEvents.length > 0 ? 'warn' : 'good'} />
              <StatBlock label="Agents affected" value={String(new Set(concurrencyEvents.map((e) => e.payload.agent_id as string)).size)} tone="neutral" />
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-white/45">
              Prevents the same agent running twice concurrently. Stops burst pile-ups when cron fires during a slow run.
            </p>
            {lastConcurrencyAt && (
              <p className="mt-2 text-[10px] text-white/35">Last block: {rel(lastConcurrencyAt)}</p>
            )}
          </div>
        </div>

        {/* Recent resilience events log */}
        {resilienceEvents.length > 0 && (
          <div className="border-t border-white/[0.05] px-5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45 mb-2">Recent events</p>
            <div className="max-h-[140px] space-y-1 overflow-auto">
              {resilienceEvents.slice(0, 12).map((event) => {
                const guardLabel = event.guard === 'circuit_breaker' ? 'Circuit' : event.guard === 'zombie_reaper' ? 'Reaper' : 'Concurrency';
                const guardTone = event.guard === 'circuit_breaker' ? 'text-red-300' : event.guard === 'zombie_reaper' ? 'text-amber-300' : 'text-sky-300';
                return (
                  <div key={event.id} className="flex items-center gap-2 text-[11px]">
                    <span className={`shrink-0 font-semibold ${guardTone}`}>{guardLabel}</span>
                    <span className="text-white/55">{event.event_type.replaceAll('_', ' ')}</span>
                    {event.guard === 'zombie_reaper' && (event.payload.reaped_count as number) > 0 && (
                      <span className="text-amber-300/80">{event.payload.reaped_count as number} reaped</span>
                    )}
                    {event.guard === 'concurrency_guard' && (
                      <span className="truncate text-sky-300/70 font-mono text-[10px]">{event.payload.agent_id as string}</span>
                    )}
                    <span className="ml-auto text-white/30">{rel(event.created_at)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      <Card title="Deployment + verification" subtitle="Repairs are not successful until deployment + verification confirm.">
        <div className="grid gap-3 px-5 py-4 md:grid-cols-4">
          <StatBlock label="Status" value={dep.status.toUpperCase()} tone={tone} />
          <StatBlock label="Last event" value={dep.last_event_at ? rel(dep.last_event_at) : '—'} />
          <StatBlock label="Last success" value={dep.last_success_at ? rel(dep.last_success_at) : '—'} />
          <StatBlock label="Last failure" value={dep.last_failure_at ? rel(dep.last_failure_at) : '—'} tone={dep.last_failure_at ? 'warn' : 'neutral'} />
        </div>
        <div className="border-t border-white/[0.05] px-5 py-3 text-xs text-white/70">
          {dep.summary}
          {dep.last_url && (
            <a href={dep.last_url} target="_blank" rel="noreferrer" className="ml-2 text-sky-300 hover:text-sky-200">
              latest deployment &rarr;
            </a>
          )}
        </div>
      </Card>
      <Card title="Repair lifecycle" subtitle="Detected → reading logs → diagnosing → planning → drafting patch → awaiting approval → applying → committing → deploying → verifying → fixed.">
        <div className="space-y-2 px-5 py-4">
          {commandState.repair_sessions.length === 0 && <p className="text-sm text-white/40">No active repairs.</p>}
          {commandState.repair_sessions.map((session) => (
            <div key={session.id} className="rounded-md border border-white/[0.06] bg-white/[0.015] px-3 py-2">
              <div className="flex items-center gap-2">
                <Pill tone={session.phase === 'blocked' ? 'bad' : session.phase === 'awaiting_approval' ? 'warn' : 'cool'}>{session.phase.replaceAll('_', ' ')}</Pill>
                <span className="text-xs font-semibold text-white">{session.agent_name}</span>
                <span className="ml-auto text-[10px] text-white/35">{rel(session.created_at)}</span>
              </div>
              <p className="mt-1 text-xs text-white/65">{session.description}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] uppercase tracking-wider text-white/50">
                <Pill tone="neutral">risk {session.risk_level}</Pill>
                {session.confidence !== null && <Pill tone="cool">conf {Math.round((session.confidence ?? 0) * 100)}%</Pill>}
                {session.linked_pr && (
                  <a href={session.linked_pr} target="_blank" rel="noreferrer" className="text-sky-300 hover:text-sky-200">
                    PR &rarr;
                  </a>
                )}
                {session.linked_deployment && (
                  <a href={session.linked_deployment} target="_blank" rel="noreferrer" className="text-sky-300 hover:text-sky-200">
                    deploy &rarr;
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Autonomy meter" subtitle="Operational readiness across the repair lifecycle.">
        <div className="grid gap-2 px-5 py-4 md:grid-cols-2 xl:grid-cols-7">
          {autonomy.map((capability) => (
            <div key={capability.key} className={`rounded-md border px-3 py-3 ${CAPABILITY_TONE[capability.status]}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{capability.label}</p>
                <span className="text-[10px] font-semibold uppercase">{capability.status}</span>
              </div>
              <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed opacity-80">{capability.detail}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                                SETTINGS TAB                                */
/* ────────────────────────────────────────────────────────────────────────── */

function SettingsTab({
  authority,
  capabilities,
  onAuthorityChange,
  savingLevel,
}: {
  authority: BudAuthority;
  capabilities: BudCapability[];
  onAuthorityChange: (level: BudAuthorityLevel) => Promise<void>;
  savingLevel: BudAuthorityLevel | null;
}) {
  const levels: BudAuthorityLevel[] = ['L0_OBSERVER', 'L1_ASSISTANT', 'L2_OPERATOR', 'L3_AUTONOMOUS_OPERATOR', 'L4_SELF_EVOLVING_SYSTEM'];
  return (
    <div className="space-y-4">
      <Card title="Bud authority" subtitle="Authority scales with verified outcomes. Configure the ceiling.">
        <div className="grid gap-3 px-5 py-4 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <div className="flex items-center gap-2">
              <Pill tone="cool">{authority.label}</Pill>
              <span className="text-[10px] uppercase tracking-wider text-white/40">trust {Math.round(authority.trust_score * 100)}%</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-white/70">{authority.description}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded border border-white/[0.06] bg-black/15 px-2 py-1.5">
                <div className="text-[10px] uppercase tracking-wider text-white/40">Rollback reliability</div>
                <div className="text-white">{Math.round(authority.rollback_reliability * 100)}%</div>
              </div>
              <div className="rounded border border-white/[0.06] bg-black/15 px-2 py-1.5">
                <div className="text-[10px] uppercase tracking-wider text-white/40">Deploy confidence</div>
                <div className="text-white">{Math.round(authority.deployment_confidence * 100)}%</div>
              </div>
              <div className="rounded border border-white/[0.06] bg-black/15 px-2 py-1.5">
                <div className="text-[10px] uppercase tracking-wider text-white/40">Verified</div>
                <div className="text-white">{authority.verified_repairs}</div>
              </div>
              <div className="rounded border border-white/[0.06] bg-black/15 px-2 py-1.5">
                <div className="text-[10px] uppercase tracking-wider text-white/40">Rollbacks</div>
                <div className="text-white">{authority.rolled_back_repairs}</div>
              </div>
            </div>
            {authority.blocked_by.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">Blocked by</p>
                {authority.blocked_by.map((reason) => (
                  <p key={reason} className="text-[11px] text-white/65">· {reason}</p>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">Authority ceiling</p>
              {savingLevel && <span className="text-[10px] text-sky-300">saving…</span>}
            </div>
            <div className="mt-2 space-y-2" role="radiogroup" aria-label="Bud authority ceiling">
              {levels.map((level) => {
                const isCeiling = level === authority.configured_ceiling;
                const isCurrent = level === authority.level;
                const isSaving = savingLevel === level;
                const disabled = savingLevel !== null && !isSaving;
                return (
                  <button
                    key={level}
                    role="radio"
                    aria-checked={isCeiling}
                    disabled={disabled}
                    onClick={() => void onAuthorityChange(level)}
                    className={`flex w-full items-start gap-3 rounded-md border px-3 py-2.5 text-left transition ${
                      isCeiling
                        ? 'border-sky-400/50 bg-sky-500/[0.10] shadow-[0_0_0_1px_rgba(56,189,248,0.25)]'
                        : 'border-white/[0.06] bg-white/[0.015] hover:border-white/20 hover:bg-white/[0.04]'
                    } ${disabled ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                  >
                    <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full transition ${isCeiling ? 'bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.7)]' : 'border border-white/30 bg-transparent'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white">{AUTHORITY_LABELS[level]}</p>
                        {isCurrent && <Pill tone="good">current</Pill>}
                        {isCeiling && !isCurrent && <Pill tone="cool">ceiling</Pill>}
                        {isSaving && <Pill tone="warn">saving</Pill>}
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-white/55">{AUTHORITY_DESCRIPTIONS[level]}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-white/40">
              Bud will not exceed its earned level even if the ceiling is higher. Changes save instantly and apply on next action.
            </p>
          </div>
        </div>
      </Card>
      <Card title="Honest capabilities" subtitle="What Bud can actually do right now. Authority + infrastructure both required.">
        <div className="grid gap-2 px-5 py-4 md:grid-cols-2 xl:grid-cols-3">
          {capabilities.map((capability) => (
            <div key={capability.key} className={`rounded-md border px-3 py-3 ${CAPABILITY_TONE[capability.status]}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{capability.label}</p>
                <span className="text-[10px] font-semibold uppercase">{capability.status}</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed opacity-80">{capability.reason}</p>
              <div className="mt-2 flex gap-1.5 text-[10px] uppercase tracking-wider">
                {capability.authority_allows ? <Pill tone="good">authority OK</Pill> : <Pill tone="bad">authority blocks</Pill>}
                {capability.infrastructure_ready ? <Pill tone="good">infra OK</Pill> : <Pill tone="bad">infra missing</Pill>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                                COMMAND TAB                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function CommandTab({
  presenceState,
  onSubmitted,
  initiatives,
}: {
  presenceState: BudOsStateLabel;
  onSubmitted: () => void;
  initiatives: BudInitiative[];
}) {
  return (
    <div className="space-y-4">
      <CommandBar onCreated={onSubmitted} presenceState={presenceState} />
      <Card title="Recommended missions" subtitle="Tap to ask Bud to take one of these on.">
        <div className="grid gap-3 px-5 py-4 md:grid-cols-2 xl:grid-cols-3">
          {initiatives.length === 0 && <p className="text-sm text-white/40">No initiatives - workforce calm.</p>}
          {initiatives.map((initiative) => (
            <button
              key={initiative.id}
              onClick={() => {
                void fetch('/api/bud/command', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ command: initiative.title }),
                })
                  .then((r) => r.json())
                  .then(() => toast.success(`Bud is taking on: ${initiative.title}`))
                  .catch(() => toast.error('Bud could not accept that mission'));
              }}
              className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3 text-left transition hover:border-sky-400/30 hover:bg-sky-500/[0.05]"
            >
              <div className="flex items-center gap-2">
                <Pill tone={initiative.severity === 'critical' ? 'bad' : initiative.severity === 'high' ? 'warn' : 'cool'}>{initiative.severity}</Pill>
                <span className="text-[10px] uppercase tracking-wider text-white/40">{initiative.category}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-white">{initiative.title}</p>
              <p className="mt-1 line-clamp-2 text-xs text-white/55">{initiative.why}</p>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                                   PAGE                                     */
/* ────────────────────────────────────────────────────────────────────────── */

type ActivityEvent = { id: string; event_type: string; narrative: string; actor: string; created_at: string; metadata?: Record<string, unknown>; target?: string };

export function MissionControlClient({
  insights,
  budActivity = [],
  commandState,
  budOs,
}: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const initialTab = (search?.get('tab') ?? 'overview') as TabKey;
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [savingAuthority, setSavingAuthority] = useState<BudAuthorityLevel | null>(null);
  const [queue, setQueue] = useState<BudOsQueueItem[]>(budOs.actionQueue);
  const [selectedId, setSelectedId] = useState<string | null>(budOs.actionQueue[0]?.id ?? null);
  const [liveActivity, setLiveActivity] = useState<BudActivityEvent[]>(budActivity.slice(0, 12));
  const [investigatingIds, setInvestigatingIds] = useState<Set<string>>(new Set());
  // Track item IDs the user has already actioned this session so they don't
  // snap back when router.refresh() re-syncs agent-health items that are
  // still technically broken.
  const actionedIdsRef = useRef<Set<string>>(new Set());

  // Sync queue from server props whenever router.refresh() brings new data.
  // useState only uses its initializer on mount, so without this effect new
  // approvals/dismissals from the server never appear without a full reload.
  const incomingQueueKey = budOs.actionQueue.map((i) => i.id).join(',');
  useEffect(() => {
    const filtered = budOs.actionQueue.filter((i) => !actionedIdsRef.current.has(i.id));
    setQueue(filtered);
    setSelectedId((prev) =>
      filtered.find((i) => i.id === prev) ? prev : (filtered[0]?.id ?? null),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingQueueKey]);

  const selected = queue.find((item) => item.id === selectedId) ?? queue[0] ?? null;
  const workspace = useMemo(
    () =>
      buildRepairWorkspace({
        selectedItem: selected,
        commandState,
        executions: budOs.repairExecutions,
        steps: budOs.repairSteps,
        logs: budOs.repairLogs,
        activity: budActivity,
      }),
    [selected, commandState, budOs.repairExecutions, budOs.repairSteps, budOs.repairLogs, budActivity],
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
      // Refresh the queue whenever Bud creates a new approval item or updates a task —
      // this is what makes the next step appear without a manual page reload.
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

  async function reject(item: BudOsQueueItem, reason: string) {
    try {
      const url = item.source === 'agent_action' ? `/api/agents/actions/${item.source_id}` : '/api/bud/approval';
      const body = item.source === 'agent_action'
        ? { decision: 'reject', notes: reason }
        : { id: item.source_id, decision: 'rejected', notes: reason };
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? 'Rejection failed');
      actionedIdsRef.current.add(item.id);
      setQueue((prev) => prev.filter((entry) => entry.id !== item.id));
      toast.success('Rejection recorded - Bud will learn from this');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Rejection failed');
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
      // Optimistically remove the item so the user sees immediate feedback.
      // Agent-health items will return on the next full refresh if the agent is
      // still broken, but the approval/task will appear in the queue meanwhile.
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

  async function executeRepair(taskId: string) {
    try {
      const res = await fetch(`/api/bud/repairs/${taskId}/execute`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Repair executor failed');
      if (body.status === 'blocked') toast.warning(`Repair blocked: ${body.blockedReason ?? 'safety gate'}`);
      else toast.success(`Repair executor status: ${body.status}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Repair executor failed');
    }
  }

  const globalTone = GLOBAL_STATUS_TONE[commandState.global_status];

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-black text-white">
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_at_top,rgba(56,189,248,0.07),transparent_55%)]" />
      <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6">
        {/* Header */}
        <header className="flex flex-wrap items-center gap-3 pb-4">
          <div className="flex items-center gap-3">
            <span className="relative inline-flex h-3 w-3">
              <span className={`absolute inset-0 animate-ping rounded-full ${globalTone.dot} opacity-60`} />
              <span className={`relative h-3 w-3 rounded-full ${globalTone.dot}`} />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">Buds OS</p>
              <h1 className="text-2xl font-semibold tracking-tight">Mission Control</h1>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ring-1 ${globalTone.ring} ${globalTone.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${globalTone.dot}`} />
              {globalTone.label}
            </span>
            <Pill tone="cool">{budOs.authority.label}</Pill>
            <button onClick={() => router.refresh()} className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-white/70 hover:bg-white/[0.08]">
              Refresh
            </button>
          </div>
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

        {/* Persistent presence + command */}
        {tab !== 'command' && (
          <div className="mb-5 space-y-4">
            <CommandBar onCreated={refreshHint} presenceState={budOs.state.label} />
            <PresencePanel presence={budOs.state} commandState={commandState} authority={budOs.authority} thoughts={budOs.thoughtStream} />
          </div>
        )}

        {/* Tab content */}
        <div className="space-y-4">
          {tab === 'command' && (
            <CommandTab presenceState={budOs.state.label} onSubmitted={refreshHint} initiatives={budOs.initiatives} />
          )}

          {tab === 'overview' && (
            <>
              <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
                <ActionQueue
                  items={queue}
                  selectedId={selected?.id ?? null}
                  onSelect={(item) => setSelectedId(item.id)}
                  onDismiss={(item) => void dismiss(item)}
                  onApprove={(item) => void approve(item)}
                  onInvestigate={(item) => void investigate(item)}
                  investigatingIds={investigatingIds}
                />
                {selected?.approval ? (
                  <ApprovalInspector
                    item={selected}
                    onApprove={(item, notes) => approve(item, notes)}
                    onReject={(item, reason) => reject(item, reason)}
                    onInvestigate={(item) => void investigate(item)}
                  />
                ) : (
                  <RepairStudio workspace={workspace} onExecute={(taskId) => void executeRepair(taskId)} />
                )}
              </div>
              <Card title="Bud noticed" subtitle="Insights Bud has not yet resolved.">
                <div className="divide-y divide-white/[0.04] px-3">
                  {insights.slice(0, 6).map((insight) => (
                    <div key={insight.id} className="px-2 py-3">
                      <p className="text-sm font-semibold text-white">{insight.title}</p>
                      <p className="mt-1 text-[11px] text-white/40">{insight.category} · {rel(insight.created_at)}</p>
                    </div>
                  ))}
                  {insights.length === 0 && <p className="px-2 py-4 text-sm text-white/40">No unresolved notices.</p>}
                </div>
              </Card>
            </>
          )}

          {tab === 'workforce' && <Workforce clusters={budOs.workforce} commandState={commandState} />}

          {tab === 'repairs' && (
            <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
              <ActionQueue
                items={queue.filter((item) => ['critical', 'needs_approval', 'watch_items'].includes(item.group))}
                selectedId={selected?.id ?? null}
                onSelect={(item) => setSelectedId(item.id)}
                onDismiss={(item) => void dismiss(item)}
                onApprove={(item) => void approve(item)}
                onInvestigate={(item) => void investigate(item)}
                investigatingIds={investigatingIds}
              />
              {selected?.approval ? (
                <ApprovalInspector
                  item={selected}
                  onApprove={(item, notes) => approve(item, notes)}
                  onReject={(item, reason) => reject(item, reason)}
                  onInvestigate={(item) => void investigate(item)}
                />
              ) : (
                <RepairStudio workspace={workspace} onExecute={(taskId) => void executeRepair(taskId)} />
              )}
            </div>
          )}

          {tab === 'activity' && (
            <ActivityTab thoughts={budOs.thoughtStream} failures={budOs.structuredFailures} liveActivity={liveActivity} />
          )}

          {tab === 'memory' && <MemoryTab memoryLayer={budOs.memoryLayer} commandState={commandState} />}

          {tab === 'evolution' && (
            <EvolutionTab
              recommendations={budOs.uxEvolution}
              initiatives={budOs.initiatives}
              efficiencyFindings={budOs.efficiencyFindings}
            />
          )}

          {tab === 'deployments' && (
            <DeploymentsTab
              commandState={commandState}
              autonomy={budOs.autonomy}
              circuit={budOs.circuit}
              resilienceEvents={budOs.resilienceEvents}
            />
          )}

          {tab === 'settings' && (
            <SettingsTab
              authority={budOs.authority}
              capabilities={budOs.capabilities}
              savingLevel={savingAuthority}
              onAuthorityChange={async (level) => {
                if (level === budOs.authority.configured_ceiling) {
                  toast.info(`Bud is already at ${AUTHORITY_LABELS[level]}`);
                  return;
                }
                setSavingAuthority(level);
                try {
                  const res = await fetch('/api/bud/authority', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ ceiling: level }),
                  });
                  const body = await res.json().catch(() => ({} as { error?: string }));
                  if (!res.ok) throw new Error(body?.error ?? 'Could not save authority');
                  toast.success(`Authority ceiling: ${AUTHORITY_LABELS[level]}`);
                  router.refresh();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Could not save authority');
                } finally {
                  setSavingAuthority(null);
                }
              }}
            />
          )}
        </div>

        <footer className="mt-8 flex flex-wrap items-center gap-3 border-t border-white/[0.05] pt-4 text-[11px] text-white/40">
          <span>Buds OS · operational intelligence layer</span>
          <span className="ml-auto">global_status: {commandState.global_status} · bud_status: {commandState.bud_status}</span>
        </footer>
      </div>
    </div>
  );
}
