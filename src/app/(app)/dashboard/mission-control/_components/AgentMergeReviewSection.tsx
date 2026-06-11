'use client';

/**
 * AgentMergeReviewSection — Promotion Queue
 *
 * The operator sees pending improvements grouped by business area.
 * Each card answers: "Should this go to production?"
 * Bud merges, deploys, and verifies. The operator approves or holds.
 *
 * Deleted from this file:
 *   - MergeDecisionWorkflow modal (6-stage PR review wizard)
 *   - FinalMergeGate (gate verdict panel)
 *   - NextStepPanel (pre-merge operator checklist)
 *   - ChecksStrip (CI check dots)
 *   - buildApprovalNote / buildRequestChangesMessage (GitHub note templates)
 *   - VERIFICATION_STEPS / SUCCESS_CRITERIA / buildChecklist (manual review instructions)
 *   - ReviewCard (replaced by PromotionCard)
 *   - SummaryStrip "Need manual review" / "Should not push" language
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MergeReviewItem, MergeReviewResponse } from '@/app/api/bud/merge-review/route';
import type { AccuracyResponse } from '@/app/api/bud/merge-review/accuracy/route';
import type { AgentReviewerReport } from '@/app/api/bud/merge-review/analyze/route';
import type { EvidencePack } from '@/app/api/bud/merge-review/evidence/route';
import { HelpTip } from './HelpTip';
import { PromotionCard } from './PromotionCard';
import {
  ImprovementOpportunityCard,
  groupIntoOpportunities,
  type ImprovementOpportunity,
} from './ImprovementOpportunityCard';

// ── Shared helpers ────────────────────────────────────────────────────────────

const SCORE_COLOR = (n: number) =>
  n >= 80 ? 'text-emerald-400' : n >= 60 ? 'text-amber-400' : n >= 40 ? 'text-orange-400' : 'text-red-400';

const VERDICT_CHIP: Record<string, string> = {
  correct:           'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  partially_correct: 'bg-amber-500/10   text-amber-400   border-amber-500/20',
  wrong:             'bg-red-500/10     text-red-400     border-red-500/20',
  unknown:           'bg-white/5        text-white/40    border-white/10',
};

// ── StatusStrip ───────────────────────────────────────────────────────────────
// Operator-language counts. No PR/CI/engineering language.

function StatusStrip({
  opportunities,
  deferredCount,
}: {
  opportunities: ImprovementOpportunity[];
  deferredCount: number;
}) {
  const readyCount   = opportunities.filter(o => o.readiness.status === 'ready').length;
  const blockedCount = opportunities.filter(o => o.readiness.status === 'blocked' || o.readiness.status === 'not_ready').length;

  return (
    <div className="grid grid-cols-3 gap-3">
      {([
        { label: 'Ready to promote', count: readyCount,     style: 'text-emerald-400', tip: 'Improvements Bud has validated and recommends promoting.' },
        { label: 'Blocked',          count: blockedCount,   style: 'text-red-400',     tip: 'Improvements that cannot be promoted until an underlying issue is resolved.' },
        { label: 'On hold',          count: deferredCount,  style: 'text-white/35',    tip: 'Improvements you have chosen to revisit later.' },
      ] as const).map(({ label, count, style, tip }) => (
        <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
          <p className="flex items-center text-[10px] font-semibold uppercase tracking-wider text-white/35">
            {label}<HelpTip text={tip} />
          </p>
          <p className={`mt-0.5 text-2xl font-semibold tabular-nums ${style}`}>{count}</p>
        </div>
      ))}
    </div>
  );
}

// ── BudTrackRecord ────────────────────────────────────────────────────────────
// Shows Bud's historical accuracy on past promotions. Collapsed by default.

function BudTrackRecord() {
  const [data, setData] = useState<AccuracyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pendingOutcome, setPendingOutcome] = useState<number | null>(null);

  async function load() {
    if (data) { setExpanded(x => !x); return; }
    setLoading(true);
    setExpanded(true);
    try {
      const res = await fetch('/api/bud/merge-review/accuracy');
      if (res.ok) setData(await res.json() as AccuracyResponse);
    } finally { setLoading(false); }
  }

  const s = data?.stats;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => void load()}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-white/[0.03]"
      >
        <div className="flex items-center gap-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/25">Bud Track Record</p>
          {s?.averageAccuracyScore != null && (
            <span className={`text-[11px] font-semibold tabular-nums ${SCORE_COLOR(s.averageAccuracyScore)}`}>
              {s.averageAccuracyScore}/100
            </span>
          )}
          {s && s.pendingOutcomeChecks > 0 && (
            <span className="inline-flex items-center rounded border border-amber-500/25 bg-amber-500/[0.08] px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-amber-400">
              {s.pendingOutcomeChecks} outcomes pending
            </span>
          )}
          {loading && <span className="text-[10px] text-white/30">Loading…</span>}
        </div>
        <span className="text-[11px] text-white/30">{expanded ? 'Hide' : 'Show'}</span>
      </button>

      {expanded && data && (
        <div className="border-t border-white/[0.06] px-4 pb-5 pt-4 space-y-5">

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([
              { label: 'Predictions',          value: s!.totalPredictions,      style: 'text-white/70' },
              { label: 'Verified outcomes',     value: s!.outcomeChecked,        style: 'text-white/70' },
              { label: 'Clean promotions',      value: s!.successfulApprovals,   style: 'text-emerald-400' },
              { label: 'Problem promotions',    value: s!.problematicApprovals,  style: s!.problematicApprovals > 0 ? 'text-red-400' : 'text-white/40' },
            ] as const).map(({ label, value, style }) => (
              <div key={label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">{label}</p>
                <p className={`mt-0.5 text-xl font-semibold tabular-nums ${style}`}>{value}</p>
              </div>
            ))}
          </div>

          {s!.outcomeChecked > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">Accuracy breakdown</p>
              <div className="flex flex-wrap gap-2">
                {([
                  ['Correct',           s!.correctCount,          'text-emerald-400'],
                  ['Partially correct', s!.partiallyCorrectCount, 'text-amber-400'],
                  ['Wrong',             s!.wrongCount,            'text-red-400'],
                ] as [string, number, string][]).filter(([, count]) => count > 0).map(([label, count, style]) => (
                  <div key={label} className="flex items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5">
                    <span className={`text-lg font-bold tabular-nums ${style}`}>{count}</span>
                    <span className="text-[11px] text-white/40">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.pendingChecks.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                Awaiting outcome confirmation
              </p>
              <div className="space-y-1.5">
                {data.pendingChecks.map(p => (
                  <div key={p.pr_number} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                    <span className="font-mono text-[11px] text-white/30">#{p.pr_number}</span>
                    <span className="flex-1 truncate text-[12px] text-white/55">{p.plain_title}</span>
                    <button
                      onClick={() => setPendingOutcome(pendingOutcome === p.pr_number ? null : p.pr_number)}
                      className="shrink-0 rounded border border-white/[0.10] bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/50 hover:text-white/70"
                    >
                      {pendingOutcome === p.pr_number ? 'Cancel' : 'Record outcome'}
                    </button>
                  </div>
                ))}
              </div>
              {pendingOutcome !== null && (
                <QuickOutcomeForm
                  prNumber={pendingOutcome}
                  onDone={() => { setPendingOutcome(null); setData(null); void load(); }}
                />
              )}
            </div>
          )}

          {data.recentLessons.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">Recent lessons</p>
              <div className="space-y-3">
                {data.recentLessons.map(lesson => (
                  <div key={`${lesson.pr_number}-${lesson.checked_at}`} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-white/30">#{lesson.pr_number}</span>
                      <span className="flex-1 truncate text-[12px] text-white/60">{lesson.plain_title}</span>
                      <span className={`inline-flex items-center rounded border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider ${VERDICT_CHIP[lesson.accuracy_verdict] ?? VERDICT_CHIP.unknown}`}>
                        {lesson.accuracy_verdict.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {lesson.learning_notes.whatGotRight && (
                      <p className="text-[11px] leading-snug text-white/50">
                        <span className="text-emerald-400/60">✓ </span>{lesson.learning_notes.whatGotRight}
                      </p>
                    )}
                    {lesson.learning_notes.whatMissed && lesson.learning_notes.whatMissed !== 'Nothing significant.' && (
                      <p className="text-[11px] leading-snug text-white/50">
                        <span className="text-amber-400/60">△ </span>{lesson.learning_notes.whatMissed}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {s!.totalPredictions === 0 && (
            <p className="text-[12px] text-white/35">No promotions recorded yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── QuickOutcomeForm ──────────────────────────────────────────────────────────

function QuickOutcomeForm({ prNumber, onDone }: { prNumber: number; onDone: () => void }) {
  const [productionHealthy,   setProductionHealthy]   = useState<boolean | null>(null);
  const [errorsIncreased,     setErrorsIncreased]     = useState<boolean | null>(null);
  const [rollbackNeeded,      setRollbackNeeded]      = useState<boolean | null>(null);
  const [improvementHappened, setImprovementHappened] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      await fetch(`/api/bud/merge-review/predictions/${prNumber}/outcome`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productionHealthy, errorsIncreased, rollbackNeeded, improvementHappened }),
      });
      onDone();
    } finally { setSubmitting(false); }
  }

  return (
    <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
        Outcome — PR #{prNumber}
      </p>
      {([
        ['Production stayed healthy?',   productionHealthy,   setProductionHealthy],
        ['Errors increased after deploy?',errorsIncreased,    setErrorsIncreased],
        ['Rollback was needed?',          rollbackNeeded,      setRollbackNeeded],
        ['Expected improvement happened?',improvementHappened,setImprovementHappened],
      ] as [string, boolean | null, (v: boolean | null) => void][]).map(([label, value, setter]) => (
        <div key={label} className="flex items-center justify-between">
          <span className="text-[12px] text-white/50">{label}</span>
          <div className="flex gap-1">
            {([['Yes', true], ['No', false]] as [string, boolean][]).map(([btnLabel, btnVal]) => (
              <button
                key={btnLabel}
                onClick={() => setter(value === btnVal ? null : btnVal)}
                className={`rounded px-2.5 py-0.5 text-[11px] font-medium transition ${
                  value === btnVal ? 'bg-white/15 text-white' : 'border border-white/[0.08] text-white/35 hover:text-white/60'
                }`}
              >
                {btnLabel}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button
        onClick={() => void submit()}
        disabled={submitting}
        className="rounded-md border border-teal-400/20 bg-teal-500/[0.08] px-3 py-1.5 text-[11px] font-medium text-teal-400 hover:bg-teal-500/[0.14] disabled:opacity-50"
      >
        {submitting ? 'Saving…' : 'Save & learn'}
      </button>
    </div>
  );
}

// ── SmokeTestPanel ────────────────────────────────────────────────────────────
// Admin-only production integration test. Evidence + analysis only — no gate verdict.

type SmokePhase = 'idle' | 'evidence' | 'analyze' | 'done' | 'error';

interface SmokeResult {
  pr: MergeReviewItem;
  evidenceOk: boolean;
  evidencePack: EvidencePack | null;
  evidenceError: string | null;
  analyzeOk: boolean;
  report: AgentReviewerReport | null;
  analyzeError: string | null;
  completedAt: string;
}

function SmokeTestPanel({ items }: { items: MergeReviewItem[] }) {
  const [phase,  setPhase]  = useState<SmokePhase>('idle');
  const [result, setResult] = useState<SmokeResult | null>(null);

  const target = items.find(i => !i.isDraft) ?? items[0] ?? null;

  async function run() {
    if (!target || phase === 'evidence' || phase === 'analyze') return;
    setPhase('evidence');
    setResult(null);

    const partial: SmokeResult = {
      pr: target, evidenceOk: false, evidencePack: null, evidenceError: null,
      analyzeOk: false, report: null, analyzeError: null, completedAt: '',
    };

    let evidencePack: EvidencePack | null = null;
    try {
      const res = await fetch('/api/bud/merge-review/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: target, allItems: items }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      evidencePack = await res.json() as EvidencePack;
      partial.evidenceOk = true;
      partial.evidencePack = evidencePack;
    } catch (e) {
      partial.evidenceError = e instanceof Error ? e.message : String(e);
    }

    setPhase('analyze');
    try {
      const res = await fetch('/api/bud/merge-review/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: target, evidence: evidencePack }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      partial.report = await res.json() as AgentReviewerReport;
      partial.analyzeOk = true;
    } catch (e) {
      partial.analyzeError = e instanceof Error ? e.message : String(e);
    }

    partial.completedAt = new Date().toISOString();
    setResult(partial);
    setPhase(partial.evidenceError && partial.analyzeError ? 'error' : 'done');
  }

  const running = phase === 'evidence' || phase === 'analyze';

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.015] p-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25">Integration smoke test</p>
          <p className="mt-0.5 text-[12px] text-white/35">Calls /evidence → /analyze on a live PR. Nothing is promoted or saved.</p>
        </div>
        <button
          onClick={() => void run()}
          disabled={running || !target}
          className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/55 hover:border-white/20 hover:text-white/80 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {running ? (phase === 'evidence' ? 'Collecting evidence…' : 'Analysing…') : result ? 'Re-run' : 'Run smoke test'}
        </button>
      </div>

      {result && (
        <div className="space-y-3 border-t border-white/[0.05] pt-3">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${
              result.evidenceOk && result.analyzeOk ? 'bg-emerald-400'
              : (result.evidenceOk || result.analyzeOk) ? 'bg-amber-400'
              : 'bg-red-400'
            }`} />
            <p className="text-[12px] font-semibold text-white/60">
              PR #{result.pr.prNumber} — {result.pr.plainTitle}
            </p>
            <span className="ml-auto font-mono text-[10px] text-white/25">
              {new Date(result.completedAt).toLocaleTimeString()}
            </span>
          </div>
          {[
            ['/evidence', result.evidenceOk, result.evidenceError, result.evidencePack ? `confidence ${result.evidencePack.confidence.level} (${result.evidencePack.confidence.score}/100)` : undefined],
            ['/analyze',  result.analyzeOk,  result.analyzeError,  result.report ? `score ${result.report.recommendationQualityScore}/100` : undefined],
          ].map(([label, ok, error, detail]) => (
            <div key={String(label)} className="flex items-start gap-2">
              <span className={`mt-[3px] inline-block h-1.5 w-1.5 shrink-0 rounded-full ${ok ? 'bg-emerald-400' : error ? 'bg-red-400' : 'bg-white/20'}`} />
              <div>
                <span className="font-mono text-[11px] text-white/50">{ok ? '✓' : '✗'} {label as string}</span>
                {detail && <p className="text-[11px] text-white/30">{detail as string}</p>}
                {error && <p className="text-[11px] text-red-400/70">{error as string}</p>}
              </div>
            </div>
          ))}
          {result.report && (
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-3">
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-white/25">Summary</p>
              <p className="text-[12px] leading-relaxed text-white/50">{result.report.executiveSummary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AgentMergeReviewSection() {
  const [data, setData]       = useState<MergeReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [showDeferred, setShowDeferred]   = useState(false);
  const [showDebug, setShowDebug]         = useState(false);
  const [snoozedMap, setSnoozedMap]       = useState<Map<string, Date | 'skip'>>(new Map());

  // Hydrate snooze state from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('bud-improvements-snoozed');
      if (!raw) return;
      const entries = JSON.parse(raw) as Array<[string, string]>;
      const now = Date.now();
      const valid: Array<[string, Date | 'skip']> = entries
        .filter(([, v]) => v === 'skip' || new Date(v).getTime() > now)
        .map(([k, v]) => [k, v === 'skip' ? 'skip' : new Date(v)]);
      setSnoozedMap(new Map(valid));
    } catch { /* storage unavailable */ }
  }, []);

  function handleSnooze(id: string, until: Date | 'skip') {
    setSnoozedMap(prev => {
      const next = new Map(prev);
      next.set(id, until);
      try {
        const entries: Array<[string, string]> = Array.from(next.entries()).map(
          ([k, v]) => [k, v === 'skip' ? 'skip' : (v as Date).toISOString()],
        );
        localStorage.setItem('bud-improvements-snoozed', JSON.stringify(entries));
      } catch { /* unavailable */ }
      return next;
    });
  }

  function handleHold(id: string) {
    handleSnooze(id, 'skip');
  }

  function handleRestore(id: string) {
    setSnoozedMap(prev => {
      const next = new Map(prev);
      next.delete(id);
      try {
        const entries: Array<[string, string]> = Array.from(next.entries()).map(
          ([k, v]) => [k, v === 'skip' ? 'skip' : (v as Date).toISOString()],
        );
        localStorage.setItem('bud-improvements-snoozed', JSON.stringify(entries));
      } catch { /* unavailable */ }
      return next;
    });
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bud/merge-review');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json() as MergeReviewResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const duplicateMap = useMemo<Map<number, number[]>>(() => {
    if (!data) return new Map();
    const byArea = new Map<string, MergeReviewItem[]>();
    for (const item of data.items) {
      const list = byArea.get(item.systemArea) ?? [];
      list.push(item);
      byArea.set(item.systemArea, list);
    }
    const result = new Map<number, number[]>();
    for (const items of byArea.values()) {
      if (items.length > 1) {
        for (const item of items) {
          result.set(item.prNumber, items.filter(i => i.prNumber !== item.prNumber).map(i => i.prNumber));
        }
      }
    }
    return result;
  }, [data]);

  const opportunities = useMemo<ImprovementOpportunity[]>(() => {
    if (!data) return [];
    return groupIntoOpportunities(data.items, duplicateMap);
  }, [data, duplicateMap]);

  const activeOpportunities = opportunities.filter(o => {
    const v = snoozedMap.get(o.id);
    if (!v) return true;
    if (v === 'skip') return false;
    return v.getTime() <= Date.now();
  });

  const deferredOpportunities = opportunities.filter(o => {
    const v = snoozedMap.get(o.id);
    if (!v) return false;
    if (v === 'skip') return true;
    return v.getTime() > Date.now();
  });

  // ── Loading / error / no-github states ────────────────────────────────────

  if (loading) return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/25">Pending Improvements</span>
        <span className="text-[10px] text-white/30">Loading…</span>
      </div>
    </div>
  );

  if (error) return (
    <div className="space-y-2">
      <p className="text-sm text-red-400">Error: {error}</p>
      <button onClick={() => void load()} className="text-[12px] text-white/40 hover:text-white/70">Retry</button>
    </div>
  );

  if (!data) return null;

  if (!data.githubConfigured) return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-5">
      <p className="text-[13px] text-white/50">
        GitHub is not connected.{' '}
        <span className="text-white/70">
          Set <code className="font-mono text-white/60">GITHUB_TOKEN</code>,{' '}
          <code className="font-mono text-white/60">GITHUB_REPO_OWNER</code>, and{' '}
          <code className="font-mono text-white/60">GITHUB_REPO_NAME</code> to enable promotions.
        </span>
      </p>
    </div>
  );

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/25">
            Pending Improvements
          </span>
        </div>
        <button onClick={() => void load()} className="text-[11px] text-white/35 hover:text-white/60">
          Refresh
        </button>
      </div>

      {/* Status counts */}
      <StatusStrip opportunities={activeOpportunities} deferredCount={deferredOpportunities.length} />

      {/* Active improvement cards */}
      {activeOpportunities.length === 0 ? (
        <p className="text-sm text-white/35">No pending improvements right now.</p>
      ) : (
        <div className="space-y-3">
          {activeOpportunities.map(opp => (
            <ImprovementOpportunityCard
              key={opp.id}
              opportunity={opp}
              onSnooze={handleSnooze}
              renderRecommendedPR={(item) => (
                <PromotionCard
                  item={item}
                  duplicateOf={duplicateMap.get(item.prNumber) ?? []}
                  allItems={data.items}
                  onHold={handleHold}
                />
              )}
            />
          ))}
        </div>
      )}

      {/* Deferred (on hold) */}
      {deferredOpportunities.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
          <button
            onClick={() => setShowDeferred(x => !x)}
            className="flex w-full items-center justify-between px-4 py-3 hover:bg-white/[0.02]"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25">On Hold</span>
              <span className="rounded-full bg-white/[0.06] px-2 py-px text-[10px] text-white/35">
                {deferredOpportunities.length}
              </span>
            </div>
            <span className="text-[11px] text-white/30">{showDeferred ? 'Hide ↑' : 'Show ↓'}</span>
          </button>
          {showDeferred && (
            <div className="border-t border-white/[0.05] divide-y divide-white/[0.04]">
              {deferredOpportunities.map(opp => (
                <div key={opp.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-white/35">{opp.areaLabel}</p>
                    <p className="mt-px truncate text-[12px] text-white/25">{opp.recommendedPR.plainTitle}</p>
                  </div>
                  <button
                    onClick={() => handleRestore(opp.id)}
                    className="shrink-0 rounded border border-white/[0.07] px-2 py-1 text-[10px] text-white/35 hover:text-white/65"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Secondary: Bud track record + debug */}
      <div className="border-t border-white/[0.05] pt-4 space-y-4">
        <BudTrackRecord />

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
          <button
            onClick={() => setShowDebug(x => !x)}
            className="flex w-full items-center justify-between px-4 py-3 hover:bg-white/[0.02]"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/20">Debug</span>
            <span className="text-[11px] text-white/25">{showDebug ? 'Hide ↑' : 'Show ↓'}</span>
          </button>
          {showDebug && (
            <div className="border-t border-white/[0.05] p-4">
              <SmokeTestPanel items={data.items} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
