'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MergeReviewItem, MergeReviewResponse } from '@/app/api/bud/merge-review/route';
import type { ExplainResponse } from '@/app/api/bud/merge-review/explain/route';
import { HelpTip } from './HelpTip';

// ── Style maps ────────────────────────────────────────────────────────────────

const RISK_STYLES = {
  low:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10  text-amber-400  border-amber-500/20',
  high:   'bg-red-500/10   text-red-400    border-red-500/20',
};

const RECOMMENDATION_STYLES = {
  approve:             'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  hold:                'bg-amber-500/10   text-amber-400   border-amber-500/20',
  reject:              'bg-red-500/10     text-red-400     border-red-500/20',
  needs_manual_review: 'bg-sky-500/10     text-sky-400     border-sky-500/20',
};

const SYSTEM_AREA_LABELS = {
  agent_quality:       'Agent Quality',
  monitoring:          'Monitoring',
  quote_funnel:        'Quote Funnel',
  dashboard_ui:        'Dashboard UI',
  infrastructure:      'Infrastructure',
  customer_experience: 'Customer Experience',
};

const SYSTEM_AREA_STYLES = {
  agent_quality:       'bg-teal-500/10    text-teal-400   border-teal-500/20',
  monitoring:          'bg-violet-500/10  text-violet-400 border-violet-500/20',
  quote_funnel:        'bg-orange-500/10  text-orange-400 border-orange-500/20',
  dashboard_ui:        'bg-sky-500/10     text-sky-400    border-sky-500/20',
  infrastructure:      'bg-white/5        text-white/50   border-white/10',
  customer_experience: 'bg-pink-500/10    text-pink-400   border-pink-500/20',
};

const CI_STYLES = {
  success: 'text-emerald-400',
  failure: 'text-red-400',
  pending: 'text-amber-400',
  unknown: 'text-white/35',
};

const CI_LABELS = {
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

// ── Sub-components ────────────────────────────────────────────────────────────

function Chip({ label, style }: { label: string; style: string }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${style}`}>
      {label}
    </span>
  );
}

function ChecksStrip({ checks }: { checks: MergeReviewItem['checks'] }) {
  const entries: Array<[string, string]> = [
    ['Typecheck', checks.typecheck],
    ['Lint',      checks.lint],
    ['Build',     checks.build],
    ['Tests',     checks.unitTests],
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
        Explain this change to me like I'm the business owner
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
        ['What it does',              result.whatItDoes],
        ['Why it matters',            result.whyItMatters],
        ['Should you approve it',     result.shouldYouApprove],
        ['What happens if you ignore it', result.whatHappensIfIgnored],
      ] as [string, string][]).map(([heading, text]) => (
        <div key={heading}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{heading}</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-white/70">{text}</p>
        </div>
      ))}
      <button
        onClick={() => setState('idle')}
        className="text-[11px] text-white/30 hover:text-white/60"
      >
        Dismiss
      </button>
    </div>
  );
}

function ReviewCard({ item }: { item: MergeReviewItem }) {
  const [expanded, setExpanded] = useState(false);

  const rel = (() => {
    const d = Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 86_400_000);
    if (d === 0) return 'today';
    if (d === 1) return '1d ago';
    if (d < 30) return `${d}d ago`;
    return `${Math.floor(d / 30)}mo ago`;
  })();

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 transition hover:border-white/[0.12]">
      {/* Header row */}
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Chip label={RISK_STYLES[item.riskLevel] ? item.riskLevel : item.riskLevel} style={RISK_STYLES[item.riskLevel]} />
          <span className="inline-flex items-center">
            <Chip label={SYSTEM_AREA_LABELS[item.systemArea]} style={SYSTEM_AREA_STYLES[item.systemArea]} />
            <HelpTip text={`This change touches the ${SYSTEM_AREA_LABELS[item.systemArea].toLowerCase()} layer of the platform.`} />
          </span>
          {item.isDraft && (
            <Chip label="Draft" style="bg-white/5 text-white/40 border-white/[0.07]" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-medium ${CI_STYLES[item.ciStatus]}`}>
            {CI_LABELS[item.ciStatus]}
          </span>
          <span className="text-[11px] text-white/30">{rel}</span>
        </div>
      </div>

      {/* Title */}
      <h3 className="mt-2 text-sm font-semibold text-white/90">{item.plainTitle}</h3>
      <p className="mt-0.5 text-[12px] text-white/35 font-mono">{item.branch}</p>

      {/* Recommendation banner */}
      <div className={`mt-3 inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-medium ${RECOMMENDATION_STYLES[item.recommendation]}`}>
        {item.recommendationLabel}
        <HelpTip text={`Confidence: ${item.confidence}%`} />
      </div>

      {/* Checks strip */}
      <div className="mt-3">
        <ChecksStrip checks={item.checks} />
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-3 space-y-3 border-t border-white/[0.07] pt-3">
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
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Rollback plan</p>
              <p className="mt-0.5 text-[13px] text-white/55">{item.rollbackPlan}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={item.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-white/[0.09] bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/50 hover:text-white/80"
            >
              View on GitHub ↗
            </a>
            {item.previewUrl && (
              <a
                href={item.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-sky-400/20 bg-sky-500/[0.06] px-2.5 py-1 text-[11px] text-sky-400 hover:bg-sky-500/[0.12]"
              >
                Preview deployment ↗
              </a>
            )}
          </div>
          <ExplainPanel item={item} />
        </div>
      )}

      {/* Footer actions */}
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => setExpanded((x) => !x)}
          className="text-[11px] text-white/40 hover:text-white/70"
        >
          {expanded ? 'Less' : 'Details + Explain'}
        </button>
        {!expanded && (
          <div className="ml-auto flex gap-2">
            <a
              href={item.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-white/35 hover:text-white/60"
            >
              GitHub ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryStrip({ summary }: { summary: MergeReviewResponse['summary'] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[
        {
          label: 'Waiting for review',
          count: summary.total,
          style: 'text-white/70',
          tip: 'Total open PRs detected from GitHub.',
        },
        {
          label: 'Safe to approve',
          count: summary.safeToApprove,
          style: 'text-emerald-400',
          tip: 'Low-risk PRs with passing CI. Can be approved without manual inspection.',
        },
        {
          label: 'Need manual review',
          count: summary.needsManualReview,
          style: 'text-amber-400',
          tip: 'Medium-risk changes, draft PRs, or changes to UI/infrastructure that need your eyes.',
        },
        {
          label: 'Should not be pushed',
          count: summary.shouldNotPush,
          style: 'text-red-400',
          tip: 'CI is failing. Do not merge these until the build is green.',
        },
      ].map(({ label, count, style, tip }) => (
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

// ── Main component ─────────────────────────────────────────────────────────────

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

  if (loading) {
    return (
      <div className="space-y-4">
        <SectionHeader loading />
        <p className="text-sm text-white/40">Fetching open PRs from GitHub…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <SectionHeader />
        <p className="text-sm text-red-400">Error: {error}</p>
      </div>
    );
  }

  if (!data) return null;

  if (!data.githubConfigured) {
    return (
      <div className="space-y-4">
        <SectionHeader />
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-5">
          <p className="text-[13px] text-white/50">
            GitHub is not connected.{' '}
            <span className="text-white/70">Set the <code className="font-mono text-white/60">GITHUB_TOKEN</code>, <code className="font-mono text-white/60">GITHUB_REPO_OWNER</code>, and <code className="font-mono text-white/60">GITHUB_REPO_NAME</code> environment variables to enable merge reviews.</span>
          </p>
        </div>
      </div>
    );
  }

  const filterButtons: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: 'all',                label: 'All',              count: data.items.length },
    { key: 'approve',            label: 'Safe to approve',  count: data.summary.safeToApprove },
    { key: 'needs_manual_review',label: 'Needs review',     count: data.summary.needsManualReview },
    { key: 'reject',             label: 'Failing CI',       count: data.summary.shouldNotPush },
  ];

  const visible = filter === 'all'
    ? data.items
    : data.items.filter((i) => i.recommendation === filter);

  return (
    <div className="space-y-5">
      <SectionHeader onRefresh={() => void load()} />

      {/* Plain-English intro */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <p className="text-[13px] text-white/55">
          These are open code changes waiting to go live on your platform. Each has been reviewed automatically for{' '}
          <strong className="text-white/70">risk</strong>,{' '}
          <strong className="text-white/70">what it does</strong>, and{' '}
          <strong className="text-white/70">whether it should go to production</strong>.
          Click <em className="text-white/60">Details + Explain</em> on any card for a plain-English breakdown.
          This is read-only — no changes will be made from here.
        </p>
      </div>

      {/* Summary strip */}
      <SummaryStrip summary={data.summary} />

      {/* Top recommended */}
      {data.summary.topRecommended.length > 0 && (
        <div className="rounded-xl border border-emerald-500/[0.12] bg-emerald-500/[0.03] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400/70 mb-2">
            Top changes likely to improve agent quality
          </p>
          <ul className="space-y-1">
            {data.summary.topRecommended.map((item) => (
              <li key={item.prNumber} className="flex items-center gap-2 text-[13px]">
                <span className="text-emerald-400">→</span>
                <span className="text-white/75">{item.plainTitle}</span>
                <span className="text-white/30 text-[11px]">#{item.prNumber}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex gap-1 rounded-lg border border-white/[0.07] bg-white/[0.03] p-0.5 w-fit">
        {filterButtons.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
              filter === key
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {label}
            {count > 0 && <span className="ml-1 text-white/30">{count}</span>}
          </button>
        ))}
      </div>

      {/* Cards */}
      {visible.length === 0 ? (
        <p className="text-sm text-white/35">No PRs in this filter.</p>
      ) : (
        <div className="space-y-3">
          {visible.map((item) => (
            <ReviewCard key={item.prNumber} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ loading, onRefresh }: { loading?: boolean; onRefresh?: () => void }) {
  return (
    <div className="flex items-center justify-between pt-1">
      <div className="flex items-center gap-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/25">
          Agent Merge Review
        </span>
        <span className="inline-flex items-center rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-sky-400">
          Read-only
        </span>
        {loading && (
          <span className="text-[10px] text-white/30">Loading…</span>
        )}
      </div>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="text-[11px] text-white/35 hover:text-white/60"
        >
          Refresh
        </button>
      )}
    </div>
  );
}
