'use client';

import { relativeTime } from './_utils';

/**
 * Mission Control — Overview v2
 *
 * Operator-facing cockpit. Surfaces:
 *   - One global truth state at the top (Healthy / Degraded / Blocked / Recovering)
 *   - Ask Bud (centerpiece input that delegates to existing /api/bud/command)
 *   - Cockpit summary + 1-3 recommended operator actions
 *   - Operational Risk strip (Revenue / UX / Deployment / Conversion / Crew)
 *   - Action queue ranked by severity, with severity weighting
 *   - Hard execution states (Proposed → Patched → Tested → Approved → Deployed → Verified)
 *   - Evidence-tied confidence breakdown
 *   - Compressed horizontal pipeline with expandable drawers
 *   - Systems map of affected areas
 *   - Verified production outcomes (post-deploy wins)
 *   - Proactive forecasts
 *   - Structured operational summaries instead of raw thought logs
 *
 * No "AI theatre" language. Hides any gate that hasn't been reached.
 */

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { MissionControlHealth } from '@/lib/bud/health';
import type { BudActivityEvent } from '@/lib/bud/types';
import type { BudOsQueueItem, BudOsRepairWorkspace } from '@/lib/bud/os-view-model';
import type { StructuredFailure } from '@/lib/bud/structured-failure';
import type { BudThought } from '@/lib/bud/thought-stream';
import type { UxEvolutionRecommendation } from '@/lib/bud/ux-evolution-engine';
import {
  activeCapabilities,
  buildCockpitSummary,
  buildOperationalSummaries,
  classifyIntent,
  deduplicateSignals,
  deriveConfidence,
  deriveCustomerImpact,
  deriveExecutionStates,
  deriveForecasts,
  derivePreflight,
  deriveGlobalTruth,
  deriveHealthDimensions,
  deriveOperationalRisk,
  deriveOrchestrationPhases,
  deriveSystemsMap,
  deriveVerifiedOutcomes,
  type CanonicalIncident,
  type ExecutionState,
  type GlobalTruthState,
  type OpRiskLevel,
  type OrchestrationPhase,
} from '@/lib/bud/overview-v2';

/* ────────────────────────────────────────────────────────────────────────── */
/*                              VISUAL TOKENS                                 */
/* ────────────────────────────────────────────────────────────────────────── */

const TRUTH_TONE: Record<GlobalTruthState, { ring: string; text: string; dot: string; barBg: string; bar: string }> = {
  healthy: { ring: 'ring-emerald-400/30', text: 'text-emerald-300', dot: 'bg-emerald-400', barBg: 'bg-emerald-500/15', bar: 'bg-emerald-400' },
  degraded: { ring: 'ring-amber-400/30', text: 'text-amber-300', dot: 'bg-amber-400', barBg: 'bg-amber-500/15', bar: 'bg-amber-400' },
  approval: { ring: 'ring-yellow-300/30', text: 'text-yellow-200', dot: 'bg-yellow-300', barBg: 'bg-yellow-300/15', bar: 'bg-yellow-300' },
  recovering: { ring: 'ring-sky-400/30', text: 'text-sky-300', dot: 'bg-sky-400', barBg: 'bg-sky-500/15', bar: 'bg-sky-400' },
  blocked: { ring: 'ring-red-400/40', text: 'text-red-300', dot: 'bg-red-400', barBg: 'bg-red-500/15', bar: 'bg-red-400' },
};

const RISK_TONE: Record<OpRiskLevel, { text: string; chip: string; bar: string }> = {
  low: { text: 'text-emerald-300', chip: 'border-emerald-400/30 bg-emerald-500/[0.06]', bar: 'bg-emerald-400' },
  medium: { text: 'text-amber-300', chip: 'border-amber-400/30 bg-amber-500/[0.06]', bar: 'bg-amber-400' },
  high: { text: 'text-orange-300', chip: 'border-orange-400/40 bg-orange-500/[0.06]', bar: 'bg-orange-400' },
  critical: { text: 'text-red-300', chip: 'border-red-400/50 bg-red-500/[0.08]', bar: 'bg-red-400' },
};

const SEVERITY_WEIGHT: Record<BudOsQueueItem['severity'], { label: string; tone: string }> = {
  critical: { label: 'Critical', tone: 'border-red-400/50 text-red-300 bg-red-500/[0.06]' },
  high: { label: 'Major', tone: 'border-orange-400/40 text-orange-300 bg-orange-500/[0.06]' },
  medium: { label: 'Medium', tone: 'border-amber-400/30 text-amber-300 bg-amber-500/[0.06]' },
  low: { label: 'Observation', tone: 'border-white/15 text-white/55 bg-white/[0.02]' },
};

const PIPELINE_ORDER: ExecutionState[] = ['proposed', 'patched', 'tested', 'approved', 'deployed', 'verified'];
const PIPELINE_LABEL: Record<ExecutionState, string> = {
  proposed: 'Proposed',
  patched: 'Patched',
  tested: 'Tested',
  approved: 'Approved',
  deployed: 'Deployed',
  verified: 'Verified',
};

const ORCHESTRATION_LABEL: Record<OrchestrationPhase, string> = {
  investigation: 'Investigation',
  root_cause: 'Root cause',
  diff_generated: 'Diff generated',
  sandbox_validation: 'Sandbox validation',
  ux_review: 'UX review',
  browser_simulation: 'Browser simulation',
  human_approval: 'Human approval',
  deploy: 'Deploy',
  live_verification: 'Live verification',
};

/* ────────────────────────────────────────────────────────────────────────── */
/*                                PROPS                                       */
/* ────────────────────────────────────────────────────────────────────────── */

type Props = {
  commandState: MissionControlHealth;
  queue: BudOsQueueItem[];
  workspace: BudOsRepairWorkspace;
  failures: StructuredFailure[];
  thoughts: BudThought[];
  activity: BudActivityEvent[];
  uxEvolution: UxEvolutionRecommendation[];
  onSelect: (item: BudOsQueueItem) => void;
  onApprove: (item: BudOsQueueItem) => void;
  onInvestigate: (item: BudOsQueueItem) => void;
  selectedId: string | null;
  investigatingIds: Set<string>;
};

/* ────────────────────────────────────────────────────────────────────────── */
/*                                COMPONENT                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export function OverviewV2(props: Props) {
  const {
    commandState,
    queue,
    workspace,
    failures,
    thoughts,
    activity,
    uxEvolution,
    onSelect,
    onApprove,
    onInvestigate,
    selectedId,
    investigatingIds,
  } = props;

  const truth = useMemo(() => deriveGlobalTruth(commandState), [commandState]);
  const risk = useMemo(
    () => deriveOperationalRisk({ commandState, failures, queue, uxEvolution }),
    [commandState, failures, queue, uxEvolution],
  );
  const incidents = useMemo(() => deduplicateSignals(queue), [queue]);
  const cockpit = useMemo(
    () => buildCockpitSummary({ truth, commandState, incidents, risk }),
    [truth, commandState, incidents, risk],
  );
  const summaries = useMemo(
    () => buildOperationalSummaries({ thoughts, failures, commandState, limit: 6 }),
    [thoughts, failures, commandState],
  );
  const execStates = useMemo(() => deriveExecutionStates(workspace), [workspace]);
  const orchestration = useMemo(() => deriveOrchestrationPhases(workspace), [workspace]);
  const confidence = useMemo(() => deriveConfidence(workspace), [workspace]);
  const map = useMemo(() => deriveSystemsMap(commandState), [commandState]);
  const forecasts = useMemo(
    () => deriveForecasts({ commandState, failures, risk }),
    [commandState, failures, risk],
  );
  const outcomes = useMemo(
    () => deriveVerifiedOutcomes({ commandState, activity }),
    [commandState, activity],
  );
  const customerImpact = useMemo(
    () => deriveCustomerImpact({ failures, uxEvolution, commandState }),
    [failures, uxEvolution, commandState],
  );
  const capabilities = useMemo(() => activeCapabilities(commandState), [commandState]);
  const dimensions = useMemo(
    () => deriveHealthDimensions({ commandState, failures, uxEvolution }),
    [commandState, failures, uxEvolution],
  );
  const preflight = useMemo(
    () => derivePreflight({ commandState, incident: incidents[0] ?? null }),
    [commandState, incidents],
  );

  return (
    <div className="space-y-5">
      {/* ── 1. Global truth + cockpit summary + Ask Bud ──────────────────── */}
      <GlobalTruthCockpit
        truth={truth}
        cockpit={cockpit}
        commandState={commandState}
        capabilities={capabilities}
        dimensions={dimensions}
        onJumpTo={(id) => {
          const target = queue.find((q) => q.id === id);
          if (target) onSelect(target);
        }}
      />

      {/* ── 2. Operational risk strip ───────────────────────────────────── */}
      <OperationalRisk risk={risk} />

      {/* ── 3. Action queue + pipeline ──────────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-[1fr_1.05fr]">
        <ActionQueueV2
          incidents={incidents.slice(0, 8)}
          selectedId={selectedId}
          investigatingIds={investigatingIds}
          onSelect={onSelect}
          onApprove={onApprove}
          onInvestigate={onInvestigate}
        />
        <PipelineCard
          workspace={workspace}
          execStates={execStates}
          orchestration={orchestration}
          confidence={confidence}
          preflight={preflight}
        />
      </div>

      {/* ── 4. Operational summary + forecasts ──────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <OperationalSummaryCard summaries={summaries} />
        <ForecastCard forecasts={forecasts} />
      </div>

      {/* ── 5. Systems map + customer impact ────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <SystemsMapCard nodes={map} />
        <CustomerImpactCard signals={customerImpact} />
      </div>

      {/* ── 6. Deployment timeline + rollback readiness ─────────────────── */}
      <DeploymentTimelineCard
        commandState={commandState}
        workspace={workspace}
        activity={activity}
      />

      {/* ── 7. Verified outcomes ────────────────────────────────────────── */}
      <VerifiedOutcomesCard outcomes={outcomes} />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                          GLOBAL TRUTH + COCKPIT                            */
/* ────────────────────────────────────────────────────────────────────────── */

function GlobalTruthCockpit({
  truth,
  cockpit,
  commandState,
  capabilities,
  dimensions,
  onJumpTo,
}: {
  truth: ReturnType<typeof deriveGlobalTruth>;
  cockpit: ReturnType<typeof buildCockpitSummary>;
  commandState: MissionControlHealth;
  capabilities: ReturnType<typeof activeCapabilities>;
  dimensions: ReturnType<typeof deriveHealthDimensions>;
  onJumpTo: (id: string) => void;
}) {
  const tone = TRUTH_TONE[truth.state];
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const [response, setResponse] = useState<string | null>(null);

  async function ask(question: string) {
    const text = question.trim();
    if (!text) return;
    setBusy(true);
    setResponse(null);
    try {
      const res = await fetch('/api/bud/command', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ command: text }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Bud could not answer');
      setResponse(body?.bud_response?.message ?? 'Bud accepted the request.');
      setDraft('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bud could not answer');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 ring-1 ${tone.ring}`}>
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        {/* Left — state */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className={`inline-flex h-2.5 w-2.5 rounded-full ${tone.dot}`} />
            <span className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${tone.text}`}>{truth.headline}</span>
          </div>
          <div>
            <h2 className="text-[26px] font-semibold leading-tight tracking-tight text-white">{cockpit.headline}</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/65">{cockpit.body}</p>
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
          <div className="grid gap-2 sm:grid-cols-2">
            {dimensions.map((dimension) => {
              const dimensionTone = TRUTH_TONE[dimension.state];
              return (
                <div key={dimension.key} className={`rounded-lg border border-white/[0.06] bg-black/20 p-3 ring-1 ring-inset ${dimensionTone.ring}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{dimension.label}</span>
                    <span className={`h-1.5 w-1.5 rounded-full ${dimensionTone.dot}`} />
                  </div>
                  <p className="mt-1 text-sm font-semibold text-white">{dimension.value}</p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-white/45">{dimension.detail}</p>
                </div>
              );
            })}
          </div>
          {capabilities.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {capabilities.slice(0, 4).map((cap) => (
                <span
                  key={cap.capability}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                    cap.level === 'attention'
                      ? 'border-amber-400/30 bg-amber-500/[0.06] text-amber-300'
                      : cap.level === 'active'
                        ? 'border-sky-400/30 bg-sky-500/[0.06] text-sky-300'
                        : 'border-white/10 bg-white/[0.02] text-white/55'
                  }`}
                >
                  <span className={`inline-block h-1 w-1 rounded-full ${cap.level === 'attention' ? 'bg-amber-400' : cap.level === 'active' ? 'bg-sky-400' : 'bg-white/40'}`} />
                  {cap.capability}
                </span>
              ))}
            </div>
          )}
        </div>
        {/* Right — Ask Bud */}
        <div className="flex flex-col gap-3">
          <label htmlFor="ov2-ask" className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">
            Ask Bud about anything on this page
          </label>
          <div className="flex gap-2">
            <input
              id="ov2-ask"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void ask(draft);
              }}
              placeholder="e.g. Why is conversion at risk?"
              className="h-12 flex-1 rounded-lg border border-white/[0.08] bg-black/30 px-4 text-[15px] text-white outline-none placeholder:text-white/30 focus:border-sky-400/40"
            />
            <button
              onClick={() => void ask(draft)}
              disabled={busy || !draft.trim()}
              className="h-12 rounded-lg bg-white px-5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? 'Thinking…' : 'Ask'}
            </button>
          </div>
          {/* Suggested questions tied to current state */}
          <div className="flex flex-wrap gap-1.5">
            {suggestedQuestions(truth.state, commandState).map((q) => (
              <button
                key={q}
                onClick={() => void ask(q)}
                disabled={busy}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-white/65 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
              >
                {q}
              </button>
            ))}
          </div>
          {response && (
            <p className="rounded-lg border border-white/[0.08] bg-black/25 p-3 text-xs leading-relaxed text-white/75">{response}</p>
          )}
          {/* Recommended actions */}
          {cockpit.recommendations.length > 0 && (
            <div className="mt-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Recommended next moves</div>
              <ul className="mt-2 space-y-1.5">
                {cockpit.recommendations.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => r.linkedItemId && onJumpTo(r.linkedItemId)}
                      className="group flex w-full items-start gap-3 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-left transition hover:border-sky-400/30 hover:bg-sky-500/[0.05]"
                    >
                      <span
                        className={`mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                          r.priority === 'critical'
                            ? 'bg-red-400'
                            : r.priority === 'major'
                              ? 'bg-orange-400'
                              : r.priority === 'medium'
                                ? 'bg-amber-400'
                                : 'bg-white/40'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-white">{r.label}</div>
                        <div className="mt-0.5 line-clamp-1 text-xs text-white/45">{r.reason}</div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function suggestedQuestions(state: GlobalTruthState, c: MissionControlHealth): string[] {
  if (state === 'blocked') return ['What is blocked right now?', 'How do I unblock the next deploy?'];
  if (state === 'approval') return ['What needs approval?', 'Is this safe to approve?'];
  if (state === 'recovering') return ['What is being repaired?', 'When will verification complete?'];
  if (state === 'degraded') return ['What needs my decision?', 'Which capability is hurting customers?'];
  if (c.repair_sessions.length > 0) return ['Show me the last successful repair', 'What did Bud learn this week?'];
  return ['Anything risky for the weekend?', 'Where is conversion right now?'];
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                          OPERATIONAL RISK STRIP                            */
/* ────────────────────────────────────────────────────────────────────────── */

function OperationalRisk({ risk }: { risk: ReturnType<typeof deriveOperationalRisk> }) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Operational risk</h3>
        <span className="text-[11px] text-white/35">Business-side impact, not internal AI process.</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {risk.map((r) => {
          const tone = RISK_TONE[r.level];
          return (
            <div key={r.key} className={`rounded-xl border px-3 py-3 ${tone.chip}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/55">{r.label}</span>
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${tone.text}`}>{r.level}</span>
              </div>
              <p className="mt-2 text-xs leading-snug text-white/75">{r.impact}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                             ACTION QUEUE V2                                */
/* ────────────────────────────────────────────────────────────────────────── */

function ActionQueueV2({
  incidents,
  selectedId,
  investigatingIds,
  onSelect,
  onApprove,
  onInvestigate,
}: {
  incidents: CanonicalIncident[];
  selectedId: string | null;
  investigatingIds: Set<string>;
  onSelect: (item: BudOsQueueItem) => void;
  onApprove: (item: BudOsQueueItem) => void;
  onInvestigate: (item: BudOsQueueItem) => void;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02]">
      <header className="flex items-center justify-between border-b border-white/[0.05] px-5 py-3">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">Needs a decision</h3>
          <p className="mt-0.5 text-xs text-white/40">Ranked by severity. Duplicate signals collapsed.</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] font-medium text-white/65">
          {incidents.length} open
        </span>
      </header>
      <ul className="divide-y divide-white/[0.05]">
        {incidents.length === 0 && (
          <li className="px-5 py-8 text-center text-sm text-white/45">No action items. Bud is on watch.</li>
        )}
        {incidents.map((incident) => {
          const primary = incident.signals[0];
          if (!primary) return null;
          const active = primary.id === selectedId;
          const investigating = investigatingIds.has(primary.id);
          const classified = classifyIntent(primary);
          const isWatch = !classified.shouldTriggerRepair && !primary.approval;
          const weight = isWatch
            ? { label: 'Watch', tone: 'border-sky-400/30 text-sky-300 bg-sky-500/[0.06]' }
            : SEVERITY_WEIGHT[incident.severity];
          return (
            <li key={incident.key}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelect(primary)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(primary); }}
                className={`group flex w-full cursor-pointer items-start gap-3 px-5 py-3.5 text-left transition ${
                  active ? 'bg-sky-500/[0.04]' : 'hover:bg-white/[0.025]'
                }`}
              >
                <span className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${weight.tone}`}>
                  {weight.label}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-white">
                      {incident.occurrences > 1
                        ? `${incident.occurrences} agents affected by identical ${intentLabel(classified.intent).toLowerCase()} issue`
                        : incident.title}
                    </p>
                    {incident.occurrences > 1 && (
                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-1.5 py-px text-[10px] text-white/55">×{incident.occurrences}</span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-white/55">{incident.summary}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-white/40">
                    {incident.agentName && <span>{incident.agentName}</span>}
                    <span>·</span>
                    <span title={classified.reason}>{intentLabel(classified.intent)}</span>
                    <span>·</span>
                    <span className={isWatch ? 'text-sky-300/80' : classified.shouldTriggerRepair ? 'text-amber-300/80' : 'text-white/45'}>
                      {isWatch ? 'Internal optimization only' : classified.shouldTriggerRepair ? 'Repairable' : 'No customer impact'}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  {primary.approval ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (primary.approval && primary.approval.readiness !== 'ready') {
                          toast.error(`Not ready: ${primary.approval.readiness_summary}`);
                          return;
                        }
                        onApprove(primary);
                      }}
                      disabled={primary.approval.readiness !== 'ready'}
                      className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Approve
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onInvestigate(primary);
                      }}
                      disabled={investigating}
                      className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-white/75 transition hover:bg-white/[0.08] disabled:opacity-50"
                    >
                      {investigating ? 'Working…' : 'Investigate'}
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function intentLabel(intent: ReturnType<typeof classifyIntent>['intent']): string {
  return ({
    runtime_error: 'Runtime error',
    infra_failure: 'Infrastructure',
    ux_issue: 'UX issue',
    investigation: 'Investigation',
    command: 'Command',
    discussion: 'Discussion',
  } as const)[intent];
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                              PIPELINE CARD                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function PipelineCard({
  workspace,
  execStates,
  orchestration,
  confidence,
  preflight,
}: {
  workspace: BudOsRepairWorkspace;
  execStates: ReturnType<typeof deriveExecutionStates>;
  orchestration: ReturnType<typeof deriveOrchestrationPhases>;
  confidence: ReturnType<typeof deriveConfidence>;
  preflight: ReturnType<typeof derivePreflight>;
}) {
  const [openState, setOpenState] = useState<ExecutionState | null>(null);

  // When preflight is hard-blocked, don't show pipeline stages as reachable —
  // the constraints that gate the pipeline aren't met. Show preflight first.
  const preflightHard = preflight.overall === 'blocked';

  // Find first non-reached state to highlight as "current".
  const currentIdx = execStates.findIndex((s) => !s.reached);
  const blocked = execStates.find((s) => s.blocker && !s.reached);

  // When no item is selected, show a neutral placeholder.
  if (!workspace.task_id && !workspace.selected_item_id) {
    return (
      <section className="flex flex-col justify-center rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">Repair pipeline</h3>
        <p className="mt-3 text-sm text-white/40">Select an item from the queue to see the repair lifecycle.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">Active repair</h3>
          <p className="mt-0.5 line-clamp-1 text-xs text-white/45">
            {workspace.problem_summary}
          </p>
        </div>
        {workspace.task_id && (
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[11px] font-medium text-white/55">
            task {workspace.task_id.slice(0, 8)}
          </span>
        )}
      </header>

      {/* Preflight — shown whenever not ready. When hard-blocked, it's the primary signal. */}
      {preflight.overall !== 'ready' && (
        <div className={`mt-4 rounded-lg border p-3 text-xs ${preflightHard ? 'border-red-400/40 bg-red-500/[0.06] text-red-200' : 'border-amber-400/30 bg-amber-500/[0.06] text-amber-200'}`}>
          <div className="font-semibold">
            {preflightHard ? 'Preflight blocked — pipeline cannot advance' : 'Preflight needs attention before repair can proceed'}
          </div>
          <ul className="mt-1 space-y-0.5 opacity-80">
            {preflight.checks
              .filter((c) => c.status !== 'ready')
              .map((c) => (
                <li key={c.id}>· {c.label}: {c.detail}</li>
              ))}
          </ul>
        </div>
      )}

      <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/20 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Orchestration state</div>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
          {orchestration.map((phase) => {
            const tone = phase.reached
              ? 'border-emerald-400/30 bg-emerald-500/[0.06] text-emerald-300'
              : phase.blocker && !/pending|deploy first|no approval required/i.test(phase.blocker)
                ? 'border-amber-400/30 bg-amber-500/[0.06] text-amber-300'
                : 'border-white/10 bg-white/[0.02] text-white/45';
            return (
              <div key={phase.phase} className={`rounded-md border px-2 py-1.5 ${tone}`} title={phase.evidence ?? phase.blocker ?? undefined}>
                <div className="truncate text-[11px] font-semibold">{ORCHESTRATION_LABEL[phase.phase]}</div>
                <div className="mt-0.5 truncate text-[10px] opacity-70">
                  {phase.reached ? 'complete' : phase.blocker ?? 'pending'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Compact horizontal pipeline — suppressed when preflight is hard-blocked */}
      {!preflightHard && (
        <div className="mt-4 flex items-center gap-1 overflow-x-auto pb-1">
          {PIPELINE_ORDER.map((stateKey, idx) => {
            const entry = execStates.find((s) => s.state === stateKey)!;
            const isCurrent = idx === currentIdx && !entry.reached;
            // Show reached stages + the immediate next stage + any with a blocker.
            const visible = entry.reached || isCurrent || Boolean(entry.blocker);
            if (!visible) return null;
            const tone = entry.reached
              ? 'border-emerald-400/40 bg-emerald-500/[0.08] text-emerald-300'
              : entry.blocker
                ? 'border-red-400/40 bg-red-500/[0.08] text-red-300'
                : isCurrent
                  ? 'border-sky-400/40 bg-sky-500/[0.06] text-sky-300'
                  : 'border-white/10 bg-white/[0.02] text-white/55';
            const open = openState === stateKey;
            return (
              <React.Fragment key={stateKey}>
                {idx > 0 && <span className="h-px flex-1 bg-white/[0.06]" />}
                <button
                  onClick={() => setOpenState(open ? null : stateKey)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${tone} ${open ? 'ring-2 ring-white/15' : ''}`}
                >
                  {entry.reached ? '✓ ' : ''}{PIPELINE_LABEL[stateKey]}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Drawer for the open stage */}
      {openState && !preflightHard && (
        <div className="mt-3 rounded-lg border border-white/[0.07] bg-black/30 p-3 text-xs text-white/75">
          {(() => {
            const entry = execStates.find((s) => s.state === openState)!;
            return (
              <>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{PIPELINE_LABEL[openState]}</span>
                  <button
                    onClick={() => setOpenState(null)}
                    className="text-[11px] text-white/50 hover:text-white"
                  >
                    Close
                  </button>
                </div>
                <p className="mt-1.5 text-white/70">
                  {entry.reached
                    ? entry.evidence ?? 'No additional notes.'
                    : entry.blocker ?? 'Not yet reached.'}
                </p>
              </>
            );
          })()}
        </div>
      )}

      {/* Confidence breakdown - evidence-tied */}
      <div className="mt-5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Confidence</span>
          <span className="text-[11px] text-white/35">staged, evidence-based</span>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {confidence.stages.map((stage) => (
            <div key={stage.label} className="rounded-lg border border-white/[0.06] bg-black/20 p-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{stage.label}</div>
              <div className={`mt-1 text-sm font-semibold ${stage.value == null ? 'text-white/45' : stage.value >= 75 ? 'text-emerald-300' : stage.value >= 50 ? 'text-amber-300' : 'text-red-300'}`}>
                {stage.value == null ? 'Unavailable' : `${stage.value}%`}
              </div>
              <div className="mt-0.5 text-[10px] text-white/40">{stage.status}</div>
            </div>
          ))}
        </div>
        <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          {confidence.evidence.map((e) => (
            <li key={e.label} className="flex items-center justify-between gap-2">
              <span className={e.present ? 'text-white/75' : 'text-white/35'}>
                {e.present ? '✓' : '·'} {e.label}
              </span>
              {e.detail && (
                <span className={`truncate ${e.present ? 'text-white/55' : 'text-white/30'}`}>{e.detail}</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Block reasons surfaced */}
      {blocked && (
        <p className="mt-4 rounded-lg border border-red-400/30 bg-red-500/[0.06] p-2.5 text-xs text-red-200">
          <span className="font-semibold">Blocking:</span> {blocked.blocker}
        </p>
      )}

      {/* Intelligence card — shown when repair succeeded and summary is available */}
      {workspace.intelligence_summary && (
        <IntelligenceCard raw={workspace.intelligence_summary} />
      )}
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                          REPAIR INTELLIGENCE CARD                          */
/* ────────────────────────────────────────────────────────────────────────── */

type IntelligencePayload = {
  what_broke?: string;
  how_fixed?: string;
  pattern?: string;
  next_action?: string;
  at_risk?: string[];
};

function IntelligenceCard({ raw }: { raw: string }) {
  let intel: IntelligencePayload = {};
  try { intel = JSON.parse(raw) as IntelligencePayload; } catch { return null; }

  const rows: Array<{ label: string; value: string }> = [
    intel.what_broke  ? { label: 'What broke',   value: intel.what_broke }  : null,
    intel.how_fixed   ? { label: 'How fixed',    value: intel.how_fixed }   : null,
    intel.pattern     ? { label: 'Pattern',      value: intel.pattern }     : null,
    intel.next_action ? { label: 'Next',         value: intel.next_action } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  if (rows.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.05] p-4">
      <h4 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400/80">
        What Bud learned
      </h4>
      <dl className="mt-2 space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex gap-2 text-xs">
            <dt className="w-20 shrink-0 text-white/40">{r.label}</dt>
            <dd className="text-white/75">{r.value}</dd>
          </div>
        ))}
        {intel.at_risk && intel.at_risk.length > 0 && (
          <div className="flex gap-2 text-xs">
            <dt className="w-20 shrink-0 text-white/40">Also check</dt>
            <dd className="flex flex-wrap gap-1">
              {intel.at_risk.map((a) => (
                <span key={a} className="rounded-full border border-amber-400/30 bg-amber-500/[0.08] px-2 py-0.5 text-[11px] text-amber-300/80">
                  {a}
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                            OPERATIONAL SUMMARY                             */
/* ────────────────────────────────────────────────────────────────────────── */

function OperationalSummaryCard({ summaries }: { summaries: ReturnType<typeof buildOperationalSummaries> }) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <header>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">What Bud is doing</h3>
        <p className="mt-0.5 text-xs text-white/40">Cause and result statements — not raw logs.</p>
      </header>
      <ul className="mt-3 space-y-2.5">
        {summaries.length === 0 && (
          <li className="text-xs text-white/40">No active operational thread.</li>
        )}
        {summaries.map((s) => (
          <li key={s.id} className="flex items-start gap-3 text-sm">
            <span
              className={`mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                s.kind === 'cause' ? 'bg-red-400' : s.kind === 'wait' ? 'bg-amber-400' : s.kind === 'result' ? 'bg-emerald-400' : 'bg-sky-400'
              }`}
            />
            <p className="text-sm leading-snug text-white/80">{s.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                              FORECASTS                                     */
/* ────────────────────────────────────────────────────────────────────────── */

function ForecastCard({ forecasts }: { forecasts: ReturnType<typeof deriveForecasts> }) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <header>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">Forecast</h3>
        <p className="mt-0.5 text-xs text-white/40">Things Bud expects to happen.</p>
      </header>
      <ul className="mt-3 space-y-2.5">
        {forecasts.length === 0 && (
          <li className="text-xs text-white/40">No notable forecast signals.</li>
        )}
        {forecasts.map((f) => (
          <li key={f.id} className="rounded-lg border border-white/[0.07] bg-black/20 p-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
              <span className="text-white/55">{f.horizon}</span>
              <span className="text-white/30">·</span>
              <span className="text-white/55">confidence {f.confidence}</span>
            </div>
            <p className="mt-1 text-sm font-medium text-white/85">{f.title}</p>
            <p className="mt-0.5 text-xs text-white/50">{f.reason}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                              SYSTEMS MAP                                   */
/* ────────────────────────────────────────────────────────────────────────── */

function SystemsMapCard({ nodes }: { nodes: ReturnType<typeof deriveSystemsMap> }) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <header>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">Systems map</h3>
        <p className="mt-0.5 text-xs text-white/40">Which surfaces are affected right now.</p>
      </header>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {nodes.map((n) => {
          const tone = TRUTH_TONE[n.state];
          return (
            <div key={n.area} className={`rounded-xl border border-white/[0.06] p-3 ring-1 ring-inset ${tone.ring}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{n.label}</span>
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${tone.text}`}>{n.state}</span>
              </div>
              <p className="mt-1 text-[11px] text-white/45">{n.detail}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                            CUSTOMER IMPACT                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function CustomerImpactCard({ signals }: { signals: ReturnType<typeof deriveCustomerImpact> }) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <header>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">Live customer impact</h3>
        <p className="mt-0.5 text-xs text-white/40">Translated from telemetry into user-impact statements.</p>
      </header>
      <ul className="mt-3 space-y-2">
        {signals.length === 0 && (
          <li className="text-xs text-white/40">No active customer-facing degradation.</li>
        )}
        {signals.map((s) => {
          const tone = RISK_TONE[s.severity];
          return (
            <li key={s.id} className={`rounded-lg border px-3 py-2 ${tone.chip}`}>
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-white/50">
                <span>{s.surface}</span>
                <span className={tone.text}>{s.severity}</span>
              </div>
              <p className="mt-1 text-sm text-white/80">{s.signal}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                       DEPLOYMENT TIMELINE + ROLLBACK                       */
/* ────────────────────────────────────────────────────────────────────────── */

function DeploymentTimelineCard({
  commandState,
  workspace,
  activity,
}: {
  commandState: MissionControlHealth;
  workspace: BudOsRepairWorkspace;
  activity: BudActivityEvent[];
}) {
  const dep = commandState.deployment;
  const rollbackReady =
    workspace.rollback_count === 0 ||
    (workspace.repair_success_rate != null && workspace.repair_success_rate >= 0.8);
  const successPct = workspace.repair_success_rate != null
    ? Math.round(workspace.repair_success_rate * 100)
    : null;
  const recentDeployEvents = activity
    .filter((e) => e.event_type === 'deployment')
    .slice(0, 4);

  const stateTone =
    dep.status === 'failed'
      ? 'border-red-400/40 bg-red-500/[0.06] text-red-300'
      : dep.status === 'deploying'
        ? 'border-sky-400/30 bg-sky-500/[0.06] text-sky-300'
        : dep.status === 'stale'
          ? 'border-amber-400/30 bg-amber-500/[0.06] text-amber-300'
          : dep.status === 'healthy'
            ? 'border-emerald-400/30 bg-emerald-500/[0.06] text-emerald-300'
            : 'border-white/10 bg-white/[0.02] text-white/55';

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">Deployment timeline</h3>
          <p className="mt-0.5 text-xs text-white/40">Last deploy and rollback readiness.</p>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${stateTone}`}>
          {dep.status}
        </span>
      </header>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Last success</p>
          <p className="mt-1 text-sm text-white/80">{relativeTime(dep.last_success_at, 'Telemetry unavailable')}</p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Last failure</p>
          <p className="mt-1 text-sm text-white/80">{relativeTime(dep.last_failure_at, 'Telemetry unavailable')}</p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Rollback readiness</p>
          <p className={`mt-1 text-sm font-semibold ${rollbackReady ? 'text-emerald-300' : 'text-amber-300'}`}>
            {rollbackReady ? 'Ready' : 'Watch'}
          </p>
          <p className="mt-0.5 text-[11px] text-white/45">
            {workspace.rollback_count} rollback{workspace.rollback_count === 1 ? '' : 's'} on file
            {successPct != null ? ` · ${successPct}% repair success` : ''}
          </p>
        </div>
      </div>
      {recentDeployEvents.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-xs">
          {recentDeployEvents.map((e) => (
            <li key={e.id} className="flex items-start gap-2 text-white/70">
              <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-sky-400" />
              <span className="min-w-0 flex-1">
                <span className="text-white/85">{e.narrative}</span>
                <span className="ml-2 text-white/35">{relativeTime(e.created_at)}</span>
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

/* ────────────────────────────────────────────────────────────────────────── */
/*                            VERIFIED OUTCOMES                               */
/* ────────────────────────────────────────────────────────────────────────── */

function VerifiedOutcomesCard({ outcomes }: { outcomes: ReturnType<typeof deriveVerifiedOutcomes> }) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">Verified production outcomes</h3>
          <p className="mt-0.5 text-xs text-white/40">Repairs that landed and held in production.</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] font-medium text-white/65">
          {outcomes.length}
        </span>
      </header>
      <ul className="mt-3 divide-y divide-white/[0.05]">
        {outcomes.length === 0 && (
          <li className="py-3 text-xs text-white/40">No verified production wins recorded yet.</li>
        )}
        {outcomes.map((o) => (
          <li key={o.id} className="flex items-start gap-3 py-2.5">
            <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white">{o.agentName}</p>
              <p className="mt-0.5 text-xs text-white/55">{o.metric}</p>
              <p className="mt-0.5 text-[11px] text-white/35">{o.evidence}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
