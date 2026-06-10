'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MergeReviewItem, MergeReviewResponse } from '@/app/api/bud/merge-review/route';
import type { ExplainResponse } from '@/app/api/bud/merge-review/explain/route';
import type { AgentReviewerReport } from '@/app/api/bud/merge-review/analyze/route';
import type { EvidencePack } from '@/app/api/bud/merge-review/evidence/route';
import type { AccuracyResponse } from '@/app/api/bud/merge-review/accuracy/route';
import { HelpTip } from './HelpTip';
import { ReviewPrioritisationEngine } from './ReviewPrioritisationEngine';
import { MergeDecisionWorkflow, AuditTrailPanel } from './MergeDecisionWorkflow';
import { computeMergeGate, MergeGatePanel, type MergeGateDecision, type MergeGateVerdict } from './FinalMergeGate';

// ── Style maps ────────────────────────────────────────────────────────────────

const RISK_STYLES: Record<MergeReviewItem['riskLevel'], string> = {
  low:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10  text-amber-400  border-amber-500/20',
  high:   'bg-red-500/10   text-red-400    border-red-500/20',
};

const RECOMMENDATION_STYLES: Record<MergeReviewItem['recommendation'], string> = {
  approve:             'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  hold:                'bg-amber-500/10   text-amber-400   border-amber-500/20',
  reject:              'bg-red-500/10     text-red-400     border-red-500/20',
  needs_manual_review: 'bg-sky-500/10     text-sky-400     border-sky-500/20',
};

const SYSTEM_AREA_LABELS: Record<MergeReviewItem['systemArea'], string> = {
  agent_quality:       'Agent Quality',
  monitoring:          'Monitoring',
  quote_funnel:        'Quote Funnel',
  dashboard_ui:        'Dashboard UI',
  infrastructure:      'Infrastructure',
  customer_experience: 'Customer Experience',
};

const SYSTEM_AREA_STYLES: Record<MergeReviewItem['systemArea'], string> = {
  agent_quality:       'bg-teal-500/10    text-teal-400   border-teal-500/20',
  monitoring:          'bg-violet-500/10  text-violet-400 border-violet-500/20',
  quote_funnel:        'bg-orange-500/10  text-orange-400 border-orange-500/20',
  dashboard_ui:        'bg-sky-500/10     text-sky-400    border-sky-500/20',
  infrastructure:      'bg-white/5        text-white/50   border-white/10',
  customer_experience: 'bg-pink-500/10    text-pink-400   border-pink-500/20',
};

const GATE_VERDICT_STYLE: Record<MergeGateVerdict, string> = {
  ready_to_merge:          'text-emerald-400',
  ready_after_manual_test: 'text-sky-400',
  needs_changes:           'text-amber-400',
  hold_due_to_risk:        'text-orange-400',
  do_not_merge:            'text-red-400',
};

const CI_STYLES: Record<MergeReviewItem['ciStatus'], string> = {
  success: 'text-emerald-400',
  failure: 'text-red-400',
  pending: 'text-amber-400',
  unknown: 'text-white/35',
};

const CI_LABELS: Record<MergeReviewItem['ciStatus'], string> = {
  success: '✓ CI passing',
  failure: '✗ CI failing',
  pending: '… CI running',
  unknown: '? CI unknown',
};

const CHECK_DOT = {
  pass:    'bg-emerald-400',
  fail:    'bg-red-400',
  unknown: 'bg-white/20',
};

// ── Derived data helpers ──────────────────────────────────────────────────────

type ChecklistStatus = 'pass' | 'fail' | 'required' | 'warning';
interface ChecklistItem { label: string; status: ChecklistStatus }

function buildChecklist(item: MergeReviewItem): ChecklistItem[] {
  const list: ChecklistItem[] = [];

  list.push(
    item.isDraft
      ? { label: 'Mark PR as ready for review — it is currently a draft', status: 'fail' }
      : { label: 'PR is marked as ready for review', status: 'pass' },
  );

  if (item.ciStatus === 'success') {
    list.push({ label: 'CI checks are passing', status: 'pass' });
  } else if (item.ciStatus === 'failure') {
    list.push({ label: 'Fix the failing CI build before merging', status: 'fail' });
  } else if (item.ciStatus === 'pending') {
    list.push({ label: 'Wait for CI checks to finish running', status: 'warning' });
  } else {
    list.push({ label: 'CI status is unknown — check GitHub manually', status: 'warning' });
  }

  if (item.checks.migrationSafe !== undefined) {
    list.push(
      item.checks.migrationSafe === 'pass'
        ? { label: 'Database migration appears safe to run', status: 'pass' }
        : { label: 'Review the database migration carefully before merging', status: 'required' },
    );
  }

  if (item.systemArea === 'quote_funnel') {
    list.push({ label: 'Run a test quote and confirm prices are unchanged', status: 'required' });
  }

  if (item.systemArea === 'dashboard_ui' || item.systemArea === 'customer_experience') {
    list.push(
      item.previewUrl
        ? { label: 'Test the preview deployment before approving', status: 'required' }
        : { label: 'Request a preview deployment for visual testing', status: 'required' },
    );
  }

  if (item.riskLevel === 'high') {
    list.push({ label: 'Business owner manual sign-off required (high risk)', status: 'required' });
  }

  if (item.systemArea === 'infrastructure') {
    list.push({ label: 'Confirm rollback steps are documented and understood', status: 'required' });
  }

  return list;
}

const VERIFICATION_STEPS: Record<MergeReviewItem['systemArea'], string[]> = {
  agent_quality: [
    'Open /dashboard/agents in the admin dashboard.',
    'Click into any agent and trigger a manual test run.',
    'Confirm it appears in Recent Runs with a success status.',
    'Check that the agent output looks correct and no errors are logged.',
  ],
  monitoring: [
    'Open Mission Control → System Health.',
    'Verify no unexpected alerts have fired.',
    'If the change adds new monitoring, trigger a test condition to confirm alerts work.',
  ],
  quote_funnel: [
    'Open /services and build a full test quote for any service.',
    'Go through all steps: service type → property details → pricing → submit.',
    'Confirm the final price looks correct and matches expectations.',
    'Submit the quote and verify the confirmation email arrives.',
  ],
  dashboard_ui: [
    'Open the affected dashboard page.',
    'Check the layout on mobile (375px width) and desktop (1280px+).',
    'Click through all tabs or panels that were changed.',
    'Confirm no overlapping elements, broken text, or missing data.',
  ],
  infrastructure: [
    'Open Vercel and confirm the deployment completed successfully.',
    'Check the build logs for any warnings or errors.',
    'If a migration was included, open Supabase and confirm it ran.',
    'Check Supabase logs for any errors after the migration.',
  ],
  customer_experience: [
    'Complete the affected customer workflow from start to finish.',
    'If it affects bookings: create a test booking and verify the confirmation.',
    'If it affects the crew portal: log in as a crew member and test the flow.',
    'Confirm all confirmation emails arrive correctly.',
  ],
};

const SUCCESS_CRITERIA: Record<MergeReviewItem['systemArea'], string> = {
  agent_quality:       'Done when a test agent run completes without errors and results appear correctly in Recent Runs.',
  monitoring:          'Done when the system health panel shows no false positives and alerts behave as expected.',
  quote_funnel:        'Done when a full test quote generates the correct price and can be submitted end to end.',
  dashboard_ui:        'Done when the changed page renders correctly on mobile and desktop with no layout issues.',
  infrastructure:      'Done when Vercel shows a green deployment, Supabase logs are clean, and the build is error-free.',
  customer_experience: 'Done when a customer or crew member can complete the affected workflow without errors.',
};

interface RolloutPlan { label: string; style: string; description: string }

function getRolloutPlan(item: MergeReviewItem): RolloutPlan {
  if (item.isDraft) return {
    label: 'Not ready to merge',
    style: 'text-white/40',
    description: 'This PR is still a draft. The author needs to mark it ready for review before it can be approved.',
  };
  if (item.ciStatus === 'failure') return {
    label: 'Do not merge until fixed',
    style: 'text-red-400',
    description: 'CI is failing. The build or tests must pass before this is safe to deploy.',
  };
  if (item.riskLevel === 'high') return {
    label: 'Needs staged rollout',
    style: 'text-amber-400',
    description: 'High-risk change. Merge to staging first, run the verification steps, then promote to production.',
  };
  if (item.riskLevel === 'medium' || item.ciStatus === 'unknown') return {
    label: 'Merge after testing',
    style: 'text-sky-400',
    description: 'Medium risk. Open the preview deployment, run the verification checklist, then approve on GitHub.',
  };
  return {
    label: 'Safe to merge now',
    style: 'text-emerald-400',
    description: 'Low risk and CI is passing. This can be merged to production without additional manual testing.',
  };
}

function buildRequestChangesMessage(item: MergeReviewItem): string {
  const lines = [`Hi — requesting changes on PR #${item.prNumber}: "${item.rawTitle}"`, ''];
  if (item.ciStatus === 'failure') lines.push('• CI is currently failing. Please fix the build before merging.');
  if (item.isDraft) lines.push('• This PR is still a draft. Please mark it ready when complete.');
  if (item.riskLevel === 'high') lines.push('• High-risk change — please document the rollback plan more clearly.');
  lines.push('', 'Thanks!');
  return lines.join('\n');
}

function buildApprovalNote(item: MergeReviewItem): string {
  return [
    `Approving PR #${item.prNumber}: "${item.rawTitle}"`,
    '',
    `Reviewed: ${SYSTEM_AREA_LABELS[item.systemArea]} — ${item.riskLevel} risk.`,
    `CI: ${CI_LABELS[item.ciStatus]}. Confidence: ${item.confidence}%.`,
    '',
    'Verified against business requirements. Safe to merge to production.',
    '',
    '— Jackson (via Mission Control)',
  ].join('\n');
}

function buildFactoryPrompt(item: MergeReviewItem): string {
  return [
    `Use Bud Factory to implement the following tracked improvement based on PR #${item.prNumber}:`,
    '',
    `**Title:** ${item.plainTitle}`,
    `**What changed:** ${item.whatChanged}`,
    `**Why it matters:** ${item.whyItMatters}`,
    `**System area:** ${SYSTEM_AREA_LABELS[item.systemArea]}`,
    `**Risk level:** ${item.riskLevel}`,
    `**What could break:** ${item.couldBreak}`,
    `**Rollback plan:** ${item.rollbackPlan}`,
    '',
    'Please research this improvement and implement it carefully.',
  ].join('\n');
}

// ── CopyButton ────────────────────────────────────────────────────────────────

function CopyButton({ text, label, copiedLabel, className }: {
  text: string; label: string; copiedLabel?: string; className: string;
}) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return <button onClick={handleCopy} className={className}>{copied ? (copiedLabel ?? '✓ Copied') : label}</button>;
}

// ── Chip ──────────────────────────────────────────────────────────────────────

function Chip({ label, style }: { label: string; style: string }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${style}`}>
      {label}
    </span>
  );
}

// ── ChecksStrip ───────────────────────────────────────────────────────────────

function ChecksStrip({ checks }: { checks: MergeReviewItem['checks'] }) {
  const entries: Array<[string, string]> = [
    ['Typecheck', checks.typecheck],
    ['Lint', checks.lint],
    ['Build', checks.build],
    ['Tests', checks.unitTests],
    ...(checks.migrationSafe != null ? [['Migration', checks.migrationSafe] as [string, string]] : []),
  ];
  return (
    <div className="flex flex-wrap gap-2.5">
      {entries.map(([label, status]) => (
        <span key={label} className="flex items-center gap-1 text-[11px] text-white/50">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${CHECK_DOT[status as keyof typeof CHECK_DOT] ?? CHECK_DOT.unknown}`} />
          {label}
        </span>
      ))}
    </div>
  );
}

// ── NextStepPanel ─────────────────────────────────────────────────────────────

const CHECKLIST_DOT: Record<ChecklistStatus, string> = {
  pass:     'bg-emerald-400',
  fail:     'bg-red-400',
  required: 'bg-amber-400',
  warning:  'bg-yellow-400',
};

const CHECKLIST_TEXT: Record<ChecklistStatus, string> = {
  pass:     'text-white/40 line-through',
  fail:     'text-red-300/80',
  required: 'text-amber-200/70',
  warning:  'text-yellow-200/70',
};

const ACTION_LABEL: Record<MergeReviewItem['recommendation'], string> = {
  approve:             'Approve for production',
  hold:                'Hold — PR is still a draft',
  reject:              'Request fix — CI must pass first',
  needs_manual_review: 'Manual review required before merging',
};

const ACTION_STYLE: Record<MergeReviewItem['recommendation'], string> = {
  approve:             'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400',
  hold:                'border-amber-500/20   bg-amber-500/[0.06]   text-amber-400',
  reject:              'border-red-500/20     bg-red-500/[0.06]     text-red-400',
  needs_manual_review: 'border-sky-500/20     bg-sky-500/[0.06]     text-sky-400',
};

const ACTION_HINT: Record<MergeReviewItem['recommendation'], string> = {
  approve:             'Low risk and CI is passing. Open the PR on GitHub and click Approve.',
  hold:                'Wait for the developer to mark this PR as ready for review.',
  reject:              'Leave a comment on GitHub asking the developer to fix CI before merging.',
  needs_manual_review: 'Open the PR on GitHub, read through the changes, then approve or request changes.',
};

function NextStepPanel({
  item,
  duplicateOf,
  tested,
  onToggleTested,
  onToggleArchived,
  onStartReview,
}: {
  item: MergeReviewItem;
  duplicateOf: number[];
  tested: boolean;
  onToggleTested: () => void;
  onToggleArchived: () => void;
  onStartReview: (item: MergeReviewItem) => void;
}) {
  const checklist = buildChecklist(item);
  const rollout = getRolloutPlan(item);
  const steps = VERIFICATION_STEPS[item.systemArea];
  const success = SUCCESS_CRITERIA[item.systemArea];

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Next step procedure</p>

      {/* 1. Recommended action */}
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/25">Recommended action</p>
        <div className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-[12px] font-semibold ${ACTION_STYLE[item.recommendation]}`}>
          {ACTION_LABEL[item.recommendation]}
        </div>
        <p className="mt-1.5 text-[12px] leading-snug text-white/40">{ACTION_HINT[item.recommendation]}</p>
      </div>

      {/* 2. Pre-merge checklist */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/25">Pre-merge checklist</p>
        <ul className="space-y-2">
          {checklist.map((c, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className={`mt-[3px] inline-block h-1.5 w-1.5 shrink-0 rounded-full ${CHECKLIST_DOT[c.status]}`} />
              <span className={`text-[12px] leading-snug ${CHECKLIST_TEXT[c.status]}`}>{c.label}</span>
            </li>
          ))}
          {tested && (
            <li className="flex items-start gap-2">
              <span className="mt-[3px] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
              <span className="text-[12px] leading-snug text-white/40 line-through">Manually tested and verified</span>
            </li>
          )}
        </ul>
      </div>

      {/* 3. Verification instructions */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/25">How to verify after merging</p>
        <ol className="space-y-1.5">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-[12px] leading-snug text-white/50">
              <span className="shrink-0 tabular-nums text-white/20">{i + 1}.</span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      {/* 4. Success criteria */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/25">Done when…</p>
        <p className="text-[12px] leading-relaxed text-white/60">{success}</p>
      </div>

      {/* 5. Rollout plan */}
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/25">Rollout plan</p>
        <p className={`text-[12px] font-semibold ${rollout.style}`}>{rollout.label}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-white/40">{rollout.description}</p>
      </div>

      {/* 6. Duplicate detection */}
      {duplicateOf.length > 0 && (
        <div className="rounded-lg border border-amber-500/[0.15] bg-amber-500/[0.04] px-3 py-2.5">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400/70">Possible duplicate</p>
          <p className="text-[12px] leading-relaxed text-white/50">
            PR{duplicateOf.length > 1 ? 's' : ''}{' '}
            <span className="font-mono text-white/70">{duplicateOf.map(n => `#${n}`).join(', ')}</span>{' '}
            {duplicateOf.length > 1 ? 'are' : 'is'} also in the{' '}
            <span className="text-white/70">{SYSTEM_AREA_LABELS[item.systemArea]}</span> area.
            Review the oldest PR first. Archive this one if it solves the same problem.
          </p>
        </div>
      )}

      {/* 7. Action buttons */}
      <div className="border-t border-white/[0.06] pt-4">
        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-white/25">Actions</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onStartReview(item)}
            className="rounded-md border border-white/[0.12] bg-white/[0.05] px-3 py-1.5 text-[11px] font-medium text-white/70 hover:bg-white/[0.10] hover:text-white"
          >
            Start review →
          </button>

          {item.previewUrl && (
            <a
              href={item.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-sky-400/20 bg-sky-500/[0.06] px-3 py-1.5 text-[11px] font-medium text-sky-400 hover:bg-sky-500/[0.12]"
            >
              Open preview ↗
            </a>
          )}

          <a
            href={item.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[11px] text-white/45 hover:text-white/70"
          >
            Open GitHub PR ↗
          </a>

          <button
            onClick={onToggleTested}
            className={`rounded-md border px-3 py-1.5 text-[11px] font-medium transition ${
              tested
                ? 'border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-400'
                : 'border-white/[0.09] bg-white/[0.03] text-white/50 hover:text-white/70'
            }`}
          >
            {tested ? '✓ Marked tested' : 'Mark tested'}
          </button>

          <CopyButton
            text={buildRequestChangesMessage(item)}
            label="Request changes"
            copiedLabel="✓ Message copied — paste into GitHub"
            className="rounded-md border border-amber-400/15 bg-amber-500/[0.05] px-3 py-1.5 text-[11px] font-medium text-amber-400/80 hover:bg-amber-500/[0.10]"
          />

          <CopyButton
            text={buildApprovalNote(item)}
            label="Approve for production"
            copiedLabel="✓ Approval note copied"
            className="rounded-md border border-emerald-400/20 bg-emerald-500/[0.06] px-3 py-1.5 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/[0.12]"
          />

          {duplicateOf.length > 0 && (
            <button
              onClick={onToggleArchived}
              className="rounded-md border border-white/[0.07] bg-white/[0.02] px-3 py-1.5 text-[11px] text-white/40 hover:text-white/60"
            >
              Archive duplicate
            </button>
          )}

          <CopyButton
            text={buildFactoryPrompt(item)}
            label="Convert to improvement"
            copiedLabel="✓ Factory prompt copied"
            className="rounded-md border border-violet-400/20 bg-violet-500/[0.06] px-3 py-1.5 text-[11px] font-medium text-violet-400 hover:bg-violet-500/[0.12]"
          />
        </div>
        <p className="mt-2 text-[10px] text-white/20">
          &ldquo;Request changes&rdquo; and &ldquo;Approve for production&rdquo; copy a pre-written note — paste into GitHub.
          &ldquo;Convert to improvement&rdquo; copies a Bud Factory prompt to paste into Claude Code.
        </p>
      </div>
    </div>
  );
}

// ── ExplainPanel ──────────────────────────────────────────────────────────────

function ExplainPanel({ item }: { item: MergeReviewItem }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<ExplainResponse | null>(null);
  const [errMsg, setErrMsg] = useState('');

  async function load() {
    setState('loading');
    try {
      const res = await fetch('/api/bud/merge-review/explain', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ item }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      setResult(await res.json() as ExplainResponse);
      setState('done');
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Failed');
      setState('error');
    }
  }

  if (state === 'idle') {
    return (
      <button
        onClick={() => void load()}
        className="rounded-md border border-violet-400/20 bg-violet-500/[0.06] px-3 py-1.5 text-[11px] font-medium text-violet-400 hover:bg-violet-500/[0.12]"
      >
        Explain this change in plain English
      </button>
    );
  }

  if (state === 'loading') {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <p className="text-[12px] text-white/40">Generating plain-English explanation…</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <p className="text-[12px] text-red-400">
        Could not generate explanation: {errMsg}.{' '}
        <button onClick={() => void load()} className="underline hover:text-red-300">Retry</button>
      </p>
    );
  }

  if (!result) return null;

  return (
    <div className="rounded-xl border border-violet-500/[0.12] bg-violet-500/[0.04] p-4 space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-400/70">Plain-English Explanation</p>
      {([
        ['What it does', result.whatItDoes],
        ['Why it matters', result.whyItMatters],
        ['Should you approve it', result.shouldYouApprove],
        ['What happens if you ignore it', result.whatHappensIfIgnored],
      ] as [string, string][]).map(([heading, text]) => (
        <div key={heading}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{heading}</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-white/70">{text}</p>
        </div>
      ))}
      <button onClick={() => setState('idle')} className="text-[11px] text-white/30 hover:text-white/60">
        Dismiss
      </button>
    </div>
  );
}

// ── SafetyGuardrailsPanel ─────────────────────────────────────────────────────

function SafetyGuardrailsPanel({ guardrails }: { guardrails: AgentReviewerReport['safetyGuardrails'] }) {
  const [expanded, setExpanded] = useState(false);

  if (!guardrails) return null;

  const { finalScore, originalScore, adjustments, highRiskFlags, auditSummary, heightenedCautionActive, heightenedCautionArea, requiresHumanDecision } = guardrails;

  const hasFlags = highRiskFlags.length > 0;
  const hasAdjustments = adjustments.length > 0;

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setExpanded(x => !x)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-white/[0.03]"
      >
        <div className="flex items-center gap-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Safety Guardrails</p>
          {requiresHumanDecision && (
            <span className="inline-flex items-center rounded border border-sky-500/20 bg-sky-500/[0.06] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sky-400">
              Human decision required
            </span>
          )}
          {heightenedCautionActive && (
            <span className="inline-flex items-center rounded border border-orange-500/20 bg-orange-500/[0.08] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-orange-400">
              Heightened caution
            </span>
          )}
          <span className="text-[11px] text-white/30 tabular-nums">{originalScore} → {finalScore}</span>
        </div>
        <span className="text-[11px] text-white/30">{expanded ? 'Hide' : 'Show'}</span>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.06] px-4 pb-4 pt-3 space-y-4">

          {/* Audit summary */}
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
            <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/25">Score audit</p>
            <p className="text-[12px] leading-snug text-white/55">{auditSummary}</p>
          </div>

          {/* Heightened caution */}
          {heightenedCautionActive && (
            <div className="rounded-lg border border-orange-500/[0.18] bg-orange-500/[0.04] px-3 py-2.5">
              <p className="text-[12px] font-semibold text-orange-400">
                ⚠ Heightened caution active for {heightenedCautionArea ?? 'this area'}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-orange-400/70">
                This area has had repeated wrong predictions. Extra manual scrutiny is required before approving.
              </p>
            </div>
          )}

          {/* Score adjustments */}
          {hasAdjustments && (
            <div>
              <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-white/25">Score adjustments</p>
              <div className="space-y-1.5">
                {adjustments.map((adj, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-[12px]">
                    <span className={`shrink-0 font-semibold tabular-nums ${adj.amount < 0 ? 'text-red-400/80' : 'text-emerald-400/80'}`}>
                      {adj.amount > 0 ? '+' : ''}{adj.amount}
                    </span>
                    <span className="leading-snug text-white/50">{adj.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* High-risk flags */}
          {hasFlags && (
            <div>
              <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-white/25">High-risk area checks</p>
              <div className="space-y-1.5">
                {highRiskFlags.map((flag, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className={`shrink-0 text-[11px] font-bold ${flag.satisfied ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {flag.satisfied ? '✓' : '⚠'}
                    </span>
                    <span className={`text-[12px] leading-snug ${flag.satisfied ? 'text-white/45' : 'text-white/70'}`}>
                      {flag.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ── AgentReviewerPanel ────────────────────────────────────────────────────────

const SCORE_COLOR = (score: number) =>
  score >= 80 ? 'text-emerald-400' :
  score >= 60 ? 'text-amber-400' :
  score >= 40 ? 'text-orange-400' :
  'text-red-400';

const SCORE_BAR_COLOR = (score: number) =>
  score >= 80 ? 'bg-emerald-500' :
  score >= 60 ? 'bg-amber-500' :
  score >= 40 ? 'bg-orange-500' :
  'bg-red-500';

const CONFIDENCE_BADGE: Record<AgentReviewerReport['confidenceAssessment']['level'], string> = {
  high:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10   text-amber-400   border-amber-500/20',
  low:    'bg-red-500/10     text-red-400     border-red-500/20',
};

const EVIDENCE_CONFIDENCE_STYLE: Record<EvidencePack['confidence']['level'], string> = {
  strong:      'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400',
  partial:     'border-amber-500/20   bg-amber-500/[0.06]   text-amber-400',
  weak:        'border-orange-500/20  bg-orange-500/[0.06]  text-orange-400',
  insufficient:'border-red-500/20     bg-red-500/[0.06]     text-red-400',
};

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div>
      <div className="mb-0.5 flex justify-between">
        <span className="text-[11px] text-white/40">{label}</span>
        <span className={`text-[11px] font-semibold tabular-nums ${SCORE_COLOR(score)}`}>{score}</span>
      </div>
      <div className="h-1 w-full rounded-full bg-white/[0.06]">
        <div
          className={`h-1 rounded-full transition-all ${SCORE_BAR_COLOR(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

// ── EvidencePackDisplay ───────────────────────────────────────────────────────

function EvidencePackDisplay({ pack }: { pack: EvidencePack }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      {/* Header row — always visible */}
      <button
        onClick={() => setExpanded(x => !x)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-white/[0.03]"
      >
        <div className="flex items-center gap-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Evidence Pack</p>
          <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${EVIDENCE_CONFIDENCE_STYLE[pack.confidence.level]}`}>
            {pack.confidence.level === 'strong' ? 'Strong evidence' :
             pack.confidence.level === 'partial' ? 'Partial evidence' :
             pack.confidence.level === 'weak' ? 'Weak evidence' :
             'Insufficient evidence'}
          </span>
          {pack.confidence.scorePenalty > 0 && (
            <span className="text-[11px] text-orange-400/70">−{pack.confidence.scorePenalty} score penalty</span>
          )}
        </div>
        <span className="text-[11px] text-white/30">{expanded ? 'Hide' : 'Show'}</span>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-white/[0.06] px-4 pb-4 pt-3">

          {/* 1. Files changed */}
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">Files Changed</p>
            {pack.filesChanged.available ? (
              <div className="space-y-2">
                {pack.filesChanged.coreAreasTouched.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {pack.filesChanged.coreAreasTouched.map(area => (
                      <span key={area} className="inline-flex items-center rounded border border-sky-500/20 bg-sky-500/[0.06] px-1.5 py-px text-[10px] text-sky-400">
                        {area}
                      </span>
                    ))}
                  </div>
                )}
                {pack.filesChanged.highRiskFiles.length > 0 && (
                  <div className="rounded-lg border border-red-500/[0.15] bg-red-500/[0.04] px-3 py-2 space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-red-400/70">High-risk files</p>
                    {pack.filesChanged.highRiskFiles.map(f => (
                      <div key={f.filename}>
                        <span className="font-mono text-[11px] text-red-300/80">{f.filename}</span>
                        <span className="ml-2 text-[11px] text-white/40">{f.riskReason}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-0.5">
                  {pack.filesChanged.files.slice(0, 12).map(f => (
                    <div key={f.filename} className="flex items-center gap-2 text-[11px]">
                      <span className={`shrink-0 ${f.isHighRisk ? 'text-red-400/80' : 'text-white/25'}`}>
                        {f.isHighRisk ? '⚠' : '·'}
                      </span>
                      <span className={`font-mono truncate ${f.isHighRisk ? 'text-red-300/70' : 'text-white/45'}`}>
                        {f.filename}
                      </span>
                      <span className="ml-auto shrink-0 text-white/25">
                        {f.additions > 0 && <span className="text-emerald-400/50">+{f.additions}</span>}
                        {f.deletions > 0 && <span className="ml-1 text-red-400/50">-{f.deletions}</span>}
                      </span>
                    </div>
                  ))}
                  {pack.filesChanged.totalCount > 12 && (
                    <p className="text-[11px] text-white/25">+{pack.filesChanged.totalCount - 12} more files</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-[12px] text-white/35">
                File list unavailable — GitHub not configured. Risk assessed from branch name and labels only.
              </p>
            )}
          </div>

          {/* 2. Test evidence */}
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">Test Evidence</p>
            <div className="flex flex-wrap gap-2">
              {([
                ['CI',         pack.testEvidence.ciStatus],
                ['Typecheck',  pack.testEvidence.typecheck],
                ['Lint',       pack.testEvidence.lint],
                ['Build',      pack.testEvidence.build],
                ['Unit tests', pack.testEvidence.unitTests],
                ...(pack.testEvidence.migrationSafe ? [['Migration', pack.testEvidence.migrationSafe]] : []),
              ] as [string, string][]).map(([label, status]) => (
                <div key={label} className="flex items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-1">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                    status === 'pass' || status === 'success' ? 'bg-emerald-400' :
                    status === 'fail' || status === 'failure' ? 'bg-red-400' :
                    'bg-white/20'
                  }`} />
                  <span className="text-[11px] text-white/50">{label}</span>
                  <span className={`text-[11px] font-medium ${
                    status === 'pass' || status === 'success' ? 'text-emerald-400' :
                    status === 'fail' || status === 'failure' ? 'text-red-400' :
                    'text-white/30'
                  }`}>{status}</span>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-white/30">
              {pack.testEvidence.checksPassed}/{pack.testEvidence.checksTotal} checks passed
            </p>
          </div>

          {/* 3. Code risk */}
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">Code Risk</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {pack.codeRisk.filesCount !== null && (
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-center">
                  <p className="text-lg font-semibold tabular-nums text-white/70">{pack.codeRisk.filesCount}</p>
                  <p className="text-[10px] text-white/30">Files</p>
                </div>
              )}
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-center">
                <p className="text-lg font-semibold tabular-nums text-emerald-400/80">+{pack.codeRisk.linesAdded}</p>
                <p className="text-[10px] text-white/30">Added</p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-center">
                <p className="text-lg font-semibold tabular-nums text-red-400/80">-{pack.codeRisk.linesRemoved}</p>
                <p className="text-[10px] text-white/30">Removed</p>
              </div>
            </div>
            {pack.codeRisk.highRiskAreasTouched.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {pack.codeRisk.highRiskAreasTouched.map(area => (
                  <span key={area} className="inline-flex items-center rounded border border-orange-500/20 bg-orange-500/[0.06] px-1.5 py-px text-[10px] text-orange-400">
                    {area}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/35">
              {pack.codeRisk.hasMigration && <span className="text-red-400/70">Database migration</span>}
              {pack.codeRisk.touchesAuth && <span>Auth layer</span>}
              {pack.codeRisk.touchesPayments && <span className="text-red-400/70">Payments</span>}
              {pack.codeRisk.touchesQuotes && <span className="text-amber-400/70">Quote funnel</span>}
              {pack.codeRisk.touchesCustomerFlow && <span>Customer flow</span>}
              {pack.codeRisk.touchesAgentSystem && <span>Agent system</span>}
            </div>
          </div>

          {/* 4. Preview evidence */}
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">Preview Evidence</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[12px]">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${pack.previewEvidence.previewUrlAvailable ? 'bg-emerald-400' : 'bg-white/20'}`} />
                <span className="text-white/50">Preview URL</span>
                <span className={pack.previewEvidence.previewUrlAvailable ? 'text-emerald-400' : 'text-white/30'}>
                  {pack.previewEvidence.previewUrlAvailable ? 'Available' : 'Not available'}
                </span>
                {pack.previewEvidence.previewUrl && (
                  <a href={pack.previewEvidence.previewUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-sky-400 hover:underline">
                    Open ↗
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2 text-[12px]">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${pack.previewEvidence.manuallyTested ? 'bg-emerald-400' : 'bg-white/20'}`} />
                <span className="text-white/50">Manual test</span>
                <span className={pack.previewEvidence.manuallyTested ? 'text-emerald-400' : 'text-white/30'}>
                  {pack.previewEvidence.manuallyTested ? 'Completed' : 'Not yet tested'}
                </span>
              </div>
            </div>
          </div>

          {/* 5. Historical evidence */}
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">Historical Evidence</p>
            <p className="text-[12px] leading-snug text-white/50">{pack.historicalEvidence.historicalRiskNote}</p>
            {pack.historicalEvidence.duplicatePRs.length > 0 && (
              <p className="mt-1.5 text-[12px] text-amber-400/80">
                Possible duplicate of PR{pack.historicalEvidence.duplicatePRs.length > 1 ? 's' : ''}{' '}
                {pack.historicalEvidence.duplicatePRs.map(n => `#${n}`).join(', ')}
              </p>
            )}
            {pack.historicalEvidence.relatedPRsInArea.length > 0 && (
              <div className="mt-1.5 space-y-0.5">
                <p className="text-[11px] text-white/30">Related PRs in same area:</p>
                {pack.historicalEvidence.relatedPRsInArea.map(p => (
                  <p key={p.prNumber} className="text-[12px] text-white/45">
                    <span className="font-mono text-white/30">#{p.prNumber}</span> {p.plainTitle}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* 6. Evidence confidence */}
          <div className={`rounded-lg border px-3 py-2.5 ${EVIDENCE_CONFIDENCE_STYLE[pack.confidence.level]}`}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">Evidence confidence</p>
              <span className="text-[11px] font-semibold tabular-nums">{pack.confidence.score}/100</span>
            </div>
            {pack.confidence.missing.length > 0 && (
              <div className="mt-2 space-y-0.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60">Missing</p>
                {pack.confidence.missing.map(m => (
                  <p key={m} className="text-[11px] leading-snug opacity-80">· {m}</p>
                ))}
              </div>
            )}
            {pack.confidence.present.length > 0 && (
              <div className="mt-2 space-y-0.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Present</p>
                {pack.confidence.present.map(p => (
                  <p key={p} className="text-[11px] leading-snug text-white/45">✓ {p}</p>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

function AgentReviewerPanel({
  item,
  duplicateOf,
  allItems,
  tested,
  onReportLoaded,
}: {
  item: MergeReviewItem;
  duplicateOf: number[];
  allItems: MergeReviewItem[];
  tested: boolean;
  onReportLoaded?: (report: AgentReviewerReport, evidence: EvidencePack | null) => void;
}) {
  const [phase, setPhase] = useState<'idle' | 'evidence' | 'analysis' | 'done' | 'error'>('idle');
  const [evidence, setEvidence] = useState<EvidencePack | null>(null);
  const [report, setReport] = useState<AgentReviewerReport | null>(null);
  const [errMsg, setErrMsg] = useState('');
  const [predictionSaved, setPredictionSaved] = useState(false);
  const [showOutcomeForm, setShowOutcomeForm] = useState(false);
  const [outcomeSubmitting, setOutcomeSubmitting] = useState(false);
  const [outcomeResult, setOutcomeResult] = useState<{
    verdict: string; accuracyScore: number;
    learningNotes: { whatGotRight: string; whatMissed: string; calibrationNote: string };
  } | null>(null);
  // Outcome form state
  const [productionHealthy, setProductionHealthy] = useState<boolean | null>(null);
  const [errorsIncreased, setErrorsIncreased] = useState<boolean | null>(null);
  const [workflowAffected, setWorkflowAffected] = useState<boolean | null>(null);
  const [rollbackNeeded, setRollbackNeeded] = useState<boolean | null>(null);
  const [improvementHappened, setImprovementHappened] = useState<boolean | null>(null);
  const [outcomeNotes, setOutcomeNotes] = useState('');

  function resetAll() {
    setPhase('idle'); setEvidence(null); setReport(null); setErrMsg('');
    setPredictionSaved(false); setShowOutcomeForm(false); setOutcomeResult(null);
    setProductionHealthy(null); setErrorsIncreased(null); setWorkflowAffected(null);
    setRollbackNeeded(null); setImprovementHappened(null); setOutcomeNotes('');
  }

  async function load() {
    setPhase('evidence');
    try {
      // Phase 1: build evidence pack
      const evRes = await fetch('/api/bud/merge-review/evidence', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ item, allItems, duplicateOf, manuallyTested: tested }),
      });
      if (!evRes.ok) {
        const d = await evRes.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? `Evidence HTTP ${evRes.status}`);
      }
      const pack = await evRes.json() as EvidencePack;
      setEvidence(pack);

      // Phase 2: AI analysis with evidence
      setPhase('analysis');
      const arRes = await fetch('/api/bud/merge-review/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ item, evidence: pack }),
      });
      if (!arRes.ok) {
        const d = await arRes.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? `Analysis HTTP ${arRes.status}`);
      }
      const finalReport = await arRes.json() as AgentReviewerReport;
      setReport(finalReport);
      setPhase('done');
      onReportLoaded?.(finalReport, pack);

      // Phase 3: save prediction (fire-and-forget — does not block the UI)
      fetch('/api/bud/merge-review/predictions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ item, report: finalReport, evidence: pack }),
      }).then((r) => { if (r.ok) setPredictionSaved(true); }).catch(() => {/* silent */});
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Failed');
      setPhase('error');
    }
  }

  async function submitOutcome() {
    setOutcomeSubmitting(true);
    try {
      const res = await fetch(`/api/bud/merge-review/predictions/${item.prNumber}/outcome`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          productionHealthy, errorsIncreased, workflowAffected,
          rollbackNeeded, improvementHappened, outcomeNotes,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as typeof outcomeResult;
      setOutcomeResult(data);
      setShowOutcomeForm(false);
    } catch {
      // show nothing — outcome submit is best-effort
    } finally {
      setOutcomeSubmitting(false);
    }
  }

  if (phase === 'idle') {
    return (
      <button
        onClick={() => void load()}
        className="rounded-md border border-teal-400/20 bg-teal-500/[0.06] px-3 py-1.5 text-[11px] font-medium text-teal-400 hover:bg-teal-500/[0.12]"
      >
        Run Agent Reviewer — full business audit
      </button>
    );
  }

  if (phase === 'evidence') {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <p className="text-[12px] text-white/40">Collecting evidence — fetching file list and checks…</p>
      </div>
    );
  }

  if (phase === 'analysis') {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
        {evidence && <EvidencePackDisplay pack={evidence} />}
        <p className="text-[12px] text-white/40">Generating business audit… ~10 seconds.</p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <p className="text-[12px] text-red-400">
        Agent Reviewer failed: {errMsg}.{' '}
        <button onClick={resetAll} className="underline hover:text-red-300">Retry</button>
      </p>
    );
  }

  if (!report) return null;

  const isApprove = report.approvalExplanation.toLowerCase().startsWith('approve');

  const VERDICT_STYLE: Record<string, string> = {
    correct:           'text-emerald-400',
    partially_correct: 'text-amber-400',
    wrong:             'text-red-400',
    unknown:           'text-white/40',
  };

  return (
    <div className="space-y-4">
      <MergeGatePanel
        decision={computeMergeGate({ item, report, evidence, manuallyTested: tested })}
        githubUrl={item.githubUrl}
      />
      <div className="rounded-xl border border-teal-500/[0.15] bg-teal-500/[0.03] p-4 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-400/70">Agent Reviewer — Business Audit</p>
          {predictionSaved && (
            <span className="inline-flex items-center rounded border border-teal-500/20 bg-teal-500/[0.08] px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-teal-400/70">
              Prediction recorded
            </span>
          )}
        </div>
        <button onClick={resetAll} className="text-[10px] text-white/25 hover:text-white/50">Dismiss</button>
      </div>

      {/* Recommendation Quality Score */}
      <div className="flex items-center gap-4 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3">
        <div className="text-center">
          <p className={`text-3xl font-bold tabular-nums ${SCORE_COLOR(report.recommendationQualityScore)}`}>
            {report.recommendationQualityScore}
          </p>
          <p className="text-[10px] text-white/30">/ 100</p>
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Recommendation Quality</p>
          <div className="mt-1.5 h-2 w-full rounded-full bg-white/[0.06]">
            <div
              className={`h-2 rounded-full transition-all ${SCORE_BAR_COLOR(report.recommendationQualityScore)}`}
              style={{ width: `${report.recommendationQualityScore}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-white/35">
            {report.recommendationQualityScore >= 90 ? 'Approve immediately' :
             report.recommendationQualityScore >= 70 ? 'Approve after minor checks' :
             report.recommendationQualityScore >= 50 ? 'Hold and investigate' :
             report.recommendationQualityScore >= 30 ? 'Request changes' :
             'Reject'}
          </p>
          {evidence && evidence.confidence.scorePenalty > 0 && (
            <p className="mt-0.5 text-[10px] text-orange-400/60">
              Includes −{evidence.confidence.scorePenalty} penalty for {evidence.confidence.level} evidence
            </p>
          )}
        </div>
      </div>

      {/* Approval Explanation */}
      <div className={`rounded-lg border px-3 py-2.5 ${isApprove ? 'border-emerald-500/20 bg-emerald-500/[0.05]' : 'border-red-500/20 bg-red-500/[0.05]'}`}>
        <p className={`text-[13px] font-medium leading-relaxed ${isApprove ? 'text-emerald-300/90' : 'text-red-300/90'}`}>
          {report.approvalExplanation}
        </p>
      </div>

      {/* Evidence Pack — always shown so the user can see what the score is based on */}
      {evidence && <EvidencePackDisplay pack={evidence} />}

      {/* Safety Guardrails */}
      <SafetyGuardrailsPanel guardrails={report.safetyGuardrails} />

      {/* Executive Summary */}
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/30">Executive Summary</p>
        <p className="text-[13px] leading-relaxed text-white/70">{report.executiveSummary}</p>
      </div>

      {/* Before vs After */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">Before vs After</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/25">Before</p>
            <p className="text-[12px] leading-snug text-white/55">{report.beforeAfter.before}</p>
          </div>
          <div className="rounded-lg border border-teal-500/[0.12] bg-teal-500/[0.03] px-3 py-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-teal-400/60">After</p>
            <p className="text-[12px] leading-snug text-white/65">{report.beforeAfter.after}</p>
          </div>
        </div>
        <p className="mt-2 text-[12px] leading-snug text-white/45">{report.beforeAfter.whyItMatters}</p>
      </div>

      {/* Business Impact */}
      <div>
        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">Business Impact</p>
        <div className="space-y-2.5">
          <ScoreBar label="Revenue impact" score={report.businessImpact.revenue} />
          <ScoreBar label="Customer impact" score={report.businessImpact.customer} />
          <ScoreBar label="Operational impact" score={report.businessImpact.operational} />
          <ScoreBar label="Agent quality impact" score={report.businessImpact.agentQuality} />
          <ScoreBar label="Reliability impact" score={report.businessImpact.reliability} />
        </div>
        <p className="mt-2 text-[12px] text-white/45">{report.businessImpact.summary}</p>
      </div>

      {/* Hidden Risks */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">Hidden Risks</p>
        <div className="space-y-2">
          {([
            ['Potential regressions',   report.hiddenRisks.regressions],
            ['Unintended side effects', report.hiddenRisks.sideEffects],
            ['Test coverage gaps',      report.hiddenRisks.testCoverage],
            ['Dependency risks',        report.hiddenRisks.dependencyRisks],
            ['Database risks',          report.hiddenRisks.databaseRisks],
          ] as [string, string][]).map(([label, text]) => (
            <div key={label} className="flex items-start gap-2">
              <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-white/20" />
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/25">{label}: </span>
                <span className="text-[12px] leading-snug text-white/55">{text}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Confidence Assessment */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">Confidence Assessment</p>
        <div className="flex items-start gap-3">
          <span className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${CONFIDENCE_BADGE[report.confidenceAssessment.level]}`}>
            {report.confidenceAssessment.level} — {report.confidenceAssessment.score}%
          </span>
          <div>
            <p className="text-[12px] leading-snug text-white/60">{report.confidenceAssessment.reason}</p>
            <p className="mt-0.5 text-[12px] leading-snug text-white/40">{report.confidenceAssessment.evidence}</p>
          </div>
        </div>
      </div>

      {/* Simulated Outcome */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">Simulated Outcome</p>
        <div className="space-y-1.5">
          {([
            ['Best case',  report.simulatedOutcome.bestCase,     'text-emerald-400/70'],
            ['Expected',   report.simulatedOutcome.expectedCase, 'text-white/40'],
            ['Worst case', report.simulatedOutcome.worstCase,    'text-red-400/70'],
          ] as [string, string, string][]).map(([label, text, labelStyle]) => (
            <div key={label} className="flex items-start gap-2 text-[12px]">
              <span className={`shrink-0 font-semibold ${labelStyle}`}>{label}:</span>
              <span className="leading-snug text-white/55">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Calibration applied note */}
      {evidence?.calibration.applied && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/25">Calibration active</p>
          <p className="mt-0.5 text-[11px] leading-snug text-white/40">
            Score adjusted by {evidence.calibration.scoreAdjustment > 0 ? '+' : ''}{evidence.calibration.scoreAdjustment} pts,
            evidence penalty ×{evidence.calibration.penaltyMultiplier} based on past outcomes for{' '}
            {item.systemArea.replace(/_/g, ' ')} PRs.
            {evidence.calibration.accuracyRate !== null && (
              <> Historical accuracy: {evidence.calibration.accuracyRate}%.</>
            )}
          </p>
          {evidence.calibration.note && (
            <p className="mt-1 text-[11px] leading-snug text-white/30">{evidence.calibration.note}</p>
          )}
        </div>
      )}

      {/* Outcome result — shown after submitting */}
      {outcomeResult && (
        <div className={`rounded-lg border px-3 py-3 space-y-2 ${
          outcomeResult.verdict === 'correct' ? 'border-emerald-500/20 bg-emerald-500/[0.04]' :
          outcomeResult.verdict === 'wrong'   ? 'border-red-500/20     bg-red-500/[0.04]'     :
                                                'border-amber-500/20   bg-amber-500/[0.04]'
        }`}>
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Outcome recorded</p>
            <span className={`text-[11px] font-semibold ${VERDICT_STYLE[outcomeResult.verdict] ?? 'text-white/40'}`}>
              {outcomeResult.verdict.replace(/_/g, ' ')} — {outcomeResult.accuracyScore}/100
            </span>
          </div>
          {outcomeResult.learningNotes.whatGotRight && (
            <p className="text-[12px] leading-snug text-white/55">
              <span className="font-medium text-emerald-400/70">Got right: </span>
              {outcomeResult.learningNotes.whatGotRight}
            </p>
          )}
          {outcomeResult.learningNotes.whatMissed && outcomeResult.learningNotes.whatMissed !== 'Nothing significant.' && (
            <p className="text-[12px] leading-snug text-white/55">
              <span className="font-medium text-amber-400/70">Missed: </span>
              {outcomeResult.learningNotes.whatMissed}
            </p>
          )}
          {outcomeResult.learningNotes.calibrationNote && (
            <p className="text-[12px] leading-snug text-white/40 italic">{outcomeResult.learningNotes.calibrationNote}</p>
          )}
        </div>
      )}

      {/* Outcome form — record what actually happened after merge */}
      {!outcomeResult && predictionSaved && (
        <div className="border-t border-white/[0.06] pt-4">
          {!showOutcomeForm ? (
            <button
              onClick={() => setShowOutcomeForm(true)}
              className="rounded-md border border-white/[0.10] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-white/50 hover:bg-white/[0.07] hover:text-white/70"
            >
              Record actual outcome after merge →
            </button>
          ) : (
            <div className="space-y-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Post-merge reality check</p>
              <p className="text-[12px] text-white/45">Answer after the PR has been merged and deployed. This trains the reviewer to be more accurate.</p>

              {([
                ['Production stayed healthy?', productionHealthy, setProductionHealthy],
                ['Errors increased after deploy?', errorsIncreased, setErrorsIncreased],
                ['Affected workflow still works?', workflowAffected === null ? null : !workflowAffected, (v: boolean | null) => setWorkflowAffected(v === null ? null : !v)],
                ['Expected improvement happened?', improvementHappened, setImprovementHappened],
                ['Rollback was needed?', rollbackNeeded, setRollbackNeeded],
              ] as [string, boolean | null, (v: boolean | null) => void][]).map(([label, value, setter]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <span className="text-[12px] text-white/55">{label}</span>
                  <div className="flex gap-1">
                    {([['Yes', true], ['No', false]] as [string, boolean][]).map(([btnLabel, btnVal]) => (
                      <button
                        key={btnLabel}
                        onClick={() => setter(value === btnVal ? null : btnVal)}
                        className={`rounded px-2.5 py-0.5 text-[11px] font-medium transition ${
                          value === btnVal
                            ? 'bg-white/15 text-white'
                            : 'border border-white/[0.08] text-white/35 hover:text-white/60'
                        }`}
                      >
                        {btnLabel}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div>
                <p className="mb-1 text-[10px] text-white/30">Notes (optional)</p>
                <textarea
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                  rows={2}
                  placeholder="Any relevant details about what happened after merge…"
                  className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-white/70 placeholder-white/20 outline-none focus:border-white/20 resize-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => void submitOutcome()}
                  disabled={outcomeSubmitting}
                  className="rounded-md border border-teal-400/20 bg-teal-500/[0.08] px-3 py-1.5 text-[11px] font-medium text-teal-400 hover:bg-teal-500/[0.14] disabled:opacity-50"
                >
                  {outcomeSubmitting ? 'Saving…' : 'Save outcome & generate lesson'}
                </button>
                <button
                  onClick={() => setShowOutcomeForm(false)}
                  className="text-[11px] text-white/30 hover:text-white/55"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
    </div>
  );
}

// ── ReviewCard ────────────────────────────────────────────────────────────────

function ReviewCard({ item, duplicateOf, allItems, onStartReview }: { item: MergeReviewItem; duplicateOf: number[]; allItems: MergeReviewItem[]; onStartReview: (item: MergeReviewItem, report?: AgentReviewerReport | null, evidence?: EvidencePack | null) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [tested, setTested] = useState(false);
  const [archived, setArchived] = useState(false);
  const [latestReport, setLatestReport] = useState<AgentReviewerReport | null>(null);
  const [latestEvidence, setLatestEvidence] = useState<EvidencePack | null>(null);

  function handleStartReview(reviewItem: MergeReviewItem) {
    onStartReview(reviewItem, latestReport, latestEvidence);
  }

  // Hydrate from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    setTested(localStorage.getItem(`bud-mr-tested-${item.prNumber}`) === '1');
    setArchived(localStorage.getItem(`bud-mr-archived-${item.prNumber}`) === '1');
  }, [item.prNumber]);

  function toggleTested() {
    const next = !tested;
    setTested(next);
    try { localStorage.setItem(`bud-mr-tested-${item.prNumber}`, next ? '1' : '0'); } catch { /* storage unavailable */ }
  }

  function toggleArchived() {
    const next = !archived;
    setArchived(next);
    try { localStorage.setItem(`bud-mr-archived-${item.prNumber}`, next ? '1' : '0'); } catch { /* storage unavailable */ }
  }

  const rel = (() => {
    const d = Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 86_400_000);
    if (d === 0) return 'today';
    if (d === 1) return '1d ago';
    if (d < 30) return `${d}d ago`;
    return `${Math.floor(d / 30)}mo ago`;
  })();

  if (archived) {
    return (
      <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] px-4 py-2.5 opacity-40">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-white/30">#{item.prNumber}</span>
          <span className="text-[12px] text-white/40">{item.plainTitle}</span>
          <span className="text-[10px] text-white/25">— archived as duplicate</span>
          <button onClick={toggleArchived} className="ml-auto text-[10px] text-white/25 hover:text-white/50">
            Restore
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border bg-white/[0.03] p-4 transition hover:border-white/[0.12] ${
      duplicateOf.length > 0 ? 'border-amber-500/[0.12]' : 'border-white/[0.07]'
    }`}>
      {/* Header */}
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Chip label={item.riskLevel} style={RISK_STYLES[item.riskLevel]} />
          <span className="inline-flex items-center">
            <Chip label={SYSTEM_AREA_LABELS[item.systemArea]} style={SYSTEM_AREA_STYLES[item.systemArea]} />
            <HelpTip text={`This change touches the ${SYSTEM_AREA_LABELS[item.systemArea].toLowerCase()} layer of the platform.`} />
          </span>
          {item.isDraft && <Chip label="Draft" style="bg-white/5 text-white/40 border-white/[0.07]" />}
          {tested && <Chip label="Tested" style="bg-emerald-500/10 text-emerald-400 border-emerald-500/20" />}
          {duplicateOf.length > 0 && <Chip label="Possible duplicate" style="bg-amber-500/10 text-amber-400 border-amber-500/20" />}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-medium ${CI_STYLES[item.ciStatus]}`}>{CI_LABELS[item.ciStatus]}</span>
          <span className="text-[11px] text-white/30">{rel}</span>
        </div>
      </div>

      {/* Title */}
      <div className="mt-2 flex items-baseline gap-2">
        <span className="shrink-0 font-mono text-[11px] text-white/25">#{item.prNumber}</span>
        <h3 className="text-sm font-semibold text-white/90">{item.plainTitle}</h3>
      </div>
      <p className="mt-0.5 font-mono text-[12px] text-white/35">{item.branch}</p>

      {/* Recommendation — initial estimate before reviewer runs, reviewer verdict after */}
      {latestReport ? (() => {
        const reviewerApproves = latestReport.approvalExplanation.toLowerCase().startsWith('approve');
        const initialIsApprove = item.recommendation === 'approve';
        const hasConflict = initialIsApprove !== reviewerApproves;
        const gate = computeMergeGate({ item, report: latestReport, evidence: latestEvidence, manuallyTested: tested });
        return (
          <div className="mt-3 space-y-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-white/25">Approval recommendation</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-sm font-bold tabular-nums ${SCORE_COLOR(latestReport.recommendationQualityScore)}`}>
                {latestReport.recommendationQualityScore}
              </span>
              <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-medium ${reviewerApproves ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                {reviewerApproves ? 'Approve' : 'Do not approve'}
              </span>
              {latestEvidence && (
                <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${EVIDENCE_CONFIDENCE_STYLE[latestEvidence.confidence.level]}`}>
                  {latestEvidence.confidence.level} evidence
                </span>
              )}
              <span className={`text-[11px] font-medium ${GATE_VERDICT_STYLE[gate.verdict]}`}>
                {gate.verdictLabel}
              </span>
            </div>
            {hasConflict && (
              <p className="text-[11px] text-amber-400/80">⚠ Reviewer verdict overrides initial recommendation</p>
            )}
          </div>
        );
      })() : (
        <div className="mt-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-white/25 mb-1">Initial estimate</p>
          <div className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-medium ${RECOMMENDATION_STYLES[item.recommendation]}`}>
            {item.recommendationLabel}
            <HelpTip text={`Confidence: ${item.confidence}%`} />
          </div>
        </div>
      )}

      {/* CI checks */}
      <div className="mt-3">
        <ChecksStrip checks={item.checks} />
      </div>

      {/* Toggle */}
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => setExpanded(x => !x)}
          className="text-[11px] text-white/40 hover:text-white/70"
        >
          {expanded ? 'Collapse' : 'Details + Next Steps'}
        </button>
        {!expanded && (
          <a href={item.githubUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-[11px] text-white/35 hover:text-white/60">
            GitHub ↗
          </a>
        )}
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="mt-4 space-y-4 border-t border-white/[0.07] pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">What changed</p>
              <p className="mt-0.5 text-[13px] text-white/55">{item.whatChanged}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Why it matters</p>
              <p className="mt-0.5 text-[13px] text-white/55">{item.whyItMatters}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">What could break</p>
              <p className="mt-0.5 text-[13px] text-white/55">{item.couldBreak}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Rollback if something goes wrong</p>
              <p className="mt-0.5 text-[13px] text-white/55">{item.rollbackPlan}</p>
            </div>
          </div>

          <NextStepPanel
            item={item}
            duplicateOf={duplicateOf}
            tested={tested}
            onToggleTested={toggleTested}
            onToggleArchived={toggleArchived}
            onStartReview={handleStartReview}
          />

          <ExplainPanel item={item} />

          <AgentReviewerPanel
            item={item}
            duplicateOf={duplicateOf}
            allItems={allItems}
            tested={tested}
            onReportLoaded={(r, e) => { setLatestReport(r); setLatestEvidence(e); }}
          />
        </div>
      )}
    </div>
  );
}

// ── SummaryStrip ──────────────────────────────────────────────────────────────

function SummaryStrip({ summary }: { summary: MergeReviewResponse['summary'] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {([
        { label: 'Waiting for review', count: summary.total,             style: 'text-white/70',    tip: 'Total open PRs detected from GitHub.' },
        { label: 'Safe to approve',    count: summary.safeToApprove,     style: 'text-emerald-400', tip: 'Low-risk PRs with passing CI. Can be approved without manual inspection.' },
        { label: 'Need manual review', count: summary.needsManualReview, style: 'text-amber-400',   tip: 'Medium-risk changes, draft PRs, or UI/infrastructure changes that need your eyes.' },
        { label: 'Should not be pushed', count: summary.shouldNotPush,   style: 'text-red-400',     tip: 'CI is failing. Do not merge these until the build is green.' },
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

// ── SectionHeader ─────────────────────────────────────────────────────────────

function SectionHeader({ loading, onRefresh }: { loading?: boolean; onRefresh?: () => void }) {
  return (
    <div className="flex items-center justify-between pt-1">
      <div className="flex items-center gap-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/25">Agent Merge Review</span>
        <span className="inline-flex items-center rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-sky-400">
          Read-only
        </span>
        {loading && <span className="text-[10px] text-white/30">Loading…</span>}
      </div>
      {onRefresh && (
        <button onClick={onRefresh} className="text-[11px] text-white/35 hover:text-white/60">Refresh</button>
      )}
    </div>
  );
}

// ── ReviewerAccuracyPanel ─────────────────────────────────────────────────────

const VERDICT_CHIP: Record<string, string> = {
  correct:           'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  partially_correct: 'bg-amber-500/10   text-amber-400   border-amber-500/20',
  wrong:             'bg-red-500/10     text-red-400     border-red-500/20',
  unknown:           'bg-white/5        text-white/40    border-white/10',
};

function ReviewerAccuracyPanel() {
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
    } finally {
      setLoading(false);
    }
  }

  const s = data?.stats;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => void load()}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-white/[0.03]"
      >
        <div className="flex items-center gap-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/25">Reviewer Accuracy</p>
          {s && s.averageAccuracyScore !== null && (
            <span className={`text-[11px] font-semibold tabular-nums ${SCORE_COLOR(s.averageAccuracyScore)}`}>
              {s.averageAccuracyScore}/100
            </span>
          )}
          {s && s.pendingOutcomeChecks > 0 && (
            <span className="inline-flex items-center rounded border border-amber-500/25 bg-amber-500/[0.08] px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-amber-400">
              {s.pendingOutcomeChecks} awaiting outcome
            </span>
          )}
          {loading && <span className="text-[10px] text-white/30">Loading…</span>}
        </div>
        <span className="text-[11px] text-white/30">{expanded ? 'Hide' : 'Show'}</span>
      </button>

      {expanded && data && (
        <div className="border-t border-white/[0.06] px-4 pb-5 pt-4 space-y-5">

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([
              { label: 'Predictions made',   value: s!.totalPredictions,      style: 'text-white/70' },
              { label: 'Outcomes checked',    value: s!.outcomeChecked,         style: 'text-white/70' },
              { label: 'Successful approvals', value: s!.successfulApprovals,  style: 'text-emerald-400' },
              { label: 'Problematic approvals', value: s!.problematicApprovals, style: s!.problematicApprovals > 0 ? 'text-red-400' : 'text-white/40' },
            ] as const).map(({ label, value, style }) => (
              <div key={label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">{label}</p>
                <p className={`mt-0.5 text-xl font-semibold tabular-nums ${style}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Accuracy breakdown */}
          {s!.outcomeChecked > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">Accuracy breakdown</p>
              <div className="flex flex-wrap gap-2">
                {([
                  ['Correct',            s!.correctCount,          'text-emerald-400'],
                  ['Partially correct',  s!.partiallyCorrectCount, 'text-amber-400'],
                  ['Wrong',              s!.wrongCount,            'text-red-400'],
                  ['Unknown',            s!.unknownCount,          'text-white/35'],
                ] as [string, number, string][]).filter(([,count]) => count > 0).map(([label, count, style]) => (
                  <div key={label} className="flex items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5">
                    <span className={`text-lg font-bold tabular-nums ${style}`}>{count}</span>
                    <span className="text-[11px] text-white/40">{label}</span>
                  </div>
                ))}
              </div>
              {s!.averageAccuracyScore !== null && (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between">
                    <span className="text-[11px] text-white/35">Average accuracy</span>
                    <span className={`text-[11px] font-semibold tabular-nums ${SCORE_COLOR(s!.averageAccuracyScore)}`}>
                      {s!.averageAccuracyScore}/100
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/[0.06]">
                    <div
                      className={`h-1.5 rounded-full ${SCORE_BAR_COLOR(s!.averageAccuracyScore)}`}
                      style={{ width: `${s!.averageAccuracyScore}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Calibration state */}
          {data.calibration.some(c => c.total_predictions > 0) && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">Calibration by area</p>
              <div className="space-y-1.5">
                {data.calibration.filter(c => c.total_predictions > 0).map(c => (
                  <div key={c.system_area} className="flex items-center gap-3 text-[11px]">
                    <span className="w-36 shrink-0 text-white/45">{c.system_area.replace(/_/g, ' ')}</span>
                    <span className={c.score_adjustment > 0 ? 'text-emerald-400/80' : c.score_adjustment < 0 ? 'text-red-400/80' : 'text-white/30'}>
                      {c.score_adjustment > 0 ? '+' : ''}{c.score_adjustment} pts
                    </span>
                    <span className={c.penalty_multiplier > 1 ? 'text-orange-400/70' : 'text-white/30'}>
                      ×{c.penalty_multiplier} penalty
                    </span>
                    {c.accuracy_rate !== null && (
                      <span className="ml-auto text-white/30">{c.accuracy_rate}% accurate ({c.total_predictions} predictions)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending outcome checks */}
          {data.pendingChecks.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">Awaiting outcome confirmation</p>
              <div className="space-y-1.5">
                {data.pendingChecks.map(p => (
                  <div key={p.pr_number} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                    <span className="font-mono text-[11px] text-white/30">#{p.pr_number}</span>
                    <span className="flex-1 text-[12px] text-white/55 truncate">{p.plain_title}</span>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${SCORE_COLOR(p.recommendation_score)}`}>
                      {p.recommendation_score}
                    </span>
                    <button
                      onClick={() => setPendingOutcome(pendingOutcome === p.pr_number ? null : p.pr_number)}
                      className="shrink-0 rounded border border-white/[0.10] bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/50 hover:text-white/70"
                    >
                      {pendingOutcome === p.pr_number ? 'Cancel' : 'Check outcome'}
                    </button>
                  </div>
                ))}
              </div>

              {/* Inline quick-outcome form for pending items */}
              {pendingOutcome !== null && (
                <QuickOutcomeForm
                  prNumber={pendingOutcome}
                  onDone={() => { setPendingOutcome(null); setData(null); void load(); }}
                />
              )}
            </div>
          )}

          {/* Recent lessons */}
          {data.recentLessons.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">Recent lessons learned</p>
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
                    {lesson.learning_notes.calibrationNote && (
                      <p className="text-[11px] leading-snug text-white/35 italic">{lesson.learning_notes.calibrationNote}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {s!.totalPredictions === 0 && (
            <p className="text-[12px] text-white/35">
              No predictions recorded yet. Run the Agent Reviewer on a PR to start tracking accuracy.
            </p>
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
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Quick outcome check — PR #{prNumber}</p>
      {([
        ['Production stayed healthy?', productionHealthy,   setProductionHealthy],
        ['Errors increased?',          errorsIncreased,     setErrorsIncreased],
        ['Rollback was needed?',       rollbackNeeded,      setRollbackNeeded],
        ['Improvement happened?',      improvementHappened, setImprovementHappened],
      ] as [string, boolean | null, (v: boolean | null) => void][]).map(([label, value, setter]) => (
        <div key={label} className="flex items-center justify-between">
          <span className="text-[12px] text-white/50">{label}</span>
          <div className="flex gap-1">
            {([['Yes', true], ['No', false]] as [string, boolean][]).map(([btnLabel, btnVal]) => (
              <button
                key={String(btnLabel)}
                onClick={() => setter(value === btnVal ? null : btnVal)}
                className={`rounded px-2.5 py-0.5 text-[11px] font-medium transition ${
                  value === btnVal ? 'bg-white/15 text-white' : 'border border-white/[0.08] text-white/35 hover:text-white/60'
                }`}
              >
                {String(btnLabel)}
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

// ── Main component ────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'approve' | 'needs_manual_review' | 'reject' | 'hold';

// ── SmokeTestPanel (admin-only production integration test) ───────────────────

type SmokePhase = 'idle' | 'evidence' | 'analyze' | 'done' | 'error';

interface SmokeResult {
  pr: MergeReviewItem;
  evidenceOk: boolean;
  evidencePack: EvidencePack | null;
  evidenceError: string | null;
  analyzeOk: boolean;
  report: AgentReviewerReport | null;
  analyzeError: string | null;
  gate: MergeGateDecision | null;
  completedAt: string;
}

function SmokeStep({
  label, ok, error, detail,
}: {
  label: string;
  ok: boolean | null;
  error?: string | null;
  detail?: string;
}) {
  const dot  = ok === null ? 'bg-white/20' : ok ? 'bg-emerald-400' : 'bg-red-400';
  const tick = ok === null ? '—' : ok ? '✓' : '✗';
  return (
    <div className="flex items-start gap-2">
      <span className={`mt-[3px] inline-block h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      <div>
        <span className="font-mono text-[11px] text-white/50">{tick} {label}</span>
        {detail && <p className="text-[11px] text-white/30">{detail}</p>}
        {error  && <p className="text-[11px] text-red-400/70">{error}</p>}
      </div>
    </div>
  );
}

function SmokeTestPanel({ items }: { items: MergeReviewItem[] }) {
  const [phase,  setPhase]  = useState<SmokePhase>('idle');
  const [result, setResult] = useState<SmokeResult | null>(null);

  // Prefer first non-draft PR as the test target
  const target = items.find(i => !i.isDraft) ?? items[0] ?? null;

  async function run() {
    if (!target || phase === 'evidence' || phase === 'analyze') return;
    setPhase('evidence');
    setResult(null);

    const partial: SmokeResult = {
      pr: target,
      evidenceOk:    false,
      evidencePack:  null,
      evidenceError: null,
      analyzeOk:     false,
      report:        null,
      analyzeError:  null,
      gate:          null,
      completedAt:   '',
    };

    // Step 1 — /evidence
    let evidencePack: EvidencePack | null = null;
    try {
      const res = await fetch('/api/bud/merge-review/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: target, allItems: items }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      evidencePack          = await res.json() as EvidencePack;
      partial.evidenceOk   = true;
      partial.evidencePack = evidencePack;
    } catch (e) {
      partial.evidenceError = e instanceof Error ? e.message : String(e);
    }

    // Step 2 — /analyze (LLM)
    setPhase('analyze');
    let report: AgentReviewerReport | null = null;
    try {
      const res = await fetch('/api/bud/merge-review/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: target, evidence: evidencePack }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      report             = await res.json() as AgentReviewerReport;
      partial.analyzeOk = true;
      partial.report    = report;
    } catch (e) {
      partial.analyzeError = e instanceof Error ? e.message : String(e);
    }

    // Step 3 — merge gate (pure client-side computation, no API call)
    if (report) {
      partial.gate = computeMergeGate({
        item: target,
        report,
        evidence: evidencePack ?? undefined,
      });
    }

    // Step 4 — /predictions intentionally skipped to avoid polluting accuracy data

    partial.completedAt = new Date().toISOString();
    setResult(partial);
    setPhase(partial.evidenceError && partial.analyzeError ? 'error' : 'done');
  }

  const running = phase === 'evidence' || phase === 'analyze';

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.015] p-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25">
            Production smoke test
          </p>
          <p className="mt-0.5 text-[12px] text-white/35">
            Calls /evidence → /analyze → computes merge gate on a real PR. Nothing is approved, merged, or saved.
          </p>
        </div>
        <button
          onClick={() => void run()}
          disabled={running || !target}
          className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/55 transition hover:border-white/20 hover:text-white/80 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {running
            ? phase === 'evidence' ? 'Fetching evidence…' : 'Running analyzer…'
            : result ? 'Re-run' : 'Run production smoke test'}
        </button>
      </div>

      {result && (
        <div className="space-y-3 border-t border-white/[0.05] pt-3">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${
              result.evidenceOk && result.analyzeOk ? 'bg-emerald-400'
              : result.evidenceOk || result.analyzeOk ? 'bg-amber-400'
              : 'bg-red-400'
            }`} />
            <p className="text-[12px] font-semibold text-white/60">
              PR #{result.pr.prNumber} — {result.pr.plainTitle}
            </p>
            <span className="ml-auto font-mono text-[10px] text-white/25">
              {new Date(result.completedAt).toLocaleTimeString()}
            </span>
          </div>

          <div className="space-y-2.5">
            <SmokeStep
              label="/evidence"
              ok={result.evidenceOk}
              error={result.evidenceError}
              detail={result.evidencePack
                ? `${result.evidencePack.filesChanged.totalCount} files · confidence ${result.evidencePack.confidence.level} (${result.evidencePack.confidence.score}/100) · penalty −${result.evidencePack.confidence.scorePenalty}`
                : undefined}
            />
            <SmokeStep
              label="/analyze (LLM)"
              ok={result.analyzeOk}
              error={result.analyzeError}
              detail={result.report
                ? `Score ${result.report.recommendationQualityScore}/100 · cap ${result.report.safetyGuardrails.capApplied ? 'applied' : 'not applied'} · heightened caution ${result.report.safetyGuardrails.heightenedCautionActive ? 'YES' : 'no'}`
                : undefined}
            />
            <SmokeStep
              label="merge gate (computed)"
              ok={!!result.gate}
              detail={result.gate
                ? `${result.gate.verdictLabel} · composite ${result.gate.compositeScore}/100 · ${result.gate.blockingIssues.length} blocker${result.gate.blockingIssues.length !== 1 ? 's' : ''}`
                : 'skipped — /analyze did not return a report'}
            />
            <SmokeStep
              label="/predictions"
              ok={null}
              detail="Skipped — smoke tests excluded from reviewer accuracy tracking"
            />
          </div>

          {result.report && (
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/25">
                Executive summary
              </p>
              <p className="text-[12px] leading-relaxed text-white/50">
                {result.report.executiveSummary}
              </p>
            </div>
          )}

          {result.gate && (
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-3 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/25">
                Final merge gate
              </p>
              <p className={`text-[13px] font-semibold ${GATE_VERDICT_STYLE[result.gate.verdict]}`}>
                {result.gate.verdictLabel}
              </p>
              <p className="text-[12px] text-white/40">{result.gate.verdictSubtext}</p>
              <p className="text-[11px] text-white/30">Next: {result.gate.nextAction}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AgentMergeReviewSection() {
  const [data, setData] = useState<MergeReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [activeWorkflowPR, setActiveWorkflowPR] = useState<MergeReviewItem | null>(null);
  const [activeWorkflowReport, setActiveWorkflowReport] = useState<AgentReviewerReport | null>(null);
  const [activeWorkflowEvidence, setActiveWorkflowEvidence] = useState<EvidencePack | null>(null);

  function openWorkflowModal(item: MergeReviewItem, report?: AgentReviewerReport | null, evidence?: EvidencePack | null) {
    setActiveWorkflowPR(item);
    setActiveWorkflowReport(report ?? null);
    setActiveWorkflowEvidence(evidence ?? null);
  }

  function closeWorkflowModal() {
    setActiveWorkflowPR(null);
    setActiveWorkflowReport(null);
    setActiveWorkflowEvidence(null);
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

  // Duplicate detection: PRs sharing the same systemArea
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

  if (loading) return (
    <div className="space-y-4">
      <SectionHeader loading />
      <p className="text-sm text-white/40">Fetching open PRs from GitHub…</p>
    </div>
  );

  if (error) return (
    <div className="space-y-4">
      <SectionHeader />
      <p className="text-sm text-red-400">Error: {error}</p>
    </div>
  );

  if (!data) return null;

  if (!data.githubConfigured) return (
    <div className="space-y-4">
      <SectionHeader />
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-5">
        <p className="text-[13px] text-white/50">
          GitHub is not connected.{' '}
          <span className="text-white/70">
            Set <code className="font-mono text-white/60">GITHUB_TOKEN</code>,{' '}
            <code className="font-mono text-white/60">GITHUB_REPO_OWNER</code>, and{' '}
            <code className="font-mono text-white/60">GITHUB_REPO_NAME</code> to enable merge reviews.
          </span>
        </p>
      </div>
    </div>
  );

  const filterButtons: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: 'all',                 label: 'All',             count: data.items.length },
    { key: 'approve',             label: 'Safe to approve', count: data.summary.safeToApprove },
    { key: 'needs_manual_review', label: 'Needs review',    count: data.items.filter(i => i.recommendation === 'needs_manual_review').length },
    { key: 'reject',              label: 'Failing CI',      count: data.summary.shouldNotPush },
  ];

  const visible = filter === 'all' ? data.items : data.items.filter(i => i.recommendation === filter);

  return (
    <div className="space-y-5">
      <SectionHeader onRefresh={() => void load()} />

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <p className="text-[13px] text-white/55">
          Open code changes waiting to go live. The{' '}
          <strong className="text-white/70">Priority Engine</strong> below controls{' '}
          <strong className="text-white/60">review priority</strong> — which PR to look at first and why.
          To get an <strong className="text-white/60">approval recommendation</strong>, expand any card and run the Agent Reviewer.
        </p>
      </div>

      <ReviewPrioritisationEngine
        items={data.items}
        duplicateMap={duplicateMap}
        onStartReview={openWorkflowModal}
      />

      <div className="border-t border-white/[0.06]" />

      <SummaryStrip summary={data.summary} />

      {data.summary.topRecommended.length > 0 && (
        <div className="rounded-xl border border-emerald-500/[0.12] bg-emerald-500/[0.03] p-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400/70">
            Top changes to improve agent quality
          </p>
          <ul className="space-y-1">
            {data.summary.topRecommended.map(item => (
              <li key={item.prNumber} className="flex items-center gap-2 text-[13px]">
                <span className="text-emerald-400">→</span>
                <span className="text-white/75">{item.plainTitle}</span>
                <span className="font-mono text-[11px] text-white/30">#{item.prNumber}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-1 rounded-lg border border-white/[0.07] bg-white/[0.03] p-0.5 w-fit">
        {filterButtons.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
              filter === key ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
            }`}
          >
            {label}
            {count > 0 && <span className="ml-1 text-white/30">{count}</span>}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-white/35">No PRs in this filter.</p>
      ) : (
        <div className="space-y-3">
          {visible.map(item => (
            <ReviewCard
              key={item.prNumber}
              item={item}
              duplicateOf={duplicateMap.get(item.prNumber) ?? []}
              allItems={data.items}
              onStartReview={openWorkflowModal}
            />
          ))}
        </div>
      )}

      <div className="border-t border-white/[0.05] pt-4 space-y-4">
        <AuditTrailPanel />
        <ReviewerAccuracyPanel />
        <SmokeTestPanel items={data.items} />
      </div>

      {activeWorkflowPR && (
        <MergeDecisionWorkflow
          item={activeWorkflowPR}
          report={activeWorkflowReport}
          evidence={activeWorkflowEvidence}
          isDuplicate={!!(duplicateMap.get(activeWorkflowPR.prNumber)?.length)}
          onClose={closeWorkflowModal}
        />
      )}
    </div>
  );
}
