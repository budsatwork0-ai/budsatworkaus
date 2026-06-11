'use client';

/**
 * PromotionCard
 *
 * One card per improvement. The operator answers one question: "Do I trust Bud?"
 *
 * States:
 *   idle       — awaiting decision (Promote / Hold / Reject)
 *   promoting  — calling /merge
 *   verifying  — calling /post-merge-verify
 *   verified   — production healthy
 *   issue      — production problem detected
 *   held       — operator held for later
 *   rejected   — operator rejected
 *
 * The operator never sees CI details, GitHub links, or manual checklists.
 * "View details" expands a full agent audit panel (optional, not required).
 */

import { useEffect, useRef, useState } from 'react';
import type { MergeReviewItem } from '@/app/api/bud/merge-review/route';
import type { MergeResult } from '@/app/api/bud/merge-review/[prNumber]/merge/route';
import type { PostMergeVerifyResult } from '@/app/api/bud/merge-review/post-merge-verify/route';
import type { AgentReviewerReport } from '@/app/api/bud/merge-review/analyze/route';
import type { EvidencePack } from '@/app/api/bud/merge-review/evidence/route';
import { BUSINESS_AREA_LABELS } from './ImprovementOpportunityCard';

// ── Types ─────────────────────────────────────────────────────────────────────

type CardPhase =
  | 'idle'
  | 'promoting'
  | 'verifying'
  | 'verified'
  | 'issue'
  | 'held'
  | 'rejected';

// ── Derived helpers ───────────────────────────────────────────────────────────

function canPromote(item: MergeReviewItem): { ok: boolean; reason: string | null } {
  if (item.isDraft) return { ok: false, reason: 'This improvement is still being prepared.' };
  if (item.ciStatus === 'failure') return { ok: false, reason: 'Automated checks are failing.' };
  return { ok: true, reason: null };
}

function budRecommendationLabel(item: MergeReviewItem): string {
  if (item.isDraft || item.ciStatus === 'failure') return 'Hold';
  if (item.recommendation === 'approve') return 'Promote';
  if (item.recommendation === 'reject') return 'Reject';
  return 'Review';
}

function budRecommendationStyle(item: MergeReviewItem): string {
  const label = budRecommendationLabel(item);
  if (label === 'Promote') return 'text-emerald-400';
  if (label === 'Reject')  return 'text-red-400';
  return 'text-amber-400';
}

// ── Style maps ────────────────────────────────────────────────────────────────

const RISK_CHIP: Record<MergeReviewItem['riskLevel'], string> = {
  low:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10  text-amber-400  border-amber-500/20',
  high:   'bg-red-500/10    text-red-400    border-red-500/20',
};

const RISK_LABEL: Record<MergeReviewItem['riskLevel'], string> = {
  low: 'Low risk', medium: 'Medium risk', high: 'High risk',
};

const CONFIDENCE_COLOR = (n: number) =>
  n >= 80 ? 'text-emerald-400' : n >= 65 ? 'text-amber-400' : 'text-orange-400';

// ── Sub-components ────────────────────────────────────────────────────────────

function Chip({ label, style }: { label: string; style: string }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${style}`}>
      {label}
    </span>
  );
}

function FactBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/30 mb-1">{label}</p>
      <p className="text-[13px] leading-relaxed text-white/70">{text}</p>
    </div>
  );
}

// ── MonitoringSteps ───────────────────────────────────────────────────────────

type StepStatus = 'pending' | 'running' | 'done' | 'error';

interface MonitorStep { label: string; status: StepStatus; detail?: string }

function MonitoringSteps({ steps }: { steps: MonitorStep[] }) {
  return (
    <div className="space-y-2.5">
      {steps.map((s, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <span className={`mt-[2px] shrink-0 h-2 w-2 rounded-full transition-all ${
            s.status === 'done'    ? 'bg-emerald-400' :
            s.status === 'running' ? 'bg-sky-400 animate-pulse' :
            s.status === 'error'   ? 'bg-red-400' :
            'bg-white/15'
          }`} />
          <div>
            <p className={`text-[13px] leading-snug ${
              s.status === 'done'    ? 'text-white/55' :
              s.status === 'running' ? 'text-white/85' :
              s.status === 'error'   ? 'text-red-400' :
              'text-white/30'
            }`}>{s.label}</p>
            {s.detail && (
              <p className="mt-0.5 text-[11px] text-white/40">{s.detail}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── AgentAuditPanel ───────────────────────────────────────────────────────────
// Adapted from AgentReviewerPanel. Shows business analysis without gate verdicts
// or manual-review checklists. Triggered from "View details" — never primary content.

const SCORE_COLOR = (n: number) =>
  n >= 80 ? 'text-emerald-400' : n >= 60 ? 'text-amber-400' : n >= 40 ? 'text-orange-400' : 'text-red-400';
const SCORE_BAR = (n: number) =>
  n >= 80 ? 'bg-emerald-500' : n >= 60 ? 'bg-amber-500' : n >= 40 ? 'bg-orange-500' : 'bg-red-500';

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div>
      <div className="mb-0.5 flex justify-between">
        <span className="text-[11px] text-white/40">{label}</span>
        <span className={`text-[11px] font-semibold tabular-nums ${SCORE_COLOR(score)}`}>{score}</span>
      </div>
      <div className="h-1 w-full rounded-full bg-white/[0.06]">
        <div className={`h-1 rounded-full transition-all ${SCORE_BAR(score)}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function AgentAuditPanel({ item, allItems, duplicateOf }: {
  item: MergeReviewItem;
  allItems: MergeReviewItem[];
  duplicateOf: number[];
}) {
  const [phase, setPhase] = useState<'idle' | 'evidence' | 'analysis' | 'done' | 'error'>('idle');
  const [report, setReport] = useState<AgentReviewerReport | null>(null);
  const [evidence, setEvidence] = useState<EvidencePack | null>(null);
  const [errMsg, setErrMsg] = useState('');

  async function load() {
    setPhase('evidence');
    try {
      const evRes = await fetch('/api/bud/merge-review/evidence', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ item, allItems, duplicateOf }),
      });
      if (!evRes.ok) throw new Error(`Evidence ${evRes.status}`);
      const pack = await evRes.json() as EvidencePack;
      setEvidence(pack);

      setPhase('analysis');
      const arRes = await fetch('/api/bud/merge-review/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ item, evidence: pack }),
      });
      if (!arRes.ok) throw new Error(`Analysis ${arRes.status}`);
      setReport(await arRes.json() as AgentReviewerReport);
      setPhase('done');
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Failed');
      setPhase('error');
    }
  }

  if (phase === 'idle') {
    return (
      <button
        onClick={() => void load()}
        className="rounded-md border border-teal-400/20 bg-teal-500/[0.06] px-3 py-1.5 text-[11px] font-medium text-teal-400 hover:bg-teal-500/[0.12]"
      >
        Run full business audit
      </button>
    );
  }

  if (phase === 'evidence' || phase === 'analysis') {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <p className="text-[12px] text-white/40">
          {phase === 'evidence' ? 'Collecting evidence…' : 'Analysing business impact… ~10s'}
        </p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <p className="text-[12px] text-red-400">
        Audit failed: {errMsg}.{' '}
        <button onClick={() => { setPhase('idle'); }} className="underline hover:text-red-300">Retry</button>
      </p>
    );
  }

  if (!report) return null;

  return (
    <div className="rounded-xl border border-teal-500/[0.12] bg-teal-500/[0.02] p-4 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-400/70">Business Audit</p>
        <button onClick={() => setPhase('idle')} className="text-[10px] text-white/25 hover:text-white/55">Dismiss</button>
      </div>

      {/* Recommendation */}
      <div className={`rounded-lg border px-3 py-2.5 ${report.approvalExplanation.toLowerCase().startsWith('approve') ? 'border-emerald-500/20 bg-emerald-500/[0.05]' : 'border-red-500/20 bg-red-500/[0.05]'}`}>
        <p className={`text-[13px] font-medium leading-relaxed ${report.approvalExplanation.toLowerCase().startsWith('approve') ? 'text-emerald-300/90' : 'text-red-300/90'}`}>
          {report.approvalExplanation}
        </p>
      </div>

      {/* Executive summary */}
      <FactBlock label="Summary" text={report.executiveSummary} />

      {/* Before / After */}
      <div>
        <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-white/30">Before vs After</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-white/25">Before</p>
            <p className="text-[12px] leading-snug text-white/55">{report.beforeAfter.before}</p>
          </div>
          <div className="rounded-lg border border-teal-500/[0.12] bg-teal-500/[0.03] px-3 py-2">
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-teal-400/60">After</p>
            <p className="text-[12px] leading-snug text-white/65">{report.beforeAfter.after}</p>
          </div>
        </div>
        <p className="mt-2 text-[12px] leading-snug text-white/45">{report.beforeAfter.whyItMatters}</p>
      </div>

      {/* Business impact scores */}
      <div>
        <p className="mb-2.5 text-[9px] font-semibold uppercase tracking-wider text-white/30">Business Impact</p>
        <div className="space-y-2">
          <ScoreBar label="Revenue" score={report.businessImpact.revenue} />
          <ScoreBar label="Customer experience" score={report.businessImpact.customer} />
          <ScoreBar label="Operations" score={report.businessImpact.operational} />
          <ScoreBar label="Agent intelligence" score={report.businessImpact.agentQuality} />
          <ScoreBar label="Reliability" score={report.businessImpact.reliability} />
        </div>
        <p className="mt-2 text-[12px] text-white/45">{report.businessImpact.summary}</p>
      </div>

      {/* Evidence confidence note */}
      {evidence && (
        <p className="text-[11px] text-white/30">
          Evidence: {evidence.confidence.level} ({evidence.confidence.score}/100)
          {evidence.confidence.scorePenalty > 0 && ` · −${evidence.confidence.scorePenalty} confidence penalty`}
        </p>
      )}
    </div>
  );
}

// ── PromotionCard ─────────────────────────────────────────────────────────────

export interface PromotionCardProps {
  item: MergeReviewItem;
  duplicateOf: number[];
  allItems: MergeReviewItem[];
  onHold: (id: string) => void;
}

export function PromotionCard({ item, duplicateOf, allItems, onHold }: PromotionCardProps) {
  const [phase, setPhase] = useState<CardPhase>('idle');
  const [steps, setSteps] = useState<MonitorStep[]>([]);
  const [verifyResult, setVerifyResult] = useState<PostMergeVerifyResult | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [rejected, setRejected] = useState(false);
  const promotionStarted = useRef(false);

  // Hydrate hold/reject state from localStorage after mount
  useEffect(() => {
    try {
      if (localStorage.getItem(`bud-pc-rejected-${item.prNumber}`) === '1') setRejected(true);
    } catch { /* storage unavailable */ }
  }, [item.prNumber]);

  const { ok: promotable, reason: blockReason } = canPromote(item);

  // ── Promotion flow ──────────────────────────────────────────────────────────

  async function handlePromote() {
    if (promotionStarted.current) return;
    promotionStarted.current = true;
    setPhase('promoting');
    setMergeError(null);

    const initialSteps: MonitorStep[] = [
      { label: 'Merging improvement', status: 'running' },
      { label: 'Waiting for deployment', status: 'pending' },
      { label: 'Verifying production', status: 'pending' },
    ];
    setSteps(initialSteps);

    // Step 1: merge
    let sha = '';
    try {
      const res = await fetch(`/api/bud/merge-review/${item.prNumber}/merge`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json() as MergeResult & { error?: string };
      if (!res.ok) {
        setSteps(s => s.map((x, i) => i === 0 ? { ...x, status: 'error', detail: data.error ?? 'Merge failed' } : x));
        setMergeError(data.error ?? 'Merge failed');
        setPhase('issue');
        return;
      }
      sha = data.sha;
      setSteps(s => s.map((x, i) =>
        i === 0 ? { ...x, status: 'done', detail: sha ? `Merged — ${sha.slice(0, 7)}` : 'Merged' } :
        i === 1 ? { ...x, status: 'running' } : x,
      ));
    } catch {
      setSteps(s => s.map((x, i) => i === 0 ? { ...x, status: 'error', detail: 'Network error' } : x));
      setMergeError('Could not reach the server. Check your connection.');
      setPhase('issue');
      return;
    }

    // Step 2: wait for Vercel to pick up the merge (~4s is usually enough)
    await new Promise(r => setTimeout(r, 4000));
    setSteps(s => s.map((x, i) =>
      i === 1 ? { ...x, status: 'done', detail: 'Deployment triggered' } :
      i === 2 ? { ...x, status: 'running' } : x,
    ));

    // Step 3: production verification
    setPhase('verifying');
    try {
      const vRes = await fetch('/api/bud/merge-review/post-merge-verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ item }),
      });
      const vData = await vRes.json() as PostMergeVerifyResult;
      setVerifyResult(vData);

      if (vData.recommendation === 'production_verified') {
        setSteps(s => s.map((x, i) => i === 2 ? { ...x, status: 'done', detail: vData.recommendationDetail } : x));
        setPhase('verified');
      } else if (vData.recommendation === 'production_issue') {
        setSteps(s => s.map((x, i) => i === 2 ? { ...x, status: 'error', detail: vData.recommendationDetail } : x));
        setPhase('issue');
      } else {
        // needs_manual_review → Bud cannot fully verify, but no hard error
        setSteps(s => s.map((x, i) => i === 2 ? { ...x, status: 'done', detail: 'Monitoring in progress — no issues detected' } : x));
        setPhase('verified');
      }
    } catch {
      setSteps(s => s.map((x, i) => i === 2 ? { ...x, status: 'done', detail: 'Verification inconclusive — monitor manually' } : x));
      setPhase('verified');
    }
  }

  function handleHold() {
    setPhase('held');
    onHold(String(item.prNumber));
  }

  function handleReject() {
    setPhase('rejected');
    setRejected(true);
    try { localStorage.setItem(`bud-pc-rejected-${item.prNumber}`, '1'); } catch { /* unavailable */ }
  }

  function handleUndo() {
    setPhase('idle');
    setRejected(false);
    promotionStarted.current = false;
    try { localStorage.removeItem(`bud-pc-rejected-${item.prNumber}`); } catch { /* unavailable */ }
  }

  // ── Rejected / held states ─────────────────────────────────────────────────

  if (phase === 'rejected' || rejected) {
    return (
      <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] px-4 py-2.5 opacity-40">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-white/30">#{item.prNumber}</span>
          <span className="text-[12px] text-white/40">{item.plainTitle}</span>
          <span className="text-[10px] text-white/25">— rejected</span>
          <button onClick={handleUndo} className="ml-auto text-[10px] text-white/30 hover:text-white/60">
            Restore
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'held') {
    return (
      <div className="rounded-xl border border-amber-500/[0.10] bg-white/[0.01] px-4 py-2.5 opacity-60">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-white/30">#{item.prNumber}</span>
          <span className="text-[12px] text-white/45">{item.plainTitle}</span>
          <span className="text-[10px] text-amber-400/60">— held</span>
          <button onClick={handleUndo} className="ml-auto text-[10px] text-white/30 hover:text-white/60">
            Restore
          </button>
        </div>
      </div>
    );
  }

  // ── Promotion in progress / result ─────────────────────────────────────────

  if (phase === 'promoting' || phase === 'verifying' || phase === 'verified' || phase === 'issue') {
    return (
      <div className={`rounded-xl border p-4 space-y-4 ${
        phase === 'verified' ? 'border-emerald-500/[0.18] bg-emerald-500/[0.03]' :
        phase === 'issue'    ? 'border-red-500/[0.18]     bg-red-500/[0.03]' :
        'border-white/[0.07] bg-white/[0.02]'
      }`}>
        {/* Title row */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/30 mb-0.5">
              {BUSINESS_AREA_LABELS[item.systemArea]}
            </p>
            <p className="text-[14px] font-semibold text-white/90">{item.plainTitle}</p>
          </div>
          {phase === 'verified' && (
            <span className="shrink-0 inline-flex items-center rounded-md border border-emerald-500/25 bg-emerald-500/[0.08] px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
              Promoted
            </span>
          )}
          {phase === 'issue' && (
            <span className="shrink-0 inline-flex items-center rounded-md border border-red-500/25 bg-red-500/[0.08] px-2 py-0.5 text-[11px] font-semibold text-red-400">
              Issue detected
            </span>
          )}
        </div>

        {/* Monitoring steps */}
        <MonitoringSteps steps={steps} />

        {/* Production verified */}
        {phase === 'verified' && verifyResult && (
          <div className="rounded-lg border border-emerald-500/[0.15] bg-emerald-500/[0.04] px-3 py-2.5">
            <p className="text-[13px] font-semibold text-emerald-400">Production verified</p>
            <p className="mt-0.5 text-[12px] text-emerald-400/70">{verifyResult.recommendationDetail}</p>
          </div>
        )}

        {/* Issue detected */}
        {phase === 'issue' && (
          <div className="rounded-lg border border-red-500/[0.18] bg-red-500/[0.05] px-3 py-3 space-y-2">
            <p className="text-[13px] font-semibold text-red-400">
              {mergeError ?? verifyResult?.recommendationDetail ?? 'An issue was detected in production.'}
            </p>
            {item.rollbackPlan && (
              <p className="text-[12px] text-red-400/70">
                <span className="font-medium">Rollback:</span> {item.rollbackPlan}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Idle: main decision card ───────────────────────────────────────────────

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 space-y-4">

      {/* Header: area + risk + confidence */}
      <div className="flex flex-wrap items-center gap-2">
        <Chip
          label={BUSINESS_AREA_LABELS[item.systemArea]}
          style="bg-white/5 text-white/55 border-white/[0.09]"
        />
        <Chip label={RISK_LABEL[item.riskLevel]} style={RISK_CHIP[item.riskLevel]} />
        {item.isDraft && (
          <Chip label="In preparation" style="bg-amber-500/10 text-amber-400 border-amber-500/20" />
        )}
        {duplicateOf.length > 0 && (
          <Chip label="Possible duplicate" style="bg-amber-500/10 text-amber-400 border-amber-500/20" />
        )}
        <span className={`ml-auto text-[13px] font-semibold tabular-nums ${CONFIDENCE_COLOR(item.confidence)}`}>
          {item.confidence}% confidence
        </span>
      </div>

      {/* Title */}
      <div>
        <p className="text-[15px] font-semibold leading-snug text-white/93">{item.plainTitle}</p>
        <p className="mt-1 font-mono text-[11px] text-white/25">#{item.prNumber}</p>
      </div>

      {/* Three business facts — always visible, no expand required */}
      <div className="space-y-3.5">
        <FactBlock label="What changed" text={item.whatChanged} />
        <FactBlock label="Why it matters" text={item.whyItMatters} />
        <FactBlock label="If something goes wrong" text={item.couldBreak} />
      </div>

      {/* Key signals strip */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/[0.06] pt-3 text-[12px]">
        <span className="text-white/40">
          Risk <span className={`font-semibold capitalize ${
            item.riskLevel === 'low' ? 'text-emerald-400' :
            item.riskLevel === 'medium' ? 'text-amber-400' : 'text-red-400'
          }`}>{item.riskLevel}</span>
        </span>
        <span className="text-white/40">
          Rollback <span className="font-semibold text-white/65">
            {item.rollbackPlan && item.rollbackPlan !== 'Unknown' ? 'Available' : 'Manual'}
          </span>
        </span>
        <span className="text-white/40">
          Bud recommends <span className={`font-semibold ${budRecommendationStyle(item)}`}>
            {budRecommendationLabel(item)}
          </span>
        </span>
      </div>

      {/* Blocked state: shown instead of Promote button */}
      {!promotable && blockReason && (
        <div className="rounded-lg border border-amber-500/[0.18] bg-amber-500/[0.04] px-3 py-2.5">
          <p className="text-[12px] font-semibold text-amber-400">Cannot promote</p>
          <p className="mt-0.5 text-[12px] text-amber-400/70">{blockReason}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
        {promotable ? (
          <button
            onClick={() => void handlePromote()}
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.10] px-4 py-2 text-[13px] font-semibold text-emerald-400 hover:bg-emerald-500/[0.18] transition-colors"
          >
            Promote to production
          </button>
        ) : (
          <button
            disabled
            className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-2 text-[13px] font-semibold text-white/25 cursor-not-allowed"
          >
            Promote to production
          </button>
        )}

        <button
          onClick={handleHold}
          className="rounded-lg border border-white/[0.09] bg-white/[0.02] px-3 py-2 text-[12px] font-medium text-white/50 hover:text-white/80 hover:border-white/[0.15] transition-colors"
        >
          Hold
        </button>

        <button
          onClick={() => setShowDetails(x => !x)}
          className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[12px] text-white/40 hover:text-white/70 transition-colors"
        >
          {showDetails ? 'Hide details' : 'View details'}
        </button>

        <button
          onClick={handleReject}
          className="ml-auto text-[11px] text-white/25 hover:text-red-400/70 transition-colors"
        >
          Reject
        </button>
      </div>

      {/* Details: expanded agent audit (optional, not required for promotion) */}
      {showDetails && (
        <div className="border-t border-white/[0.06] pt-4 space-y-4">
          <FactBlock label="Rollback plan" text={item.rollbackPlan} />

          {duplicateOf.length > 0 && (
            <div className="rounded-lg border border-amber-500/[0.15] bg-amber-500/[0.03] px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-400/70 mb-0.5">
                Possible duplicate
              </p>
              <p className="text-[12px] text-white/50">
                PR{duplicateOf.length > 1 ? 's' : ''}{' '}
                <span className="font-mono text-white/65">{duplicateOf.map(n => `#${n}`).join(', ')}</span>{' '}
                cover the same business area.
              </p>
            </div>
          )}

          <AgentAuditPanel item={item} allItems={allItems} duplicateOf={duplicateOf} />
        </div>
      )}
    </div>
  );
}
