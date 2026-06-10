'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MergeReviewItem, MergeReviewResponse } from '@/app/api/bud/merge-review/route';
import type { ExplainResponse } from '@/app/api/bud/merge-review/explain/route';
import { HelpTip } from './HelpTip';
import { ReviewPrioritisationEngine } from './ReviewPrioritisationEngine';

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
}: {
  item: MergeReviewItem;
  duplicateOf: number[];
  tested: boolean;
  onToggleTested: () => void;
  onToggleArchived: () => void;
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
          <a
            href={item.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-white/[0.12] bg-white/[0.05] px-3 py-1.5 text-[11px] font-medium text-white/70 hover:bg-white/[0.10] hover:text-white"
          >
            Start review ↗
          </a>

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
          "Request changes" and "Approve for production" copy a pre-written note — paste into GitHub.
          "Convert to improvement" copies a Bud Factory prompt to paste into Claude Code.
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

// ── ReviewCard ────────────────────────────────────────────────────────────────

function ReviewCard({ item, duplicateOf }: { item: MergeReviewItem; duplicateOf: number[] }) {
  const [expanded, setExpanded] = useState(false);
  const [tested, setTested] = useState(false);
  const [archived, setArchived] = useState(false);

  // Hydrate from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    setTested(localStorage.getItem(`bud-mr-tested-${item.prNumber}`) === '1');
    setArchived(localStorage.getItem(`bud-mr-archived-${item.prNumber}`) === '1');
  }, [item.prNumber]);

  function toggleTested() {
    const next = !tested;
    setTested(next);
    localStorage.setItem(`bud-mr-tested-${item.prNumber}`, next ? '1' : '0');
  }

  function toggleArchived() {
    const next = !archived;
    setArchived(next);
    localStorage.setItem(`bud-mr-archived-${item.prNumber}`, next ? '1' : '0');
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

      {/* Recommendation */}
      <div className={`mt-3 inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-medium ${RECOMMENDATION_STYLES[item.recommendation]}`}>
        {item.recommendationLabel}
        <HelpTip text={`Confidence: ${item.confidence}%`} />
      </div>

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
          />

          <ExplainPanel item={item} />
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

// ── Main component ────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'approve' | 'needs_manual_review' | 'reject' | 'hold';

export function AgentMergeReviewSection() {
  const [data, setData] = useState<MergeReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');

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
    { key: 'needs_manual_review', label: 'Needs review',    count: data.summary.needsManualReview },
    { key: 'reject',              label: 'Failing CI',      count: data.summary.shouldNotPush },
  ];

  const visible = filter === 'all' ? data.items : data.items.filter(i => i.recommendation === filter);

  return (
    <div className="space-y-5">
      <SectionHeader onRefresh={() => void load()} />

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <p className="text-[13px] text-white/55">
          Open code changes waiting to go live. The{' '}
          <strong className="text-white/70">Priority Engine</strong> below tells you exactly which PR to review first and why.
          Expand any card for the full checklist, verification steps, and action buttons.
        </p>
      </div>

      <ReviewPrioritisationEngine items={data.items} duplicateMap={duplicateMap} />

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
            />
          ))}
        </div>
      )}
    </div>
  );
}
