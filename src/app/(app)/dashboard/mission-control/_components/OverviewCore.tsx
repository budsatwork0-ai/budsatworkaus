'use client';

/**
 * Mission Control — Overview (Core)
 *
 * Stripped-down operator cockpit. Renders ONLY panels backed by real data and
 * working actions — no synthesized narrative ("AI theatre"):
 *
 *   1. Platform state      — deriveGlobalTruth(commandState) from real health telemetry
 *   2. Vitals             — live counts straight off MissionControlHealth
 *   3. Ask Bud            — real /api/bud/command (creates tasks + approvals)
 *   4. Needs a decision   — real action queue with working Approve / Investigate
 *   5. Live activity      — real bud_activity_feed events
 *   6. Deployment         — real deployment telemetry
 *
 * Intentionally does NOT use: thought-stream, initiatives, ux-evolution, or the
 * derived overview-v2 narrative builders (cockpit prose, operational risk,
 * forecasts, customer impact, systems map, confidence, etc.).
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { relativeTime } from './_utils';
import type { MissionControlHealth } from '@/lib/bud/health';
import type { BudActivityEvent } from '@/lib/bud/types';
import type { BudOsQueueItem, AgentImpactMap } from '@/lib/bud/os-view-model';
import {
  deriveAgentBizValue,
  deriveAgentDisplayStatus,
  type AgentBizValue,
  type AgentStatusDerived,
} from '@/lib/bud/os-view-model';
import { deriveGlobalTruth, type GlobalTruthState } from '@/lib/bud/overview-v2';
import type { BusinessSnapshotData } from '../MissionControlClient';

/* ── section label ───────────────────────────────────────────────────────── */

type SectionBadge = 'Active' | 'Read Only' | 'Report' | 'Placeholder' | 'Prototype';

const SECTION_BADGE_STYLE: Record<SectionBadge, string> = {
  'Active':      'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  'Read Only':   'border-white/10 bg-white/[0.04] text-white/40',
  'Report':      'border-sky-500/30 bg-sky-500/10 text-sky-400',
  'Placeholder': 'border-slate-500/20 bg-slate-500/[0.06] text-slate-400',
  'Prototype':   'border-violet-500/30 bg-violet-500/10 text-violet-400',
};

function SectionLabel({ label, badge }: { label: string; badge: SectionBadge }) {
  return (
    <div className="flex items-center gap-2.5 pt-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/25">{label}</span>
      <span className={`inline-flex items-center rounded border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider ${SECTION_BADGE_STYLE[badge]}`}>
        {badge}
      </span>
    </div>
  );
}

/* ── tokens ──────────────────────────────────────────────────────────────── */

const TRUTH_TONE: Record<GlobalTruthState, { ring: string; text: string; dot: string; barBg: string; bar: string }> = {
  healthy: { ring: 'ring-emerald-400/30', text: 'text-emerald-300', dot: 'bg-emerald-400', barBg: 'bg-emerald-500/15', bar: 'bg-emerald-400' },
  degraded: { ring: 'ring-amber-400/30', text: 'text-amber-300', dot: 'bg-amber-400', barBg: 'bg-amber-500/15', bar: 'bg-amber-400' },
  approval: { ring: 'ring-yellow-300/30', text: 'text-yellow-200', dot: 'bg-yellow-300', barBg: 'bg-yellow-300/15', bar: 'bg-yellow-300' },
  recovering: { ring: 'ring-sky-400/30', text: 'text-sky-300', dot: 'bg-sky-400', barBg: 'bg-sky-500/15', bar: 'bg-sky-400' },
  blocked: { ring: 'ring-red-400/40', text: 'text-red-300', dot: 'bg-red-400', barBg: 'bg-red-500/15', bar: 'bg-red-400' },
};

const SEVERITY_TONE: Record<BudOsQueueItem['severity'], { label: string; tone: string }> = {
  critical: { label: 'Critical', tone: 'border-red-400/50 text-red-300 bg-red-500/[0.06]' },
  high: { label: 'Major', tone: 'border-orange-400/40 text-orange-300 bg-orange-500/[0.06]' },
  medium: { label: 'Medium', tone: 'border-amber-400/30 text-amber-300 bg-amber-500/[0.06]' },
  low: { label: 'Observation', tone: 'border-white/15 text-white/55 bg-white/[0.02]' },
};

const APPROVAL_TRUTH_TONE: Record<NonNullable<BudOsQueueItem['approval']>['truth_label'], string> = {
  Actionable: 'border-emerald-400/35 bg-emerald-500/[0.08] text-emerald-300',
  Blocked: 'border-red-400/40 bg-red-500/[0.08] text-red-300',
  Archived: 'border-white/15 bg-white/[0.03] text-white/45',
  'Needs manual review': 'border-amber-400/35 bg-amber-500/[0.08] text-amber-300',
};

const VALUE_TONE: Record<AgentBizValue, string> = {
  high:   'border-emerald-400/40 bg-emerald-500/10 text-emerald-300',
  medium: 'border-amber-400/30 bg-amber-500/[0.08] text-amber-300',
  low:    'border-white/10 bg-white/[0.03] text-white/35',
};

const AGENT_STATUS_TONE: Record<AgentStatusDerived, string> = {
  healthy:  'border-emerald-400/30 bg-emerald-500/[0.06] text-emerald-300',
  watch:    'border-amber-400/35 bg-amber-500/[0.08] text-amber-300',
  failing:  'border-red-400/40 bg-red-500/[0.08] text-red-300',
  disabled: 'border-white/15 bg-white/[0.03] text-white/35',
};

/* ── props ───────────────────────────────────────────────────────────────── */

type Props = {
  commandState: MissionControlHealth;
  businessSnapshot: BusinessSnapshotData;
  agentImpact?: AgentImpactMap;
  queue: BudOsQueueItem[];
  activity: BudActivityEvent[];
  selectedId: string | null;
  investigatingIds: Set<string>;
  onSelect: (item: BudOsQueueItem) => void;
  onApprove: (item: BudOsQueueItem) => void;
  onReject: (item: BudOsQueueItem) => void;
  onInvestigate: (item: BudOsQueueItem) => void;
};

/* ── component ───────────────────────────────────────────────────────────── */

export function OverviewCore({
  commandState,
  businessSnapshot,
  agentImpact,
  queue,
  activity,
  selectedId,
  investigatingIds,
  onSelect,
  onApprove,
  onReject,
  onInvestigate,
}: Props) {
  const truth = deriveGlobalTruth(commandState);

  return (
    <div className="space-y-5">
      <SectionLabel label="Business" badge="Active" />
      <BusinessSnapshot snapshot={businessSnapshot} />
      <SectionLabel label="Runtime" badge="Active" />
      <StateAndAsk truth={truth} commandState={commandState} />
      <Vitals commandState={commandState} />
      <ActionQueue
        queue={queue}
        selectedId={selectedId}
        investigatingIds={investigatingIds}
        onSelect={onSelect}
        onApprove={onApprove}
        onReject={onReject}
        onInvestigate={onInvestigate}
      />
      <AgentValue agents={commandState.agents} agentImpact={agentImpact} />
      <ActivityFeed activity={activity} />
      <NextAction commandState={commandState} queue={queue} />
      <SectionLabel label="Reports" badge="Report" />
      <Deployment commandState={commandState} activity={activity} />
    </div>
  );
}

/* ── 1. platform state + Ask Bud ─────────────────────────────────────────── */

const QUICK_COMMANDS: Array<{ label: string; command: string }> = [
  { label: 'Investigate Customer Reply',  command: 'Investigate customer reply failures' },
  { label: 'Review pending approvals',    command: 'Review pending approvals' },
  { label: 'Investigate stalled agents',  command: 'Investigate stalled agents' },
  { label: 'Audit Messenger leads',       command: 'Audit Messenger leads' },
  { label: 'Check quote follow-ups',      command: 'Review quote follow-up pipeline' },
  { label: 'Improve Mission Control UX',  command: 'Improve Mission Control UX' },
];

function StateAndAsk({
  truth,
  commandState,
}: {
  truth: ReturnType<typeof deriveGlobalTruth>;
  commandState: MissionControlHealth;
}) {
  const tone = TRUTH_TONE[truth.state];
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function ask(override?: string) {
    const text = (override !== undefined ? override : draft).trim();
    if (!text) return;
    setBusy(true);
    setResponse(null);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/bud/command', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ command: text }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Bud could not answer');
      setResponse(body?.bud_response?.message ?? 'Bud accepted the request.');
      if (override === undefined) setDraft('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bud could not answer';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 ring-1 ${tone.ring}`}>
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        {/* state */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className={`inline-flex h-2.5 w-2.5 rounded-full ${tone.dot}`} />
            <span className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${tone.text}`}>{truth.headline}</span>
          </div>
          <div>
            <h2 className="text-2xl font-semibold leading-tight tracking-tight text-white">{commandState.summary}</h2>
            <p className="mt-1 text-xs uppercase tracking-wider text-white/40">Operating mode: {commandState.operating_mode.replace(/_/g, ' ')}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Platform health</span>
              <span className="text-sm font-semibold tabular-nums text-white">{truth.index}</span>
            </div>
            <div className={`mt-2 h-1.5 w-full overflow-hidden rounded-full ${tone.barBg}`}>
              <div className={`h-full ${tone.bar}`} style={{ width: `${truth.index}%` }} />
            </div>
            <p className="mt-2 text-xs text-white/45">{truth.detail}</p>
          </div>
        </div>
        {/* ask bud */}
        <div className="flex flex-col gap-3">
          <label htmlFor="core-ask" className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">
            Ask Bud
          </label>
          <p className="text-[11px] leading-relaxed text-white/40">
            Ask Bud creates a tracked task. Some commands may require approval before action.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_COMMANDS.map((cmd) => (
              <button
                key={cmd.label}
                onClick={() => void ask(cmd.command)}
                disabled={busy}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-white/55 transition hover:border-white/15 hover:bg-white/[0.06] hover:text-white/75 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {cmd.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              id="core-ask"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void ask(); }}
              placeholder="e.g. Investigate the stripe-dispute-manager failures"
              className="h-12 flex-1 rounded-lg border border-white/[0.08] bg-black/30 px-4 text-[15px] text-white outline-none placeholder:text-white/30 focus:border-sky-400/40"
            />
            <button
              onClick={() => void ask()}
              disabled={busy || !draft.trim()}
              className="h-12 rounded-lg bg-white px-5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? 'Working…' : 'Ask'}
            </button>
          </div>
          {errorMsg && (
            <p className="rounded-lg border border-red-400/25 bg-red-500/[0.06] p-3 text-xs leading-relaxed text-red-300">{errorMsg}</p>
          )}
          {!errorMsg && response && (
            <p className="rounded-lg border border-white/[0.08] bg-black/25 p-3 text-xs leading-relaxed text-white/75">{response}</p>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── 2. vitals ───────────────────────────────────────────────────────────── */

function Vitals({ commandState }: { commandState: MissionControlHealth }) {
  const attention = commandState.agents_needing_attention.length;
  const openTasks = commandState.repair_sessions.length;
  const cells: Array<{ label: string; value: string; sub?: string; tone?: string }> = [
    {
      label: 'Agents',
      value: String(commandState.agents.length),
      sub: attention > 0 ? `${attention} need attention` : 'all healthy',
      tone: attention > 0 ? 'text-amber-300' : 'text-emerald-300',
    },
    {
      label: 'Failed runs',
      value: String(commandState.counts.failed_runs),
      sub: 'recent window',
      tone: commandState.counts.failed_runs > 0 ? 'text-red-300' : 'text-emerald-300',
    },
    {
      label: 'Pending approvals',
      value: String(commandState.approvals.total_pending),
      sub: `${commandState.approvals.actionable_pending} actionable · ${commandState.approvals.needs_manual_review} manual · ${commandState.approvals.blocked_historical} blocked · ${commandState.approvals.archived_stale} archived`,
      tone: commandState.approvals.total_pending > 0 ? 'text-yellow-200' : 'text-white/70',
    },
    {
      label: 'Open tasks',
      value: String(openTasks),
      sub: 'in the work queue',
      tone: 'text-white/80',
    },
    {
      label: 'Deployment',
      value: commandState.deployment.status,
      sub: commandState.deployment.connected ? 'telemetry live' : 'not connected',
      tone:
        commandState.deployment.status === 'failed' ? 'text-red-300'
        : commandState.deployment.status === 'healthy' ? 'text-emerald-300'
        : commandState.deployment.status === 'deploying' ? 'text-sky-300'
        : 'text-amber-300',
    },
    {
      label: 'Memory',
      value: String(commandState.memory.recent_count),
      sub: commandState.memory.connected ? 'records synced' : 'not synced',
      tone: commandState.memory.connected ? 'text-white/80' : 'text-white/45',
    },
  ];

  return (
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {cells.map((c) => (
        <div key={c.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{c.label}</p>
          <p className={`mt-1 text-xl font-semibold tabular-nums capitalize ${c.tone ?? 'text-white'}`}>{c.value}</p>
          {c.sub && <p className="mt-0.5 text-[11px] text-white/40">{c.sub}</p>}
        </div>
      ))}
    </section>
  );
}

/* ── business snapshot ───────────────────────────────────────────────────── */

function fmtRevenue(n: number): string {
  if (n >= 10_000) return `$${(n / 1000).toFixed(1)}k`;
  if (n >= 1_000) return `$${(n / 1000).toFixed(2).replace(/\.?0+$/, '')}k`;
  return `$${n.toFixed(0)}`;
}

function BusinessSnapshot({ snapshot }: { snapshot: BusinessSnapshotData }) {
  const cells: Array<{ label: string; value: string; sub: string; tone: string }> = [
    {
      label: 'Revenue MTD',
      value: fmtRevenue(snapshot.mtd_revenue),
      sub: `${snapshot.mtd_orders} order${snapshot.mtd_orders !== 1 ? 's' : ''} this month`,
      tone: 'text-white',
    },
    {
      label: 'Completed',
      value: String(snapshot.completed_mtd),
      sub: 'jobs finished this month',
      tone: snapshot.completed_mtd > 0 ? 'text-emerald-300' : 'text-white/60',
    },
    {
      label: 'In progress',
      value: String(snapshot.in_progress),
      sub: 'confirmed or active',
      tone: snapshot.in_progress > 0 ? 'text-amber-300' : 'text-white/60',
    },
    {
      label: "Today's jobs",
      value: String(snapshot.jobs_today),
      sub: 'scheduled today',
      tone: snapshot.jobs_today > 0 ? 'text-sky-300' : 'text-white/60',
    },
  ];

  return (
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {cells.map((c) => (
        <div key={c.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{c.label}</p>
          <p className={`mt-1 text-xl font-semibold tabular-nums ${c.tone}`}>{c.value}</p>
          <p className="mt-0.5 text-[11px] text-white/40">{c.sub}</p>
        </div>
      ))}
    </section>
  );
}

/* ── next recommended action ─────────────────────────────────────────────── */

function deriveNextAction(
  commandState: MissionControlHealth,
  queue: BudOsQueueItem[],
): { text: string; detail?: string; urgent: boolean } {
  if (commandState.deployment.status === 'failed') {
    return { text: 'Check deployment — latest deploy failed', urgent: true };
  }
  if (commandState.counts.broken_agents > 0) {
    const n = commandState.counts.broken_agents;
    return {
      text: `Investigate ${n} broken agent${n > 1 ? 's' : ''}`,
      detail: commandState.agents_needing_attention.slice(0, 3).join(', ') || undefined,
      urgent: true,
    };
  }
  const topItem = queue[0];
  if (commandState.approvals.total_pending > 0 && topItem) {
    const n = commandState.approvals.total_pending;
    return {
      text: `Review: ${topItem.title}`,
      detail: n > 1 ? `${n} items in the approval queue` : undefined,
      urgent: false,
    };
  }
  if (commandState.counts.failed_runs > 5) {
    return {
      text: `${commandState.counts.failed_runs} recent run failures — check agent health tab`,
      urgent: false,
    };
  }
  if (commandState.counts.watch_agents > 0) {
    const n = commandState.counts.watch_agents;
    return {
      text: `${n} agent${n > 1 ? 's' : ''} on watch — monitor for continued failures`,
      urgent: false,
    };
  }
  return { text: 'System nominal — no immediate action required', urgent: false };
}

function NextAction({
  commandState,
  queue,
}: {
  commandState: MissionControlHealth;
  queue: BudOsQueueItem[];
}) {
  const action = deriveNextAction(commandState, queue);
  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
        Next Recommended Action
      </p>
      <p className={`text-sm font-medium ${action.urgent ? 'text-white' : 'text-white/65'}`}>
        {action.urgent && (
          <span className="mr-2 inline-flex items-center rounded border border-red-400/40 bg-red-500/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-red-400">
            Urgent
          </span>
        )}
        {action.text}
      </p>
      {action.detail && (
        <p className="mt-1 text-xs text-white/40">{action.detail}</p>
      )}
    </section>
  );
}

/* ── verdict helper ──────────────────────────────────────────────────────── */

type VerdictResult = {
  label: string;
  reason: string;
  containerTone: string;
  chipTone: string;
};

function deriveVerdict(approval: BudOsQueueItem['approval']): VerdictResult {
  if (!approval) {
    return {
      label: 'Needs investigation',
      reason: 'Not enough information to make a decision yet. Ask Bud to investigate first.',
      containerTone: 'border-white/10 bg-white/[0.02]',
      chipTone: 'border-white/20 text-white/55',
    };
  }

  const summary = approval.readiness_summary?.trim() || '';

  if (approval.readiness === 'blocked') {
    return {
      label: 'Do not approve',
      reason: summary || 'Something is blocking this change. Investigate and resolve the blocker before approving.',
      containerTone: 'border-red-400/30 bg-red-500/[0.05]',
      chipTone: 'border-red-400/40 bg-red-500/[0.08] text-red-300',
    };
  }
  if (approval.truth_label === 'Archived') {
    return {
      label: 'Archived',
      reason: 'This approval is historical and is no longer a live decision.',
      containerTone: 'border-white/10 bg-white/[0.02]',
      chipTone: 'border-white/20 text-white/55',
    };
  }
  if (approval.truth_label === 'Blocked') {
    return {
      label: 'Blocked',
      reason: summary || 'This approval is stale or missing execution proof. It must not be approved without a fresh task, diff, or PR.',
      containerTone: 'border-red-400/30 bg-red-500/[0.05]',
      chipTone: 'border-red-400/40 bg-red-500/[0.08] text-red-300',
    };
  }
  if (approval.readiness === 'awaiting_diff') {
    return {
      label: 'Hold — no diff',
      reason: summary || 'High-risk change with no code diff or linked PR. Do not approve until the exact changes are visible.',
      containerTone: 'border-amber-400/25 bg-amber-500/[0.04]',
      chipTone: 'border-amber-400/40 bg-amber-500/[0.08] text-amber-300',
    };
  }
  if (approval.linked_pr) {
    return {
      label: 'Review PR first',
      reason: summary || 'There is a linked pull request with the actual code diff. Read it before approving — the PR is the source of truth for what will land in production.',
      containerTone: 'border-sky-400/25 bg-sky-500/[0.04]',
      chipTone: 'border-sky-400/40 bg-sky-500/[0.08] text-sky-300',
    };
  }
  if (approval.risk_level === 'high' || approval.risk_level === 'critical') {
    return {
      label: 'Needs review',
      reason: summary || 'High-risk change. Read the proposed steps above carefully. If the change is not specific and concrete, reject and ask for a PR first.',
      containerTone: 'border-orange-400/25 bg-orange-500/[0.04]',
      chipTone: 'border-orange-400/40 bg-orange-500/[0.08] text-orange-300',
    };
  }
  if (approval.readiness === 'ready' && (approval.risk_level === 'low' || approval.risk_level === 'medium')) {
    return {
      label: 'Safe to approve',
      reason: summary || 'Low blast radius, fully drafted, and gated. Review the steps above, then approve if they look correct.',
      containerTone: 'border-emerald-400/25 bg-emerald-500/[0.04]',
      chipTone: 'border-emerald-400/40 bg-emerald-500/[0.08] text-emerald-300',
    };
  }
  return {
    label: 'Needs review',
    reason: summary || 'Read the proposed change above before deciding. Approve only if the steps are specific and you understand the impact.',
    containerTone: 'border-white/10 bg-white/[0.02]',
    chipTone: 'border-white/20 text-white/55',
  };
}

/* ── 3. action queue ─────────────────────────────────────────────────────── */

const APPROVAL_ACTION_TYPES = new Set([
  'send_email',
  'send_messenger',
  'approve_repair_plan',
  'approve_ux_evolution_plan',
  'approve_deployment_plan',
  'run_improvement_pipeline',
  'flag_for_review',
]);

type QueueBucket = 'approval' | 'operational' | 'observation' | 'watch';

function classifyQueueItem(item: BudOsQueueItem): QueueBucket {
  if (item.approval && APPROVAL_ACTION_TYPES.has(item.approval.action_type)) return 'approval';
  if (item.source === 'bud_insight' || item.source === 'ux_evolution') return 'observation';
  if (item.group === 'watch_items') return 'watch';
  if (item.source === 'agent_health') return 'operational';
  if (item.approval) return 'approval';
  return 'operational';
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function deriveDeduplicateKey(item: BudOsQueueItem): string {
  const approval = item.approval;
  if (!approval) {
    return `${item.source}:${item.agent_id ?? ''}:${normalizeTitle(item.title)}`;
  }
  const at = approval.action_type;
  const p = approval.payload ?? {};
  if (at === 'send_email') {
    const recipient = String(p['to'] ?? p['recipient'] ?? p['email'] ?? '').toLowerCase().trim();
    const subject = normalizeTitle(String(p['subject'] ?? item.title));
    const ref = String(p['quote_id'] ?? p['lead_id'] ?? p['order_id'] ?? '');
    return `send_email:${ref}:${recipient}:${subject}`;
  }
  if (at === 'flag_for_review') {
    return `flag_for_review:${approval.source_agent ?? ''}:${approval.affected_area ?? ''}:${normalizeTitle(item.title)}`;
  }
  if (approval.target_table && approval.target_id) {
    return `${at}:${approval.target_table}:${approval.target_id}`;
  }
  return item.id;
}

type DedupedQueueItem = {
  item: BudOsQueueItem;
  duplicateCount: number;
  duplicateIds: string[];
};

function deduplicateQueueBucket(items: BudOsQueueItem[]): DedupedQueueItem[] {
  const groups = new Map<string, BudOsQueueItem[]>();
  for (const it of items) {
    const key = deriveDeduplicateKey(it);
    const existing = groups.get(key);
    if (existing) {
      existing.push(it);
    } else {
      groups.set(key, [it]);
    }
  }
  return Array.from(groups.values()).map((group) => {
    const representative = group.reduce((latest, cur) =>
      new Date(cur.created_at).getTime() > new Date(latest.created_at).getTime() ? cur : latest,
    );
    return {
      item: representative,
      duplicateCount: group.length,
      duplicateIds: group.map((i) => i.id),
    };
  });
}

function QueueItemRow({
  item,
  active,
  investigating,
  duplicateCount,
  onSelect,
  onApprove,
  onReject,
  onInvestigate,
}: {
  item: BudOsQueueItem;
  active: boolean;
  investigating: boolean;
  duplicateCount: number;
  onSelect: (item: BudOsQueueItem) => void;
  onApprove: (item: BudOsQueueItem) => void;
  onReject: (item: BudOsQueueItem) => void;
  onInvestigate: (item: BudOsQueueItem) => void;
}) {
  const weight = SEVERITY_TONE[item.severity];
  const approval = item.approval;
  const notReady = approval
    ? approval.readiness !== 'ready' || approval.truth_label === 'Blocked' || approval.truth_label === 'Archived'
    : false;
  const plan = approval?.proposed_plan ?? [];
  const files = approval?.affected_files ?? [];
  const description = approval?.full_description ?? '';
  const isImprovementApproval = approval?.action_type === 'run_improvement_pipeline';
  const hasDetail = plan.length > 0 || files.length > 0 || description.length > 60 || isImprovementApproval;
  return (
    <li>
      {/* Row */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(item)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(item); }}
        className={`group flex w-full cursor-pointer items-start gap-3 px-5 py-3.5 text-left transition ${
          active ? 'bg-sky-500/[0.04]' : 'hover:bg-white/[0.025]'
        }`}
      >
        <span className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${weight.tone}`}>
          {weight.label}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{item.title}</p>
          <p className="mt-1 line-clamp-1 text-xs text-white/55">{item.detail}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-white/40">
            {item.agent_name && <span>{item.agent_name}</span>}
            {item.agent_name && <span>·</span>}
            <span>{item.status}</span>
            {approval && (
              <>
                <span>·</span>
                <span className={`rounded-full border px-1.5 py-px font-semibold ${APPROVAL_TRUTH_TONE[approval.truth_label]}`}>
                  {approval.truth_label}
                </span>
              </>
            )}
            {approval && (
              <>
                <span>·</span>
                <span className={notReady ? 'text-amber-300/80' : 'text-emerald-300/80'}>
                  {approval.readiness_summary}
                </span>
              </>
            )}
            {duplicateCount > 1 && (
              <>
                <span>·</span>
                <span className="rounded border border-white/15 bg-white/[0.04] px-1.5 py-px text-white/50">
                  +{duplicateCount - 1} similar
                </span>
              </>
            )}
            {hasDetail && !active && (
              <span className="text-sky-400/60">· click to expand</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          {approval ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (notReady) { toast.error(approval.readiness_summary || 'Not ready to approve — expand for details.'); return; }
                onApprove(item);
              }}
              disabled={notReady}
              className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Approve
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onInvestigate(item); }}
              disabled={investigating}
              className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-white/75 transition hover:bg-white/[0.08] disabled:opacity-50"
            >
              {investigating ? 'Working…' : 'Investigate'}
            </button>
          )}
        </div>
      </div>

      {/* Expansion drawer */}
      {active && hasDetail && (
        <div className="border-t border-white/[0.05] bg-black/20 px-5 py-4 space-y-5">

          {/* ── 1. The idea ── */}
          {description && description !== item.title && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35 mb-1.5">The idea</p>
              <p className="text-sm leading-relaxed text-white/80">{description}</p>
            </div>
          )}

          {/* ── 2. Improvement evidence metadata ── */}
          {isImprovementApproval && approval && (() => {
            const conf = approval.confidence != null
              ? `${Math.round(approval.confidence * 100)}%`
              : null;
            const risk = approval.risk_level;
            const riskWeight = risk ? SEVERITY_TONE[risk as keyof typeof SEVERITY_TONE] : null;
            const agentLabel = approval.source_agent ?? approval.affected_area ?? null;
            const pr = approval.linked_pr;
            return (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35 mb-2">Evidence summary</p>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-white/30 mb-0.5">Confidence</dt>
                    <dd className={conf ? 'font-medium text-white/80' : 'text-white/30 italic'}>{conf ?? 'Not provided'}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-white/30 mb-0.5">Risk level</dt>
                    <dd>
                      {riskWeight
                        ? <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${riskWeight.tone}`}>{riskWeight.label}</span>
                        : <span className="text-white/30 italic">Not provided</span>
                      }
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-white/30 mb-0.5">Expected impact</dt>
                    <dd className="text-white/30 italic">Not provided</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-white/30 mb-0.5">Affected agent</dt>
                    <dd className={agentLabel ? 'font-medium text-white/80' : 'text-white/30 italic'}>{agentLabel ?? 'Not provided'}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-white/30 mb-0.5">Why approval required</dt>
                    <dd className="text-white/30 italic">Not provided</dd>
                  </div>
                  {pr && (
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-white/30 mb-0.5">Pull request</dt>
                      <dd>
                        <a
                          href={pr}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-sky-400 underline-offset-2 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {pr}
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            );
          })()}

          {/* ── 3. What it actually does ── */}
          {(plan.length > 0 || files.length > 0) && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35 mb-1.5">What it actually does</p>
              {plan.length > 0 && (
                <ol className="space-y-1.5 mb-2">
                  {plan.map((step, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-white/75">
                      <span className="mt-px shrink-0 rounded bg-white/[0.06] px-1.5 py-px text-[10px] font-semibold tabular-nums text-white/40">{i + 1}</span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              )}
              {files.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[11px] text-white/35 self-center mr-1">Files:</span>
                  {files.map((f) => (
                    <span key={f} className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-sky-300/80">{f}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── 4. Verdict ── */}
          {approval && (() => {
            const verdict = deriveVerdict(approval);
            return (
              <div className={`rounded-xl border px-4 py-3 ${verdict.containerTone}`}>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Verdict</p>
                  <span className={`rounded-full border px-2 py-px text-[10px] font-semibold uppercase tracking-wider ${verdict.chipTone}`}>
                    {verdict.label}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-white/75">{verdict.reason}</p>
              </div>
            );
          })()}

          {/* ── 5. Decision buttons ── */}
          {approval && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (notReady) { toast.error(approval.readiness_summary || 'Not ready to approve — see the verdict above.'); return; }
                  onApprove(item);
                }}
                disabled={notReady}
                className="flex-1 rounded-lg border border-emerald-400/40 bg-emerald-500/10 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Approve
              </button>
              <button
                onClick={() => onReject(item)}
                className="flex-1 rounded-lg border border-red-400/30 bg-red-500/[0.06] py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/10"
              >
                Reject
              </button>
            </div>
          )}
          {!approval && (
            <button
              onClick={() => onInvestigate(item)}
              disabled={investigating}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-2 text-sm font-semibold text-white/75 transition hover:bg-white/[0.08] disabled:opacity-50"
            >
              {investigating ? 'Working…' : 'Ask Bud to investigate and propose a fix'}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

type QueueSubSectionHandlers = {
  selectedId: string | null;
  investigatingIds: Set<string>;
  onSelect: (item: BudOsQueueItem) => void;
  onApprove: (item: BudOsQueueItem) => void;
  onReject: (item: BudOsQueueItem) => void;
  onInvestigate: (item: BudOsQueueItem) => void;
};

function QueueSubSection({
  title,
  description,
  count,
  countTone,
  items,
  selectedId,
  investigatingIds,
  onSelect,
  onApprove,
  onReject,
  onInvestigate,
}: {
  title: string;
  description: string;
  count: number;
  countTone: string;
  items: DedupedQueueItem[];
} & QueueSubSectionHandlers) {
  return (
    <div>
      <header className="flex items-center justify-between border-b border-white/[0.05] px-5 py-3">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">{title}</h3>
          <p className="mt-0.5 text-xs text-white/40">{description}</p>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${countTone}`}>
          {count}
        </span>
      </header>
      <ul className="divide-y divide-white/[0.05]">
        {items.map((di) => (
          <QueueItemRow
            key={di.item.id}
            item={di.item}
            active={di.item.id === selectedId}
            investigating={investigatingIds.has(di.item.id)}
            duplicateCount={di.duplicateCount}
            onSelect={onSelect}
            onApprove={onApprove}
            onReject={onReject}
            onInvestigate={onInvestigate}
          />
        ))}
      </ul>
    </div>
  );
}

function ActionQueue({
  queue,
  selectedId,
  investigatingIds,
  onSelect,
  onApprove,
  onReject,
  onInvestigate,
}: {
  queue: BudOsQueueItem[];
  selectedId: string | null;
  investigatingIds: Set<string>;
  onSelect: (item: BudOsQueueItem) => void;
  onApprove: (item: BudOsQueueItem) => void;
  onReject: (item: BudOsQueueItem) => void;
  onInvestigate: (item: BudOsQueueItem) => void;
}) {
  const approvals    = deduplicateQueueBucket(queue.filter((i) => classifyQueueItem(i) === 'approval')).slice(0, 10);
  const operational  = deduplicateQueueBucket(queue.filter((i) => classifyQueueItem(i) === 'operational')).slice(0, 10);
  const observations = deduplicateQueueBucket(queue.filter((i) => classifyQueueItem(i) === 'observation')).slice(0, 10);
  const watchItems   = deduplicateQueueBucket(queue.filter((i) => classifyQueueItem(i) === 'watch')).slice(0, 10);
  const isEmpty = approvals.length + operational.length + observations.length + watchItems.length === 0;

  const handlers: QueueSubSectionHandlers = {
    selectedId, investigatingIds, onSelect, onApprove, onReject, onInvestigate,
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] divide-y divide-white/[0.05]">
      {isEmpty ? (
        <div className="px-5 py-8 text-center text-sm text-white/45">No action items. Bud is on watch.</div>
      ) : (
        <>
          {approvals.length > 0 && (
            <QueueSubSection
              title="Needs approval"
              description="Actions awaiting your decision."
              count={approvals.length}
              countTone="border-yellow-300/25 bg-yellow-300/[0.06] text-yellow-200"
              items={approvals}
              {...handlers}
            />
          )}
          {operational.length > 0 && (
            <QueueSubSection
              title="Operational issues"
              description="Broken or failing agents that need attention."
              count={operational.length}
              countTone="border-red-400/30 bg-red-500/[0.06] text-red-300"
              items={operational}
              {...handlers}
            />
          )}
          {observations.length > 0 && (
            <QueueSubSection
              title="Observations"
              description="Insights and system observations."
              count={observations.length}
              countTone="border-sky-400/25 bg-sky-500/[0.06] text-sky-300"
              items={observations}
              {...handlers}
            />
          )}
          {watchItems.length > 0 && (
            <QueueSubSection
              title="Watch list"
              description="Agents on watch — monitor for continued issues."
              count={watchItems.length}
              countTone="border-amber-400/25 bg-amber-500/[0.06] text-amber-300"
              items={watchItems}
              {...handlers}
            />
          )}
        </>
      )}
    </section>
  );
}

/* ── 4. agent value ──────────────────────────────────────────────────────── */

const VALUE_LABEL: Record<AgentBizValue, string> = { high: 'High', medium: 'Medium', low: 'Low' };
const STATUS_LABEL: Record<AgentStatusDerived, string> = {
  healthy: 'Healthy', watch: 'Watch', failing: 'Failing', disabled: 'Disabled',
};

function AgentValue({
  agents,
  agentImpact,
}: {
  agents: MissionControlHealth['agents'];
  agentImpact?: AgentImpactMap;
}) {
  type Classified = MissionControlHealth['agents'][number] & {
    bizValue: AgentBizValue;
    displayStatus: AgentStatusDerived;
  };

  const classified: Classified[] = agents
    .map((a) => ({ ...a, bizValue: deriveAgentBizValue(a.id), displayStatus: deriveAgentDisplayStatus(a) }))
    .sort((a, b) => {
      const order: Record<AgentBizValue, number> = { high: 0, medium: 1, low: 2 };
      return order[a.bizValue] - order[b.bizValue];
    });

  const featured = classified.filter((a) => a.bizValue !== 'low');
  const low = classified.filter((a) => a.bizValue === 'low');
  const lowNeedAttention = low.filter((a) => a.displayStatus === 'failing' || a.displayStatus === 'watch');

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02]">
      <header className="flex items-center justify-between border-b border-white/[0.05] px-5 py-3">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">Agent value</h3>
          <p className="mt-0.5 text-xs text-white/40">High-value agents drive core business operations.</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] font-medium text-white/65">
          {agents.length} agents
        </span>
      </header>
      <ul className="divide-y divide-white/[0.05]">
        {featured.length === 0 && (
          <li className="px-5 py-6 text-center text-sm text-white/40">No agents classified as high or medium value.</li>
        )}
        {featured.map((agent) => (
          <li key={agent.id} className="flex items-center gap-3 px-5 py-3">
            <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${VALUE_TONE[agent.bizValue]}`}>
              {VALUE_LABEL[agent.bizValue]}
            </span>
            <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${AGENT_STATUS_TONE[agent.displayStatus]}`}>
              {STATUS_LABEL[agent.displayStatus]}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{agent.name}</span>
            <div className="flex shrink-0 items-center gap-4 text-xs tabular-nums text-white/50">
              <span>{agent.last_run_at ? relativeTime(agent.last_run_at) : 'Never'}</span>
              <span className={agent.failures_7d > 0 ? 'text-red-300/80' : ''}>{agent.failures_7d} err</span>
              {(() => {
                const imp = agentImpact?.[agent.id];
                if (!imp) return <span className="italic text-white/30">–</span>;
                return (
                  <>
                    <span title="Successful outputs (30d)">{imp.outputs_last_30d} out</span>
                    <span title="Actions proposed (30d)" className="hidden sm:inline">{imp.actions_last_30d} act</span>
                    <span title="Actions approved (30d)" className="hidden md:inline">{imp.approvals_last_30d} appr</span>
                  </>
                );
              })()}
            </div>
            <span className="hidden xl:block shrink-0 max-w-[200px] truncate text-xs text-white/40">
              {agent.recommended_action}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.05] px-5 py-2.5">
        <span className="text-[11px] italic text-white/30">out = succeeded runs · act = actions proposed · appr = actions approved · quotes/leads/jobs — Not available</span>
        {low.length > 0 && (
          <span className="text-[11px] text-white/40">
            {low.length} low-value agents
            {lowNeedAttention.length > 0 && (
              <span className="ml-1.5 text-amber-300/70">· {lowNeedAttention.length} need attention</span>
            )}
          </span>
        )}
      </div>
    </section>
  );
}

/* ── 5. live activity ────────────────────────────────────────────────────── */

function ActivityFeed({ activity }: { activity: BudActivityEvent[] }) {
  const items = activity.slice(0, 12);
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <header>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">Live activity</h3>
        <p className="mt-0.5 text-xs text-white/40">Real events from the activity feed.</p>
      </header>
      <ul className="mt-3 space-y-2.5">
        {items.length === 0 && (
          <li className="text-xs text-white/40">No activity recorded yet.</li>
        )}
        {items.map((e) => (
          <li key={e.id} className="flex items-start gap-3 text-sm">
            <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
            <div className="min-w-0 flex-1">
              <p className="leading-snug text-white/80">{e.narrative}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-white/35">
                {e.actor ? `${e.actor} · ` : ''}<span suppressHydrationWarning>{relativeTime(e.created_at)}</span>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── 5. deployment ───────────────────────────────────────────────────────── */

function Deployment({
  commandState,
  activity,
}: {
  commandState: MissionControlHealth;
  activity: BudActivityEvent[];
}) {
  const dep = commandState.deployment;
  const recent = activity.filter((e) => e.event_type === 'deployment').slice(0, 4);
  const stateTone =
    dep.status === 'failed' ? 'border-red-400/40 bg-red-500/[0.06] text-red-300'
    : dep.status === 'deploying' ? 'border-sky-400/30 bg-sky-500/[0.06] text-sky-300'
    : dep.status === 'stale' ? 'border-amber-400/30 bg-amber-500/[0.06] text-amber-300'
    : dep.status === 'healthy' ? 'border-emerald-400/30 bg-emerald-500/[0.06] text-emerald-300'
    : 'border-white/10 bg-white/[0.02] text-white/55';

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">Deployment</h3>
          <p className="mt-0.5 text-xs text-white/40">Latest deploy telemetry.</p>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${stateTone}`}>
          {dep.status}
        </span>
      </header>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Last success</p>
          <p suppressHydrationWarning className="mt-1 text-sm text-white/80">{relativeTime(dep.last_success_at, 'Telemetry unavailable')}</p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Last failure</p>
          <p suppressHydrationWarning className="mt-1 text-sm text-white/80">{relativeTime(dep.last_failure_at, 'Telemetry unavailable')}</p>
        </div>
      </div>
      {recent.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-xs">
          {recent.map((e) => (
            <li key={e.id} className="flex items-start gap-2 text-white/70">
              <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-sky-400" />
              <span className="min-w-0 flex-1">
                <span className="text-white/85">{e.narrative}</span>
                <span suppressHydrationWarning className="ml-2 text-white/35">{relativeTime(e.created_at)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {dep.summary && (
        <p className="mt-3 rounded-lg border border-white/[0.06] bg-black/20 p-3 text-xs text-white/65">{dep.summary}</p>
      )}
    </section>
  );
}
