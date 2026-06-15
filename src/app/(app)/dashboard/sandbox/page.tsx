'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { SANDBOX_SCENARIOS } from '@/lib/sandbox/scenarios';
import type { ScenarioCategory, ScenarioDifficulty, SandboxScenarioTemplate } from '@/lib/sandbox/scenarios';
import { SANDBOX_CRONS, formatCountdown, nextCronRun } from '@/lib/sandbox/cron-schedule';
import CronCountdownCard from './_components/CronCountdownCard';

type SandboxData = {
  mode: 'sandbox';
  status: {
    activeCustomers: number;
    activeLeads: number;
    activeJobs: number;
    activeInitiatives: number;
    activeApprovals: number;
  };
  metrics: {
    leadsGenerated: number;
    quotesGenerated: number;
    jobsCompleted: number;
    reviewsGenerated: number;
    initiativesCreated: number;
    agentActionsCreated: number;
  };
};

type OperationsTab = 'overview' | 'run' | 'agents' | 'learning' | 'infrastructure';

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

type Lesson = {
  id: string;
  agentId: string;
  title: string;
  observation: string;
  recommendation: string | null;
  severity: string;
  source: string;
  createdAt: string;
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

type ReadinessData = {
  overallReadiness: number;
  byCategory: Record<string, { ready: number; total: number }>;
  totalScenarios: number;
  readyScenarios: number;
};

type RunResult = {
  trainingRunId: string;
  agentRunId?: string | null;
  status: 'complete' | 'completed' | 'failed';
  summary: string;
  proposedActions: Array<{ action_type: string; preview?: string }>;
  llmCalls: number;
  inputTokens?: number;
  outputTokens?: number;
  costCents: number;
  durationMs: number;
  score: { precisionScore: number; recallScore: number; f1Score: number; hit: boolean };
};

type PackResult = {
  scenarioSlug: string;
  scenarioTitle: string;
  category: ScenarioCategory;
  agentId: string;
  expectedActionTypes: string[];
  result: RunResult;
};

type HistoryRow = {
  id: string;
  batchId: string | null;
  trigger: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number;
  costCents: number;
  scenario: {
    id: string;
    slug: string | null;
    title: string;
    category: string;
    agentId: string;
    expectedActionTypes: string[];
  };
  response: {
    summary: string;
    proposedActions: Array<{ action_type?: string; preview?: string }>;
    llmCalls: number;
  } | null;
  score: {
    precisionScore: number;
    recallScore: number;
    f1Score: number;
    hit: boolean;
    scoredAt: string;
  } | null;
  lessonCount: number;
};

type RunStatus = {
  kind: 'scenario' | 'pack';
  label: string;
  status: 'running' | 'complete' | 'failed';
  startedAt: number;
  currentIndex: number;
  total: number;
  currentScenario?: string;
  message: string;
};

type AgentRow = {
  agentId: string;
  f1: number | null;
  baselineF1: number | null;
  passRate: number | null;
  rootCauseCount: number;
  lessonCount: number;
  status: OperatorPromotionStatus;
  recommendation: string;
  trend: 'improving' | 'stable' | 'degrading';
  blockers: string[];
};

type OperatorPromotionStatus = 'Promote' | 'Monitor' | 'Investigate' | 'Blocked';
type FleetBucket = 'promote' | 'investigate' | 'blocked' | 'monitor';

const CATEGORY_COLOURS: Record<ScenarioCategory, string> = {
  customer: 'bg-blue-100 text-blue-800',
  participant: 'bg-purple-100 text-purple-800',
  marketplace: 'bg-amber-100 text-amber-800',
  ndis: 'bg-teal-100 text-teal-800',
  ops: 'bg-orange-100 text-orange-800',
  growth: 'bg-emerald-100 text-emerald-800',
  finance: 'bg-rose-100 text-rose-800',
};

const DIFFICULTY_COLOURS: Record<ScenarioDifficulty, string> = {
  easy: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  hard: 'bg-red-100 text-red-800',
};

export default function SandboxPage() {
  const [data, setData] = useState<SandboxData | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [readiness, setReadiness] = useState<ReadinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<OperationsTab>('overview');
  const [agentFilter, setAgentFilter] = useState<FleetBucket | 'all'>('all');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<PackResult | null>(null);
  const [lastResult, setLastResult] = useState<RunResult | null>(null);
  const [lastScenario, setLastScenario] = useState<SandboxScenarioTemplate | null>(null);
  const [packResults, setPackResults] = useState<PackResult[]>([]);
  const [runStatus, setRunStatus] = useState<RunStatus | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [busyPack, setBusyPack] = useState<ScenarioCategory | 'stress' | 'all' | null>(null);
  const [scenarioSearch, setScenarioSearch] = useState('');
  const [scenarioCategory, setScenarioCategory] = useState<ScenarioCategory | 'all'>('all');
  const [scenarioDifficulty, setScenarioDifficulty] = useState<ScenarioDifficulty | 'all'>('all');
  const [scenarioSort, setScenarioSort] = useState<'title' | 'agent' | 'category' | 'difficulty'>('category');

  const loadSandbox = useCallback(async () => {
    const response = await fetch('/api/sandbox', { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Failed to load sandbox');
    setData(payload);
  }, []);

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const response = await fetch('/api/sandbox/health', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to load sandbox health');
      setHealth(payload);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    const response = await fetch('/api/sandbox/run-history?limit=80', { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Failed to load run history');
    setHistory(payload.history ?? []);
  }, []);

  const loadLessons = useCallback(async () => {
    const response = await fetch('/api/sandbox/lessons?limit=80', { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Failed to load lessons');
    setLessons(payload.lessons ?? []);
  }, []);

  const loadReadiness = useCallback(async () => {
    const response = await fetch('/api/sandbox/readiness', { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Failed to load readiness');
    setReadiness(payload);
  }, []);

  const reloadOperationalData = useCallback(async () => {
    return Promise.allSettled([loadSandbox(), loadHealth(), loadHistory(), loadLessons(), loadReadiness()]);
  }, [loadSandbox, loadHealth, loadHistory, loadLessons, loadReadiness]);

  useEffect(() => {
    reloadOperationalData()
      .then((results) => {
        const rejected = results.find((result) => result.status === 'rejected');
        if (rejected?.status === 'rejected') throw rejected.reason;
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [reloadOperationalData]);

  const activeRootCauses = health?.activeRootCauses ?? health?.rootCauses ?? [];
  const resolvedRootCauses = health?.resolvedRootCauses ?? [];
  const proposals = health?.proposals ?? [];
  const recommendations = health?.recommendations ?? [];
  const isBusy = busySlug !== null || busyPack !== null;

  const agents = useMemo(
    () => buildAgentRows(health, lessons ?? [], SANDBOX_SCENARIOS),
    [health, lessons],
  );

  const visibleAgents = useMemo(() => {
    if (agentFilter === 'all') return agents;
    return agents.filter((agent) => bucketForAgent(agent) === agentFilter);
  }, [agentFilter, agents]);

  const fleetBuckets = useMemo(() => {
    return {
      promote: agents.filter((agent) => agent.status === 'Promote'),
      investigate: agents.filter((agent) => agent.status === 'Investigate'),
      blocked: agents.filter((agent) => agent.status === 'Blocked'),
      monitor: agents.filter((agent) => agent.status === 'Monitor'),
    };
  }, [agents]);

  const latestManualSummary = useMemo(() => {
    if (packResults.length > 0) {
      const passed = packResults.filter((row) => isPass(row.result)).length;
      const avgF1 = packResults.reduce((sum, row) => sum + row.result.score.f1Score, 0) / packResults.length;
      return `${passed}/${packResults.length} passed - avg F1 ${avgF1.toFixed(2)}`;
    }
    if (lastResult && lastScenario) {
      return `${isPass(lastResult) ? 'Pass' : 'Fail'} - ${lastScenario.title} - F1 ${lastResult.score.f1Score.toFixed(2)}`;
    }
    return 'No manual pack in this session';
  }, [lastResult, lastScenario, packResults]);

  const fleetHealth = useMemo(() => {
    if (agents.some((agent) => agent.status === 'Blocked')) return 'Blocked';
    if (activeRootCauses.length > 0 || (health?.regressions.length ?? 0) > 0 || agents.some((agent) => agent.status === 'Investigate')) {
      return 'Investigate';
    }
    return 'Healthy';
  }, [activeRootCauses.length, agents, health?.regressions.length]);

  const passingAgents = agents.filter((agent) => agent.passRate !== null && agent.passRate >= 0.5).length;
  const passingScenarios = readiness?.readyScenarios ?? (history ?? []).filter((row) => row.score && row.score.f1Score >= 0.5).length;
  const readyToPromote = fleetBuckets.promote.length;

  const filteredScenarios = useMemo(() => {
    const query = scenarioSearch.trim().toLowerCase();
    const rows = SANDBOX_SCENARIOS.filter((scenario) => {
      const matchesQuery =
        !query ||
        scenario.title.toLowerCase().includes(query) ||
        scenario.description.toLowerCase().includes(query) ||
        scenario.agentId.toLowerCase().includes(query) ||
        scenario.tags.some((tag) => tag.toLowerCase().includes(query));
      const matchesCategory = scenarioCategory === 'all' || scenario.category === scenarioCategory;
      const matchesDifficulty = scenarioDifficulty === 'all' || scenario.difficulty === scenarioDifficulty;
      return matchesQuery && matchesCategory && matchesDifficulty;
    });
    return [...rows].sort((a, b) => {
      if (scenarioSort === 'agent') return a.agentId.localeCompare(b.agentId) || a.title.localeCompare(b.title);
      if (scenarioSort === 'title') return a.title.localeCompare(b.title);
      if (scenarioSort === 'difficulty') return difficultyRank(a.difficulty) - difficultyRank(b.difficulty) || a.title.localeCompare(b.title);
      return a.category.localeCompare(b.category) || a.title.localeCompare(b.title);
    });
  }, [scenarioCategory, scenarioDifficulty, scenarioSearch, scenarioSort]);

  async function executeScenario(slug: string): Promise<RunResult> {
    const response = await fetch('/api/sandbox/run-scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Scenario run failed');
    return payload as RunResult;
  }

  function toPackResult(scenario: SandboxScenarioTemplate, result: RunResult): PackResult {
    return {
      scenarioSlug: scenario.slug,
      scenarioTitle: scenario.title,
      category: scenario.category,
      agentId: scenario.agentId,
      expectedActionTypes: scenario.expectedActionTypes,
      result,
    };
  }

  async function runScenario(slug: string) {
    const scenario = SANDBOX_SCENARIOS.find((s) => s.slug === slug);
    setBusySlug(slug);
    setError(null);
    setNotice(null);
    setLastResult(null);
    setLastScenario(scenario ?? null);
    setRunStatus({
      kind: 'scenario',
      label: scenario?.title ?? slug,
      status: 'running',
      startedAt: Date.now(),
      currentIndex: 1,
      total: 1,
      currentScenario: scenario?.title ?? slug,
      message: 'Running one scenario through the sandbox interceptor.',
    });
    toast.info('Scenario started', { description: scenario?.title ?? slug });
    try {
      const result = await executeScenario(slug);
      setLastResult(result);
      if (scenario) {
        const row = toPackResult(scenario, result);
        setPackResults([row]);
        setSelectedResult(row);
      }
      setRunStatus((current) => current ? {
        ...current,
        status: result.status === 'failed' ? 'failed' : 'complete',
        message: `Scenario ${result.status === 'failed' ? 'failed' : 'completed'} with F1 ${result.score.f1Score.toFixed(2)}.`,
      } : current);
      setNotice(`Latest manual scenario: ${scenario?.title ?? slug} - F1 ${result.score.f1Score.toFixed(2)}`);
      toast[result.status === 'failed' ? 'error' : 'success'](
        result.status === 'failed' ? 'Scenario failed' : 'Scenario completed',
        { description: scenario?.title ?? slug },
      );
      await reloadOperationalData();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setRunStatus((current) => current ? { ...current, status: 'failed', message } : current);
      setError(message);
      toast.error('Scenario failed', { description: message });
    } finally {
      setBusySlug(null);
    }
  }

  async function runPack(pack: ScenarioCategory | 'stress' | 'all') {
    const scenarios =
      pack === 'all'
        ? SANDBOX_SCENARIOS
        : pack === 'stress'
          ? SANDBOX_SCENARIOS.filter((scenario) => scenario.slug === 'stress-agent-cascade')
          : SANDBOX_SCENARIOS.filter((scenario) => scenario.category === pack);

    if (scenarios.length === 0) {
      setError('No matching scenarios found for this pack.');
      return;
    }

    setBusyPack(pack);
    setError(null);
    setNotice(null);
    setLastResult(null);
    setLastScenario(null);
    setSelectedResult(null);
    setPackResults([]);
    setRunStatus({
      kind: 'pack',
      label: pack === 'all' ? 'Full Scenario Pack' : pack === 'stress' ? 'Stress Test' : `${pack} pack`,
      status: 'running',
      startedAt: Date.now(),
      currentIndex: 0,
      total: scenarios.length,
      currentScenario: scenarios[0]?.title,
      message: `Pack started. 0 of ${scenarios.length} scenarios complete.`,
    });
    toast.info('Pack started', { description: `${scenarios.length} scenarios queued.` });

    const completed: PackResult[] = [];
    try {
      for (let index = 0; index < scenarios.length; index += 1) {
        const scenario = scenarios[index];
        setRunStatus((current) => current ? {
          ...current,
          currentIndex: index,
          currentScenario: scenario.title,
          message: `Running ${index + 1} of ${scenarios.length}: ${scenario.title}`,
        } : current);
        const result = await executeScenario(scenario.slug);
        const row = toPackResult(scenario, result);
        completed.push(row);
        setPackResults([...completed]);
        setLastResult(result);
        setLastScenario(scenario);
        setSelectedResult(row);
        setRunStatus((current) => current ? {
          ...current,
          currentIndex: index + 1,
          currentScenario: scenario.title,
          message: `Completed ${index + 1} of ${scenarios.length}. Latest F1 ${result.score.f1Score.toFixed(2)}.`,
        } : current);
      }
      const passCount = completed.filter((row) => isPass(row.result)).length;
      const avgF1 = completed.reduce((sum, row) => sum + row.result.score.f1Score, 0) / completed.length;
      setRunStatus((current) => current ? {
        ...current,
        status: 'complete',
        currentIndex: completed.length,
        message: `Latest manual pack result: ${passCount}/${completed.length} passed with avg F1 ${avgF1.toFixed(2)}.`,
      } : current);
      setNotice(`Latest manual pack result: ${passCount}/${completed.length} passed. Fleet health is calculated separately from unresolved root causes.`);
      toast.success('Pack completed', { description: `${passCount}/${completed.length} passed - Avg F1 ${avgF1.toFixed(2)}` });
      await reloadOperationalData();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setRunStatus((current) => current ? { ...current, status: 'failed', message } : current);
      setError(message);
      toast.error('Pack failed', { description: message });
    } finally {
      setBusyPack(null);
    }
  }

  return (
    <div className="grid gap-5 px-1 pb-8 sm:px-2">
      <header className="grid gap-1">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#617269]">Sandbox</p>
        <h1 className="text-2xl font-black text-[#17392b]">Agent Operations Centre</h1>
        <p className="max-w-4xl text-sm font-semibold text-[#617269]">
          One operating view for sandbox execution, agent health, learning, promotion readiness, and isolated test data.
        </p>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <ExecutiveCommandStrip
        fleetHealth={fleetHealth}
        passingAgents={passingAgents}
        totalAgents={agents.length}
        passingScenarios={passingScenarios}
        totalScenarios={readiness?.totalScenarios ?? SANDBOX_SCENARIOS.length}
        activeRootCauses={activeRootCauses.length}
        readyToPromote={readyToPromote}
        lastCronRun={health?.lastCronRun ?? null}
        loading={loading || healthLoading}
        busy={isBusy}
        onRunFullPack={() => {
          setActiveTab('run');
          void runPack('all');
        }}
        onRunScenario={() => setActiveTab('run')}
      />

      {runStatus ? <RunStatusPanel status={runStatus} /> : null}

      <div className="flex gap-1 overflow-x-auto border-b border-[#dfe9e2]">
        {(['overview', 'run', 'agents', 'learning', 'infrastructure'] as OperationsTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={
              activeTab === tab
                ? 'whitespace-nowrap rounded-t-[6px] border-b-2 border-[#1C7C54] px-4 py-2 text-sm font-black text-[#17392b]'
                : 'whitespace-nowrap px-4 py-2 text-sm font-bold text-[#7f9187] transition hover:text-[#17392b]'
            }
          >
            {titleCase(tab)}
          </button>
        ))}
      </div>

      {activeTab === 'overview' ? (
        <OverviewTab
          health={health}
          agents={agents}
          buckets={fleetBuckets}
          activeRootCauses={activeRootCauses}
          resolvedRootCauses={resolvedRootCauses}
          proposals={proposals}
          recommendations={recommendations}
          latestManualSummary={latestManualSummary}
          onFilterAgents={(bucket) => {
            setAgentFilter(bucket);
            setActiveTab('agents');
          }}
          onOpenDetails={(target) => {
            if (target === 'learning') setActiveTab('learning');
            if (target === 'agents') setActiveTab('agents');
            if (target === 'run') setActiveTab('run');
          }}
        />
      ) : null}

      {activeTab === 'run' ? (
        <RunTab
          scenarios={filteredScenarios}
          search={scenarioSearch}
          category={scenarioCategory}
          difficulty={scenarioDifficulty}
          sort={scenarioSort}
          busySlug={busySlug}
          busyPack={busyPack}
          disabled={isBusy}
          packResults={packResults}
          lastResult={lastResult}
          lastScenario={lastScenario}
          onSearch={setScenarioSearch}
          onCategory={setScenarioCategory}
          onDifficulty={setScenarioDifficulty}
          onSort={setScenarioSort}
          onRunScenario={runScenario}
          onRunPack={runPack}
          onSelectResult={setSelectedResult}
        />
      ) : null}

      {activeTab === 'agents' ? (
        <AgentsTab
          agents={visibleAgents}
          allAgents={agents}
          filter={agentFilter}
          onFilter={setAgentFilter}
          onSelectAgent={setSelectedAgent}
        />
      ) : null}

      {activeTab === 'learning' ? (
        <LearningTab
          health={health}
          history={history}
          lessons={lessons}
          activeRootCauses={activeRootCauses}
          resolvedRootCauses={resolvedRootCauses}
          proposals={proposals}
          onSelectRun={(row) => setSelectedResult(historyRowToPackResult(row))}
          onRefresh={() => void reloadOperationalData()}
        />
      ) : null}

      {activeTab === 'infrastructure' ? (
        <InfrastructureTab
          data={data}
          loading={loading}
          health={health}
          readiness={readiness}
          onRefresh={() => void reloadOperationalData()}
        />
      ) : null}

      {selectedAgent ? (
        <AgentDetailDrawer
          agentId={selectedAgent}
          health={health}
          history={history ?? []}
          lessons={lessons ?? []}
          scenarios={SANDBOX_SCENARIOS}
          onClose={() => setSelectedAgent(null)}
          onSelectRun={(row) => setSelectedResult(historyRowToPackResult(row))}
        />
      ) : null}

      {selectedResult ? (
        <ScenarioResultDrawer result={selectedResult} onClose={() => setSelectedResult(null)} />
      ) : null}
    </div>
  );
}

function ExecutiveCommandStrip({
  fleetHealth,
  passingAgents,
  totalAgents,
  passingScenarios,
  totalScenarios,
  activeRootCauses,
  readyToPromote,
  lastCronRun,
  loading,
  busy,
  onRunFullPack,
  onRunScenario,
}: {
  fleetHealth: 'Healthy' | 'Investigate' | 'Blocked';
  passingAgents: number;
  totalAgents: number;
  passingScenarios: number;
  totalScenarios: number;
  activeRootCauses: number;
  readyToPromote: number;
  lastCronRun: Batch | null;
  loading: boolean;
  busy: boolean;
  onRunFullPack: () => void;
  onRunScenario: () => void;
}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const nextRows = now
    ? SANDBOX_CRONS.map((cron) => ({ ...cron, next: nextCronRun(cron.schedule, now) })).sort((a, b) => a.next.getTime() - b.next.getTime())
    : [];
  const nextCron = nextRows[0];
  const statusStyles =
    fleetHealth === 'Healthy'
      ? 'border-[#b5d6c5] bg-[#e5f4ec] text-[#1C7C54]'
      : fleetHealth === 'Investigate'
        ? 'border-amber-300 bg-amber-50 text-amber-800'
        : 'border-red-200 bg-red-50 text-red-700';

  return (
    <section className="sticky top-0 z-20 rounded-[8px] border border-[#dfe9e2] bg-white/95 px-4 py-4 shadow-[0_18px_48px_rgba(15,61,46,0.09)] backdrop-blur">
      <div className="grid gap-3 xl:grid-cols-[1fr_auto] xl:items-center">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <CommandMetric label="Fleet health" loading={loading} value={fleetHealth} className={statusStyles} />
          <CommandMetric label="Agents passing" loading={loading} value={`${passingAgents}/${totalAgents}`} />
          <CommandMetric label="Scenarios passing" loading={loading} value={`${passingScenarios}/${totalScenarios}`} />
          <CommandMetric label="Active root causes" loading={loading} value={String(activeRootCauses)} tone={activeRootCauses > 0 ? 'warning' : 'normal'} />
          <CommandMetric label="Ready to promote" loading={loading} value={String(readyToPromote)} tone={readyToPromote > 0 ? 'success' : 'normal'} />
          <CommandMetric
            label="Next cron"
            loading={!now}
            value={nextCron ? `${nextCron.label} ${formatCountdown(nextCron.next.getTime() - now!.getTime())}` : '-'}
            subValue={nextCron ? nextCron.categories : undefined}
          />
          <CommandMetric
            label="Last cron result"
            loading={loading}
            value={lastCronRun ? `${lastCronRun.pass_count}/${lastCronRun.scenario_count} passed` : 'No runs'}
            subValue={lastCronRun ? `${lastCronRun.status} - ${fmtF1(lastCronRun.avg_f1)} F1` : 'Waiting for cron'}
          />
        </div>
        <div className="flex flex-wrap gap-2 xl:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onRunFullPack}
            className="rounded-[6px] bg-[#1C7C54] px-4 py-2 text-sm font-black text-white transition hover:bg-[#17392b] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Run Full Pack
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onRunScenario}
            className="rounded-[6px] border border-[#dfe9e2] px-4 py-2 text-sm font-black text-[#17392b] transition hover:border-[#3c8259] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Run Scenario
          </button>
        </div>
      </div>
      <p className="mt-3 text-xs font-semibold text-[#617269]">
        Safety: sandbox rows stay in <code>environment=&quot;sandbox&quot;</code>; proposed actions are captured, not dispatched. Health separates manual pack results, cron health, unresolved historical issues, and current failures.
      </p>
    </section>
  );
}

function OverviewTab({
  health,
  agents,
  buckets,
  activeRootCauses,
  resolvedRootCauses,
  proposals,
  recommendations,
  latestManualSummary,
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
  latestManualSummary: string;
  onFilterAgents: (bucket: FleetBucket) => void;
  onOpenDetails: (target: 'learning' | 'agents' | 'run') => void;
}) {
  const requiredActions = buildRequiredActions(health, agents, activeRootCauses, proposals);
  const lessonsThisWeek = (health?.needsReview ?? []).length;
  const resolvedThisWeek = resolvedRootCauses.length;

  return (
    <section className="grid gap-5">
      <FleetStatusCards buckets={buckets} onFilter={onFilterAgents} />

      <ContradictionExplainer
        latestManualSummary={latestManualSummary}
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
            <MiniMetric label="Root causes found" value={String(activeRootCauses.length)} />
            <MiniMetric label="Root causes resolved" value={String(resolvedThisWeek)} />
            <MiniMetric label="Resolution rate" value={pctRatio(resolvedThisWeek, activeRootCauses.length + resolvedThisWeek)} />
            <MiniMetric label="Lessons generated" value={String(lessonsThisWeek)} />
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
            <EmptyState message="No active discoveries need operator attention." />
          )}
        </Panel>
        <Panel title="Promotion Summary" action={<SmallButton onClick={() => onOpenDetails('agents')}>Agents</SmallButton>}>
          <div className="grid gap-2">
            <SummaryLine label="Promote" value={buckets.promote.map((a) => a.agentId).join(', ') || 'None'} />
            <SummaryLine label="Investigate" value={buckets.investigate.map((a) => a.agentId).join(', ') || 'None'} />
            <SummaryLine label="Blocked" value={buckets.blocked.map((a) => a.agentId).join(', ') || 'None'} />
          </div>
        </Panel>
      </div>
    </section>
  );
}

function RunTab({
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
  busyPack: ScenarioCategory | 'stress' | 'all' | null;
  disabled: boolean;
  packResults: PackResult[];
  lastResult: RunResult | null;
  lastScenario: SandboxScenarioTemplate | null;
  onSearch: (value: string) => void;
  onCategory: (value: ScenarioCategory | 'all') => void;
  onDifficulty: (value: ScenarioDifficulty | 'all') => void;
  onSort: (value: 'title' | 'agent' | 'category' | 'difficulty') => void;
  onRunScenario: (slug: string) => void;
  onRunPack: (pack: ScenarioCategory | 'stress' | 'all') => void;
  onSelectResult: (row: PackResult) => void;
}) {
  return (
    <section className="grid gap-5">
      <Panel title="Scenario Execution">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <ArenaActionButton label="Run Full Pack" description="All scenarios, sequential client run" busy={busyPack === 'all'} disabled={disabled} onClick={() => onRunPack('all')} />
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

function AgentsTab({
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
  const count = (bucket: FleetBucket) => allAgents.filter((agent) => bucketForAgent(agent) === bucket).length;

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap gap-2">
        {[
          ['all', `All (${allAgents.length})`],
          ['promote', `Promote (${count('promote')})`],
          ['investigate', `Investigate (${count('investigate')})`],
          ['blocked', `Blocked (${count('blocked')})`],
          ['monitor', `Monitor (${count('monitor')})`],
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

function LearningTab({
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

  return (
    <section className="grid gap-5">
      <Panel title="Learning Velocity" action={<SmallButton onClick={onRefresh}>Refresh</SmallButton>}>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <MiniMetric label="Root causes found" value={String(found)} />
          <MiniMetric label="Root causes resolved" value={String(resolved)} />
          <MiniMetric label="Resolution rate" value={pctRatio(resolved, found)} />
          <MiniMetric label="Lessons generated" value={String(lessons?.length ?? health?.needsReview.length ?? 0)} />
          <MiniMetric label="Trend" value={(health?.regressions.length ?? 0) > 0 ? 'Regressing' : resolved > 0 ? 'Learning' : 'Stable'} />
        </div>
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

function InfrastructureTab({
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

function FleetStatusCards({ buckets, onFilter }: { buckets: Record<FleetBucket, AgentRow[]>; onFilter: (bucket: FleetBucket) => void }) {
  const cards: Array<{ key: FleetBucket; title: string; description: string; tone: string }> = [
    { key: 'promote', title: 'Ready to Promote', description: 'Passing, stable, and no active blockers', tone: 'border-[#b5d6c5] bg-[#f5fbf7]' },
    { key: 'investigate', title: 'Investigate', description: 'Root causes, regressions, or low confidence', tone: 'border-amber-300 bg-amber-50' },
    { key: 'blocked', title: 'Blocked', description: 'Critical issue or failing scenario blocks promotion', tone: 'border-red-200 bg-red-50' },
    { key: 'monitor', title: 'Healthy / Monitor', description: 'Healthy enough to observe, not promote yet', tone: 'border-[#dfe9e2] bg-white' },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <button
          key={card.key}
          type="button"
          onClick={() => onFilter(card.key)}
          className={`rounded-[8px] border px-4 py-4 text-left shadow-[0_12px_32px_rgba(15,61,46,0.05)] transition hover:-translate-y-0.5 ${card.tone}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-[#17392b]">{card.title}</p>
              <p className="text-xs font-semibold text-[#617269]">{card.description}</p>
            </div>
            <span className="text-2xl font-black text-[#17392b]">{buckets[card.key].length}</span>
          </div>
          <p className="mt-3 line-clamp-3 text-xs font-bold text-[#617269]">
            {buckets[card.key].map((agent) => agent.agentId).join(', ') || 'None'}
          </p>
        </button>
      ))}
    </div>
  );
}

function ContradictionExplainer({
  latestManualSummary,
  activeRootCauses,
  failingScenarios,
  readyToPromote,
}: {
  latestManualSummary: string;
  activeRootCauses: number;
  failingScenarios: number;
  readyToPromote: number;
}) {
  return (
    <Panel title="What These Numbers Mean">
      <div className="grid gap-3 lg:grid-cols-4">
        <SummaryLine label="Latest manual pack result" value={latestManualSummary} />
        <SummaryLine label="Fleet health" value={activeRootCauses > 0 ? `${activeRootCauses} unresolved historical issue${activeRootCauses === 1 ? '' : 's'}` : 'No unresolved root causes'} />
        <SummaryLine label="Current failing scenarios" value={`${failingScenarios} failing latest-score scenario${failingScenarios === 1 ? '' : 's'}`} />
        <SummaryLine label="Promotion readiness" value={`${readyToPromote} agent${readyToPromote === 1 ? '' : 's'} can still be clean while other agents have root causes`} />
      </div>
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

function RunHistoryTable({ history, onSelect }: { history: HistoryRow[] | null; onSelect: (row: HistoryRow) => void }) {
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
              <td className="py-2 text-right">{row.score ? <F1Badge f1={row.score.f1Score} /> : '-'}</td>
              <td className="py-2 text-right font-bold text-[#617269]">{row.lessonCount}</td>
              <td className="py-2 text-xs font-bold text-[#7f9187]">{new Date(row.startedAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AgentDetailDrawer({
  agentId,
  health,
  history,
  lessons,
  scenarios,
  onClose,
  onSelectRun,
}: {
  agentId: string;
  health: HealthData | null;
  history: HistoryRow[];
  lessons: Lesson[];
  scenarios: SandboxScenarioTemplate[];
  onClose: () => void;
  onSelectRun: (row: HistoryRow) => void;
}) {
  const rootCauses = (health?.activeRootCauses ?? health?.rootCauses ?? []).filter((rc) => rc.agentId === agentId);
  const proposals = (health?.proposals ?? []).filter((proposal) => proposal.affectedAgent === agentId);
  const runs = history.filter((row) => row.scenario.agentId === agentId).slice(0, 12);
  const agentLessons = lessons.filter((lesson) => lesson.agentId === agentId).slice(0, 12);
  const failing = (health?.failingScenarios ?? []).filter((scenario) => scenario.agentId === agentId);
  const agentScenarios = scenarios.filter((scenario) => scenario.agentId === agentId);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <aside className="fixed bottom-0 right-0 top-0 z-50 w-full max-w-2xl overflow-y-auto bg-white px-5 py-5 shadow-[-20px_0_60px_rgba(15,61,46,0.18)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7f9187]">Agent detail</p>
            <h2 className="text-xl font-black text-[#17392b]">{agentId}</h2>
            <p className="text-sm font-semibold text-[#617269]">{agentScenarios.length} scenario templates</p>
          </div>
          <CloseButton onClose={onClose} />
        </div>
        <div className="mt-4 grid gap-4">
          <DrawerSection title={`Failing scenarios (${failing.length})`}>
            {failing.length > 0 ? failing.map((scenario) => (
              <SummaryLine key={scenario.scenarioId} label={scenario.title} value={`F1 ${scenario.f1.toFixed(2)} - ${new Date(scenario.scoredAt).toLocaleString()}`} />
            )) : <EmptyState message="No current failing scenarios for this agent." />}
          </DrawerSection>
          <DrawerSection title="Recent runs">
            <RunHistoryTable history={runs} onSelect={onSelectRun} />
          </DrawerSection>
          <DrawerSection title={`Lessons (${agentLessons.length})`}>
            {agentLessons.length > 0 ? agentLessons.map((lesson) => <LessonCard key={lesson.id} lesson={lesson} />) : <EmptyState message="No lessons for this agent." />}
          </DrawerSection>
          <DrawerSection title={`Root causes (${rootCauses.length})`}>
            {rootCauses.length > 0 ? rootCauses.map((rc) => <RootCauseCard key={rc.key} rootCause={rc} />) : <EmptyState message="No active root causes for this agent." />}
          </DrawerSection>
          <DrawerSection title={`Proposals (${proposals.length})`}>
            {proposals.length > 0 ? proposals.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} />) : <EmptyState message="No proposals for this agent." />}
          </DrawerSection>
        </div>
      </aside>
    </>
  );
}

function ScenarioResultDrawer({ result, onClose }: { result: PackResult; onClose: () => void }) {
  const actualActionTypes = result.result.proposedActions.map((action) => action.action_type).filter(Boolean);
  const expectedSet = new Set(result.expectedActionTypes);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <aside className="fixed bottom-0 right-0 top-0 z-50 w-full max-w-xl overflow-y-auto bg-white px-5 py-5 shadow-[-20px_0_60px_rgba(15,61,46,0.18)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7f9187]">Scenario Result</p>
            <h2 className="text-xl font-black text-[#17392b]">{result.scenarioTitle}</h2>
            <p className="text-sm font-semibold text-[#617269]">{result.agentId}</p>
          </div>
          <CloseButton onClose={onClose} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniMetric label="Result" value={isPass(result.result) ? 'PASS' : 'FAIL'} />
          <MiniMetric label="Precision" value={pct(result.result.score.precisionScore)} />
          <MiniMetric label="Recall" value={pct(result.result.score.recallScore)} />
          <MiniMetric label="F1" value={result.result.score.f1Score.toFixed(2)} />
        </div>
        <div className="mt-4 grid gap-3">
          <ActionComparePanel title="Expected Actions" actions={result.expectedActionTypes} />
          <ActionComparePanel title="Actual Actions" actions={actualActionTypes} expectedSet={expectedSet} />
        </div>
        <section className="mt-4 rounded-[8px] border border-[#dfe9e2] bg-[#f4faf6] px-4 py-3">
          <h3 className="text-sm font-black text-[#17392b]">Summary</h3>
          <p className="mt-1 text-sm font-semibold text-[#617269]">{result.result.summary || 'No summary returned.'}</p>
        </section>
        <section className="mt-4 rounded-[8px] border border-[#dfe9e2] px-4 py-3">
          <h3 className="text-sm font-black text-[#17392b]">Proposed Action Details</h3>
          {result.result.proposedActions.length > 0 ? (
            <div className="mt-2 grid gap-2">
              {result.result.proposedActions.map((action, index) => (
                <div key={`${action.action_type}-${index}`} className="rounded-[8px] bg-[#f4faf6] px-3 py-2">
                  <p className="text-xs font-black text-[#17392b]">{action.action_type}</p>
                  {action.preview ? <p className="text-xs font-semibold text-[#617269]">{action.preview}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm font-semibold text-[#7f9187]">No actions proposed.</p>
          )}
        </section>
      </aside>
    </>
  );
}

function buildAgentRows(health: HealthData | null, lessons: Lesson[], scenarios: SandboxScenarioTemplate[]): AgentRow[] {
  const activeRootCauses = health?.activeRootCauses ?? health?.rootCauses ?? [];
  const agentIds = new Set<string>();
  scenarios.forEach((scenario) => agentIds.add(scenario.agentId));
  health?.health.forEach((row) => agentIds.add(row.agent_id));
  health?.recommendations?.forEach((row) => agentIds.add(row.agentId));
  activeRootCauses.forEach((row) => agentIds.add(row.agentId));

  return [...agentIds].sort().map((agentId) => {
    const healthRow = health?.health.find((row) => row.agent_id === agentId);
    const recommendation = health?.recommendations?.find((row) => row.agentId === agentId);
    const rootCauses = activeRootCauses.filter((row) => row.agentId === agentId);
    const failing = health?.failingScenarios.filter((row) => row.agentId === agentId) ?? [];
    const isRegression = Boolean(health?.regressions.some((row) => row.agent_id === agentId));
    const lessonCount = recommendation?.lessonCount ?? lessons.filter((lesson) => lesson.agentId === agentId).length;
    const blockers = [
      ...rootCauses.map((row) => row.title),
      ...failing.map((row) => `Failing scenario: ${row.title}`),
      ...(isRegression ? ['Regression against 7d baseline'] : []),
      ...((healthRow?.avg_f1 ?? recommendation?.currentF1 ?? 1) < 0.5 ? ['24h F1 is below pass threshold'] : []),
    ];
    return {
      agentId,
      f1: recommendation?.currentF1 ?? healthRow?.avg_f1 ?? null,
      baselineF1: recommendation?.baselineF1 ?? healthRow?.baseline_f1 ?? null,
      passRate: healthRow?.pass_rate ?? null,
      rootCauseCount: recommendation?.rootCauseCount ?? rootCauses.length,
      lessonCount,
      status: mapPromotionStatus(recommendation?.status, blockers, healthRow?.avg_f1 ?? recommendation?.currentF1 ?? null),
      recommendation: recommendation?.rationale ?? fallbackRecommendation(blockers.length, healthRow?.avg_f1 ?? null),
      trend: recommendation?.trend ?? healthRow?.trend ?? 'stable',
      blockers,
    };
  });
}

function mapPromotionStatus(status: PromotionStatus | undefined, blockers: string[], f1: number | null): OperatorPromotionStatus {
  if (status === 'promote') return 'Promote';
  if (status === 'blocked') return 'Blocked';
  if (status === 'investigate') return 'Investigate';
  if (blockers.length > 0) return blockers.some((blocker) => blocker.includes('Failing scenario')) ? 'Blocked' : 'Investigate';
  if (f1 !== null && f1 < 0.5) return 'Investigate';
  return 'Monitor';
}

function fallbackRecommendation(blockerCount: number, f1: number | null): string {
  if (blockerCount > 0) return 'Clear blockers before promotion.';
  if (f1 !== null && f1 >= 0.8) return 'Monitor for stability or promote after review.';
  return 'Keep monitoring until more runs are available.';
}

function bucketForAgent(agent: AgentRow): FleetBucket {
  if (agent.status === 'Promote') return 'promote';
  if (agent.status === 'Blocked') return 'blocked';
  if (agent.status === 'Investigate') return 'investigate';
  return 'monitor';
}

function buildRequiredActions(health: HealthData | null, agents: AgentRow[], activeRootCauses: RootCause[], proposals: ImprovementProposal[]) {
  const actions: Array<{ id: string; title: string; what: string; why: string; next: string; target: 'learning' | 'agents' | 'run' }> = [];
  activeRootCauses.forEach((rootCause) => actions.push({
    id: `rc-${rootCause.key}`,
    title: rootCause.title,
    what: rootCause.rootCauseSummary,
    why: `${rootCause.agentId} has ${rootCause.lessonCount} related lesson${rootCause.lessonCount === 1 ? '' : 's'}.`,
    next: rootCause.recommendedFix,
    target: 'learning',
  }));
  (health?.regressions ?? []).forEach((regression) => actions.push({
    id: `regression-${regression.agent_id}`,
    title: `${regression.agent_id} regressed`,
    what: `24h F1 ${fmtF1(regression.avg_f1)} vs baseline ${fmtF1(regression.baseline_f1)}.`,
    why: 'Promotion should wait until the baseline recovers.',
    next: 'Inspect recent runs and root causes.',
    target: 'agents',
  }));
  proposals.forEach((proposal) => actions.push({
    id: `proposal-${proposal.id}`,
    title: proposal.title,
    what: proposal.likelyRootCause,
    why: `Expected F1 impact: ${proposal.expectedF1Impact}.`,
    next: proposal.suggestedFix,
    target: 'learning',
  }));
  agents.filter((agent) => agent.f1 !== null && agent.f1 < 0.5).forEach((agent) => actions.push({
    id: `low-f1-${agent.agentId}`,
    title: `${agent.agentId} has low 24h F1`,
    what: `Current F1 is ${fmtF1(agent.f1)}.`,
    why: 'The agent is below the scenario pass threshold.',
    next: 'Run targeted scenarios and inspect recent lessons.',
    target: 'agents',
  }));
  return actions;
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

function RootCauseCard({ rootCause, resolved = false }: { rootCause: RootCause; resolved?: boolean }) {
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

function ProposalCard({ proposal }: { proposal: ImprovementProposal }) {
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

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="grid gap-3 rounded-[8px] border border-[#dfe9e2] bg-white px-4 py-4 shadow-[0_18px_48px_rgba(15,61,46,0.07)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black text-[#17392b]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[8px] border border-[#dfe9e2] px-4 py-3">
      <h3 className="text-sm font-black text-[#17392b]">{title}</h3>
      <div className="mt-2 grid gap-2">{children}</div>
    </section>
  );
}

function CommandMetric({ label, value, subValue, loading, tone = 'normal', className }: { label: string; value: string; subValue?: string; loading?: boolean; tone?: 'normal' | 'warning' | 'success'; className?: string }) {
  const toneClass =
    className ??
    (tone === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-800' : tone === 'success' ? 'border-[#b5d6c5] bg-[#e5f4ec] text-[#1C7C54]' : 'border-[#dfe9e2] bg-[#f4faf6] text-[#17392b]');
  return (
    <div className={`rounded-[8px] border px-3 py-2 ${toneClass}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.12em] opacity-75">{label}</p>
      <p className="mt-1 text-base font-black">{loading ? '-' : value}</p>
      {subValue ? <p className="truncate text-[10px] font-bold opacity-75">{subValue}</p> : null}
    </div>
  );
}

function ArenaActionButton({ label, description, busy, disabled, onClick, tone = 'default' }: { label: string; description: string; busy: boolean; disabled: boolean; onClick: () => void; tone?: 'default' | 'warning' }) {
  const styles = tone === 'warning'
    ? 'border border-amber-300 bg-amber-50 hover:bg-amber-100'
    : 'border border-[#dfe9e2] bg-[#f4faf6] hover:border-[#3c8259] hover:bg-white';
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`rounded-[8px] px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${styles}`}>
      <p className="text-sm font-black text-[#17392b]">{busy ? 'Running...' : label}</p>
      <p className="text-xs font-semibold text-[#7f9187]">{description}</p>
    </button>
  );
}

function RunStatusPanel({ status }: { status: RunStatus }) {
  const progress = status.total === 0 ? 0 : Math.round((status.currentIndex / status.total) * 100);
  const elapsed = Math.max(0, Math.round((Date.now() - status.startedAt) / 1000));
  const tone = status.status === 'failed' ? 'border-red-200 bg-red-50 text-red-800' : status.status === 'complete' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900';
  return (
    <section className={`rounded-[8px] border px-4 py-4 shadow-sm ${tone}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em]">{status.kind === 'pack' ? 'Pack running' : 'Scenario running'}</p>
          <h2 className="text-lg font-black">{status.label}</h2>
          <p className="text-sm font-semibold">{status.message}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black">{status.currentIndex}/{status.total}</p>
          <p className="text-xs font-bold">{elapsed}s elapsed</p>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/70">
        <div className="h-full rounded-full bg-current transition-all" style={{ width: `${progress}%` }} />
      </div>
      {status.currentScenario ? <p className="mt-2 text-xs font-bold">Current: {status.currentScenario}</p> : null}
    </section>
  );
}

function LastResultCard({ result, scenario, onOpen }: { result: RunResult; scenario: SandboxScenarioTemplate | null; onOpen: () => void }) {
  return (
    <Panel title="Latest Manual Scenario Result" action={scenario ? <SmallButton onClick={onOpen}>Details</SmallButton> : null}>
      <div className="flex flex-wrap items-center gap-3">
        <PassFailChip passed={isPass(result)} />
        <F1Badge f1={result.score.f1Score} />
        {scenario ? <p className="text-sm font-black text-[#17392b]">{scenario.title}</p> : null}
      </div>
      <p className="text-xs font-semibold text-[#617269]">{result.summary}</p>
    </Panel>
  );
}

function StatCard({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return (
    <div className="rounded-[8px] border border-[#dfe9e2] bg-white px-4 py-4 shadow-[0_12px_32px_rgba(15,61,46,0.06)]">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7f9187]">{label}</p>
      <p className="mt-2 text-3xl font-black text-[#17392b]">{loading ? '-' : value}</p>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] bg-[#f4faf6] px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-wider text-[#7f9187]">{label}</p>
      <p className="mt-1 text-sm font-black text-[#17392b]">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] bg-[#f4faf6] px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-wider text-[#7f9187]">{label}</p>
      <p className="text-lg font-black text-[#17392b]">{value}</p>
    </div>
  );
}

function LessonCard({ lesson }: { lesson: Lesson }) {
  return (
    <div className="rounded-[8px] bg-[#f4faf6] px-3 py-2">
      <p className="text-xs font-black text-[#17392b]">{lesson.title}</p>
      <p className="mt-1 text-xs font-semibold text-[#617269]">{lesson.observation}</p>
      {lesson.recommendation ? <p className="mt-1 text-xs font-semibold text-[#1C7C54]">{lesson.recommendation}</p> : null}
    </div>
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-[6px] border border-[#dfe9e2] bg-white px-3 py-2 text-sm font-bold text-[#617269] outline-none transition focus:border-[#1C7C54]">
      {children}
    </select>
  );
}

function SmallButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-[6px] border border-[#dfe9e2] px-3 py-1.5 text-xs font-black text-[#17392b] hover:border-[#3c8259]">
      {children}
    </button>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" onClick={onClose} className="rounded-full bg-[#f4faf6] px-3 py-1.5 text-sm font-black text-[#617269] hover:bg-[#dfe9e2]">
      Close
    </button>
  );
}

function Alert({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  return (
    <div className={`rounded-[8px] border px-4 py-3 text-sm font-semibold ${tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
      {children}
    </div>
  );
}

function PromotionChip({ status }: { status: OperatorPromotionStatus }) {
  const styles: Record<OperatorPromotionStatus, string> = {
    Promote: 'bg-[#e5f4ec] text-[#1C7C54]',
    Monitor: 'bg-[#fff6e0] text-[#9a6700]',
    Investigate: 'bg-[#fde8e8] text-[#b42318]',
    Blocked: 'bg-[#f8e8f8] text-[#7b2d7b]',
  };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${styles[status]}`}>{status}</span>;
}

function SeverityBadge({ severity }: { severity: string }) {
  const colour =
    severity === 'critical' ? 'bg-red-100 text-red-800'
    : severity === 'warning' ? 'bg-yellow-100 text-yellow-800'
    : severity === 'resolved' ? 'bg-emerald-100 text-emerald-800'
    : 'bg-blue-100 text-blue-800';
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${colour}`}>{severity}</span>;
}

function StatusPill({ status }: { status: string }) {
  const styles = status === 'complete' ? 'bg-[#e5f4ec] text-[#1C7C54]' : status === 'failed' ? 'bg-[#fde8e8] text-[#b42318]' : 'bg-[#fff6e0] text-[#9a6700]';
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${styles}`}>{status}</span>;
}

function F1Badge({ f1 }: { f1: number }) {
  const colour = f1 >= 0.7 ? 'bg-emerald-100 text-emerald-800' : f1 >= 0.4 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-black ${colour}`}>F1 {f1.toFixed(2)}</span>;
}

function PassFailChip({ passed }: { passed: boolean }) {
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${passed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{passed ? 'Pass' : 'Fail'}</span>;
}

function ActionComparePanel({ title, actions, expectedSet }: { title: string; actions: string[]; expectedSet?: Set<string> }) {
  return (
    <section className="rounded-[8px] border border-[#dfe9e2] px-4 py-3">
      <h3 className="text-sm font-black text-[#17392b]">{title}</h3>
      {actions.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {actions.map((action, index) => {
            const matched = expectedSet ? expectedSet.has(action) : true;
            return <span key={`${action}-${index}`} className={`rounded-full px-2 py-0.5 text-[10px] font-black ${matched ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{action}</span>;
          })}
        </div>
      ) : (
        <p className="mt-2 text-sm font-semibold text-[#7f9187]">None.</p>
      )}
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[8px] bg-[#f4faf6] px-4 py-6 text-center">
      <p className="text-sm font-semibold text-[#7f9187]">{message}</p>
    </div>
  );
}

function isPass(result: RunResult): boolean {
  return result.status !== 'failed' && result.score.f1Score >= 0.5;
}

function fmtF1(value: number | null): string {
  return value === null ? '-' : Number(value).toFixed(2);
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function pctRatio(numerator: number, denominator: number): string {
  if (denominator === 0) return '-';
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function difficultyRank(difficulty: ScenarioDifficulty): number {
  return difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
}

function scenarioCategories(): ScenarioCategory[] {
  return ['customer', 'participant', 'marketplace', 'ndis', 'ops', 'growth', 'finance'];
}

function toPackResultStatic(scenario: SandboxScenarioTemplate, result: RunResult): PackResult {
  return {
    scenarioSlug: scenario.slug,
    scenarioTitle: scenario.title,
    category: scenario.category,
    agentId: scenario.agentId,
    expectedActionTypes: scenario.expectedActionTypes,
    result,
  };
}

function historyRowToPackResult(row: HistoryRow): PackResult {
  return {
    scenarioSlug: row.scenario.slug ?? row.scenario.id,
    scenarioTitle: row.scenario.title,
    category: row.scenario.category as ScenarioCategory,
    agentId: row.scenario.agentId,
    expectedActionTypes: row.scenario.expectedActionTypes,
    result: {
      trainingRunId: row.id,
      status: row.status as RunResult['status'],
      summary: row.response?.summary ?? '',
      proposedActions: (row.response?.proposedActions ?? []).map((action) => ({
        action_type: action.action_type ?? 'unknown',
        preview: action.preview,
      })),
      llmCalls: row.response?.llmCalls ?? 0,
      costCents: row.costCents,
      durationMs: row.durationMs,
      score: row.score ?? { precisionScore: 0, recallScore: 0, f1Score: 0, hit: false },
    },
  };
}
