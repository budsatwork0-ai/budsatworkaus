'use client';

/**
 * Final Production Merge Gate
 *
 * Combines every available signal — CI status, risk level, agent reviewer score,
 * evidence confidence, safety guardrails, calibration history, manual test result,
 * and duplicate status — into one authoritative go / no-go decision.
 *
 * Two display modes:
 * - MergeGateBanner  compact header strip, always visible in the review modal
 * - MergeGatePanel   full breakdown panel, shown after the AI report completes
 */

import type { MergeReviewItem } from '@/app/api/bud/merge-review/route';
import type { AgentReviewerReport } from '@/app/api/bud/merge-review/analyze/route';
import type { EvidencePack } from '@/app/api/bud/merge-review/evidence/route';

// ── Verdict types ─────────────────────────────────────────────────────────────

export type MergeGateVerdict =
  | 'ready_to_merge'
  | 'ready_after_manual_test'
  | 'needs_changes'
  | 'hold_due_to_risk'
  | 'do_not_merge';

export interface BlockingIssue {
  severity: 'blocker' | 'warning';
  issue: string;
  resolution: string;
}

export interface MergeGateDecision {
  verdict: MergeGateVerdict;
  verdictLabel: string;   // shown in the banner headline
  verdictSubtext: string; // one-line explanation shown under the headline
  reasons: string[];      // top 3 reasons for this verdict
  blockingIssues: BlockingIssue[];
  nextAction: string;     // single most important thing to do right now
  postMergeChecks: string[];
  rollbackInstruction: string;
  compositeScore: number; // weighted 0–100 combining all signals
  dataDepth: 'full' | 'partial' | 'basic'; // how much data was available
}

export interface GateInput {
  item: MergeReviewItem;
  report?: AgentReviewerReport | null;
  evidence?: EvidencePack | null;
  manuallyTested?: boolean;
  isDuplicate?: boolean;
  workflowTestResult?: 'passed' | 'failed' | null;
}

// ── Post-merge checks by system area ─────────────────────────────────────────

const POST_MERGE_CHECKS: Record<string, string[]> = {
  agent_quality: [
    'Open /dashboard/agents — confirm all agents show a healthy status.',
    'Trigger a test run on the most-used agent and verify it succeeds.',
    'Check Recent Runs for any new errors or silent failures.',
  ],
  monitoring: [
    'Open Mission Control → System Health.',
    'Confirm no unexpected alerts fired since the deploy.',
    'If new monitors were added, trigger a test condition to confirm they fire.',
  ],
  quote_funnel: [
    'Open /services on the live site and complete a full test quote.',
    'Confirm the final price is correct and unchanged.',
    'Submit the quote and verify the confirmation email arrives.',
  ],
  dashboard_ui: [
    'Open the affected dashboard page on production.',
    'Check layout on mobile (375px) and desktop (1280px+).',
    'Confirm all data loads and no elements are broken or missing.',
  ],
  infrastructure: [
    'Check Vercel — confirm the deployment succeeded with no errors.',
    'If a migration ran, verify it completed in Supabase dashboard.',
    'Check Supabase logs for errors in the 30 minutes after deploy.',
  ],
  customer_experience: [
    'Complete the affected customer workflow on the live production site.',
    'Confirm all confirmation emails send correctly.',
    'Monitor error logs and support channels for 30 minutes.',
  ],
};

const DEFAULT_POST_MERGE = [
  'Verify the deployment completed successfully on Vercel.',
  'Check that core features work as expected on production.',
  'Monitor error logs for 30 minutes after deploy.',
];

// ── Core computation ──────────────────────────────────────────────────────────

export function computeMergeGate({
  item,
  report = null,
  evidence = null,
  manuallyTested = false,
  isDuplicate = false,
  workflowTestResult = null,
}: GateInput): MergeGateDecision {

  const safetyGuardrails = report?.safetyGuardrails ?? null;
  const finalScore = safetyGuardrails?.finalScore
    ?? (item.recommendation === 'approve'             ? 78
      : item.recommendation === 'needs_manual_review' ? 58
      : item.recommendation === 'hold'                ? 35
      : 18);

  const blockingIssues: BlockingIssue[] = [];

  // ── Absolute blockers ─────────────────────────────────────────────────────

  if (item.isDraft) {
    blockingIssues.push({
      severity: 'blocker',
      issue: 'PR is still a draft',
      resolution: 'The author needs to mark this PR as ready for review before it can be merged.',
    });
  }

  if (item.ciStatus === 'failure') {
    blockingIssues.push({
      severity: 'blocker',
      issue: 'CI checks are failing',
      resolution: 'Fix the failing build. Do not merge until CI is green.',
    });
  }

  if (item.checks.migrationSafe === 'fail') {
    blockingIssues.push({
      severity: 'blocker',
      issue: 'Database migration safety check failed',
      resolution: 'Review the migration carefully. Confirm it is safe before running in production.',
    });
  }

  if (finalScore < 30) {
    blockingIssues.push({
      severity: 'blocker',
      issue: `Recommendation score too low (${finalScore}/100)`,
      resolution: 'The reviewer does not have enough confidence to recommend this PR. Address the outstanding issues first.',
    });
  }

  // ── Warnings from safety guardrails ───────────────────────────────────────

  if (safetyGuardrails?.heightenedCautionActive) {
    blockingIssues.push({
      severity: 'warning',
      issue: `Heightened caution active for ${item.systemArea.replace(/_/g, ' ')}`,
      resolution: 'This area has had repeated wrong predictions. Apply extra manual scrutiny before approving.',
    });
  }

  if (safetyGuardrails) {
    for (const flag of safetyGuardrails.highRiskFlags.filter(f => !f.satisfied)) {
      blockingIssues.push({
        severity: 'warning',
        issue: flag.message,
        resolution: flag.requirement === 'manual_testing'
          ? `Manually test the ${flag.displayName} flow before approving.`
          : flag.requirement === 'rollback_plan'
          ? `Document a clear rollback plan for ${flag.displayName} changes.`
          : `Strengthen the evidence for this ${flag.displayName} change.`,
      });
    }
  }

  if (evidence?.confidence.level === 'insufficient') {
    blockingIssues.push({
      severity: 'warning',
      issue: 'Evidence quality is insufficient',
      resolution: evidence.confidence.missing.slice(0, 2).join('; ') || 'Gather CI results and file list before approving.',
    });
  }

  if (workflowTestResult === 'failed') {
    blockingIssues.push({
      severity: 'warning',
      issue: 'Your manual preview test failed',
      resolution: 'Fix the issues found during testing before approving this PR.',
    });
  }

  if (isDuplicate) {
    blockingIssues.push({
      severity: 'warning',
      issue: 'This PR may be a duplicate',
      resolution: 'Check whether another PR already solves the same problem. Archive this one if so.',
    });
  }

  // ── Determine verdict ─────────────────────────────────────────────────────

  const hasBlockers = blockingIssues.some(b => b.severity === 'blocker');
  const hasWarnings = blockingIssues.some(b => b.severity === 'warning');

  let verdict: MergeGateVerdict;
  let verdictLabel: string;
  let verdictSubtext: string;

  if (hasBlockers) {
    const mainBlocker = blockingIssues.find(b => b.severity === 'blocker')!;
    verdict = 'do_not_merge';
    verdictLabel = `Do not merge — ${mainBlocker.issue.toLowerCase()}`;
    verdictSubtext = mainBlocker.resolution;

  } else if (
    safetyGuardrails?.heightenedCautionActive ||
    (item.riskLevel === 'high' && item.ciStatus !== 'success') ||
    (finalScore >= 30 && finalScore < 50)
  ) {
    verdict = 'hold_due_to_risk';
    verdictLabel = safetyGuardrails?.heightenedCautionActive
      ? `Hold — heightened caution for ${item.systemArea.replace(/_/g, ' ')}`
      : finalScore < 50
      ? `Hold — score ${finalScore}/100 below safe threshold`
      : 'Hold due to risk';
    verdictSubtext = safetyGuardrails?.heightenedCautionActive
      ? 'This area has had repeated wrong predictions. Extra manual scrutiny required.'
      : `Risk is ${item.riskLevel} and CI is ${item.ciStatus}. Do not merge without manual verification.`;

  } else if (
    workflowTestResult === 'failed' ||
    evidence?.confidence.level === 'insufficient' ||
    (finalScore >= 50 && finalScore < 65)
  ) {
    verdict = 'needs_changes';
    verdictLabel = workflowTestResult === 'failed'
      ? 'Needs changes — manual test failed'
      : evidence?.confidence.level === 'insufficient'
      ? 'Needs changes — insufficient evidence'
      : `Needs changes — score ${finalScore}/100`;
    verdictSubtext = workflowTestResult === 'failed'
      ? 'Your preview test found issues. Address them before approving.'
      : evidence?.confidence.level === 'insufficient'
      ? 'The reviewer does not have enough evidence to confidently recommend this PR.'
      : 'The recommendation score is below the threshold for direct approval.';

  } else if (
    !manuallyTested &&
    (item.riskLevel !== 'low' ||
     ['quote_funnel', 'customer_experience', 'infrastructure'].includes(item.systemArea) ||
     (safetyGuardrails && safetyGuardrails.highRiskFlags.length > 0))
  ) {
    verdict = 'ready_after_manual_test';
    verdictLabel = 'Ready after manual test';
    verdictSubtext = `Run the ${AREA_LABELS[item.systemArea] ?? item.systemArea.replace(/_/g, ' ')} verification checklist, then approve.`;

  } else {
    verdict = 'ready_to_merge';
    verdictLabel = 'Ready to merge';
    verdictSubtext = `CI is passing, risk is ${item.riskLevel}, and the review score is ${finalScore}/100.`;
  }

  // ── Top 3 reasons ─────────────────────────────────────────────────────────

  const reasons: string[] = [];

  // CI
  if (item.ciStatus === 'success')      reasons.push('CI checks are passing — typecheck, lint, build, and tests all green');
  else if (item.ciStatus === 'failure') reasons.push('CI checks are failing — do not merge until the build is fixed');
  else if (item.ciStatus === 'pending') reasons.push('CI is still running — wait for results before approving');
  else                                  reasons.push('CI status is unknown — verify directly on GitHub before approving');

  // Score
  if (finalScore >= 85)      reasons.push(`High recommendation score (${finalScore}/100) — strong signal for approval`);
  else if (finalScore >= 65) reasons.push(`Moderate recommendation score (${finalScore}/100) — proceed carefully`);
  else if (finalScore >= 40) reasons.push(`Low recommendation score (${finalScore}/100) — investigation needed before approving`);
  else                       reasons.push(`Very low recommendation score (${finalScore}/100) — do not merge`);

  // Evidence / risk
  if (evidence) {
    const confidenceMap: Record<EvidencePack['confidence']['level'], string> = {
      strong:       'Strong evidence — all checks passed with full file list available',
      partial:      `Partial evidence — ${evidence.confidence.scorePenalty > 0 ? `−${evidence.confidence.scorePenalty} score penalty applied` : 'some verification gaps'}`,
      weak:         'Weak evidence — significant verification gaps detected',
      insufficient: 'Insufficient evidence — major gaps; manual review is essential',
    };
    reasons.push(confidenceMap[evidence.confidence.level]);
  } else {
    const riskMap: Record<MergeReviewItem['riskLevel'], string> = {
      low:    'Low risk change — unlikely to cause production issues if CI is passing',
      medium: 'Medium risk — follow the verification checklist before merging',
      high:   'High risk change — manual sign-off required before merging',
    };
    reasons.push(riskMap[item.riskLevel]);
  }

  // ── Required next action ──────────────────────────────────────────────────

  const nextActionMap: Record<MergeGateVerdict, string> = {
    ready_to_merge:          'Open the GitHub PR and click Approve, then Merge pull request.',
    ready_after_manual_test: item.previewUrl
      ? `Open the preview deployment and run the ${AREA_LABELS[item.systemArea] ?? item.systemArea.replace(/_/g, ' ')} verification checklist.`
      : `Complete the ${AREA_LABELS[item.systemArea] ?? item.systemArea.replace(/_/g, ' ')} verification checklist in the testing step above.`,
    needs_changes:    hasWarnings
      ? blockingIssues.find(b => b.severity === 'warning')!.resolution
      : 'Address the identified issues and re-run the agent reviewer.',
    hold_due_to_risk: safetyGuardrails?.heightenedCautionActive
      ? 'Apply manual scrutiny. Heightened caution clears after accurate predictions are recorded for this area.'
      : 'Review the full agent report and address warnings before proceeding.',
    do_not_merge:     hasBlockers
      ? blockingIssues.find(b => b.severity === 'blocker')!.resolution
      : 'Resolve all blocking issues before this PR can be merged.',
  };

  // ── Composite score ───────────────────────────────────────────────────────

  const ciScore         = { success: 100, pending: 50, failure: 0, unknown: 30 }[item.ciStatus];
  const riskScore       = { low: 100, medium: 60, high: 20 }[item.riskLevel];
  const evidenceScore   = evidence
    ? { strong: 100, partial: 70, weak: 40, insufficient: 10 }[evidence.confidence.level]
    : 50;
  const compositeScore  = Math.round(ciScore * 0.35 + riskScore * 0.20 + finalScore * 0.30 + evidenceScore * 0.15);

  const dataDepth = report && evidence ? 'full' : report || evidence ? 'partial' : 'basic';

  return {
    verdict,
    verdictLabel,
    verdictSubtext,
    reasons: reasons.slice(0, 3),
    blockingIssues,
    nextAction: nextActionMap[verdict],
    postMergeChecks: POST_MERGE_CHECKS[item.systemArea] ?? DEFAULT_POST_MERGE,
    rollbackInstruction: item.rollbackPlan,
    compositeScore,
    dataDepth,
  };
}

// ── Shared area labels ────────────────────────────────────────────────────────

const AREA_LABELS: Record<string, string> = {
  agent_quality:       'Agent Quality',
  monitoring:          'Monitoring',
  quote_funnel:        'Quote Funnel',
  dashboard_ui:        'Dashboard UI',
  infrastructure:      'Infrastructure',
  customer_experience: 'Customer Experience',
};

// ── Style maps ────────────────────────────────────────────────────────────────

const VERDICT_CONFIG: Record<MergeGateVerdict, {
  bg: string;
  border: string;
  icon: string;
  headingColor: string;
  subtextColor: string;
}> = {
  ready_to_merge: {
    bg:           'bg-emerald-500/[0.07]',
    border:       'border-emerald-500/[0.22]',
    icon:         '✓',
    headingColor: 'text-emerald-400',
    subtextColor: 'text-emerald-400/70',
  },
  ready_after_manual_test: {
    bg:           'bg-sky-500/[0.07]',
    border:       'border-sky-500/[0.20]',
    icon:         '→',
    headingColor: 'text-sky-400',
    subtextColor: 'text-sky-400/70',
  },
  needs_changes: {
    bg:           'bg-amber-500/[0.07]',
    border:       'border-amber-500/[0.20]',
    icon:         '↩',
    headingColor: 'text-amber-400',
    subtextColor: 'text-amber-400/70',
  },
  hold_due_to_risk: {
    bg:           'bg-orange-500/[0.07]',
    border:       'border-orange-500/[0.20]',
    icon:         '⏸',
    headingColor: 'text-orange-400',
    subtextColor: 'text-orange-400/70',
  },
  do_not_merge: {
    bg:           'bg-red-500/[0.07]',
    border:       'border-red-500/[0.22]',
    icon:         '✗',
    headingColor: 'text-red-400',
    subtextColor: 'text-red-400/70',
  },
};

// ── MergeGateBanner ───────────────────────────────────────────────────────────
// Compact strip for the review modal header. Always visible; uses basic data.

export function MergeGateBanner({ decision }: { decision: MergeGateDecision }) {
  const cfg = VERDICT_CONFIG[decision.verdict];
  const dataBadge = decision.dataDepth === 'full'
    ? { label: 'Full analysis',   style: 'border-teal-500/20 bg-teal-500/[0.08] text-teal-400/80' }
    : decision.dataDepth === 'partial'
    ? { label: 'Partial analysis', style: 'border-amber-500/20 bg-amber-500/[0.06] text-amber-400/70' }
    : { label: 'Basic signals',    style: 'border-white/10 bg-white/[0.04] text-white/40' };

  return (
    <div className={`rounded-xl border px-4 py-3 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/30 mb-0.5">
            Final Merge Decision
          </p>
          <p className={`text-[15px] font-bold leading-tight ${cfg.headingColor}`}>
            {cfg.icon} {decision.verdictLabel}
          </p>
          <p className={`mt-0.5 text-[12px] leading-snug ${cfg.subtextColor}`}>
            {decision.verdictSubtext}
          </p>
        </div>
        <div className="shrink-0 text-right space-y-1">
          <div className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${dataBadge.style}`}>
            {dataBadge.label}
          </div>
          <p className="text-[9px] text-white/30">
            Score: {decision.compositeScore}/100
          </p>
        </div>
      </div>

      {/* Blocking issues */}
      {decision.blockingIssues.filter(b => b.severity === 'blocker').length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-red-500/[0.15] pt-3">
          {decision.blockingIssues.filter(b => b.severity === 'blocker').map((b, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="shrink-0 text-[11px] font-bold text-red-400">✗</span>
              <div>
                <span className="text-[12px] font-medium text-red-300/90">{b.issue}</span>
                <span className="text-[11px] text-red-400/60"> — {b.resolution}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── MergeGatePanel ────────────────────────────────────────────────────────────
// Full breakdown panel shown after the AI report completes in AgentReviewerPanel.

export function MergeGatePanel({
  decision,
  githubUrl,
}: {
  decision: MergeGateDecision;
  githubUrl: string;
}) {
  const cfg = VERDICT_CONFIG[decision.verdict];

  return (
    <div className={`rounded-xl border p-5 space-y-5 ${cfg.bg} ${cfg.border}`}>

      {/* Verdict headline */}
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25 mb-1">
          Final Merge Gate
        </p>
        <div className="flex items-baseline gap-3 flex-wrap">
          <p className={`text-[18px] font-bold leading-tight ${cfg.headingColor}`}>
            {cfg.icon} {decision.verdictLabel}
          </p>
          <span className="text-[10px] text-white/30 tabular-nums">
            Composite score {decision.compositeScore}/100
          </span>
        </div>
        <p className={`mt-1 text-[13px] leading-relaxed ${cfg.subtextColor}`}>
          {decision.verdictSubtext}
        </p>
      </div>

      {/* Top 3 reasons */}
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25 mb-2">
          Top 3 reasons
        </p>
        <ul className="space-y-1.5">
          {decision.reasons.map((r, i) => {
            const isNeg = r.toLowerCase().includes('failing') || r.toLowerCase().includes('low') || r.toLowerCase().includes('insufficient') || r.toLowerCase().includes('do not');
            return (
              <li key={i} className="flex items-start gap-2.5">
                <span className={`shrink-0 text-[11px] font-bold ${isNeg ? 'text-red-400' : cfg.headingColor}`}>
                  {isNeg ? '✗' : '✓'}
                </span>
                <span className="text-[13px] leading-snug text-white/65">{r}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Blocking issues */}
      {decision.blockingIssues.length > 0 && (
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25 mb-2">
            {decision.blockingIssues.some(b => b.severity === 'blocker') ? 'Blocking issues' : 'Warnings'}
          </p>
          <div className="space-y-2">
            {decision.blockingIssues.map((b, i) => (
              <div
                key={i}
                className={`rounded-lg border px-3 py-2.5 ${
                  b.severity === 'blocker'
                    ? 'border-red-500/[0.20] bg-red-500/[0.05]'
                    : 'border-amber-500/[0.18] bg-amber-500/[0.04]'
                }`}
              >
                <p className={`text-[12px] font-semibold ${b.severity === 'blocker' ? 'text-red-400' : 'text-amber-400'}`}>
                  {b.severity === 'blocker' ? '✗' : '⚠'} {b.issue}
                </p>
                <p className={`mt-0.5 text-[11px] leading-snug ${b.severity === 'blocker' ? 'text-red-400/65' : 'text-amber-400/60'}`}>
                  {b.resolution}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Required next action */}
      <div className={`rounded-lg border px-4 py-3 ${cfg.border} ${cfg.bg}`}>
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/30 mb-1">
          Required next action
        </p>
        <p className={`text-[13px] font-semibold leading-snug ${cfg.headingColor}`}>
          {decision.nextAction}
        </p>
        {decision.verdict === 'ready_to_merge' && (
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex rounded-lg border border-emerald-400/25 bg-emerald-500/[0.12] px-3 py-1.5 text-[12px] font-semibold text-emerald-400 hover:bg-emerald-500/[0.20]"
          >
            Open GitHub PR to approve ↗
          </a>
        )}
        {decision.verdict === 'ready_after_manual_test' && (
          <p className="mt-1 text-[11px] text-white/35">
            Complete testing, then return here and approve.
          </p>
        )}
      </div>

      {/* What to check after merge */}
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25 mb-2">
          Check immediately after merge
        </p>
        <ol className="space-y-1.5">
          {decision.postMergeChecks.map((step, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[12px] text-white/55">
              <span className="shrink-0 tabular-nums text-[10px] text-white/25 mt-0.5">{i + 1}.</span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      {/* Rollback instruction */}
      <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25 mb-1">
          Rollback if something goes wrong
        </p>
        <p className="text-[12px] leading-relaxed text-white/55">
          {decision.rollbackInstruction}
        </p>
      </div>

      {/* Data depth note */}
      {decision.dataDepth === 'basic' && (
        <p className="text-[10px] text-white/25">
          This decision is based on CI status and risk signals only.
          Run the Agent Reviewer above for a full analysis with evidence, safety guardrails, and calibration history.
        </p>
      )}
    </div>
  );
}
