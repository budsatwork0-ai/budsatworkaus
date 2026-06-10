'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import type { MergeReviewItem } from '@/app/api/bud/merge-review/route';

// ── Business area translations ────────────────────────────────────────────────

export const BUSINESS_AREA_LABELS: Record<MergeReviewItem['systemArea'], string> = {
  quote_funnel:        'Revenue Protection',
  customer_experience: 'Customer Experience',
  agent_quality:       'Agent Intelligence',
  monitoring:          'Platform Reliability',
  dashboard_ui:        'Operations Dashboard',
  infrastructure:      'Core Infrastructure',
};

const BUSINESS_AREA_DESCRIPTIONS: Record<MergeReviewItem['systemArea'], string> = {
  quote_funnel:        'Changes to how customers receive and pay for quotes',
  customer_experience: 'Changes visible to customers or crew during bookings',
  agent_quality:       'Improvements to how AI agents perform tasks',
  monitoring:          'Changes that keep the platform healthy and observable',
  dashboard_ui:        'Changes to how the team manages day-to-day operations',
  infrastructure:      'Technical foundation — deploys, databases, and core config',
};

// ── Deployment readiness ──────────────────────────────────────────────────────

export type DeploymentStatus = 'ready' | 'needs_test' | 'blocked' | 'not_ready';

export interface DeploymentReadiness {
  status: DeploymentStatus;
  label: string;
  reason: string;
}

export function computeDeploymentReadiness(item: MergeReviewItem): DeploymentReadiness {
  if (item.isDraft) {
    return {
      status: 'not_ready',
      label: 'Not ready yet',
      reason: 'Author is still working on this change',
    };
  }
  if (item.ciStatus === 'failure') {
    return {
      status: 'blocked',
      label: 'Blocked',
      reason: 'Automated checks failed — must be fixed before deploying',
    };
  }
  if (item.ciStatus === 'pending') {
    return {
      status: 'not_ready',
      label: 'Checking',
      reason: 'Automated checks still running — check back shortly',
    };
  }
  if (item.riskLevel === 'high') {
    return {
      status: 'needs_test',
      label: 'Test first',
      reason: 'High-risk change — manual verification required before deploying',
    };
  }
  if (['quote_funnel', 'customer_experience', 'infrastructure'].includes(item.systemArea)) {
    return {
      status: 'needs_test',
      label: 'Test first',
      reason: `${BUSINESS_AREA_LABELS[item.systemArea]} changes need a quick check before going live`,
    };
  }
  if (item.riskLevel === 'medium') {
    return {
      status: 'needs_test',
      label: 'Test first',
      reason: 'Medium-risk change — run the verification checklist first',
    };
  }
  return {
    status: 'ready',
    label: 'Ready to deploy',
    reason: 'Automated checks passing and risk is low',
  };
}

// ── ImprovementOpportunity ────────────────────────────────────────────────────

export interface ImprovementOpportunity {
  id: string;
  businessArea: MergeReviewItem['systemArea'];
  areaLabel: string;
  areaDescription: string;
  readiness: DeploymentReadiness;
  recommendedPR: MergeReviewItem;
  priorityScore: number;
  otherPRs: MergeReviewItem[];
}

// ── Priority scoring (mirrors ReviewPrioritisationEngine.scoreItem) ───────────

function computePriorityScore(item: MergeReviewItem, duplicateOf: number[]): number {
  const recBase   = ({ approve: 80, needs_manual_review: 60, reject: 15, hold: 10 } as Record<string, number>)[item.recommendation] ?? 30;
  const areaBonus = ({ quote_funnel: 20, customer_experience: 15, agent_quality: 15, monitoring: 10, dashboard_ui: 5, infrastructure: 5 } as Record<string, number>)[item.systemArea] ?? 0;
  const ciBonus   = ({ success: 10, failure: -20, pending: 0, unknown: -5 } as Record<string, number>)[item.ciStatus] ?? 0;
  const riskPen   = ({ low: 0, medium: -5, high: -15 } as Record<string, number>)[item.riskLevel] ?? 0;
  const dupPen    = duplicateOf.length > 0 ? -15 : 0;
  return Math.max(0, Math.min(100, recBase + areaBonus + ciBonus + riskPen + dupPen));
}

const STATUS_ORDER: Record<DeploymentStatus, number> = {
  ready: 0, needs_test: 1, not_ready: 2, blocked: 3,
};

export function groupIntoOpportunities(
  items: MergeReviewItem[],
  duplicateMap: Map<number, number[]>,
): ImprovementOpportunity[] {
  const byArea = new Map<MergeReviewItem['systemArea'], MergeReviewItem[]>();
  for (const item of items) {
    const list = byArea.get(item.systemArea) ?? [];
    list.push(item);
    byArea.set(item.systemArea, list);
  }

  const opportunities: ImprovementOpportunity[] = [];
  for (const [area, areaItems] of byArea) {
    const scored = areaItems
      .map(item => ({ item, score: computePriorityScore(item, duplicateMap.get(item.prNumber) ?? []) }))
      .sort((a, b) => b.score - a.score);

    const [best, ...rest] = scored;
    opportunities.push({
      id: `${area}-${best.item.prNumber}`,
      businessArea: area,
      areaLabel: BUSINESS_AREA_LABELS[area],
      areaDescription: BUSINESS_AREA_DESCRIPTIONS[area],
      readiness: computeDeploymentReadiness(best.item),
      recommendedPR: best.item,
      priorityScore: best.score,
      otherPRs: rest.map(s => s.item),
    });
  }

  return opportunities.sort((a, b) => {
    const statusDiff = STATUS_ORDER[a.readiness.status] - STATUS_ORDER[b.readiness.status];
    return statusDiff !== 0 ? statusDiff : b.priorityScore - a.priorityScore;
  });
}

// ── Opportunity age ───────────────────────────────────────────────────────────

function computeOpportunityAge(createdAt: string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  if (days === 0) return 'New today';
  if (days === 1) return 'Waiting 1 day';
  if (days < 14) return `Waiting ${days} days`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return 'Waiting 1 week';
  if (weeks < 8) return `Waiting ${weeks} weeks`;
  return `Waiting ${Math.floor(days / 30)} months`;
}

// ── Selection reason ──────────────────────────────────────────────────────────

function computeSelectionReason(best: MergeReviewItem, others: MergeReviewItem[]): string {
  if (others.length === 0) return 'The only available change in this area.';

  if (others.every(o => o.isDraft)) {
    return 'Chosen because all other changes in this area are still drafts.';
  }
  if (best.ciStatus === 'success' && others.some(o => o.ciStatus === 'failure')) {
    return 'Chosen because it is the only change with all checks passing.';
  }
  if (best.riskLevel === 'low' && others.some(o => o.riskLevel !== 'low')) {
    return 'Chosen because it carries the lowest risk of all available changes.';
  }
  if (best.recommendation === 'approve' && others.some(o => o.recommendation !== 'approve')) {
    return 'Chosen because it has the strongest approval recommendation.';
  }
  if (best.confidence > 70) {
    return `Chosen because it has the highest reviewer confidence at ${best.confidence}%.`;
  }
  return 'Chosen based on the combination of approval recommendation, risk level, and check results.';
}

// ── Style maps ────────────────────────────────────────────────────────────────

const READINESS_DOT: Record<DeploymentStatus, string> = {
  ready:      'bg-emerald-400',
  needs_test: 'bg-sky-400',
  blocked:    'bg-red-400',
  not_ready:  'bg-white/20',
};

const READINESS_LABEL_STYLE: Record<DeploymentStatus, string> = {
  ready:      'text-emerald-400',
  needs_test: 'text-sky-400',
  blocked:    'text-red-400',
  not_ready:  'text-white/35',
};

const CARD_BORDER: Record<DeploymentStatus, string> = {
  ready:      'border-emerald-500/[0.18]',
  needs_test: 'border-sky-500/[0.15]',
  blocked:    'border-red-500/[0.15]',
  not_ready:  'border-white/[0.07]',
};

// ── ImprovementOpportunityCard ────────────────────────────────────────────────

export function ImprovementOpportunityCard({
  opportunity,
  onStartReview,
  onSnooze,
  renderRecommendedPR,
}: {
  opportunity: ImprovementOpportunity;
  onStartReview: (item: MergeReviewItem) => void;
  onSnooze: (id: string, until: Date | 'skip') => void;
  renderRecommendedPR: (item: MergeReviewItem) => ReactNode;
}) {
  const [expanded, setExpanded]       = useState(false);
  const [devExpanded, setDevExpanded] = useState(false);
  const { recommendedPR, readiness, otherPRs, areaLabel, areaDescription } = opportunity;

  const age             = computeOpportunityAge(recommendedPR.createdAt);
  const selectionReason = computeSelectionReason(recommendedPR, otherPRs);

  function snoozeUntilTomorrow() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    onSnooze(opportunity.id, d);
  }

  function snoozeFor7Days() {
    onSnooze(opportunity.id, new Date(Date.now() + 7 * 86_400_000));
  }

  return (
    <div className={`rounded-2xl border bg-white/[0.025] p-5 space-y-4 ${CARD_BORDER[readiness.status]}`}>

      {/* Area header + readiness pill */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/30">
              {areaLabel}
            </span>
            {otherPRs.length > 0 && (
              <span className="text-[9px] text-white/20">
                · {otherPRs.length + 1} changes queued
              </span>
            )}
          </div>
          <p className="text-[11px] text-white/30">{areaDescription}</p>
        </div>
        <div className="shrink-0 flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${READINESS_DOT[readiness.status]}`} />
          <span className={`text-[10px] font-semibold ${READINESS_LABEL_STYLE[readiness.status]}`}>
            {readiness.label}
          </span>
        </div>
      </div>

      {/* Title + why it matters */}
      <div>
        <h3 className="text-[15px] font-semibold leading-snug text-white/95">
          {recommendedPR.plainTitle}
        </h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">
          {recommendedPR.whyItMatters}
        </p>
      </div>

      {/* Age + selection reason */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="shrink-0 text-[11px] text-white/25">{age}</span>
        <span className="text-[11px] leading-relaxed text-white/30">{selectionReason}</span>
      </div>

      {/* Readiness reason */}
      <p className="text-[12px] text-white/35">{readiness.reason}</p>

      {/* Action row */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/[0.05]">
        {readiness.status === 'ready' && (
          <button
            onClick={() => onStartReview(recommendedPR)}
            className="rounded-lg border border-emerald-400/25 bg-emerald-500/[0.10] px-4 py-2 text-[12px] font-semibold text-emerald-400 hover:bg-emerald-500/[0.18]"
          >
            Deploy Now →
          </button>
        )}
        {readiness.status === 'needs_test' && (
          <button
            onClick={() => onStartReview(recommendedPR)}
            className="rounded-lg border border-sky-400/20 bg-sky-500/[0.08] px-4 py-2 text-[12px] font-semibold text-sky-400 hover:bg-sky-500/[0.14]"
          >
            Test &amp; Deploy →
          </button>
        )}
        {(readiness.status === 'blocked' || readiness.status === 'not_ready') && (
          <button
            onClick={() => onStartReview(recommendedPR)}
            className="rounded-lg border border-white/[0.09] bg-white/[0.03] px-4 py-2 text-[12px] font-medium text-white/45 hover:bg-white/[0.07]"
          >
            Review →
          </button>
        )}

        {/* Defer controls */}
        <div className="ml-auto flex items-center gap-1">
          <span className="text-[10px] text-white/20 mr-0.5">Defer:</span>
          <button
            onClick={snoozeUntilTomorrow}
            className="rounded border border-white/[0.07] bg-white/[0.02] px-2 py-1 text-[10px] text-white/30 hover:text-white/60"
          >
            Tomorrow
          </button>
          <button
            onClick={snoozeFor7Days}
            className="rounded border border-white/[0.07] bg-white/[0.02] px-2 py-1 text-[10px] text-white/30 hover:text-white/60"
          >
            7 days
          </button>
          <button
            onClick={() => onSnooze(opportunity.id, 'skip')}
            className="rounded border border-white/[0.07] bg-white/[0.02] px-2 py-1 text-[10px] text-white/30 hover:text-white/60"
          >
            Skip for now
          </button>
        </div>

        <button
          onClick={() => { setExpanded(x => !x); if (expanded) setDevExpanded(false); }}
          className="text-[11px] text-white/30 hover:text-white/60"
        >
          {expanded ? 'Hide details ↑' : 'Details ↓'}
        </button>
      </div>

      {/* Details expansion — business content first */}
      {expanded && (
        <div className="border-t border-white/[0.06] pt-4 space-y-4">

          {/* Business summary */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/20">What&apos;s changing</p>
              <p className="text-[13px] leading-relaxed text-white/55">{recommendedPR.whatChanged}</p>
            </div>
            <div>
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/20">What could break</p>
              <p className="text-[13px] leading-relaxed text-white/55">{recommendedPR.couldBreak}</p>
            </div>
          </div>

          <div>
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/20">Recovery plan</p>
            <p className="text-[13px] leading-relaxed text-white/55">{recommendedPR.rollbackPlan}</p>
          </div>

          {/* Other changes in this area */}
          {otherPRs.length > 0 && (
            <div className="space-y-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/20">
                {otherPRs.length} other change{otherPRs.length !== 1 ? 's' : ''} in this area
              </p>
              <div className="space-y-1.5">
                {otherPRs.map(pr => {
                  const r = computeDeploymentReadiness(pr);
                  return (
                    <div key={pr.prNumber} className="flex items-center gap-3 rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2">
                      <span className={`shrink-0 inline-block h-1.5 w-1.5 rounded-full ${READINESS_DOT[r.status]}`} />
                      <span className="flex-1 truncate text-[12px] text-white/50">{pr.plainTitle}</span>
                      <span className={`shrink-0 text-[10px] ${READINESS_LABEL_STYLE[r.status]}`}>{r.label}</span>
                      <button
                        onClick={() => onStartReview(pr)}
                        className="shrink-0 rounded border border-white/[0.07] px-2 py-0.5 text-[10px] text-white/35 hover:text-white/65"
                      >
                        Review →
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Developer Details — nested gate keeping all GitHub / CI / PR content */}
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] overflow-hidden">
            <button
              onClick={() => setDevExpanded(x => !x)}
              className="flex w-full items-center justify-between px-4 py-3 hover:bg-white/[0.02]"
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/20">
                  Developer Details
                </span>
                <span className="text-[9px] text-white/15">
                  — checks, branches, full analysis
                </span>
              </div>
              <span className="text-[11px] text-white/25">{devExpanded ? 'Hide ↑' : 'Show ↓'}</span>
            </button>
            {devExpanded && (
              <div className="border-t border-white/[0.05] p-4">
                {renderRecommendedPR(recommendedPR)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
