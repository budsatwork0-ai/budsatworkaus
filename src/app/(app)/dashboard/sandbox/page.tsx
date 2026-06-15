'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { SANDBOX_SCENARIOS } from '@/lib/sandbox/scenarios';
import type { ScenarioCategory, ScenarioDifficulty, SandboxScenarioTemplate } from '@/lib/sandbox/scenarios';
import type { FleetBucket, HealthData, HistoryRow, Lesson, PackKind, PackResult, ReadinessData, RunResult, RunStatus, SandboxData, OperationsTab } from './_lib/types';
import { buildAgentRows, bucketForAgent } from './_lib/agents';
import { difficultyRank, isPass, titleCase } from './_lib/format';
import { buildOperatorIntelligence } from './_lib/operator-intelligence';
import { historyRowToPackResult } from './_lib/results';
import { packLabel, scenariosForPack } from './_lib/run-packs';
import { AgentDetailDrawer, ScenarioResultDrawer } from './_components/SandboxDrawers';
import { AgentsTab, InfrastructureTab, LearningTab, OverviewTab, RunTab } from './_components/SandboxTabs';
import { ExecutiveCommandStrip, ExecutiveSummary, PackRunConfirmationDialog } from './_components/RunControls';
import { Alert, RunStatusPanel } from './_components/ui';

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
  const [busyPack, setBusyPack] = useState<PackKind | null>(null);
  const [pendingPack, setPendingPack] = useState<{ pack: PackKind; label: string; count: number } | null>(null);
  const runLockRef = useRef(false);
  const packStartingRef = useRef(false);
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

  const activeRootCauses = useMemo(() => health?.activeRootCauses ?? health?.rootCauses ?? [], [health]);
  const resolvedRootCauses = useMemo(() => health?.resolvedRootCauses ?? [], [health]);
  const proposals = useMemo(() => health?.proposals ?? [], [health]);
  const recommendations = useMemo(() => health?.recommendations ?? [], [health]);
  const isBusy = busySlug !== null || busyPack !== null || pendingPack !== null;

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
  const operatorIntelligence = useMemo(
    () => buildOperatorIntelligence({
      agents,
      health,
      history: history ?? [],
      lessons: lessons ?? [],
      readiness,
      activeRootCauses,
      resolvedRootCauses,
      fleetHealth,
    }),
    [activeRootCauses, agents, fleetHealth, health, history, lessons, readiness, resolvedRootCauses],
  );

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
    if (runLockRef.current) return;
    const scenario = SANDBOX_SCENARIOS.find((s) => s.slug === slug);
    runLockRef.current = true;
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
      runLockRef.current = false;
    }
  }


  function requestPackRun(pack: PackKind) {
    if (runLockRef.current || pendingPack) return;
    const scenarios = scenariosForPack(pack);

    if (scenarios.length === 0) {
      setError('No matching scenarios found for this pack.');
      return;
    }

    runLockRef.current = true;
    setPendingPack({ pack, label: packLabel(pack), count: scenarios.length });
  }

  function cancelPackRun() {
    if (packStartingRef.current) return;
    setPendingPack(null);
    runLockRef.current = false;
  }

  async function startPackRun(pack: PackKind) {
    if (packStartingRef.current) return;
    packStartingRef.current = true;
    const scenarios =
      scenariosForPack(pack);

    if (scenarios.length === 0) {
      setError('No matching scenarios found for this pack.');
      setPendingPack(null);
      runLockRef.current = false;
      packStartingRef.current = false;
      return;
    }

    setPendingPack(null);
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
      packStartingRef.current = false;
      runLockRef.current = false;
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
        fleetScore={operatorIntelligence.fleetScore}
        fleetScoreTrend={operatorIntelligence.fleetScoreTrend}
        passingAgents={passingAgents}
        totalAgents={agents.length}
        passingScenarios={passingScenarios}
        passingScenariosTrend={operatorIntelligence.passingScenariosTrend}
        totalScenarios={readiness?.totalScenarios ?? SANDBOX_SCENARIOS.length}
        activeRootCauses={activeRootCauses.length}
        rootCausesTrend={operatorIntelligence.rootCausesTrend}
        readyToPromote={readyToPromote}
        readyToPromoteTrend={operatorIntelligence.readyToPromoteTrend}
        lastCronRun={health?.lastCronRun ?? null}
        loading={loading || healthLoading}
        busy={isBusy}
        onRunFullPack={() => {
          setActiveTab('run');
          requestPackRun('all');
        }}
        onRunScenario={() => setActiveTab('run')}
      />

      <ExecutiveSummary summary={operatorIntelligence.executiveSummary} fleetHealth={fleetHealth} />

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
          intelligence={operatorIntelligence}
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
          onRunPack={requestPackRun}
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

      {pendingPack ? (
        <PackRunConfirmationDialog
          label={pendingPack.label}
          count={pendingPack.count}
          onCancel={cancelPackRun}
          onConfirm={() => void startPackRun(pendingPack.pack)}
        />
      ) : null}
    </div>
  );
}
