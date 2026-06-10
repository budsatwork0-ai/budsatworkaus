'use client';

import type { MergeReviewItem } from '@/app/api/bud/merge-review/route';
import { HelpTip } from './HelpTip';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScoredItem {
  item: MergeReviewItem;
  priorityScore: number;   // 0–100 overall priority (higher = review first)
  businessImpact: number;  // 0–100 business value
  safetyScore: number;     // 0–100 (100 = very safe to merge)
  reviewMinutes: number;
  duplicateOf: number[];
  ignoreReason: string | null;
}

interface DuplicateGroup {
  area: MergeReviewItem['systemArea'];
  recommended: ScoredItem;
  others: ScoredItem[];
  preferReason: string;
}

interface ValueBucket {
  label: string;
  area: MergeReviewItem['systemArea'];
  description: string;
  count: number;
  readyCount: number;
  level: 'high' | 'medium' | 'low' | 'none';
}

interface PriorityReport {
  scored: ScoredItem[];
  reviewNext: ScoredItem | null;
  quickWins: ScoredItem[];
  duplicateGroups: DuplicateGroup[];
  ignoreNow: ScoredItem[];
  valueBuckets: ValueBucket[];
  recommendation: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SYSTEM_AREA_LABELS: Record<MergeReviewItem['systemArea'], string> = {
  agent_quality:       'Agent Quality',
  monitoring:          'Monitoring',
  quote_funnel:        'Quote Funnel',
  dashboard_ui:        'Dashboard UI',
  infrastructure:      'Infrastructure',
  customer_experience: 'Customer Experience',
};

const AREA_IMPACT: Record<MergeReviewItem['systemArea'], number> = {
  quote_funnel:        90,
  customer_experience: 80,
  agent_quality:       70,
  monitoring:          60,
  dashboard_ui:        45,
  infrastructure:      40,
};

// ── Scoring ───────────────────────────────────────────────────────────────────

function scoreItem(item: MergeReviewItem, duplicateOf: number[]): ScoredItem {
  // Priority score — what to look at first
  const recBase   = { approve: 80, needs_manual_review: 60, reject: 15, hold: 10 }[item.recommendation];
  const areaBonus = { quote_funnel: 20, customer_experience: 15, agent_quality: 15, monitoring: 10, dashboard_ui: 5, infrastructure: 5 }[item.systemArea];
  const ciBonus   = { success: 10, failure: -20, pending: 0, unknown: -5 }[item.ciStatus];
  const riskPen   = { low: 0, medium: -5, high: -15 }[item.riskLevel];
  const dupPen    = duplicateOf.length > 0 ? -15 : 0;
  const days      = Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 86_400_000);
  const ageBonus  = Math.min(days / 3, 10);
  const priorityScore = Math.max(0, Math.min(100, recBase + areaBonus + ciBonus + riskPen + dupPen + ageBonus));

  // Business impact
  const impactMult = { approve: 1.0, needs_manual_review: 0.9, reject: 0.5, hold: 0.5 }[item.recommendation];
  const businessImpact = Math.round(AREA_IMPACT[item.systemArea] * impactMult);

  // Safety score (100 = very safe to merge)
  const riskBase  = { low: 80, medium: 50, high: 25 }[item.riskLevel];
  const ciSafety  = { success: 15, failure: -20, pending: 0, unknown: -5 }[item.ciStatus];
  const draftPen  = item.isDraft ? -10 : 0;
  const migPen    = item.checks.migrationSafe === 'fail' ? -15 : 0;
  const safetyScore = Math.max(0, Math.min(100, riskBase + ciSafety + draftPen + migPen));

  // Review time estimate
  const lines = item.additions + item.deletions;
  let reviewMinutes = lines < 50 ? 5 : lines < 150 ? 15 : lines < 350 ? 25 : lines < 700 ? 40 : 60;
  if (item.checks.migrationSafe !== undefined) reviewMinutes += 10;

  // Ignore reason — these PRs don't need the owner's attention yet
  let ignoreReason: string | null = null;
  if (item.isDraft)                     ignoreReason = 'Still a draft — wait for the developer to mark it ready';
  else if (item.ciStatus === 'failure') ignoreReason = 'CI is failing — developer needs to fix this first';
  else if (priorityScore < 20)          ignoreReason = 'Low business priority relative to other open PRs';

  return { item, priorityScore, businessImpact, safetyScore, reviewMinutes, duplicateOf, ignoreReason };
}

function buildDuplicateGroups(scored: ScoredItem[]): DuplicateGroup[] {
  const seenAreas = new Set<string>();
  const groups: DuplicateGroup[] = [];

  for (const s of scored) {
    if (s.duplicateOf.length === 0 || seenAreas.has(s.item.systemArea)) continue;
    seenAreas.add(s.item.systemArea);

    const groupItems = scored.filter(x => x.item.systemArea === s.item.systemArea && x.duplicateOf.length > 0);
    if (groupItems.length < 2) continue;

    const [recommended, ...others] = groupItems;
    let preferReason: string;
    const othersHaveFailingCI = others.some(o => o.item.ciStatus !== 'success');
    const othersAreDrafts = others.some(o => o.item.isDraft);
    const recLines = recommended.item.additions + recommended.item.deletions;
    const smallestOther = Math.min(...others.map(o => o.item.additions + o.item.deletions));

    if (recommended.item.ciStatus === 'success' && othersHaveFailingCI) {
      preferReason = 'CI is passing here; failing on the others.';
    } else if (!recommended.item.isDraft && othersAreDrafts) {
      preferReason = 'This PR is ready to review; the others are still drafts.';
    } else if (recLines < smallestOther) {
      preferReason = 'Smallest change — lowest risk and quickest to review.';
    } else {
      preferReason = `Highest combined impact and safety score in the ${SYSTEM_AREA_LABELS[s.item.systemArea]} group.`;
    }

    groups.push({ area: s.item.systemArea, recommended, others, preferReason });
  }
  return groups;
}

function buildValueBuckets(scored: ScoredItem[]): ValueBucket[] {
  const bucketDefs: Array<{ label: string; area: MergeReviewItem['systemArea']; description: string }> = [
    { label: 'Revenue protection',    area: 'quote_funnel',        description: 'Quote builder changes that affect how customers receive prices.' },
    { label: 'Customer experience',   area: 'customer_experience', description: 'Changes visible to customers and crew — bookings, orders, communications.' },
    { label: 'Agent quality',         area: 'agent_quality',       description: 'Improvements to how accurately and reliably AI agents perform.' },
    { label: 'Platform reliability',  area: 'monitoring',          description: 'Monitoring improvements that catch issues before customers notice.' },
    { label: 'Dashboard clarity',     area: 'dashboard_ui',        description: 'Changes to how you and your team see and interact with the platform.' },
  ];

  return bucketDefs.map(b => {
    const inArea = scored.filter(s => s.item.systemArea === b.area);
    const readyCount = inArea.filter(s => s.item.recommendation === 'approve' && s.item.ciStatus === 'success').length;
    const level: ValueBucket['level'] =
      readyCount >= 2 ? 'high' :
      readyCount === 1 ? 'medium' :
      inArea.length > 0 ? 'low' : 'none';
    return { ...b, count: inArea.length, readyCount, level };
  });
}

function buildRecommendationText(reviewNext: ScoredItem | null): string {
  if (!reviewNext) return 'No actionable PRs right now. All open PRs are drafts or have failing CI.';
  const pr = reviewNext.item;
  const parts: string[] = [`Review PR #${pr.prNumber} next.`];
  // Use whyItMatters but trim trailing period
  const why = pr.whyItMatters.replace(/\.$/, '');
  parts.push(why);
  const ciNote = pr.ciStatus === 'success' ? 'CI is passing' : pr.ciStatus === 'pending' ? 'CI is still running' : null;
  const riskNote =
    pr.riskLevel === 'low'    ? 'risk is low' :
    pr.riskLevel === 'medium' ? 'risk is moderate — follow the checklist' :
    'risk is high — manual sign-off required';
  const extras = [ciNote, riskNote].filter(Boolean) as string[];
  if (extras.length) parts.push(extras.join(', ') + '.');
  if (reviewNext.reviewMinutes <= 15) parts.push(`Estimated ${reviewNext.reviewMinutes} minutes to review.`);
  return parts.join(' ');
}

function computeReport(items: MergeReviewItem[], duplicateMap: Map<number, number[]>): PriorityReport {
  const scored = items
    .map(item => scoreItem(item, duplicateMap.get(item.prNumber) ?? []))
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const actionable = scored.filter(s => !s.ignoreReason);
  const reviewNext = actionable[0] ?? null;

  const quickWins = actionable
    .filter(s =>
      s !== reviewNext &&
      s.safetyScore >= 65 &&
      s.item.ciStatus === 'success' &&
      !s.item.isDraft &&
      s.item.recommendation !== 'reject',
    )
    .slice(0, 3);

  const duplicateGroups = buildDuplicateGroups(scored);
  const ignoreNow = scored.filter(s => s.ignoreReason !== null);
  const valueBuckets = buildValueBuckets(scored);
  const recommendation = buildRecommendationText(reviewNext);

  return { scored, reviewNext, quickWins, duplicateGroups, ignoreNow, valueBuckets, recommendation };
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1 w-full rounded-full bg-white/[0.06]">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}

function ScorePill({ label, value, color, tip }: { label: string; value: number; color: string; tip?: string }) {
  return (
    <div className="min-w-[72px]">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-white/30 flex items-center">
          {label}
          {tip && <HelpTip text={tip} />}
        </span>
        <span className="text-[10px] font-semibold text-white/45">{value}</span>
      </div>
      <ScoreBar value={value} color={color} />
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ number, title, tip }: { number: string; title: string; tip: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-semibold text-white/20">{number}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">{title}</span>
      <HelpTip text={tip} />
    </div>
  );
}

// ── Review Next card ──────────────────────────────────────────────────────────

function ReviewNextCard({ s, onStartReview }: { s: ScoredItem; onStartReview: (item: ScoredItem['item']) => void }) {
  const pr = s.item;

  const reasons: string[] = [];
  if (s.businessImpact >= 70) reasons.push(`Highest business impact — ${SYSTEM_AREA_LABELS[pr.systemArea]}`);
  else reasons.push(`${SYSTEM_AREA_LABELS[pr.systemArea]} improvement`);
  if (pr.ciStatus === 'success') reasons.push('CI is passing — safe to act on');
  if (pr.riskLevel === 'low') reasons.push('Low risk change — unlikely to break anything');
  else if (pr.riskLevel === 'medium') reasons.push('Moderate risk — follow the checklist before merging');
  if (pr.recommendation === 'approve') reasons.push('Eligible for approval right now');
  else if (pr.recommendation === 'needs_manual_review') reasons.push('Needs your eyes before it can move forward');
  if (s.reviewMinutes <= 15) reasons.push(`Quick review — estimated ${s.reviewMinutes} minutes`);

  return (
    <div className="rounded-xl border border-emerald-500/[0.18] bg-emerald-500/[0.04] p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="font-mono text-[11px] text-white/30">#{pr.prNumber}</span>
          <h3 className="mt-0.5 text-[15px] font-semibold leading-snug text-white/95">{pr.plainTitle}</h3>
          <p className="mt-0.5 font-mono text-[11px] text-white/30">{pr.branch}</p>
        </div>
        <button
          onClick={() => onStartReview(pr)}
          className="shrink-0 rounded-lg border border-emerald-400/25 bg-emerald-500/[0.12] px-3 py-1.5 text-[12px] font-semibold text-emerald-400 hover:bg-emerald-500/[0.20]"
        >
          Start review →
        </button>
      </div>

      <div>
        <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-white/25">Why this PR ranks first</p>
        <ul className="space-y-1">
          {reasons.map((r, i) => (
            <li key={i} className="flex items-center gap-2 text-[12px] text-white/60">
              <span className="shrink-0 text-[9px] text-emerald-400">✓</span>
              {r}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-3">
        <ScorePill label="Impact"   value={s.businessImpact}          color="bg-emerald-400" tip="How much this PR matters to the business (0–100)" />
        <ScorePill label="Safety"   value={s.safetyScore}             color="bg-sky-400"     tip="How safe this is to merge right now (0–100, higher = safer)" />
        <ScorePill label="Priority" value={Math.round(s.priorityScore)} color="bg-violet-400"  tip="Combined ranking score used to sort all PRs (0–100)" />
      </div>

      <p className="text-[10px] text-white/25">
        {s.reviewMinutes} min estimated &middot; {pr.additions}+ / {pr.deletions}− lines &middot; {pr.riskLevel} risk
      </p>
    </div>
  );
}

// ── Quick Win card ────────────────────────────────────────────────────────────

function QuickWinCard({ s, onStartReview }: { s: ScoredItem; onStartReview: (item: ScoredItem['item']) => void }) {
  const pr = s.item;
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 space-y-2.5 transition hover:border-white/[0.12]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="font-mono text-[10px] text-white/25">#{pr.prNumber}</span>
          <p className="text-[12px] font-semibold leading-snug text-white/85">{pr.plainTitle}</p>
        </div>
        <button
          onClick={() => onStartReview(pr)}
          className="shrink-0 rounded border border-white/[0.09] bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/50 hover:text-white/80"
        >
          Review →
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ScorePill label="Impact" value={s.businessImpact} color="bg-emerald-400" />
        <ScorePill label="Safety" value={s.safetyScore}    color="bg-sky-400" />
      </div>
      <p className="text-[10px] text-white/30">
        {s.reviewMinutes} min &middot; {pr.riskLevel} risk &middot; CI {pr.ciStatus}
      </p>
    </div>
  );
}

// ── Duplicate Group card ──────────────────────────────────────────────────────

function DuplicateGroupCard({ group }: { group: DuplicateGroup }) {
  return (
    <div className="rounded-xl border border-amber-500/[0.12] bg-amber-500/[0.03] p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-amber-400/60">
          {SYSTEM_AREA_LABELS[group.area]}
        </span>
        <span className="text-[9px] text-white/25">
          — {group.others.length + 1} PRs may overlap
        </span>
      </div>

      {/* Recommended PR */}
      <div className="rounded-lg border border-emerald-500/[0.15] bg-emerald-500/[0.04] px-3 py-2.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-400/70 mb-0.5">Review this one</p>
          <p className="text-[12px] font-semibold leading-snug text-white/85">
            #{group.recommended.item.prNumber} — {group.recommended.item.plainTitle}
          </p>
        </div>
        <a
          href={group.recommended.item.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded border border-emerald-400/20 bg-emerald-500/[0.08] px-2 py-0.5 text-[10px] text-emerald-400 hover:bg-emerald-500/[0.15]"
        >
          Open ↗
        </a>
      </div>
      <p className="pl-0.5 text-[11px] text-white/40">{group.preferReason}</p>

      {/* Other PRs in group */}
      <div className="space-y-1.5">
        {group.others.map(s => (
          <div
            key={s.item.prNumber}
            className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-1.5 opacity-55"
          >
            <p className="text-[11px] text-white/60">
              #{s.item.prNumber} — {s.item.plainTitle}
            </p>
            <span className="shrink-0 text-[9px] text-white/30 ml-2">possible duplicate</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Ignore For Now row ────────────────────────────────────────────────────────

function IgnoreRow({ s }: { s: ScoredItem }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-white/[0.05] bg-white/[0.01] px-3 py-2">
      <span className="shrink-0 font-mono text-[10px] text-white/25">#{s.item.prNumber}</span>
      <span className="min-w-0 flex-1 truncate text-[12px] text-white/40">{s.item.plainTitle}</span>
      <span className="shrink-0 text-[10px] text-white/25">{s.ignoreReason}</span>
    </div>
  );
}

// ── Value buckets ─────────────────────────────────────────────────────────────

const LEVEL_CHIP: Record<ValueBucket['level'], string> = {
  high:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10  text-amber-400  border-amber-500/20',
  low:    'bg-white/5        text-white/35  border-white/[0.07]',
  none:   'bg-white/[0.02]   text-white/20  border-white/[0.04]',
};

const LEVEL_LABEL: Record<ValueBucket['level'], string> = {
  high:   'High — ready to ship',
  medium: 'Available to unlock',
  low:    'Pending — blocked',
  none:   'No changes queued',
};

function ValueBuckets({ buckets }: { buckets: ValueBucket[] }) {
  return (
    <div className="space-y-1.5">
      {buckets.map(b => (
        <div key={b.label} className="flex items-center gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold text-white/65">{b.label}</span>
              {b.count > 0 && (
                <span className="text-[10px] text-white/30">
                  {b.count} PR{b.count > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[10px] leading-snug text-white/35">{b.description}</p>
          </div>
          <div className="shrink-0 text-right space-y-0.5">
            <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${LEVEL_CHIP[b.level]}`}>
              {LEVEL_LABEL[b.level]}
            </span>
            {b.readyCount > 0 && (
              <p className="text-[9px] text-emerald-400/60">{b.readyCount} ready to approve</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ReviewPrioritisationEngine({
  items,
  duplicateMap,
  onStartReview,
}: {
  items: MergeReviewItem[];
  duplicateMap: Map<number, number[]>;
  onStartReview: (item: MergeReviewItem) => void;
}) {
  if (items.length === 0) return null;

  const report = computeReport(items, duplicateMap);
  const hasQuickWins = report.quickWins.length > 0;
  const hasDuplicates = report.duplicateGroups.length > 0;
  const hasIgnore = report.ignoreNow.length > 0;

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.015] p-5 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/25">
          Recommended Review Order
        </span>
        <span className="inline-flex items-center rounded border border-violet-500/30 bg-violet-500/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-violet-400">
          Priority Engine
        </span>
      </div>

      {/* One-click recommendation */}
      <div className="rounded-xl border border-violet-500/[0.15] bg-violet-500/[0.05] px-4 py-3">
        <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-violet-400/60">Bottom line</p>
        <p className="text-[13px] leading-relaxed text-white/80">{report.recommendation}</p>
      </div>

      {/* 1 — Review Next */}
      {report.reviewNext && (
        <div className="space-y-2">
          <SectionLabel
            number="1"
            title="Review next"
            tip="The single highest-priority PR based on business impact, safety, CI status, and how long it has been waiting."
          />
          <ReviewNextCard s={report.reviewNext} onStartReview={onStartReview} />
        </div>
      )}

      {/* 2 — Quick Wins */}
      {hasQuickWins && (
        <div className="space-y-2">
          <SectionLabel
            number="2"
            title="Quick wins"
            tip="Low-risk, high-value PRs with passing CI. These can likely be approved and merged soon."
          />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {report.quickWins.map(s => <QuickWinCard key={s.item.prNumber} s={s} onStartReview={onStartReview} />)}
          </div>
        </div>
      )}

      {/* 3 — Duplicate Groups */}
      {hasDuplicates && (
        <div className="space-y-2">
          <SectionLabel
            number="3"
            title="Possible duplicates"
            tip="Multiple PRs appear to address the same area. One is recommended; the others can likely be archived."
          />
          <div className="space-y-2">
            {report.duplicateGroups.map(g => (
              <DuplicateGroupCard key={g.area} group={g} />
            ))}
          </div>
        </div>
      )}

      {/* 4 — Ignore For Now */}
      {hasIgnore && (
        <div className="space-y-2">
          <SectionLabel
            number="4"
            title="Ignore for now"
            tip="Drafts, failing CI, and low-priority PRs that do not need your attention yet. The developer needs to act first."
          />
          <div className="space-y-1.5">
            {report.ignoreNow.map(s => <IgnoreRow key={s.item.prNumber} s={s} />)}
          </div>
        </div>
      )}

      {/* 5 — Estimated Value */}
      <div className="space-y-2">
        <SectionLabel
          number="5"
          title="Business value waiting to ship"
          tip="What value is locked in open PRs across each area. 'Ready to ship' means CI is green and the PR can be approved now."
        />
        <ValueBuckets buckets={report.valueBuckets} />
      </div>
    </div>
  );
}
