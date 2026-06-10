'use client';

import { useState } from 'react';
import type { MergeReviewItem } from '@/app/api/bud/merge-review/route';

// ── Audit trail ───────────────────────────────────────────────────────────────

const AUDIT_KEY = 'bud-merge-audit';

export interface AuditEntry {
  id: string;
  prNumber: number;
  prTitle: string;
  branch: string;
  systemArea: string;
  decision: DecisionType;
  testResult: 'passed' | 'failed' | 'skipped';
  postMergeResult: 'passed' | 'failed' | 'pending';
  notes: string;
  timestamp: string;
  reviewer: string;
}

export function loadAuditEntries(): AuditEntry[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(AUDIT_KEY) ?? '[]') as AuditEntry[]; }
  catch { return []; }
}

function persistAuditEntry(entry: AuditEntry): void {
  const existing = loadAuditEntries();
  localStorage.setItem(AUDIT_KEY, JSON.stringify([entry, ...existing].slice(0, 200)));
}

// ── Types & constants ─────────────────────────────────────────────────────────

type Stage = 'review' | 'testing' | 'decision' | 'readiness' | 'post_merge' | 'complete';
type DecisionType = 'approve' | 'request_changes' | 'archive_duplicate' | 'hold';

interface WorkflowState {
  testChecks: Record<string, boolean>;
  testResult: 'passed' | 'failed' | null;
  testNotes: string;
  decision: DecisionType | null;
  decisionNotes: string;
  postMergeChecks: Record<string, boolean>;
  postMergeResult: 'passed' | 'failed' | null;
  postMergeNotes: string;
}

const AREA_LABELS: Record<string, string> = {
  agent_quality: 'Agent Quality', monitoring: 'Monitoring', quote_funnel: 'Quote Funnel',
  dashboard_ui: 'Dashboard UI', infrastructure: 'Infrastructure', customer_experience: 'Customer Experience',
};

const RISK_STYLE: Record<string, string> = {
  low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  high: 'bg-red-500/10 text-red-400 border-red-500/20',
};

// Preview-environment testing steps (before merge)
const PREVIEW_STEPS: Record<string, string[]> = {
  agent_quality: [
    'Open the preview deployment (or /dashboard/agents on staging).',
    'Trigger a manual test run on any agent.',
    'Confirm the run completes and shows in Recent Runs.',
    'Check the agent output looks correct — no errors or silent failures.',
  ],
  monitoring: [
    'Open Mission Control → System Health on the preview.',
    'Confirm no unexpected alerts have fired.',
    'If new monitoring was added, trigger a test condition to confirm it fires.',
  ],
  quote_funnel: [
    'Open /services on the preview deployment.',
    'Complete a full test quote for any service type.',
    'Confirm the final price matches expectations.',
    'Submit and check the confirmation email arrives.',
  ],
  dashboard_ui: [
    'Open the affected dashboard page on the preview.',
    'Check layout at 375px (mobile) and 1280px+ (desktop).',
    'Click through all tabs and panels that were changed.',
    'Confirm no broken elements, missing data, or overlapping text.',
  ],
  infrastructure: [
    'Confirm the preview build deployed successfully on Vercel.',
    'If a migration is included, check Supabase for the test database.',
    'Verify the app loads and core features work on the preview URL.',
  ],
  customer_experience: [
    'Open the preview deployment and complete the affected customer workflow.',
    'If booking-related: create a test booking and verify the confirmation.',
    'If crew-related: log in as a crew member and test the changed flow.',
  ],
};

// Production verification steps (after merge)
const PRODUCTION_STEPS: Record<string, string[]> = {
  agent_quality: [
    'Open /dashboard/agents — confirm all agents show a healthy status.',
    'Trigger a test run on the most-used agent.',
    'Confirm the run succeeds and appears in Recent Runs.',
    'Check agent output for any new errors or silent failures.',
  ],
  monitoring: [
    'Open Mission Control → System Health.',
    'Confirm no unexpected alerts have fired since the deploy.',
    'If new monitors were added, trigger a test condition to confirm they fire.',
  ],
  quote_funnel: [
    'Open /services on the production site.',
    'Complete a full quote end to end — pick a common service.',
    'Confirm the final price is correct and unchanged.',
    'Submit the quote and verify the confirmation email arrives.',
    'Check Supabase for the new quote record.',
  ],
  dashboard_ui: [
    'Open the affected dashboard page on production.',
    'Check on mobile (375px) and desktop.',
    'Confirm all data loads and no elements are broken.',
    'Check nearby tabs for regressions.',
  ],
  infrastructure: [
    'Check Vercel — confirm the deployment succeeded with no errors.',
    'If a migration ran, verify it in Supabase.',
    'Check Supabase logs for errors in the 30 minutes after deploy.',
    'Confirm the site loads and all core features work.',
  ],
  customer_experience: [
    'Complete the affected customer workflow on the live production site.',
    'Confirm all confirmation emails send correctly.',
    'If crew-facing: log in as a crew member and verify the flow.',
    'Monitor support channels for any errors or complaints.',
  ],
};

// ── Gate check logic ──────────────────────────────────────────────────────────

interface GateCheck { label: string; passed: boolean; blocking: boolean; note: string | null }

function getGateChecks(item: MergeReviewItem, ws: WorkflowState): GateCheck[] {
  return [
    {
      label: 'PR is marked ready for review (not a draft)',
      passed: !item.isDraft,
      blocking: true,
      note: item.isDraft ? 'The author needs to mark this PR as ready before it can be merged.' : null,
    },
    {
      label: 'CI checks are passing',
      passed: item.ciStatus === 'success',
      blocking: true,
      note: item.ciStatus === 'failure' ? 'Fix the failing build before merging.' : item.ciStatus !== 'success' ? 'Wait for CI to finish.' : null,
    },
    {
      label: 'Database migration reviewed',
      passed: item.checks.migrationSafe !== 'fail',
      blocking: item.checks.migrationSafe === 'fail',
      note: item.checks.migrationSafe === 'fail' ? 'Review and confirm the migration is safe before merging.' : null,
    },
    {
      label: 'Duplicate check completed',
      passed: true,
      blocking: false,
      note: null,
    },
    {
      label: 'Manual preview test completed',
      passed: ws.testResult === 'passed',
      blocking: false,
      note: ws.testResult === 'failed' ? 'Your preview test failed. Consider requesting changes instead of approving.' : ws.testResult === null ? 'No test result was recorded in the previous step.' : null,
    },
  ];
}

// ── Stage navigation ──────────────────────────────────────────────────────────

const STAGE_ORDER: Stage[] = ['review', 'testing', 'decision', 'readiness', 'post_merge', 'complete'];

const STAGE_LABELS: Record<Stage, string> = {
  review: 'Review', testing: 'Test', decision: 'Decide',
  readiness: 'Gate', post_merge: 'Verify', complete: 'Done',
};

function nextStage(current: Stage, decision: DecisionType | null): Stage {
  if (current === 'decision') return decision === 'approve' ? 'readiness' : 'complete';
  const idx = STAGE_ORDER.indexOf(current);
  return STAGE_ORDER[idx + 1] ?? 'complete';
}

function prevStage(current: Stage): Stage | null {
  if (current === 'complete' || current === 'review') return null;
  const idx = STAGE_ORDER.indexOf(current);
  return STAGE_ORDER[idx - 1] ?? null;
}

// ── Shared UI primitives ──────────────────────────────────────────────────────

function Chip({ label, style }: { label: string; style: string }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${style}`}>
      {label}
    </span>
  );
}

function GateRow({ check }: { check: GateCheck }) {
  const icon = check.passed ? '✓' : check.blocking ? '✗' : '⚠';
  const color = check.passed ? 'text-emerald-400' : check.blocking ? 'text-red-400' : 'text-amber-400';
  return (
    <div className="space-y-0.5">
      <div className="flex items-start gap-2.5">
        <span className={`shrink-0 text-[12px] font-bold ${color}`}>{icon}</span>
        <span className={`text-[13px] ${check.passed ? 'text-white/55' : check.blocking ? 'text-white/80' : 'text-white/65'}`}>
          {check.label}
        </span>
      </div>
      {check.note && (
        <p className={`pl-5 text-[11px] ${check.blocking ? 'text-red-400/70' : 'text-amber-400/70'}`}>{check.note}</p>
      )}
    </div>
  );
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
        checked ? 'border-emerald-500/20 bg-emerald-500/[0.06]' : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12]'
      }`}
    >
      <span className={`mt-0.5 h-3.5 w-3.5 shrink-0 rounded border text-[9px] flex items-center justify-center ${
        checked ? 'border-emerald-400 bg-emerald-400 text-black' : 'border-white/20'
      }`}>
        {checked && '✓'}
      </span>
      <span className={`text-[13px] leading-snug ${checked ? 'text-white/60 line-through' : 'text-white/75'}`}>
        {label}
      </span>
    </button>
  );
}

function ProgressBar({ current, decision }: { current: Stage; decision: DecisionType | null }) {
  const skipStages = new Set<Stage>(decision && decision !== 'approve' ? ['readiness', 'post_merge'] : []);
  const visibleStages = STAGE_ORDER.filter(s => !skipStages.has(s));

  return (
    <div className="flex items-center gap-0">
      {visibleStages.map((stage, i) => {
        const idx = STAGE_ORDER.indexOf(stage);
        const currentIdx = STAGE_ORDER.indexOf(current);
        const done = idx < currentIdx;
        const active = stage === current;
        return (
          <div key={stage} className="flex items-center">
            {i > 0 && (
              <div className={`h-px w-6 transition-all ${done || active ? 'bg-white/20' : 'bg-white/[0.06]'}`} />
            )}
            <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 transition-all ${
              active  ? 'bg-white/10' :
              done    ? 'bg-transparent' :
              'bg-transparent'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full transition-all ${
                active ? 'bg-white' : done ? 'bg-emerald-400' : 'bg-white/[0.15]'
              }`} />
              <span className={`text-[10px] font-semibold transition-all ${
                active ? 'text-white' : done ? 'text-emerald-400' : 'text-white/25'
              }`}>
                {STAGE_LABELS[stage]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Stage content components ──────────────────────────────────────────────────

function StageReview({ item }: { item: MergeReviewItem }) {
  const ciLabel = { success: '✓ CI passing', failure: '✗ CI failing', pending: '… CI running', unknown: '? CI unknown' }[item.ciStatus];
  const ciStyle = { success: 'text-emerald-400', failure: 'text-red-400', pending: 'text-amber-400', unknown: 'text-white/35' }[item.ciStatus];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25 mb-2">What you are reviewing</p>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Chip label={AREA_LABELS[item.systemArea] ?? item.systemArea} style="bg-white/5 text-white/50 border-white/[0.08]" />
            <Chip label={`${item.riskLevel} risk`} style={RISK_STYLE[item.riskLevel]} />
            <span className={`inline-flex items-center text-[11px] font-medium ${ciStyle}`}>{ciLabel}</span>
            {item.isDraft && <Chip label="Draft" style="bg-amber-500/10 text-amber-400 border-amber-500/20" />}
          </div>
          <div>
            <span className="font-mono text-[11px] text-white/25">#{item.prNumber}</span>
            <h3 className="mt-0.5 text-[15px] font-semibold text-white/95">{item.plainTitle}</h3>
            <p className="mt-0.5 font-mono text-[11px] text-white/30">{item.branch}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-white/25 mb-1">What changed</p>
          <p className="text-[13px] leading-relaxed text-white/60">{item.whatChanged}</p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-white/25 mb-1">Why it matters</p>
          <p className="text-[13px] leading-relaxed text-white/60">{item.whyItMatters}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-white/25 mb-1">What could break</p>
          <p className="text-[13px] leading-relaxed text-white/55">{item.couldBreak}</p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-white/25 mb-1">Rollback plan</p>
          <p className="text-[13px] leading-relaxed text-white/55">{item.rollbackPlan}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={item.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-[12px] text-white/60 hover:text-white/90"
        >
          Open GitHub PR ↗
        </a>
        {item.previewUrl && (
          <a
            href={item.previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-sky-400/20 bg-sky-500/[0.06] px-3 py-1.5 text-[12px] text-sky-400 hover:bg-sky-500/[0.12]"
          >
            Open preview ↗
          </a>
        )}
      </div>

      <p className="text-[11px] text-white/30">
        {item.additions}+ / {item.deletions}− lines &middot; {item.labels.length > 0 ? item.labels.join(', ') : 'no labels'}
      </p>
    </div>
  );
}

function StageTesting({
  item,
  ws,
  setWs,
}: {
  item: MergeReviewItem;
  ws: WorkflowState;
  setWs: (fn: (prev: WorkflowState) => WorkflowState) => void;
}) {
  const steps = PREVIEW_STEPS[item.systemArea] ?? [];
  const checkKeys = ['openedPreview', 'testedWorkflow', 'noUIBreakage', 'noConsoleErrors'];
  const checkLabels = [
    item.previewUrl ? 'Opened the preview deployment' : 'Opened the GitHub PR and reviewed the diff',
    'Tested the affected workflow (steps above)',
    'Confirmed no visible UI breakage or layout issues',
    'Confirmed no console errors or runtime exceptions',
  ];

  function toggleCheck(key: string) {
    setWs(prev => ({
      ...prev,
      testChecks: { ...prev.testChecks, [key]: !prev.testChecks[key] },
    }));
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25 mb-2">
          What to test — {AREA_LABELS[item.systemArea] ?? item.systemArea}
        </p>
        <ol className="space-y-2">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[13px] text-white/60">
              <span className="shrink-0 tabular-nums text-[11px] text-white/25">{i + 1}.</span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25 mb-2">Checklist</p>
        <div className="space-y-1.5">
          {checkKeys.map((key, i) => (
            <CheckRow
              key={key}
              label={checkLabels[i]}
              checked={!!ws.testChecks[key]}
              onChange={() => toggleCheck(key)}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25 mb-2">Test result</p>
        <div className="flex gap-2">
          {(['passed', 'failed'] as const).map(result => (
            <button
              key={result}
              onClick={() => setWs(prev => ({ ...prev, testResult: result }))}
              className={`flex-1 rounded-xl border py-2.5 text-[12px] font-semibold transition ${
                ws.testResult === result
                  ? result === 'passed'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : 'border-red-500/30 bg-red-500/10 text-red-400'
                  : 'border-white/[0.08] bg-white/[0.02] text-white/35 hover:text-white/60'
              }`}
            >
              {result === 'passed' ? '✓ Test passed' : '✗ Test failed'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25 mb-1.5">Notes (optional)</p>
        <textarea
          value={ws.testNotes}
          onChange={e => setWs(prev => ({ ...prev, testNotes: e.target.value }))}
          placeholder="Any issues found, things to flag, or context to record…"
          rows={3}
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-white placeholder-white/20 outline-none focus:border-white/20 resize-none"
        />
      </div>
    </div>
  );
}

function StageDecision({
  ws,
  setWs,
}: {
  ws: WorkflowState;
  setWs: (fn: (prev: WorkflowState) => WorkflowState) => void;
}) {
  const options: Array<{ value: DecisionType; label: string; sub: string; style: string; activeStyle: string }> = [
    {
      value: 'approve',
      label: '✓  Approve for production',
      sub: 'CI is passing, test passed, this is safe to merge.',
      style: 'border-white/[0.08] bg-white/[0.02] hover:border-emerald-500/20',
      activeStyle: 'border-emerald-500/25 bg-emerald-500/[0.08]',
    },
    {
      value: 'request_changes',
      label: '↩  Request changes',
      sub: 'Something failed or needs attention before this can merge.',
      style: 'border-white/[0.08] bg-white/[0.02] hover:border-amber-500/20',
      activeStyle: 'border-amber-500/25 bg-amber-500/[0.07]',
    },
    {
      value: 'archive_duplicate',
      label: '⊘  Archive as duplicate',
      sub: 'Another PR already solves the same problem.',
      style: 'border-white/[0.08] bg-white/[0.02] hover:border-white/20',
      activeStyle: 'border-white/20 bg-white/[0.06]',
    },
    {
      value: 'hold',
      label: '⏸  Hold for later',
      sub: 'Not the right time — come back to this PR later.',
      style: 'border-white/[0.08] bg-white/[0.02] hover:border-sky-500/20',
      activeStyle: 'border-sky-500/20 bg-sky-500/[0.06]',
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25 mb-2">Your decision</p>
        <div className="space-y-2">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => setWs(prev => ({ ...prev, decision: opt.value }))}
              className={`w-full rounded-xl border p-3.5 text-left transition ${ws.decision === opt.value ? opt.activeStyle : opt.style}`}
            >
              <p className={`text-[13px] font-semibold ${ws.decision === opt.value ? 'text-white/90' : 'text-white/60'}`}>
                {opt.label}
              </p>
              <p className="mt-0.5 text-[11px] text-white/35">{opt.sub}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25 mb-1.5">Decision notes</p>
        <textarea
          value={ws.decisionNotes}
          onChange={e => setWs(prev => ({ ...prev, decisionNotes: e.target.value }))}
          placeholder="Reason for this decision, what to fix, or any context for the audit trail…"
          rows={3}
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-white placeholder-white/20 outline-none focus:border-white/20 resize-none"
        />
      </div>
    </div>
  );
}

function StageReadiness({ item, ws }: { item: MergeReviewItem; ws: WorkflowState }) {
  const checks = getGateChecks(item, ws);
  const blockers = checks.filter(c => !c.passed && c.blocking);
  const allBlockersPassed = blockers.length === 0;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25 mb-2">Merge readiness gate</p>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
          {checks.map((c, i) => <GateRow key={i} check={c} />)}
        </div>
      </div>

      {allBlockersPassed ? (
        <div className="rounded-xl border border-emerald-500/[0.20] bg-emerald-500/[0.05] px-4 py-3">
          <p className="text-[12px] font-semibold text-emerald-400">All blocking checks passed. Ready to merge.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-red-500/[0.20] bg-red-500/[0.05] px-4 py-3">
          <p className="text-[12px] font-semibold text-red-400">
            {blockers.length} blocking {blockers.length === 1 ? 'issue' : 'issues'} must be resolved before merging.
          </p>
        </div>
      )}

      {allBlockersPassed && (
        <div className="space-y-2">
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25">How to merge on GitHub</p>
          <ol className="space-y-2">
            {[
              'Open the PR on GitHub using the button below.',
              'Click "Approve" on the PR (or leave a review comment).',
              'Click "Merge pull request" → "Confirm merge".',
              'Come back here and click "I\'ve merged — start verification".',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13px] text-white/60">
                <span className="shrink-0 tabular-nums text-[11px] text-white/25">{i + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
          <a
            href={item.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex rounded-lg border border-emerald-400/25 bg-emerald-500/[0.10] px-4 py-2 text-[12px] font-semibold text-emerald-400 hover:bg-emerald-500/[0.18]"
          >
            Open GitHub PR to approve ↗
          </a>
        </div>
      )}
    </div>
  );
}

function StagePostMerge({
  item,
  ws,
  setWs,
}: {
  item: MergeReviewItem;
  ws: WorkflowState;
  setWs: (fn: (prev: WorkflowState) => WorkflowState) => void;
}) {
  const steps = PRODUCTION_STEPS[item.systemArea] ?? [];

  function toggleCheck(key: string) {
    setWs(prev => ({
      ...prev,
      postMergeChecks: { ...prev.postMergeChecks, [key]: !prev.postMergeChecks[key] },
    }));
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-sky-500/[0.15] bg-sky-500/[0.04] px-4 py-3">
        <p className="text-[12px] text-sky-400/90">
          The PR has been merged. Now verify it works correctly in <strong>production</strong>.
        </p>
      </div>

      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25 mb-2">
          What to check in production — {AREA_LABELS[item.systemArea] ?? item.systemArea}
        </p>
        <div className="space-y-1.5">
          {steps.map((step, i) => (
            <CheckRow
              key={i}
              label={step}
              checked={!!ws.postMergeChecks[String(i)]}
              onChange={() => toggleCheck(String(i))}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25 mb-2">Verification result</p>
        <div className="flex gap-2">
          {(['passed', 'failed'] as const).map(result => (
            <button
              key={result}
              onClick={() => setWs(prev => ({ ...prev, postMergeResult: result }))}
              className={`flex-1 rounded-xl border py-2.5 text-[12px] font-semibold transition ${
                ws.postMergeResult === result
                  ? result === 'passed'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : 'border-red-500/30 bg-red-500/10 text-red-400'
                  : 'border-white/[0.08] bg-white/[0.02] text-white/35 hover:text-white/60'
              }`}
            >
              {result === 'passed' ? '✓ Production verified — all good' : '✗ Issue found in production'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25 mb-1.5">Notes</p>
        <textarea
          value={ws.postMergeNotes}
          onChange={e => setWs(prev => ({ ...prev, postMergeNotes: e.target.value }))}
          placeholder="What you checked, any issues found, or context to record…"
          rows={3}
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-white placeholder-white/20 outline-none focus:border-white/20 resize-none"
        />
      </div>
    </div>
  );
}

function StageComplete({
  item,
  entry,
}: {
  item: MergeReviewItem;
  entry: AuditEntry;
}) {
  const DECISION_LABELS: Record<DecisionType, string> = {
    approve: 'Approved for production',
    request_changes: 'Changes requested',
    archive_duplicate: 'Archived as duplicate',
    hold: 'Held for later',
  };
  const DECISION_STYLE: Record<DecisionType, string> = {
    approve: 'text-emerald-400',
    request_changes: 'text-amber-400',
    archive_duplicate: 'text-white/40',
    hold: 'text-sky-400',
  };

  const formattedDate = new Date(entry.timestamp).toLocaleString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-emerald-500/[0.18] bg-emerald-500/[0.04] px-4 py-3">
        <p className="text-[13px] font-semibold text-emerald-400">Decision recorded in audit trail.</p>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25">Audit record</p>

        <div>
          <span className="font-mono text-[11px] text-white/25">#{item.prNumber}</span>
          <p className="text-[14px] font-semibold text-white/90">{item.plainTitle}</p>
          <p className="font-mono text-[11px] text-white/30">{item.branch}</p>
        </div>

        {([
          ['Decision',          <span key="d" className={`text-[13px] font-semibold ${DECISION_STYLE[entry.decision]}`}>{DECISION_LABELS[entry.decision]}</span>],
          ['Test result',       <span key="t" className="text-[13px] text-white/65">{entry.testResult === 'passed' ? '✓ Passed' : entry.testResult === 'failed' ? '✗ Failed' : 'Skipped'}</span>],
          ['Verification',      <span key="v" className="text-[13px] text-white/65">{entry.postMergeResult === 'passed' ? '✓ Production verified' : entry.postMergeResult === 'failed' ? '✗ Issue found' : 'Pending'}</span>],
          ['Reviewer',          <span key="r" className="text-[13px] text-white/65">{entry.reviewer}</span>],
          ['Date',              <span key="date" className="text-[13px] text-white/65">{formattedDate}</span>],
          ...(entry.notes ? [['Notes', <span key="n" className="text-[13px] text-white/55 italic">"{entry.notes}"</span>]] : []),
        ] as [string, React.ReactNode][]).map(([label, value]) => (
          <div key={label} className="flex items-start gap-3">
            <span className="w-24 shrink-0 text-[11px] text-white/30">{label}</span>
            {value}
          </div>
        ))}
      </div>

      {entry.decision === 'request_changes' && (
        <div className="rounded-xl border border-amber-500/[0.15] bg-amber-500/[0.04] px-4 py-3">
          <p className="text-[12px] text-amber-400/80">
            Go to GitHub and leave your review comment. The developer will fix and re-submit.
          </p>
          <a
            href={item.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex text-[12px] font-medium text-amber-400 hover:underline"
          >
            Open GitHub PR ↗
          </a>
        </div>
      )}

      {entry.decision === 'archive_duplicate' && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
          <p className="text-[12px] text-white/50">
            Go to GitHub and close this PR with a note that it's superseded by another.
          </p>
          <a
            href={item.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex text-[12px] font-medium text-white/50 hover:text-white/80"
          >
            Close PR on GitHub ↗
          </a>
        </div>
      )}

      {entry.postMergeResult === 'failed' && (
        <div className="rounded-xl border border-red-500/[0.20] bg-red-500/[0.05] px-4 py-3">
          <p className="text-[12px] font-semibold text-red-400">Issue found in production.</p>
          <p className="mt-0.5 text-[12px] text-red-400/70">
            Follow the rollback plan: {item.rollbackPlan}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main workflow modal ───────────────────────────────────────────────────────

function buildAuditEntry(item: MergeReviewItem, ws: WorkflowState): AuditEntry {
  const notes = [ws.decisionNotes, ws.testNotes, ws.postMergeNotes].filter(Boolean).join(' | ');
  return {
    id: `${item.prNumber}-${Date.now()}`,
    prNumber: item.prNumber,
    prTitle: item.plainTitle,
    branch: item.branch,
    systemArea: item.systemArea,
    decision: ws.decision ?? 'hold',
    testResult: ws.testResult ?? 'skipped',
    postMergeResult: ws.postMergeResult ?? 'pending',
    notes,
    timestamp: new Date().toISOString(),
    reviewer: 'Jackson',
  };
}

export function MergeDecisionWorkflow({
  item,
  onClose,
}: {
  item: MergeReviewItem;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<Stage>('review');
  const [ws, setWs] = useState<WorkflowState>({
    testChecks: {},
    testResult: null,
    testNotes: '',
    decision: null,
    decisionNotes: '',
    postMergeChecks: {},
    postMergeResult: null,
    postMergeNotes: '',
  });
  const [auditEntry, setAuditEntry] = useState<AuditEntry | null>(null);

  const gateChecks = getGateChecks(item, ws);
  const blockers = gateChecks.filter(c => !c.passed && c.blocking);

  function advance() {
    if (stage === 'readiness' && blockers.length > 0) return;
    const next = nextStage(stage, ws.decision);

    if (next === 'complete') {
      const entry = buildAuditEntry(item, ws);
      persistAuditEntry(entry);
      setAuditEntry(entry);
    }
    setStage(next);
  }

  function retreat() {
    const prev = prevStage(stage);
    if (prev) setStage(prev);
  }

  const canAdvance = (() => {
    if (stage === 'decision') return ws.decision !== null;
    if (stage === 'readiness') return blockers.length === 0;
    if (stage === 'post_merge') return ws.postMergeResult !== null;
    return true;
  })();

  const continueLabel = (() => {
    if (stage === 'readiness') return "I've merged — start verification →";
    if (stage === 'post_merge') return 'Complete workflow →';
    if (stage === 'decision' && ws.decision && ws.decision !== 'approve') return 'Record decision →';
    return 'Continue →';
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative my-8 w-full max-w-2xl rounded-2xl border border-white/[0.10] bg-[#0d1117] shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="shrink-0 border-b border-white/[0.07] px-5 py-3.5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25">Merge Decision</p>
            <p className="mt-0.5 text-[13px] font-semibold text-white/80 truncate">
              #{item.prNumber} — {item.plainTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg border border-white/[0.07] px-2.5 py-1 text-[11px] text-white/35 hover:text-white/70"
          >
            ✕ Close
          </button>
        </div>

        {/* Progress stepper */}
        <div className="shrink-0 border-b border-white/[0.05] px-5 py-3 overflow-x-auto">
          <ProgressBar current={stage} decision={ws.decision} />
        </div>

        {/* Stage content */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {stage === 'review'     && <StageReview item={item} />}
          {stage === 'testing'    && <StageTesting item={item} ws={ws} setWs={setWs} />}
          {stage === 'decision'   && <StageDecision ws={ws} setWs={setWs} />}
          {stage === 'readiness'  && <StageReadiness item={item} ws={ws} />}
          {stage === 'post_merge' && <StagePostMerge item={item} ws={ws} setWs={setWs} />}
          {stage === 'complete'   && auditEntry && <StageComplete item={item} entry={auditEntry} />}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/[0.07] px-5 py-3.5 flex items-center justify-between">
          <button
            onClick={retreat}
            disabled={stage === 'review' || stage === 'complete'}
            className="rounded-md border border-white/[0.07] px-3 py-1.5 text-[12px] text-white/40 hover:text-white/70 disabled:opacity-25 disabled:cursor-not-allowed"
          >
            ← Back
          </button>

          {stage !== 'complete' ? (
            <button
              onClick={advance}
              disabled={!canAdvance}
              className="rounded-md border border-white/[0.12] bg-white/[0.07] px-4 py-1.5 text-[12px] font-semibold text-white/80 hover:bg-white/[0.12] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {continueLabel}
            </button>
          ) : (
            <button
              onClick={onClose}
              className="rounded-md border border-emerald-400/25 bg-emerald-500/[0.10] px-4 py-1.5 text-[12px] font-semibold text-emerald-400 hover:bg-emerald-500/[0.18]"
            >
              Close workflow
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Audit Trail viewer ────────────────────────────────────────────────────────

export function AuditTrailPanel() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [expanded, setExpanded] = useState(false);

  // Load after mount to avoid SSR mismatch
  useState(() => { setEntries(loadAuditEntries()); });

  if (!expanded) {
    return (
      <button
        onClick={() => { setEntries(loadAuditEntries()); setExpanded(true); }}
        className="text-[11px] text-white/30 hover:text-white/60"
      >
        View audit trail ({loadAuditEntries().length} decisions) ↓
      </button>
    );
  }

  const DECISION_STYLE: Record<string, string> = {
    approve: 'text-emerald-400', request_changes: 'text-amber-400',
    archive_duplicate: 'text-white/40', hold: 'text-sky-400',
  };
  const DECISION_SHORT: Record<string, string> = {
    approve: 'Approved', request_changes: 'Changes requested',
    archive_duplicate: 'Archived', hold: 'Held',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25">Audit Trail</span>
        <button onClick={() => setExpanded(false)} className="text-[11px] text-white/30 hover:text-white/60">
          Collapse ↑
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="text-[12px] text-white/30">No decisions recorded yet. Complete a merge workflow to create an entry.</p>
      ) : (
        <div className="space-y-1.5">
          {entries.slice(0, 10).map(e => (
            <div key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
              <span className="font-mono text-[10px] text-white/25">#{e.prNumber}</span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-white/55">{e.prTitle}</span>
              <span className={`shrink-0 text-[11px] font-medium ${DECISION_STYLE[e.decision] ?? 'text-white/40'}`}>
                {DECISION_SHORT[e.decision] ?? e.decision}
              </span>
              <span className="shrink-0 text-[10px] text-white/25">
                {new Date(e.timestamp).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
              </span>
            </div>
          ))}
          {entries.length > 10 && (
            <p className="text-[11px] text-white/25">{entries.length - 10} older entries hidden.</p>
          )}
        </div>
      )}
    </div>
  );
}
