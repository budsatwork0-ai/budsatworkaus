'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { toast } from 'sonner';
import type { BudActivityEvent, BudApprovalItem } from '@/lib/bud/types';
import type { MissionControlHealth } from '@/lib/bud/health';
import {
  buildRepairWorkspace,
  type BudOsAutonomyCapability,
  type BudOsMemoryLayer,
  type BudOsQueueGroup,
  type BudOsQueueItem,
  type BudOsRepairWorkspace,
  type BudOsStateLabel,
  type BudOsWorkforceCluster,
} from '@/lib/bud/os-view-model';
import type { UxEvolutionRecommendation } from '@/lib/bud/ux-evolution-engine';

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
  started_at: string;
};

type ActionRow = {
  id: string;
  agent_id: string;
  action_type: string;
  preview: string;
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

type RepairLogRow = {
  id: number;
  execution_id: string;
  level: string;
  message: string;
  created_at: string;
};

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
    state: {
      label: BudOsStateLabel;
      summary: string;
      hasIssues: boolean;
    };
    actionQueue: BudOsQueueItem[];
    workforce: BudOsWorkforceCluster[];
    memoryLayer: BudOsMemoryLayer;
    autonomy: BudOsAutonomyCapability[];
    uxEvolution: UxEvolutionRecommendation[];
    repairExecutions: RepairExecutionRow[];
    repairSteps: RepairStepRow[];
    repairLogs: RepairLogRow[];
  };
};

type BudCommandResponse = {
  ok: boolean;
  task_id: string;
  intent: string;
  approval_id: string | null;
  status: string;
  bud_response: {
    message: string;
    plan: string[];
    bud_state: string;
  } | null;
};

const EXAMPLES = [
  'Fix broken agents',
  'Improve the admin dashboard',
  'Check why quotes are dropping',
  "Review today's jobs",
  'Find issues in the site',
  'Deploy approved repairs',
];

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

const STATE_STYLE: Record<BudOsStateLabel, string> = {
  Observing: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Thinking: 'bg-sky-50 text-sky-700 border-sky-100',
  Investigating: 'bg-amber-50 text-amber-700 border-amber-100',
  Planning: 'bg-violet-50 text-violet-700 border-violet-100',
  'Waiting for approval': 'bg-violet-50 text-violet-700 border-violet-100',
  Repairing: 'bg-orange-50 text-orange-700 border-orange-100',
  Deploying: 'bg-blue-50 text-blue-700 border-blue-100',
  Verifying: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  Learning: 'bg-teal-50 text-teal-700 border-teal-100',
  Blocked: 'bg-red-50 text-red-700 border-red-100',
};

const SEVERITY_STYLE: Record<BudOsQueueItem['severity'], string> = {
  low: 'bg-slate-50 text-slate-600 border-slate-100',
  medium: 'bg-amber-50 text-amber-700 border-amber-100',
  high: 'bg-orange-50 text-orange-700 border-orange-100',
  critical: 'bg-red-50 text-red-700 border-red-100',
};

const CAPABILITY_STYLE: Record<BudOsAutonomyCapability['status'], string> = {
  online: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  partial: 'bg-amber-50 text-amber-700 border-amber-100',
  blocked: 'bg-red-50 text-red-700 border-red-100',
};

function rel(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function short(text: string, length = 150): string {
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-black/[0.06] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-3 border-b border-black/[0.05] px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        <div className="ml-auto">{action}</div>
      </div>
      {children}
    </section>
  );
}

const BUD_STATE_DOT: Record<string, string> = {
  thinking: 'bg-blue-400',
  investigating: 'bg-amber-400',
  planning: 'bg-violet-400',
  repairing: 'bg-orange-400',
  waiting_for_approval: 'bg-yellow-400',
};

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-pulse"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}

function CommandBar({ onCreated }: { onCreated: () => void }) {
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

  const dotColor = budReply?.bud_response?.bud_state
    ? (BUD_STATE_DOT[budReply.bud_response.bud_state] ?? 'bg-emerald-400')
    : 'bg-emerald-400';

  return (
    <div className="rounded-lg border border-slate-900/10 bg-slate-950 text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
      <div className="px-4 pt-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <label htmlFor="bud-command" className="sr-only">Ask Bud</label>
            <input
              ref={inputRef}
              id="bud-command"
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void submit();
              }}
              placeholder="Ask Bud to investigate, fix, improve, schedule, quote, review, or deploy..."
              className="h-12 w-full rounded-md border border-white/10 bg-white/10 px-4 text-sm text-white outline-none transition placeholder:text-slate-400 focus:border-white/30 focus:bg-white/[0.14]"
            />
          </div>
          <button
            disabled={busy || !command.trim()}
            onClick={() => void submit()}
            className="h-12 rounded-md bg-white px-5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Bud is thinking...' : 'Ask Bud'}
          </button>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-4">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              disabled={busy}
              onClick={() => void submit(example)}
              className="shrink-0 rounded-md border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {/* Bud response panel */}
      {(busy || budReply) && (
        <div className="border-t border-white/[0.08] px-4 py-4">
          {busy && !budReply && (
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
              <span className="text-sm text-slate-300">Bud is analyzing your request <ThinkingDots /></span>
            </div>
          )}
          {budReply?.bud_response && (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotColor} animate-pulse`} />
                <div>
                  <p className="text-sm font-semibold text-white">{budReply.bud_response.bud_state.replace(/_/g, ' ')}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-200">{budReply.bud_response.message}</p>
                </div>
              </div>
              {budReply.bud_response.plan.length > 0 && (
                <ol className="space-y-1.5 pl-5">
                  {budReply.bud_response.plan.map((step, index) => (
                    <li key={`${step}-${index}`} className="flex gap-2 text-xs text-slate-300">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-white">{index + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              )}
              <div className="flex items-center gap-2 pt-1">
                {budReply.approval_id && (
                  <span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-yellow-300">
                    Needs your approval
                  </span>
                )}
                <span className="text-[11px] text-slate-500">Task {budReply.task_id.slice(0, 8)}</span>
                <button
                  onClick={() => setBudReply(null)}
                  className="ml-auto text-[11px] text-slate-500 hover:text-slate-300"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
          {budReply && !budReply.bud_response && (
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-sm text-slate-300">Bud queued the task. Refresh to see it in the work queue.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BudStatePanel({ state, commandState }: { state: Props['budOs']['state']; commandState: MissionControlHealth }) {
  const counts = [
    { label: 'Broken', value: commandState.counts.broken_agents + commandState.counts.needs_repair_agents },
    { label: 'Can fix', value: commandState.repair_sessions.length },
    { label: 'Needs approval', value: commandState.approvals.total_pending },
    { label: 'Learned', value: commandState.memory.recent_count },
  ];

  return (
    <Section
      title="Bud State"
      action={<span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${STATE_STYLE[state.label]}`}>{state.label}</span>}
    >
      <div className="px-4 py-4">
        <div className="flex items-start gap-3">
          <span className={`mt-1.5 h-3 w-3 rounded-full ${state.hasIssues ? 'animate-pulse bg-amber-500' : 'bg-emerald-500'}`} />
          <div>
            <p className="text-lg font-semibold leading-tight text-slate-950">Bud is {state.label.toLowerCase()}</p>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">{state.summary}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {counts.map((item) => (
            <div key={item.label} className="rounded-md border border-black/[0.05] bg-slate-50 px-3 py-3">
              <div className="text-xl font-semibold tabular-nums text-slate-950">{item.value}</div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function ActionQueue({
  items,
  selectedId,
  onSelect,
  onDismiss,
  onApprove,
  onInvestigate,
}: {
  items: BudOsQueueItem[];
  selectedId: string | null;
  onSelect: (item: BudOsQueueItem) => void;
  onDismiss: (item: BudOsQueueItem) => void;
  onApprove: (item: BudOsQueueItem) => void;
  onInvestigate: (item: BudOsQueueItem) => void;
}) {
  const groups = useMemo(() => {
    return (Object.keys(GROUP_LABEL) as BudOsQueueGroup[]).map((group) => ({
      group,
      items: items.filter((item) => item.group === group),
    }));
  }, [items]);

  return (
    <Section title="Work Queue">
      <div className="divide-y divide-black/[0.05]">
        {groups.map(({ group, items: groupItems }) => (
          <div key={group} className="px-3 py-3">
            <div className="mb-2 flex items-center gap-2 px-1">
              <p className="text-xs font-semibold text-slate-950">{GROUP_LABEL[group]}</p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{groupItems.length}</span>
            </div>
            <p className="mb-2 px-1 text-[11px] text-slate-500">{GROUP_COPY[group]}</p>
            <div className="space-y-2">
              {groupItems.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-400">Nothing here right now.</div>
              ) : groupItems.slice(0, 6).map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelect(item)}
                  className={`w-full rounded-md border px-3 py-3 text-left transition ${
                    selectedId === item.id ? 'border-slate-900 bg-slate-950 text-white' : 'border-black/[0.06] bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${selectedId === item.id ? 'border-white/20 bg-white/10 text-white' : SEVERITY_STYLE[item.severity]}`}>
                      {item.severity}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-tight">{item.title}</p>
                      <p className={`mt-1 text-xs leading-relaxed ${selectedId === item.id ? 'text-slate-300' : 'text-slate-500'}`}>{short(item.detail, 120)}</p>
                      <p className={`mt-1 text-[11px] ${selectedId === item.id ? 'text-slate-400' : 'text-slate-400'}`}>{item.agent_name ?? 'Bud'} - {rel(item.created_at)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className={`rounded-md px-2 py-1 text-[11px] font-medium ${selectedId === item.id ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-600'}`}>Explain</span>
                    {item.actions.includes('investigate') && <span onClick={(event) => { event.stopPropagation(); onInvestigate(item); }} className={`rounded-md px-2 py-1 text-[11px] font-medium ${selectedId === item.id ? 'bg-white/10 text-white' : 'bg-sky-50 text-sky-700'}`}>Investigate</span>}
                    {item.actions.includes('fix_with_bud') && <span onClick={(event) => { event.stopPropagation(); onInvestigate(item); }} className={`rounded-md px-2 py-1 text-[11px] font-medium ${selectedId === item.id ? 'bg-white/10 text-white' : 'bg-orange-50 text-orange-700'}`}>Fix with Bud</span>}
                    {item.actions.includes('approve') && <span onClick={(event) => { event.stopPropagation(); onApprove(item); }} className={`rounded-md px-2 py-1 text-[11px] font-medium ${selectedId === item.id ? 'bg-white/10 text-white' : 'bg-emerald-50 text-emerald-700'}`}>Approve</span>}
                    {item.actions.includes('dismiss') && <span onClick={(event) => { event.stopPropagation(); onDismiss(item); }} className={`rounded-md px-2 py-1 text-[11px] font-medium ${selectedId === item.id ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-600'}`}>Dismiss</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function RepairStudio({ workspace, onExecute }: { workspace: BudOsRepairWorkspace; onExecute: (taskId: string) => void }) {
  return (
    <Section
      title="Repair Studio"
      action={workspace.task_id ? (
        <button onClick={() => onExecute(workspace.task_id!)} className="rounded-md bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
          Run gated repair
        </button>
      ) : null}
    >
      <div className="grid gap-4 px-4 py-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Problem summary</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-800">{workspace.problem_summary}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Diagnosis</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-800">{workspace.diagnosis}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Proposed plan</p>
            <ol className="mt-2 space-y-1.5">
              {workspace.proposed_plan.map((step, index) => (
                <li key={`${step}-${index}`} className="flex gap-2 text-sm text-slate-700">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500">{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <StatusTile label="Approval" value={workspace.approval_status} />
            <StatusTile label="Deployment" value={workspace.deployment_status} />
            <StatusTile label="Verification" value={workspace.verification_status.replaceAll('_', ' ')} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Code/config diff</p>
            <p className="mt-1 rounded-md border border-black/[0.06] bg-slate-50 px-3 py-3 font-mono text-xs leading-relaxed text-slate-600">{workspace.diff_summary}</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-md border border-black/[0.06]">
            <div className="border-b border-black/[0.05] px-3 py-2 text-xs font-semibold text-slate-800">Repair steps</div>
            <div className="max-h-[220px] overflow-auto">
              {workspace.steps.length === 0 ? (
                <p className="px-3 py-3 text-xs text-slate-400">Bud has not recorded repair steps for this item yet.</p>
              ) : workspace.steps.map((step) => (
                <div key={step.id} className="border-b border-black/[0.04] px-3 py-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-800">{step.state.replaceAll('_', ' ')}</span>
                    <span className="ml-auto text-[11px] text-slate-400">{step.status}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{step.summary}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-md border border-black/[0.06]">
            <div className="border-b border-black/[0.05] px-3 py-2 text-xs font-semibold text-slate-800">Bud explains what it is doing</div>
            <div className="max-h-[280px] overflow-auto">
              {workspace.logs.map((log) => (
                <div key={log.id} className="border-b border-black/[0.04] px-3 py-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase text-slate-400">{log.level}</span>
                    <span className="ml-auto text-[11px] text-slate-400">{rel(log.created_at)}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{log.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-black/[0.06] bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function Workforce({ clusters }: { clusters: BudOsWorkforceCluster[] }) {
  return (
    <Section title="Agent Workforce" action={<Link href="/dashboard/agents" className="text-xs font-semibold text-slate-500 hover:text-slate-900">Open workforce</Link>}>
      <div className="grid gap-3 px-4 py-4 md:grid-cols-2 xl:grid-cols-3">
        {clusters.map((cluster) => (
          <div key={cluster.name} className="rounded-md border border-black/[0.06] bg-slate-50/70">
            <div className="flex items-center justify-between border-b border-black/[0.05] px-3 py-2">
              <p className="text-sm font-semibold text-slate-950">{cluster.name}</p>
              <span className="text-xs font-semibold text-slate-400">{cluster.agents.length}</span>
            </div>
            <div className="divide-y divide-black/[0.04]">
              {cluster.agents.slice(0, 4).map((agent) => (
                <Link key={agent.id} href={`/dashboard/agents/${agent.id}`} className="block px-3 py-3 transition hover:bg-white">
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{agent.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${agent.can_delegate ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      {agent.can_delegate ? 'Can delegate' : 'Blocked'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{agent.health} - {agent.role}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{agent.current_task}</p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function MemoryLayer({ memoryLayer }: { memoryLayer: BudOsMemoryLayer }) {
  return (
    <Section title="Memory Layer">
      <div className="grid gap-3 px-4 py-4 md:grid-cols-2 xl:grid-cols-3">
        {memoryLayer.map((group) => (
          <div key={group.name} className="rounded-md border border-black/[0.06] bg-white px-3 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">{group.name}</p>
              <span className="text-xs font-semibold text-slate-400">{group.items.length}</span>
            </div>
            <div className="mt-3 space-y-2">
              {group.items.length === 0 ? (
                <p className="text-xs text-slate-400">Bud has not saved this kind of memory yet.</p>
              ) : group.items.map((item) => (
                <div key={item.id} className="rounded-md bg-slate-50 px-3 py-2">
                  <p className="line-clamp-1 text-xs font-semibold text-slate-800">{item.title}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function AutonomyMeter({ capabilities }: { capabilities: BudOsAutonomyCapability[] }) {
  return (
    <Section title="Autonomy Meter">
      <div className="grid gap-2 px-4 py-4 md:grid-cols-2 xl:grid-cols-7">
        {capabilities.map((capability) => (
          <div key={capability.key} className={`rounded-md border px-3 py-3 ${CAPABILITY_STYLE[capability.status]}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">{capability.label}</p>
              <span className="text-[10px] font-semibold uppercase">{capability.status}</span>
            </div>
            <p className="mt-2 line-clamp-3 text-xs leading-relaxed opacity-80">{capability.detail}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function UxEvolution({ recommendations }: { recommendations: UxEvolutionRecommendation[] }) {
  return (
    <Section title="Bud UX Evolution Engine">
      <div className="grid gap-3 px-4 py-4 lg:grid-cols-3">
        <div className="rounded-md border border-black/[0.06] bg-slate-950 px-4 py-4 text-white lg:col-span-1">
          <p className="text-sm font-semibold">Bud can redesign the OS by recommendation and approval.</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">
            It detects friction, clutter, repeated workflows, weak hierarchy, duplicated sections, dead features, conversion gaps, and bottlenecks. It does not silently rewrite or deploy itself.
          </p>
        </div>
        <div className="space-y-2 lg:col-span-2">
          {recommendations.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-400">No self-improvement recommendations are waiting.</div>
          ) : recommendations.slice(0, 5).map((rec) => (
            <div key={rec.id} className="rounded-md border border-black/[0.06] bg-white px-3 py-3">
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${SEVERITY_STYLE[rec.severity]}`}>{rec.severity}</span>
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{rec.title}</p>
                <span className="text-[11px] text-slate-400">{rel(rec.created_at)}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">{rec.summary}</p>
              <p className="mt-2 text-[11px] font-medium text-slate-400">{rec.affected_area} - {rec.can_queue_approval ? 'Ready for approval queue' : 'Reference memory only'}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

type ActivityEvent = {
  id: string;
  event_type: string;
  narrative: string;
  actor: string;
  created_at: string;
};

export function MissionControlClient({
  runs,
  actions,
  insights,
  budActivity = [],
  commandState,
  budOs,
}: Props) {
  const router = useRouter();
  const [queue, setQueue] = useState<BudOsQueueItem[]>(budOs.actionQueue);
  const [selectedId, setSelectedId] = useState<string | null>(budOs.actionQueue[0]?.id ?? null);
  const [liveActivity, setLiveActivity] = useState<ActivityEvent[]>([]);
  const selected = queue.find((item) => item.id === selectedId) ?? queue[0] ?? null;
  const workspace = useMemo(() => buildRepairWorkspace({
    selectedItem: selected,
    commandState,
    executions: budOs.repairExecutions,
    steps: budOs.repairSteps,
    logs: budOs.repairLogs,
    activity: budActivity,
  }), [selected, commandState, budOs.repairExecutions, budOs.repairSteps, budOs.repairLogs, budActivity]);

  // Auto-refresh server data every 30s
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(interval);
  }, [router]);

  // Supabase realtime: subscribe to live activity feed
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const channel = supabase
      .channel('bud-live-activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bud_activity_feed' }, (payload) => {
        const row = payload.new as ActivityEvent;
        setLiveActivity((prev) => [row, ...prev].slice(0, 10));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

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
      setQueue((prev) => prev.filter((entry) => entry.id !== item.id));
      toast.success('Bud dismissed the item');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Dismiss failed');
    }
  }

  async function approve(item: BudOsQueueItem) {
    try {
      const url = item.source === 'agent_action' ? `/api/agents/actions/${item.source_id}` : '/api/bud/approval';
      const body = item.source === 'agent_action'
        ? { decision: 'approve' }
        : { id: item.source_id, decision: 'approved' };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? 'Approval failed');
      setQueue((prev) => prev.filter((entry) => entry.id !== item.id));
      toast.success('Bud approval recorded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Approval failed');
    }
  }

  async function investigate(item: BudOsQueueItem) {
    try {
      if (item.source === 'agent_run' && item.agent_id) {
        const res = await fetch('/api/bud/investigate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ runId: item.source_id, agentId: item.agent_id, agentName: item.agent_name ?? item.agent_id }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error ?? 'Investigation failed');
        toast.success('Bud started investigating');
        return;
      }
      const res = await fetch('/api/bud/command', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ command: `Investigate and propose a fix: ${item.title}. ${item.detail}` }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Bud command failed');
      toast.success('Bud queued an investigation');
    } catch (error) {
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

  return (
    <div className="space-y-4 pb-8">
      <CommandBar onCreated={refreshHint} />

      <BudStatePanel state={budOs.state} commandState={commandState} />

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <ActionQueue
          items={queue}
          selectedId={selected?.id ?? null}
          onSelect={(item) => setSelectedId(item.id)}
          onDismiss={(item) => void dismiss(item)}
          onApprove={(item) => void approve(item)}
          onInvestigate={(item) => void investigate(item)}
        />
        <RepairStudio workspace={workspace} onExecute={(taskId) => void executeRepair(taskId)} />
      </div>

      <AutonomyMeter capabilities={budOs.autonomy} />
      <UxEvolution recommendations={budOs.uxEvolution} />
      <Workforce clusters={budOs.workforce} />
      <MemoryLayer memoryLayer={budOs.memoryLayer} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Command">
          <div className="space-y-2 px-4 py-4 text-sm text-slate-600">
            <Link href="/dashboard/agents/lobby" className="block rounded-md border border-black/[0.06] px-3 py-2 font-semibold text-slate-800 hover:bg-slate-50">Runtime</Link>
            <Link href="/dashboard/agents" className="block rounded-md border border-black/[0.06] px-3 py-2 font-semibold text-slate-800 hover:bg-slate-50">Workforce</Link>
            <Link href="/dashboard/settings" className="block rounded-md border border-black/[0.06] px-3 py-2 font-semibold text-slate-800 hover:bg-slate-50">Settings</Link>
          </div>
        </Section>
        <Section title="Bud noticed">
          <div className="divide-y divide-black/[0.05]">
            {insights.slice(0, 5).map((insight) => (
              <div key={insight.id} className="px-4 py-3">
                <p className="text-sm font-semibold text-slate-800">{insight.title}</p>
                <p className="mt-1 text-xs text-slate-400">{insight.category} - {rel(insight.created_at)}</p>
              </div>
            ))}
            {insights.length === 0 && <p className="px-4 py-4 text-sm text-slate-400">No unresolved Bud notices.</p>}
          </div>
        </Section>
        <Section title="Bud is working on">
          <div className="divide-y divide-black/[0.05]">
            {liveActivity.slice(0, 3).map((event) => (
              <div key={event.id} className="flex items-start gap-2 px-4 py-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-500" />
                <div>
                  <p className="text-sm text-slate-800 leading-snug">{event.narrative}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{rel(event.created_at)}</p>
                </div>
              </div>
            ))}
            {liveActivity.length === 0 && [
              ...runs.filter((run) => run.status === 'running'),
              ...runs.filter((run) => run.status === 'needs_repair'),
            ].slice(0, 5).map((run) => (
              <div key={run.id} className="px-4 py-3">
                <p className="text-sm font-semibold text-slate-800">{run.agent_id}</p>
                <p className="mt-1 text-xs text-slate-500">{run.summary ?? run.status}</p>
              </div>
            ))}
            {liveActivity.length === 0 && runs.filter((run) => run.status === 'running' || run.status === 'needs_repair').length === 0 && actions.length === 0 && (
              <p className="px-4 py-4 text-sm text-slate-400">Bud is watching. No active work right now.</p>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}
