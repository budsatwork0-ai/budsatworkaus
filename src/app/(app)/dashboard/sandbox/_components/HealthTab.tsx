'use client';

/**
 * Health tab — continuous sandbox monitoring (Phase 1 + Phase 2).
 * Shows last cron run, latest batches, per-agent health trends,
 * failing scenarios, regressions, the needs-review queue, improvement
 * proposals, promotion recommendations, and resolved root causes.
 * Data: GET /api/sandbox/health (admin-gated).
 */

import { useCallback, useEffect, useState } from 'react';
import CronCountdownCard from './CronCountdownCard';

type Batch = {
  id: string;
  agent_id: string;
  trigger: string;
  status: string;
  scenario_count: number;
  pass_count: number;
  avg_f1: number | null;
  total_cost_cents: number;
  started_at: string;
  finished_at: string | null;
};

type HealthRow = {
  agent_id: string;
  runs: number;
  pass_rate: number | null;
  avg_f1: number | null;
  baseline_f1: number | null;
  delta_f1: number | null;
  trend: 'improving' | 'stable' | 'degrading';
  computed_at: string;
};

type FailingScenario = {
  scenarioId: string;
  title: string;
  category: string;
  agentId: string;
  f1: number;
  scoredAt: string;
};

type ReviewItem = {
  id: string;
  agent_id: string;
  title: string;
  observation: string;
  recommendation: string | null;
  severity: string;
  created_at: string;
};

type RootCause = {
  key: string;
  title: string;
  severity: 'critical' | 'warning';
  agentId: string;
  failureType: 'zero_action' | 'wrong_actions';
  rootCauseSummary: string;
  lessonCount: number;
  latestAt: string;
  exampleObservations: string[];
  recommendedFix: string;
  lessonIds: string[];
};

type ImprovementProposal = {
  id: string;
  title: string;
  affectedAgent: string;
  severity: 'critical' | 'warning' | 'info';
  confidence: number;
  likelyRootCause: string;
  suggestedFix: string;
  expectedF1Impact: string;
  suggestedFiles: string[];
  suggestedTests: string[];
  rollbackPlan: string;
  sourceRootCauseKey: string;
  lessonCount: number;
  createdAt: string;
};

type PromotionStatus = 'promote' | 'healthy' | 'monitor' | 'investigate' | 'blocked';

type PromotionRecommendation = {
  agentId: string;
  status: PromotionStatus;
  currentF1: number | null;
  baselineF1: number | null;
  trend: 'improving' | 'stable' | 'degrading';
  hasRegression: boolean;
  hasActiveRootCauses: boolean;
  lessonCount: number;
  rootCauseCount: number;
  rationale: string;
};

type HealthData = {
  lastCronRun: Batch | null;
  batches: Batch[];
  health: HealthRow[];
  regressions: HealthRow[];
  failingScenarios: FailingScenario[];
  needsReview: ReviewItem[];
  rootCauses: RootCause[];
  activeRootCauses?: RootCause[];
  resolvedRootCauses?: RootCause[];
  proposals?: ImprovementProposal[];
  recommendations?: PromotionRecommendation[];
};

// ── Shared atoms ───────────────────────────────────────────────────────────

function TrendChip({ trend }: { trend: HealthRow['trend'] }) {
  const styles =
    trend === 'improving'
      ? 'bg-[#e5f4ec] text-[#1C7C54]'
      : trend === 'degrading'
        ? 'bg-[#fde8e8] text-[#b42318]'
        : 'bg-[#eef2f0] text-[#617269]';
  const arrow = trend === 'improving' ? '▲' : trend === 'degrading' ? '▼' : '—';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${styles}`}>
      {arrow} {trend}
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  const styles =
    status === 'complete'
      ? 'bg-[#e5f4ec] text-[#1C7C54]'
      : status === 'failed'
        ? 'bg-[#fde8e8] text-[#b42318]'
        : 'bg-[#fff6e0] text-[#9a6700]';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${styles}`}>
      {status}
    </span>
  );
}

function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 rounded-[8px] border border-[#dfe9e2] bg-white px-4 py-4 shadow-[0_18px_48px_rgba(15,61,46,0.07)]">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-[#17392b]">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function fmtF1(v: number | null): string {
  return v === null ? '—' : Number(v).toFixed(2);
}

function SeverityChip({ severity }: { severity: string }) {
  const isCritical = severity === 'critical';
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
        isCritical ? 'bg-[#fde8e8] text-[#b42318]' : 'bg-[#fff6e0] text-[#9a6700]'
      }`}
    >
      {severity}
    </span>
  );
}

// ── Promotion recommendation chip ──────────────────────────────────────────

const PROMO_STYLES: Record<PromotionStatus, string> = {
  promote: 'bg-[#e5f4ec] text-[#1C7C54]',
  healthy: 'bg-[#e8f4fb] text-[#1a5f8a]',
  monitor: 'bg-[#fff6e0] text-[#9a6700]',
  investigate: 'bg-[#fde8e8] text-[#b42318]',
  blocked: 'bg-[#f8e8f8] text-[#7b2d7b]',
};

const PROMO_LABELS: Record<PromotionStatus, string> = {
  promote: '★ Promote',
  healthy: '✓ Healthy',
  monitor: '◎ Monitor',
  investigate: '⚠ Investigate',
  blocked: '✗ Blocked',
};

function RecommendationChip({ status }: { status: PromotionStatus }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${PROMO_STYLES[status]}`}
    >
      {PROMO_LABELS[status]}
    </span>
  );
}

// ── Root cause card ────────────────────────────────────────────────────────

function RootCauseCard({
  rc,
  rawLessons,
  resolved,
}: {
  rc: RootCause;
  rawLessons: ReviewItem[];
  resolved?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const related = rawLessons.filter((l) => rc.lessonIds.includes(l.id));

  return (
    <div
      className={`rounded-[8px] border px-4 py-3 ${
        resolved
          ? 'border-[#dfe9e2] bg-[#f8fdf9]'
          : 'border-[#f3c7c3] bg-[#fff8f7]'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black text-[#17392b]">{rc.title}</p>
            {resolved ? (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase bg-[#e5f4ec] text-[#1C7C54]">
                resolved
              </span>
            ) : (
              <SeverityChip severity={rc.severity} />
            )}
          </div>
          <p className="mt-1 text-xs font-semibold text-[#617269]">{rc.rootCauseSummary}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-black uppercase text-[#7f9187]">Lessons</p>
          <p
            className={`text-lg font-black ${resolved ? 'text-[#617269]' : 'text-[#b42318]'}`}
          >
            {rc.lessonCount}
          </p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold text-[#7f9187]">
        <span>
          Agent: <span className="text-[#17392b]">{rc.agentId}</span>
        </span>
        <span>
          Type:{' '}
          <span className="text-[#17392b]">
            {rc.failureType === 'zero_action' ? 'Zero action' : 'Wrong actions'}
          </span>
        </span>
        <span>
          Latest:{' '}
          <span className="text-[#17392b]">{new Date(rc.latestAt).toLocaleString()}</span>
        </span>
      </div>

      {!resolved && (
        <div className="mt-2 rounded-[6px] bg-[#f0f9f4] px-3 py-2">
          <p className="text-[10px] font-black uppercase text-[#617269]">Recommended fix</p>
          <p className="mt-0.5 text-xs font-semibold text-[#17392b]">{rc.recommendedFix}</p>
        </div>
      )}

      {related.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-[10px] font-black text-[#1C7C54] hover:underline"
        >
          {expanded
            ? '▲ Hide details'
            : `▼ View ${related.length} lesson${related.length !== 1 ? 's' : ''}`}
        </button>
      )}

      {expanded && related.length > 0 && (
        <div className="mt-2 grid gap-1.5">
          {related.map((l) => (
            <div
              key={l.id}
              className="rounded-[6px] border border-[#dfe9e2] bg-white px-3 py-2"
            >
              <p className="text-xs font-black text-[#17392b]">{l.title}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-[#617269]">{l.observation}</p>
              {l.recommendation && (
                <p className="mt-0.5 text-[11px] font-semibold text-[#1C7C54]">
                  {l.recommendation}
                </p>
              )}
              <p className="mt-0.5 text-[10px] font-bold text-[#7f9187]">
                {new Date(l.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Needs review panel (active root causes only) ───────────────────────────

function NeedsReviewPanel({
  rootCauses,
  rawLessons,
}: {
  rootCauses: RootCause[];
  rawLessons: ReviewItem[];
}) {
  const totalLessons = rawLessons.length;
  const title =
    rootCauses.length > 0
      ? `Active Root Causes — ${rootCauses.length} open (${totalLessons} lesson${totalLessons !== 1 ? 's' : ''})`
      : `Active Root Causes (${totalLessons})`;

  return (
    <Panel title={title}>
      {rootCauses.length === 0 && totalLessons === 0 ? (
        <p className="text-sm font-semibold text-[#7f9187]">
          No active root causes in the last 7 days.
        </p>
      ) : rootCauses.length > 0 ? (
        <div className="grid gap-2">
          {rootCauses.map((rc) => (
            <RootCauseCard key={rc.key} rc={rc} rawLessons={rawLessons} />
          ))}
        </div>
      ) : (
        <div className="grid gap-2">
          {rawLessons.map((item) => (
            <div
              key={item.id}
              className="rounded-[8px] border border-[#f3c7c3] bg-[#fff8f7] px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-black text-[#17392b]">{item.title}</p>
                <SeverityChip severity={item.severity} />
              </div>
              <p className="mt-1 text-xs font-semibold text-[#617269]">{item.observation}</p>
              <p className="mt-1 text-[10px] font-bold text-[#7f9187]">
                {item.agent_id} — {new Date(item.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ── Resolved root causes panel ─────────────────────────────────────────────

function ResolvedRootCausesPanel({
  rootCauses,
  rawLessons,
}: {
  rootCauses: RootCause[];
  rawLessons: ReviewItem[];
}) {
  if (rootCauses.length === 0) return null;

  return (
    <Panel title={`Resolved Root Causes (${rootCauses.length})`}>
      <p className="text-xs font-semibold text-[#617269]">
        These agents previously had failures but now pass all their scenarios. Historical lessons
        are preserved.
      </p>
      <div className="mt-2 grid gap-2">
        {rootCauses.map((rc) => (
          <RootCauseCard key={rc.key} rc={rc} rawLessons={rawLessons} resolved />
        ))}
      </div>
    </Panel>
  );
}

// ── Improvement proposals panel ────────────────────────────────────────────

function ProposalCard({ proposal }: { proposal: ImprovementProposal }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-[8px] border border-[#dfe0f5] bg-[#f9f9fe] px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black text-[#17392b]">{proposal.title}</p>
            <SeverityChip severity={proposal.severity} />
            <span className="rounded-full bg-[#eef2f0] px-2 py-0.5 text-[10px] font-black text-[#617269]">
              {proposal.confidence}% confidence
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold text-[#617269]">
            Agent: {proposal.affectedAgent} · Expected F1 impact: {proposal.expectedF1Impact}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-black uppercase text-[#7f9187]">Lessons</p>
          <p className="text-lg font-black text-[#17392b]">{proposal.lessonCount}</p>
        </div>
      </div>

      <div className="mt-2 rounded-[6px] bg-[#f0f9f4] px-3 py-2">
        <p className="text-[10px] font-black uppercase text-[#617269]">Likely root cause</p>
        <p className="mt-0.5 text-xs font-semibold text-[#17392b]">{proposal.likelyRootCause}</p>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 text-[10px] font-black text-[#1C7C54] hover:underline"
      >
        {expanded ? '▲ Hide details' : '▼ View fix + files + tests'}
      </button>

      {expanded && (
        <div className="mt-2 grid gap-2">
          <div className="rounded-[6px] border border-[#dfe9e2] bg-white px-3 py-2">
            <p className="text-[10px] font-black uppercase text-[#617269]">Suggested fix</p>
            <p className="mt-0.5 whitespace-pre-line text-xs font-semibold text-[#17392b]">
              {proposal.suggestedFix}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[6px] border border-[#dfe9e2] bg-white px-3 py-2">
              <p className="text-[10px] font-black uppercase text-[#617269]">Files</p>
              {proposal.suggestedFiles.map((f) => (
                <p key={f} className="mt-0.5 text-[11px] font-mono font-semibold text-[#17392b]">
                  {f}
                </p>
              ))}
            </div>
            <div className="rounded-[6px] border border-[#dfe9e2] bg-white px-3 py-2">
              <p className="text-[10px] font-black uppercase text-[#617269]">Tests</p>
              {proposal.suggestedTests.map((t) => (
                <p key={t} className="mt-0.5 text-[11px] font-mono font-semibold text-[#17392b]">
                  {t}
                </p>
              ))}
            </div>
          </div>
          <div className="rounded-[6px] border border-[#dfe9e2] bg-white px-3 py-2">
            <p className="text-[10px] font-black uppercase text-[#617269]">Rollback plan</p>
            <p className="mt-0.5 text-xs font-semibold text-[#617269]">{proposal.rollbackPlan}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ProposalsPanel({ proposals }: { proposals: ImprovementProposal[] }) {
  if (proposals.length === 0) {
    return (
      <Panel title="Improvement Proposals (0)">
        <p className="text-sm font-semibold text-[#7f9187]">
          No proposals — all active root causes have been resolved or no data yet.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title={`Improvement Proposals (${proposals.length})`}>
      <p className="text-xs font-semibold text-[#617269]">
        Read-only. One proposal per active root cause. No automatic code changes or promotions.
      </p>
      <div className="mt-2 grid gap-2">
        {proposals.map((p) => (
          <ProposalCard key={p.id} proposal={p} />
        ))}
      </div>
    </Panel>
  );
}

// ── Recommendations panel ──────────────────────────────────────────────────

function RecommendationsPanel({
  recommendations,
}: {
  recommendations: PromotionRecommendation[];
}) {
  if (recommendations.length === 0) return null;

  const promotable = recommendations.filter((r) => r.status === 'promote');
  const blocked = recommendations.filter(
    (r) => r.status === 'blocked' || r.status === 'investigate',
  );

  return (
    <Panel
      title={`Promotion Recommendations (${recommendations.length})`}
    >
      {promotable.length > 0 && (
        <div className="mb-2 rounded-[6px] bg-[#e5f4ec] px-3 py-2">
          <p className="text-[10px] font-black uppercase text-[#1C7C54]">
            {promotable.length} agent{promotable.length !== 1 ? 's' : ''} ready to promote
          </p>
          <p className="text-xs font-semibold text-[#1C7C54]">
            {promotable.map((r) => r.agentId).join(', ')}
          </p>
        </div>
      )}
      {blocked.length > 0 && (
        <div className="mb-2 rounded-[6px] bg-[#fff8f7] px-3 py-2">
          <p className="text-[10px] font-black uppercase text-[#b42318]">
            {blocked.length} agent{blocked.length !== 1 ? 's' : ''} blocked or need investigation
          </p>
          <p className="text-xs font-semibold text-[#b42318]">
            {blocked.map((r) => r.agentId).join(', ')}
          </p>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[10px] font-black uppercase text-[#7f9187]">
              <th className="py-2 pr-4">Agent</th>
              <th className="py-2 pr-4">F1</th>
              <th className="py-2 pr-4">Trend</th>
              <th className="py-2 pr-4">Root causes</th>
              <th className="py-2 pr-4">Lessons</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {recommendations.map((r) => (
              <tr key={r.agentId} className="border-t border-[#eef2f0]">
                <td className="py-2 pr-4 font-black text-[#17392b]">{r.agentId}</td>
                <td className="py-2 pr-4 font-semibold text-[#617269]">
                  {fmtF1(r.currentF1)}
                </td>
                <td className="py-2 pr-4">
                  <TrendChip trend={r.trend} />
                </td>
                <td className="py-2 pr-4 font-semibold text-[#617269]">{r.rootCauseCount}</td>
                <td className="py-2 pr-4 font-semibold text-[#617269]">{r.lessonCount}</td>
                <td className="py-2">
                  <RecommendationChip status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function HealthTab() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sandbox/health', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to load health data (${res.status})`);
      setData((await res.json()) as HealthData);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return <p className="text-sm font-semibold text-[#7f9187]">Loading health data...</p>;
  }
  if (error) {
    return <p className="text-sm font-semibold text-[#b42318]">{error}</p>;
  }
  if (!data) return null;

  const refreshButton = (
    <button
      type="button"
      onClick={() => void load()}
      className="rounded-[6px] border border-[#dfe9e2] px-3 py-1.5 text-xs font-bold text-[#617269] hover:border-[#3c8259]"
    >
      Refresh
    </button>
  );

  // Phase 2 data (falls back to empty arrays for Phase 1 API responses)
  const activeRootCauses = data.activeRootCauses ?? data.rootCauses ?? [];
  const resolvedRootCauses = data.resolvedRootCauses ?? [];
  const proposals = data.proposals ?? [];
  const recommendations = data.recommendations ?? [];

  return (
    <section className="grid gap-5">
      {/* Cron countdown — live client-side timer */}
      <CronCountdownCard lastCronRun={data.lastCronRun} />

      {/* Last cron run */}
      <Panel title="Continuous Monitoring" action={refreshButton}>
        {data.lastCronRun ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
              <p className="text-[10px] font-black uppercase text-[#7f9187]">Last cron run</p>
              <p className="text-sm font-black text-[#17392b]">
                {new Date(data.lastCronRun.started_at).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-[#7f9187]">Agent</p>
              <p className="text-sm font-black text-[#17392b]">{data.lastCronRun.agent_id}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-[#7f9187]">Result</p>
              <p className="text-sm font-black text-[#17392b]">
                {data.lastCronRun.pass_count}/{data.lastCronRun.scenario_count} passed · avg F1{' '}
                {fmtF1(data.lastCronRun.avg_f1)}
              </p>
            </div>
            <StatusChip status={data.lastCronRun.status} />
          </div>
        ) : (
          <p className="text-sm font-semibold text-[#7f9187]">
            No cron runs yet. The sandbox-runner cron activates on the next deploy — hourly
            (customer), daily 03:00 (ops/finance/ndis/growth), nightly 01:30 (full regression).
          </p>
        )}
      </Panel>

      {/* Active root causes (needs review) */}
      <NeedsReviewPanel rootCauses={activeRootCauses} rawLessons={data.needsReview} />

      {/* Phase 2: Improvement proposals */}
      <ProposalsPanel proposals={proposals} />

      {/* Phase 2: Promotion recommendations */}
      <RecommendationsPanel recommendations={recommendations} />

      {/* Agent health trends */}
      <Panel title="Agent Health">
        {data.health.length === 0 ? (
          <p className="text-sm font-semibold text-[#7f9187]">
            No health snapshots yet — they accumulate as the cron runs.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[10px] font-black uppercase text-[#7f9187]">
                  <th className="py-2 pr-4">Agent</th>
                  <th className="py-2 pr-4">Runs (24h)</th>
                  <th className="py-2 pr-4">Pass rate</th>
                  <th className="py-2 pr-4">Avg F1</th>
                  <th className="py-2 pr-4">Baseline</th>
                  <th className="py-2 pr-4">Δ F1</th>
                  <th className="py-2 pr-4">Trend</th>
                  {recommendations.length > 0 && <th className="py-2">Recommendation</th>}
                </tr>
              </thead>
              <tbody>
                {data.health.map((h) => {
                  const rec = recommendations.find((r) => r.agentId === h.agent_id);
                  return (
                    <tr key={h.agent_id} className="border-t border-[#eef2f0]">
                      <td className="py-2 pr-4 font-black text-[#17392b]">{h.agent_id}</td>
                      <td className="py-2 pr-4 font-semibold text-[#617269]">{h.runs}</td>
                      <td className="py-2 pr-4 font-semibold text-[#617269]">
                        {h.pass_rate === null ? '—' : `${Math.round(Number(h.pass_rate) * 100)}%`}
                      </td>
                      <td className="py-2 pr-4 font-semibold text-[#617269]">{fmtF1(h.avg_f1)}</td>
                      <td className="py-2 pr-4 font-semibold text-[#617269]">
                        {fmtF1(h.baseline_f1)}
                      </td>
                      <td
                        className={`py-2 pr-4 font-black ${
                          h.delta_f1 !== null && Number(h.delta_f1) < 0
                            ? 'text-[#b42318]'
                            : 'text-[#1C7C54]'
                        }`}
                      >
                        {h.delta_f1 === null
                          ? '—'
                          : Number(h.delta_f1) > 0
                            ? `+${fmtF1(h.delta_f1)}`
                            : fmtF1(h.delta_f1)}
                      </td>
                      <td className="py-2 pr-4">
                        <TrendChip trend={h.trend} />
                      </td>
                      {recommendations.length > 0 && (
                        <td className="py-2">
                          {rec ? <RecommendationChip status={rec.status} /> : null}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Regressions */}
      {data.regressions.length > 0 ? (
        <Panel title={`Regressions (${data.regressions.length})`}>
          <div className="grid gap-2">
            {data.regressions.map((r) => (
              <div
                key={r.agent_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-[#f3c7c3] bg-[#fff8f7] px-4 py-3"
              >
                <p className="text-sm font-black text-[#17392b]">{r.agent_id}</p>
                <p className="text-xs font-semibold text-[#617269]">
                  F1 {fmtF1(r.avg_f1)} vs baseline {fmtF1(r.baseline_f1)} (Δ {fmtF1(r.delta_f1)})
                </p>
                <TrendChip trend={r.trend} />
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {/* Failing scenarios */}
      <Panel title={`Failing Scenarios (${data.failingScenarios.length})`}>
        {data.failingScenarios.length === 0 ? (
          <p className="text-sm font-semibold text-[#7f9187]">
            No failing scenarios. All latest scores ≥ 0.5.
          </p>
        ) : (
          <div className="grid gap-2">
            {data.failingScenarios.map((s) => (
              <div
                key={s.scenarioId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-[#dfe9e2] px-4 py-3"
              >
                <div>
                  <p className="text-sm font-black text-[#17392b]">{s.title}</p>
                  <p className="text-[10px] font-bold uppercase text-[#7f9187]">
                    {s.category} · {s.agentId}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-[#b42318]">F1 {s.f1.toFixed(2)}</p>
                  <p className="text-[10px] font-bold text-[#7f9187]">
                    {new Date(s.scoredAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Phase 2: Resolved root causes */}
      <ResolvedRootCausesPanel rootCauses={resolvedRootCauses} rawLessons={data.needsReview} />

      {/* Latest batches */}
      <Panel title="Latest Batches">
        {data.batches.length === 0 ? (
          <p className="text-sm font-semibold text-[#7f9187]">No batches yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[10px] font-black uppercase text-[#7f9187]">
                  <th className="py-2 pr-4">Started</th>
                  <th className="py-2 pr-4">Agent</th>
                  <th className="py-2 pr-4">Trigger</th>
                  <th className="py-2 pr-4">Passed</th>
                  <th className="py-2 pr-4">Avg F1</th>
                  <th className="py-2 pr-4">Cost</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.batches.map((b) => (
                  <tr key={b.id} className="border-t border-[#eef2f0]">
                    <td className="py-2 pr-4 font-semibold text-[#617269]">
                      {new Date(b.started_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 font-black text-[#17392b]">{b.agent_id}</td>
                    <td className="py-2 pr-4 font-semibold text-[#617269]">{b.trigger}</td>
                    <td className="py-2 pr-4 font-semibold text-[#617269]">
                      {b.pass_count}/{b.scenario_count}
                    </td>
                    <td className="py-2 pr-4 font-semibold text-[#617269]">{fmtF1(b.avg_f1)}</td>
                    <td className="py-2 pr-4 font-semibold text-[#617269]">
                      {b.total_cost_cents}¢
                    </td>
                    <td className="py-2">
                      <StatusChip status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </section>
  );
}
