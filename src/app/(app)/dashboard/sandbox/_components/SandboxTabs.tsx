'use client';

import { useMemo, useState } from 'react';
import type { ScenarioCategory, ScenarioDifficulty, SandboxScenarioTemplate } from '@/lib/sandbox/scenarios';
import { SANDBOX_SCENARIOS } from '@/lib/sandbox/scenarios';
import type { AgentIntegrityReport, AgentIntegrityStatus, RequirementStatus } from '../_lib/types';
import { integrityStatusColour, integrityStatusLabel, requirementStatusColour } from '../_lib/doctor';
import CronCountdownCard from './CronCountdownCard';
import type { AgentRow, Batch, FleetBucket, HealthData, HistoryRow, ImprovementProposal, Lesson, OperatorIntelligence, PackKind, PackResult, PromotionRecommendation, ReadinessData, RootCause, RunResult, SandboxData } from '../_lib/types';
import { CATEGORY_COLOURS, DIFFICULTY_COLOURS, fmtF1, isPass, pct, pctRatio, scenarioCategories } from '../_lib/format';
import { bucketForAgent, buildRequiredActions, promotionReason } from '../_lib/agents';
import { toPackResultStatic } from '../_lib/results';
import { FleetStatusCards } from './FleetStatusCards';
import { ArenaActionButton, EmptyState, F1Badge, LastResultCard, MiniMetric, Panel, PassFailChip, PromotionChip, SeverityBadge, SmallButton, StatCard, StatusPill, SummaryLine, Select } from './ui';

export function OverviewTab({
  health,
  agents,
  buckets,
  activeRootCauses,
  resolvedRootCauses,
  proposals,
  recommendations,
  latestManualSummary,
  intelligence,
  onFilterAgents,
  onOpenDetails,
}: {
  health: HealthData | null;
  agents: AgentRow[];
  buckets: Record<FleetBucket, AgentRow[]>;
  activeRootCauses: RootCause[];
  resolvedRootCauses: RootCause[];
  proposals: ImprovementProposal[];
  recommendations: PromotionRecommendation[];
  latestManualSummary: string | null;
  intelligence: OperatorIntelligence;
  onFilterAgents: (bucket: FleetBucket) => void;
  onOpenDetails: (target: 'learning' | 'agents' | 'run') => void;
}) {
  const requiredActions = buildRequiredActions(health, agents, activeRootCauses, proposals);
  const resolvedThisWeek = resolvedRootCauses.length;
  const actionableAgents = [...buckets.promote, ...buckets.investigate, ...buckets.blocked];

  return (
    <section className="grid gap-5">
      <FleetStatusCards buckets={buckets} onFilter={onFilterAgents} intelligence={intelligence} />

      <Panel title="What's Changed Since Yesterday">
        {intelligence.recentChanges.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {intelligence.recentChanges.map((change) => (
              <div key={change} className="rounded-[8px] bg-[#f4faf6] px-3 py-2 text-sm font-black text-[#17392b]">{change}</div>
            ))}
          </div>
        ) : (
          <EmptyState message={`No active discoveries. Fleet has been healthy for ${intelligence.healthyDays} consecutive day${intelligence.healthyDays === 1 ? '' : 's'}.`} />
        )}
      </Panel>

      <ContradictionExplainer
        latestManualSummary={latestManualSummary}
        lastCronRun={health?.lastCronRun ?? null}
        activeRootCauses={activeRootCauses.length}
        failingScenarios={health?.failingScenarios.length ?? 0}
        readyToPromote={recommendations.filter((row) => row.status === 'promote').length}
      />

      {requiredActions.length > 0 ? (
        <Panel title="Required Actions" action={<SmallButton onClick={() => onOpenDetails('learning')}>View details</SmallButton>}>
          <div className="grid gap-2">
            {requiredActions.slice(0, 8).map((action) => (
              <RequiredActionCard key={action.id} action={action} onOpen={() => onOpenDetails(action.target)} />
            ))}
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-3">
        <Panel title="Learning This Week">
          <div className="grid grid-cols-2 gap-2">
            <MiniMetric label="Root causes found" value={String(activeRootCauses.length)} trend={intelligence.rootCausesTrend} />
            <MiniMetric label="Root causes resolved" value={String(resolvedThisWeek)} />
            <MiniMetric label="Open lessons" value={String(intelligence.openLessons)} trend={intelligence.lessonsTrend} />
            <MiniMetric label="New lessons (7d)" value={String(intelligence.lessonsThisWeek)} />
          </div>
        </Panel>
        <Panel title="Latest Discoveries">
          {activeRootCauses.length > 0 ? (
            <div className="grid gap-2">
              {activeRootCauses.slice(0, 3).map((rc) => (
                <CompactRootCause key={rc.key} rootCause={rc} />
              ))}
            </div>
          ) : (
            <EmptyState message={`No active discoveries. Fleet has been healthy for ${intelligence.healthyDays} consecutive day${intelligence.healthyDays === 1 ? '' : 's'}.`} />
          )}
        </Panel>
        <Panel title="Promotion Summary" action={<SmallButton onClick={() => onOpenDetails('agents')}>Agents</SmallButton>}>
          {actionableAgents.length === 0 ? (
            <EmptyState message="All agents in Monitor — no immediate action required." />
          ) : (
            <div className="grid gap-2">
              {actionableAgents.map((agent) => (
                <div key={agent.agentId} className="flex items-start justify-between gap-2 rounded-[8px] bg-[#f4faf6] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-[#17392b]">{agent.agentId}</p>
                    <p className="text-[11px] font-semibold text-[#617269]">{promotionReason(agent)}</p>
                  </div>
                  <PromotionChip status={agent.status} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </section>
  );
}

export function RunTab({
  scenarios,
  search,
  category,
  difficulty,
  sort,
  busySlug,
  busyPack,
  disabled,
  packResults,
  lastResult,
  lastScenario,
  onSearch,
  onCategory,
  onDifficulty,
  onSort,
  onRunScenario,
  onRunPack,
  onSelectResult,
}: {
  scenarios: SandboxScenarioTemplate[];
  search: string;
  category: ScenarioCategory | 'all';
  difficulty: ScenarioDifficulty | 'all';
  sort: 'title' | 'agent' | 'category' | 'difficulty';
  busySlug: string | null;
  busyPack: PackKind | null;
  disabled: boolean;
  packResults: PackResult[];
  lastResult: RunResult | null;
  lastScenario: SandboxScenarioTemplate | null;
  onSearch: (value: string) => void;
  onCategory: (value: ScenarioCategory | 'all') => void;
  onDifficulty: (value: ScenarioDifficulty | 'all') => void;
  onSort: (value: 'title' | 'agent' | 'category' | 'difficulty') => void;
  onRunScenario: (slug: string) => void;
  onRunPack: (pack: PackKind) => void;
  onSelectResult: (row: PackResult) => void;
}) {
  return (
    <section className="grid gap-5">
      <Panel title="Scenario Execution">
        <p className="text-xs font-semibold text-[#617269]">
          Pack runs execute sequentially and require confirmation. Scenario runs stay sandboxed and show live progress above the tabs.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <ArenaActionButton label="Run All Scenarios" description={`${SANDBOX_SCENARIOS.length} scenarios, sequential run`} busy={busyPack === 'all'} disabled={disabled} onClick={() => onRunPack('all')} />
          <ArenaActionButton label="Run Customer Pack" description="Customer scenarios" busy={busyPack === 'customer'} disabled={disabled} onClick={() => onRunPack('customer')} />
          <ArenaActionButton label="Run Ops Pack" description="Operations scenarios" busy={busyPack === 'ops'} disabled={disabled} onClick={() => onRunPack('ops')} />
          <ArenaActionButton label="Run Finance Pack" description="Finance scenarios" busy={busyPack === 'finance'} disabled={disabled} onClick={() => onRunPack('finance')} />
          <ArenaActionButton label="Stress Test" description="Multi-agent cascade" busy={busyPack === 'stress'} disabled={disabled} onClick={() => onRunPack('stress')} tone="warning" />
        </div>
      </Panel>

      {lastResult ? <LastResultCard result={lastResult} scenario={lastScenario} onOpen={() => lastScenario && onSelectResult(toPackResultStatic(lastScenario, lastResult))} /> : null}

      <Panel title="Scenario Catalogue">
        <div className="grid gap-2 lg:grid-cols-[1fr_auto_auto_auto]">
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search scenarios, tags, or agents"
            className="rounded-[6px] border border-[#dfe9e2] px-3 py-2 text-sm font-semibold text-[#17392b] outline-none transition focus:border-[#1C7C54]"
          />
          <Select value={category} onChange={(value) => onCategory(value as ScenarioCategory | 'all')}>
            <option value="all">All categories</option>
            {scenarioCategories().map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </Select>
          <Select value={difficulty} onChange={(value) => onDifficulty(value as ScenarioDifficulty | 'all')}>
            <option value="all">All difficulty</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </Select>
          <Select value={sort} onChange={(value) => onSort(value as 'title' | 'agent' | 'category' | 'difficulty')}>
            <option value="category">Sort: category</option>
            <option value="title">Sort: title</option>
            <option value="agent">Sort: agent</option>
            <option value="difficulty">Sort: difficulty</option>
          </Select>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {scenarios.map((scenario) => (
            <ScenarioCard
              key={scenario.slug}
              scenario={scenario}
              busy={busySlug === scenario.slug}
              disabled={disabled}
              onRun={onRunScenario}
            />
          ))}
        </div>
        {scenarios.length === 0 ? <EmptyState message="No scenarios match the current search and filters." /> : null}
      </Panel>

      {packResults.length > 0 ? <PackResultsTable rows={packResults} onSelect={onSelectResult} /> : null}
    </section>
  );
}

export function AgentsTab({
  agents,
  allAgents,
  filter,
  onFilter,
  onSelectAgent,
}: {
  agents: AgentRow[];
  allAgents: AgentRow[];
  filter: FleetBucket | 'all';
  onFilter: (filter: FleetBucket | 'all') => void;
  onSelectAgent: (agentId: string) => void;
}) {
  // Single pass over allAgents instead of four separate .filter() calls.
  const bucketCounts = useMemo(() => {
    const counts = { promote: 0, investigate: 0, blocked: 0, monitor: 0 };
    for (const agent of allAgents) counts[bucketForAgent(agent)] += 1;
    return counts;
  }, [allAgents]);

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap gap-2">
        {[
          ['all', `All (${allAgents.length})`],
          ['promote', `Promote (${bucketCounts.promote})`],
          ['investigate', `Investigate (${bucketCounts.investigate})`],
          ['blocked', `Blocked (${bucketCounts.blocked})`],
          ['monitor', `Monitor (${bucketCounts.monitor})`],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => onFilter(key as FleetBucket | 'all')}
            className={filter === key ? 'rounded-full bg-[#17392b] px-3 py-1 text-xs font-black text-white' : 'rounded-full border border-[#dfe9e2] bg-white px-3 py-1 text-xs font-bold text-[#617269] hover:border-[#3c8259]'}
          >
            {label}
          </button>
        ))}
      </div>
      <Panel title="Agent Health and Promotion">
        <p className="text-xs font-semibold text-[#617269]">
          Promotion status is the source of truth here: Promote, Monitor, Investigate, or Blocked. Blockers include active root causes, regressions, failing scenarios, and low F1.
        </p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#dfe9e2] text-xs font-black uppercase tracking-wider text-[#7f9187]">
                <th className="pb-2 pr-4">Agent</th>
                <th className="pb-2 pr-4 text-right">24h F1</th>
                <th className="pb-2 pr-4 text-right">7d baseline</th>
                <th className="pb-2 pr-4 text-right">Pass rate</th>
                <th className="pb-2 pr-4 text-right">Root causes</th>
                <th className="pb-2 pr-4 text-right">Lessons</th>
                <th className="pb-2 pr-4">Promotion status</th>
                <th className="pb-2 pr-4">Why not promotable</th>
                <th className="pb-2">Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.agentId} className="border-b border-[#f4faf6]">
                  <td className="py-2 pr-4">
                    <button type="button" onClick={() => onSelectAgent(agent.agentId)} className="font-black text-[#17392b] hover:text-[#1C7C54]">
                      {agent.agentId}
                    </button>
                  </td>
                  <td className="py-2 pr-4 text-right font-bold text-[#617269]">{fmtF1(agent.f1)}</td>
                  <td className="py-2 pr-4 text-right font-bold text-[#617269]">{fmtF1(agent.baselineF1)}</td>
                  <td className="py-2 pr-4 text-right font-bold text-[#617269]">{agent.passRate === null ? '-' : pct(agent.passRate)}</td>
                  <td className="py-2 pr-4 text-right font-bold text-[#617269]">{agent.rootCauseCount}</td>
                  <td className="py-2 pr-4 text-right font-bold text-[#617269]">{agent.lessonCount}</td>
                  <td className="py-2 pr-4"><PromotionChip status={agent.status} /></td>
                  <td className="py-2 pr-4 text-xs font-semibold text-[#617269]">{agent.status === 'Promote' ? 'Ready now' : promotionReason(agent)}</td>
                  <td className="py-2 text-xs font-semibold text-[#617269]">{agent.recommendation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {agents.length === 0 ? <EmptyState message="No agents match this filter." /> : null}
      </Panel>
    </section>
  );
}

export function LearningTab({
  health,
  history,
  lessons,
  activeRootCauses,
  resolvedRootCauses,
  proposals,
  onSelectRun,
  onRefresh,
}: {
  health: HealthData | null;
  history: HistoryRow[] | null;
  lessons: Lesson[] | null;
  activeRootCauses: RootCause[];
  resolvedRootCauses: RootCause[];
  proposals: ImprovementProposal[];
  onSelectRun: (row: HistoryRow) => void;
  onRefresh: () => void;
}) {
  const found = activeRootCauses.length + resolvedRootCauses.length;
  const resolved = resolvedRootCauses.length;
  const allLessons = lessons ?? [];
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newLessonsThisWeek = allLessons.filter((l) => new Date(l.createdAt).getTime() >= sevenDaysAgo).length;
  const resolvedLessonIds = new Set(resolvedRootCauses.flatMap((rc) => rc.lessonIds));
  const resolvedLessonsCount = allLessons.filter((l) => resolvedLessonIds.has(l.id)).length;
  const openLessonsCount = allLessons.length - resolvedLessonsCount;

  return (
    <section className="grid gap-5">
      <Panel title="Learning Velocity" action={<SmallButton onClick={onRefresh}>Refresh</SmallButton>}>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <MiniMetric label="Root causes found" value={String(found)} />
          <MiniMetric label="Root causes resolved" value={String(resolved)} />
          <MiniMetric label="Resolution rate" value={pctRatio(resolved, found)} />
          <MiniMetric label="Open lessons" value={String(openLessonsCount)} />
          <MiniMetric label="New lessons (7d)" value={String(newLessonsThisWeek)} />
        </div>
        <p className="text-xs font-semibold text-[#617269]">
          {resolvedLessonsCount > 0 ? `${resolvedLessonsCount} lesson${resolvedLessonsCount === 1 ? '' : 's'} resolved via root cause fixes. ` : ''}
          {(health?.regressions.length ?? 0) > 0 ? 'Regressions active — see Agent Health.' : resolved > 0 ? 'Loop is learning — root causes are being resolved.' : 'Stable — no regressions or resolved causes yet.'}
        </p>
      </Panel>

      {resolvedRootCauses.length > 0 ? (
        <Panel title={`Resolved Root Causes (${resolvedRootCauses.length})`}>
          <p className="text-xs font-semibold text-[#617269]">Resolved causes prove the loop is learning. Historical lessons are kept for traceability.</p>
          <div className="mt-2 grid gap-2">
            {resolvedRootCauses.map((rc) => <RootCauseCard key={rc.key} rootCause={rc} resolved />)}
          </div>
        </Panel>
      ) : null}

      <Panel title={`Active Root Causes (${activeRootCauses.length})`}>
        {activeRootCauses.length > 0 ? (
          <div className="grid gap-2">
            {activeRootCauses.map((rc) => <RootCauseCard key={rc.key} rootCause={rc} />)}
          </div>
        ) : (
          <EmptyState message="No active root causes." />
        )}
      </Panel>

      <Panel title={`Improvement Proposals (${proposals.length})`}>
        {proposals.length > 0 ? (
          <div className="grid gap-2">
            {proposals.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} />)}
          </div>
        ) : (
          <EmptyState message="No improvement proposals are open." />
        )}
      </Panel>

      <Panel title="Run History and Lessons">
        <RunHistoryTable history={history} onSelect={onSelectRun} />
      </Panel>
    </section>
  );
}

export function InfrastructureTab({
  data,
  loading,
  health,
  readiness,
  onRefresh,
}: {
  data: SandboxData | null;
  loading: boolean;
  health: HealthData | null;
  readiness: ReadinessData | null;
  onRefresh: () => void;
}) {
  const statusCards = [
    ['Active customers', data?.status.activeCustomers ?? 0],
    ['Active leads', data?.status.activeLeads ?? 0],
    ['Active jobs', data?.status.activeJobs ?? 0],
    ['Initiatives', data?.status.activeInitiatives ?? 0],
    ['Approvals', data?.status.activeApprovals ?? 0],
  ];
  const metricCards = [
    ['Leads generated', data?.metrics.leadsGenerated ?? 0],
    ['Quotes generated', data?.metrics.quotesGenerated ?? 0],
    ['Jobs completed', data?.metrics.jobsCompleted ?? 0],
    ['Reviews generated', data?.metrics.reviewsGenerated ?? 0],
    ['Initiatives created', data?.metrics.initiativesCreated ?? 0],
    ['Agent actions', data?.metrics.agentActionsCreated ?? 0],
  ];

  return (
    <section className="grid gap-5">
      <Panel title="Sandbox Environment" action={<SmallButton onClick={onRefresh}>Refresh</SmallButton>}>
        <p className="text-xs font-semibold text-[#617269]">Infrastructure and synthetic data generation are isolated here so the main operations view stays focused on agent decisions.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {statusCards.map(([label, value]) => <StatCard key={label as string} label={label as string} value={value as number} loading={loading} />)}
        </div>
      </Panel>

      <Panel title="Sandbox Metrics">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {metricCards.map(([label, value]) => (
            <div key={label as string} className="flex items-center justify-between rounded-[8px] bg-[#f4faf6] px-3 py-2">
              <span className="text-sm font-bold text-[#617269]">{label}</span>
              <span className="text-lg font-black text-[#17392b]">{loading ? '-' : value}</span>
            </div>
          ))}
        </div>
      </Panel>

      <CronCountdownCard lastCronRun={health?.lastCronRun ?? null} />

      <Panel title="Readiness Data">
        {readiness ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <MiniMetric label="Overall readiness" value={`${readiness.overallReadiness}%`} />
            <MiniMetric label="Ready scenarios" value={`${readiness.readyScenarios}/${readiness.totalScenarios}`} />
            {Object.entries(readiness.byCategory).map(([cat, row]) => (
              <MiniMetric key={cat} label={cat} value={`${row.ready}/${row.total}`} />
            ))}
          </div>
        ) : (
          <EmptyState message="No readiness data yet." />
        )}
      </Panel>

      <Panel title="Latest Batches">
        <BatchTable batches={health?.batches ?? []} />
      </Panel>

      <Panel title="Isolation Rules">
        <p className="text-sm font-semibold text-[#617269]">
          Sandbox rows are written with <code>environment=&quot;sandbox&quot;</code>. The arena interceptor captures all proposed actions without dispatching them to Resend, Stripe, or Twilio. Production dashboards default to production-only data.
        </p>
      </Panel>
    </section>
  );
}

function ContradictionExplainer({
  latestManualSummary,
  lastCronRun,
  activeRootCauses,
  failingScenarios,
  readyToPromote,
}: {
  latestManualSummary: string | null;
  lastCronRun: Batch | null;
  activeRootCauses: number;
  failingScenarios: number;
  readyToPromote: number;
}) {
  const latestPackValue = latestManualSummary
    ?? (lastCronRun?.status === 'complete'
      ? `${lastCronRun.pass_count}/${lastCronRun.scenario_count} passed${lastCronRun.avg_f1 !== null ? ` — avg F1 ${lastCronRun.avg_f1.toFixed(2)}` : ''} (last cron)`
      : 'No completed runs yet — use Run tab');

  const sessionValue = latestManualSummary ?? 'No manual run in this browser session';

  const fleetHealthValue = activeRootCauses === 0
    ? 'Clean — no active root causes'
    : `${activeRootCauses} active root cause${activeRootCauses === 1 ? '' : 's'} — see Learning tab`;

  const promotionValue = readyToPromote === 0
    ? 'No agents promotable yet — requires passing status, stability, and no active blockers'
    : `${readyToPromote} agent${readyToPromote === 1 ? '' : 's'} ready — based on latest passing status, stability, and no active blockers`;

  return (
    <Panel title="What These Numbers Mean">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryLine label="Latest completed pack" value={latestPackValue} />
        <SummaryLine label="This session" value={sessionValue} />
        <SummaryLine label="Fleet health" value={fleetHealthValue} />
        <SummaryLine label="Promotion readiness" value={promotionValue} />
      </div>
      {failingScenarios > 0 ? (
        <p className="text-xs font-semibold text-amber-700">
          {failingScenarios} scenario{failingScenarios === 1 ? '' : 's'} failing latest score — see Run tab for details.
        </p>
      ) : null}
    </Panel>
  );
}

function ScenarioCard({ scenario, busy, disabled, onRun }: { scenario: SandboxScenarioTemplate; busy: boolean; disabled: boolean; onRun: (slug: string) => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-[8px] border border-[#dfe9e2] bg-white px-4 py-3 shadow-[0_12px_32px_rgba(15,61,46,0.05)]">
      <div className="flex flex-wrap gap-1">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${CATEGORY_COLOURS[scenario.category]}`}>{scenario.category}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${DIFFICULTY_COLOURS[scenario.difficulty]}`}>{scenario.difficulty}</span>
      </div>
      <div className="min-h-[78px]">
        <p className="text-sm font-black text-[#17392b]">{scenario.title}</p>
        <p className="mt-0.5 text-xs font-semibold text-[#7f9187]">{scenario.description}</p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-[#617269]">Agent: <span className="text-[#17392b]">{scenario.agentId}</span></span>
        <button type="button" disabled={disabled} onClick={() => onRun(scenario.slug)} className="rounded-[6px] bg-[#1C7C54] px-3 py-1.5 text-xs font-black text-white transition hover:bg-[#17392b] disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? 'Running...' : 'Run'}
        </button>
      </div>
    </div>
  );
}

function PackResultsTable({ rows, onSelect }: { rows: PackResult[]; onSelect: (row: PackResult) => void }) {
  const passCount = rows.filter((row) => isPass(row.result)).length;
  const avgF1 = rows.reduce((sum, row) => sum + row.result.score.f1Score, 0) / rows.length;

  return (
    <Panel title="Latest Manual Pack Result">
      <p className="text-sm font-semibold text-[#617269]">{passCount}/{rows.length} passed - Avg F1 {avgF1.toFixed(2)}. This is a run result, not the fleet health state.</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#dfe9e2]">
              <th className="pb-2 text-left text-xs font-black uppercase tracking-wider text-[#7f9187]">Scenario</th>
              <th className="pb-2 text-left text-xs font-black uppercase tracking-wider text-[#7f9187]">Agent</th>
              <th className="pb-2 text-right text-xs font-black uppercase tracking-wider text-[#7f9187]">Precision</th>
              <th className="pb-2 text-right text-xs font-black uppercase tracking-wider text-[#7f9187]">Recall</th>
              <th className="pb-2 text-right text-xs font-black uppercase tracking-wider text-[#7f9187]">F1</th>
              <th className="pb-2 text-left text-xs font-black uppercase tracking-wider text-[#7f9187]">Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.result.trainingRunId} className="border-b border-[#f4faf6]">
                <td className="py-2 pr-4">
                  <button type="button" onClick={() => onSelect(row)} className="text-left font-black text-[#17392b] hover:text-[#1C7C54]">{row.scenarioTitle}</button>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#7f9187]">{row.category}</p>
                </td>
                <td className="py-2 pr-4 font-bold text-[#617269]">{row.agentId}</td>
                <td className="py-2 text-right font-bold text-[#617269]">{pct(row.result.score.precisionScore)}</td>
                <td className="py-2 text-right font-bold text-[#617269]">{pct(row.result.score.recallScore)}</td>
                <td className="py-2 text-right"><F1Badge f1={row.result.score.f1Score} /></td>
                <td className="py-2"><PassFailChip passed={isPass(row.result)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function RunHistoryTable({ history, onSelect }: { history: HistoryRow[] | null; onSelect: (row: HistoryRow) => void }) {
  if (!history) return <p className="text-sm font-semibold text-[#7f9187]">Loading...</p>;
  if (history.length === 0) return <EmptyState message="No run history yet. Run a scenario or pack to create history." />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#dfe9e2]">
            <th className="pb-2 text-left text-xs font-black uppercase tracking-wider text-[#7f9187]">Scenario</th>
            <th className="pb-2 text-left text-xs font-black uppercase tracking-wider text-[#7f9187]">Agent</th>
            <th className="pb-2 text-left text-xs font-black uppercase tracking-wider text-[#7f9187]">Status</th>
            <th className="pb-2 text-right text-xs font-black uppercase tracking-wider text-[#7f9187]">F1</th>
            <th className="pb-2 text-right text-xs font-black uppercase tracking-wider text-[#7f9187]">Lessons</th>
            <th className="pb-2 text-left text-xs font-black uppercase tracking-wider text-[#7f9187]">Started</th>
          </tr>
        </thead>
        <tbody>
          {history.map((row) => (
            <tr key={row.id} className="border-b border-[#f4faf6]">
              <td className="py-2 pr-4">
                <button type="button" onClick={() => onSelect(row)} className="text-left font-black text-[#17392b] hover:text-[#1C7C54]">{row.scenario.title}</button>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#7f9187]">{row.batchId ? `Batch ${row.batchId.slice(0, 8)}` : row.trigger}</p>
              </td>
              <td className="py-2 pr-4 font-bold text-[#617269]">{row.scenario.agentId}</td>
              <td className="py-2"><PassFailChip passed={row.score ? row.score.f1Score >= 0.5 : row.status === 'complete'} /></td>
              <td className="py-2 text-right">{row.score ? <F1Badge f1={row.score.f1Score} /> : <span className="text-xs font-bold text-[#7f9187]">Not scored</span>}</td>
              <td className="py-2 text-right font-bold text-[#617269]">{row.lessonCount}</td>
              <td className="py-2 text-xs font-bold text-[#7f9187]">{new Date(row.startedAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RequiredActionCard({ action, onOpen }: { action: { title: string; what: string; why: string; next: string }; onOpen: () => void }) {
  return (
    <div className="rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-black text-[#17392b]">{action.title}</p>
          <p className="mt-1 text-xs font-semibold text-[#617269]"><span className="font-black">What happened:</span> {action.what}</p>
          <p className="text-xs font-semibold text-[#617269]"><span className="font-black">Why it matters:</span> {action.why}</p>
          <p className="text-xs font-semibold text-[#617269]"><span className="font-black">Do next:</span> {action.next}</p>
        </div>
        <SmallButton onClick={onOpen}>Details</SmallButton>
      </div>
    </div>
  );
}

export function RootCauseCard({ rootCause, resolved = false }: { rootCause: RootCause; resolved?: boolean }) {
  return (
    <div className={`rounded-[8px] border px-4 py-3 ${resolved ? 'border-[#dfe9e2] bg-[#f8fdf9]' : 'border-[#f3c7c3] bg-[#fff8f7]'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-black text-[#17392b]">{rootCause.title}</p>
          <p className="mt-1 text-xs font-semibold text-[#617269]">{rootCause.rootCauseSummary}</p>
        </div>
        <SeverityBadge severity={resolved ? 'resolved' : rootCause.severity} />
      </div>
      <p className="mt-2 text-xs font-bold text-[#7f9187]">{rootCause.agentId} - {rootCause.lessonCount} lessons - latest {new Date(rootCause.latestAt).toLocaleString()}</p>
      {!resolved ? <p className="mt-2 text-xs font-semibold text-[#1C7C54]">{rootCause.recommendedFix}</p> : null}
    </div>
  );
}

function CompactRootCause({ rootCause }: { rootCause: RootCause }) {
  return (
    <div className="rounded-[8px] bg-[#fff8f7] px-3 py-2">
      <p className="text-xs font-black text-[#17392b]">{rootCause.title}</p>
      <p className="text-[11px] font-semibold text-[#617269]">{rootCause.agentId} - {rootCause.lessonCount} lessons</p>
    </div>
  );
}

export function ProposalCard({ proposal }: { proposal: ImprovementProposal }) {
  return (
    <div className="rounded-[8px] border border-[#dfe0f5] bg-[#f9f9fe] px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-black text-[#17392b]">{proposal.title}</p>
          <p className="mt-1 text-xs font-semibold text-[#617269]">{proposal.likelyRootCause}</p>
        </div>
        <SeverityBadge severity={proposal.severity} />
      </div>
      <p className="mt-2 text-xs font-semibold text-[#1C7C54]">{proposal.suggestedFix}</p>
      <p className="mt-1 text-[10px] font-bold text-[#7f9187]">{proposal.affectedAgent} - {proposal.confidence}% confidence - expected {proposal.expectedF1Impact}</p>
    </div>
  );
}

function BatchTable({ batches }: { batches: Batch[] }) {
  if (batches.length === 0) return <EmptyState message="No batches yet." />;
  return (
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
          {batches.map((batch) => (
            <tr key={batch.id} className="border-t border-[#eef2f0]">
              <td className="py-2 pr-4 font-semibold text-[#617269]">{new Date(batch.started_at).toLocaleString()}</td>
              <td className="py-2 pr-4 font-black text-[#17392b]">{batch.agent_id}</td>
              <td className="py-2 pr-4 font-semibold text-[#617269]">{batch.trigger}</td>
              <td className="py-2 pr-4 font-semibold text-[#617269]">{batch.pass_count}/{batch.scenario_count}</td>
              <td className="py-2 pr-4 font-semibold text-[#617269]">{fmtF1(batch.avg_f1)}</td>
              <td className="py-2 pr-4 font-semibold text-[#617269]">{batch.total_cost_cents} cents</td>
              <td className="py-2"><StatusPill status={batch.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Bud Agent Doctor ──────────────────────────────────────────────────────

function IntegrityChip({ status }: { status: AgentIntegrityStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${integrityStatusColour(status)}`}>
      {integrityStatusLabel(status)}
    </span>
  );
}

function RequirementChip({ status }: { status: RequirementStatus }) {
  const colour = requirementStatusColour(status);
  const label = status === 'present' ? '✓' : status === 'partial' ? '~' : '✗';
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${colour}`}>{label}</span>
  );
}

function IntegrityScoreBar({ score }: { score: number }) {
  const colour =
    score >= 80 ? 'bg-[#1C7C54]' : score >= 50 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#dfe9e2]">
        <div className={`h-full rounded-full transition-all ${colour}`} style={{ width: `${score}%` }} />
      </div>
      <span className="w-8 text-right text-[10px] font-black text-[#617269]">{score}</span>
    </div>
  );
}

function RequirementList({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; status: RequirementStatus; notes?: string }>;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-[#7f9187]">{title}</p>
      <div className="grid gap-1">
        {items.map((item, index) => (
          <div key={`${item.label}-${index}`} className="flex items-start gap-2">
            <RequirementChip status={item.status} />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#17392b]">{item.label}</p>
              {item.notes ? <p className="text-[10px] text-[#617269]">{item.notes}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentIntegrityCard({
  report,
  expanded,
  onToggle,
}: {
  report: AgentIntegrityReport;
  expanded: boolean;
  onToggle: () => void;
}) {
  function copyFixPrompt() {
    void navigator.clipboard.writeText(report.generateFixPrompt);
  }

  return (
    <div className="rounded-[8px] border border-[#dfe9e2] bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-[#f4faf6]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black text-[#17392b]">{report.agentName}</p>
            <span className="rounded-full bg-[#f4faf6] px-2 py-0.5 text-[10px] font-semibold text-[#617269]">
              {report.category}
            </span>
            <IntegrityChip status={report.integrityStatus} />
            {report.scenarioCount > 0 ? (
              <span className="text-[10px] font-semibold text-[#617269]">
                {report.scenarioCount} scenario{report.scenarioCount !== 1 ? 's' : ''}
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-red-600">no scenarios</span>
            )}
          </div>
          <div className="mt-1.5">
            <IntegrityScoreBar score={report.integrityScore} />
          </div>
        </div>
        <span className="mt-1 text-xs text-[#7f9187]">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded ? (
        <div className="grid gap-4 border-t border-[#dfe9e2] px-4 py-4">
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-[#7f9187]">Intended Capability</p>
            <p className="text-xs font-semibold text-[#17392b]">{report.intendedCapability}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <RequirementList title="Data Sources" items={report.dataSources} />
            <RequirementList title="Integrations" items={report.integrations} />
            <RequirementList title="Sandbox Fixtures" items={report.sandboxFixtures} />
            <RequirementList title="Scenario Coverage" items={report.scenarioCoverage} />
          </div>

          {report.missingConnections.length > 0 ? (
            <div className="rounded-[6px] bg-red-50 px-3 py-2">
              <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-red-700">Missing Connections</p>
              <div className="flex flex-wrap gap-1">
                {report.missingConnections.map((c) => (
                  <span key={c} className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800">{c}</span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[6px] bg-[#f4faf6] px-3 py-2">
              <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-[#7f9187]">Recommendation</p>
              <p className="text-xs font-semibold text-[#17392b]">{report.recommendation}</p>
            </div>
            <div className="rounded-[6px] bg-amber-50 px-3 py-2">
              <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-amber-700">Risk if Promoted</p>
              <p className="text-xs font-semibold text-amber-900">{report.riskIfPromoted}</p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={copyFixPrompt}
              className="rounded-[6px] border border-[#1C7C54] px-3 py-1.5 text-xs font-black text-[#1C7C54] transition hover:bg-[#e5f4ec]"
            >
              Generate Fix Prompt
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function IntegrityFleetSummary({ reports }: { reports: AgentIntegrityReport[] }) {
  const counts: Record<AgentIntegrityStatus, number> = {
    ready_to_promote:    reports.filter((r) => r.integrityStatus === 'ready_to_promote').length,
    ready_to_test:       reports.filter((r) => r.integrityStatus === 'ready_to_test').length,
    missing_data:        reports.filter((r) => r.integrityStatus === 'missing_data').length,
    missing_integration: reports.filter((r) => r.integrityStatus === 'missing_integration').length,
    unsafe_to_promote:   reports.filter((r) => r.integrityStatus === 'unsafe_to_promote').length,
  };

  const statuses: AgentIntegrityStatus[] = [
    'ready_to_promote',
    'ready_to_test',
    'missing_data',
    'missing_integration',
    'unsafe_to_promote',
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {statuses.map((status) => (
        <div key={status} className={`rounded-[8px] px-3 py-3 ${integrityStatusColour(status)}`}>
          <p className="text-2xl font-black">{counts[status]}</p>
          <p className="text-[10px] font-black uppercase tracking-wider opacity-75">
            {integrityStatusLabel(status)}
          </p>
        </div>
      ))}
    </div>
  );
}

export function DoctorTab({ reports }: { reports: AgentIntegrityReport[] }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AgentIntegrityStatus | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = reports;
    if (statusFilter !== 'all') result = result.filter((r) => r.integrityStatus === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.agentName.toLowerCase().includes(q) ||
          r.agentId.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q),
      );
    }
    return result;
  }, [reports, statusFilter, search]);

  const sorted = useMemo(() => {
    const order: AgentIntegrityStatus[] = [
      'unsafe_to_promote',
      'missing_integration',
      'missing_data',
      'ready_to_test',
      'ready_to_promote',
    ];
    return [...filtered].sort(
      (a, b) => order.indexOf(a.integrityStatus) - order.indexOf(b.integrityStatus),
    );
  }, [filtered]);

  return (
    <section className="grid gap-5">
      <Panel title="Agent Integrity Overview">
        <p className="text-xs font-semibold text-[#617269]">
          Derived from static integrity specs and live scenario coverage. All sandbox runs use mock
          connectors — no real emails, calendar events, Stripe writes, or external API calls are
          dispatched.
        </p>
        <IntegrityFleetSummary reports={reports} />
      </Panel>

      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search agents..."
          className="min-w-[180px] flex-1 rounded-[6px] border border-[#dfe9e2] bg-white px-3 py-2 text-sm font-bold text-[#17392b] outline-none focus:border-[#1C7C54]"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AgentIntegrityStatus | 'all')}
          className="rounded-[6px] border border-[#dfe9e2] bg-white px-3 py-2 text-sm font-bold text-[#617269] outline-none focus:border-[#1C7C54]"
        >
          <option value="all">All statuses</option>
          <option value="unsafe_to_promote">Unsafe to Promote</option>
          <option value="missing_integration">Missing Integration</option>
          <option value="missing_data">Missing Data</option>
          <option value="ready_to_test">Ready to Test</option>
          <option value="ready_to_promote">Ready to Promote</option>
        </select>
      </div>

      <Panel title={`Agent Integrity Requirements (${sorted.length})`}>
        {sorted.length === 0 ? (
          <EmptyState message="No agents match the current filter." />
        ) : (
          <div className="grid gap-2">
            {sorted.map((report) => (
              <AgentIntegrityCard
                key={report.agentId}
                report={report}
                expanded={expandedId === report.agentId}
                onToggle={() =>
                  setExpandedId(expandedId === report.agentId ? null : report.agentId)
                }
              />
            ))}
          </div>
        )}
      </Panel>
    </section>
  );
}
