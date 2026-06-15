'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { SANDBOX_SCENARIOS } from '@/lib/sandbox/scenarios';
import type { ScenarioCategory, SandboxScenarioTemplate } from '@/lib/sandbox/scenarios';
import HealthTab from './_components/HealthTab';

// ── Types ──────────────────────────────────────────────────────────────────

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

type ArenaTab = 'actions' | 'history' | 'health' | 'leaderboard' | 'lessons' | 'readiness';

type LeaderboardRow = {
  agentId: string;
  scenarioCount: number;
  avgF1: number;
  avgPrecision: number;
  avgRecall: number;
  hitRate: number;
  totalCostCents: number;
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

type RunStatus = {
  kind: 'scenario' | 'pack';
  label: string;
  status: 'starting' | 'running' | 'complete' | 'failed';
  startedAt: number;
  currentIndex: number;
  total: number;
  currentScenario?: string;
  message: string;
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

// ── Category colours ───────────────────────────────────────────────────────

const CATEGORY_COLOURS: Record<ScenarioCategory, string> = {
  customer:    'bg-blue-100 text-blue-800',
  participant: 'bg-purple-100 text-purple-800',
  marketplace: 'bg-amber-100 text-amber-800',
  ndis:        'bg-teal-100 text-teal-800',
  ops:         'bg-orange-100 text-orange-800',
  growth:      'bg-emerald-100 text-emerald-800',
  finance:     'bg-rose-100 text-rose-800',
};

const DIFFICULTY_COLOURS: Record<string, string> = {
  easy:   'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  hard:   'bg-red-100 text-red-800',
};

// ── Page ───────────────────────────────────────────────────────────────────

export default function SandboxPage() {
  const [data, setData] = useState<SandboxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Arena state
  const [activeTab, setActiveTab] = useState<ArenaTab>('actions');
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [busyPack, setBusyPack] = useState<ScenarioCategory | 'stress' | null>(null);
  const [lastResult, setLastResult] = useState<RunResult | null>(null);
  const [lastScenario, setLastScenario] = useState<SandboxScenarioTemplate | null>(null);
  const [runStatus, setRunStatus] = useState<RunStatus | null>(null);
  const [selectedResult, setSelectedResult] = useState<PackResult | null>(null);
  const [packResults, setPackResults] = useState<PackResult[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ScenarioCategory | 'all'>('all');

  // Data tabs
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[] | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [readiness, setReadiness] = useState<ReadinessData | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const response = await fetch('/api/sandbox', { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Failed to load sandbox');
    setData(payload);
  }, []);

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [load]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch('/api/sandbox/run-history?limit=50', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to load run history');
      setHistory(payload.history ?? []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Load data tabs on demand
  useEffect(() => {
    if (activeTab === 'leaderboard' && leaderboard === null) {
      setLeaderboardLoading(true);
      fetch('/api/sandbox/leaderboard')
        .then((r) => r.json())
        .then((j) => setLeaderboard(j.leaderboard ?? []))
        .catch(() => setLeaderboard([]))
        .finally(() => setLeaderboardLoading(false));
    }
    if (activeTab === 'lessons' && lessons === null) {
      setLessonsLoading(true);
      fetch('/api/sandbox/lessons?limit=50')
        .then((r) => r.json())
        .then((j) => setLessons(j.lessons ?? []))
        .catch(() => setLessons([]))
        .finally(() => setLessonsLoading(false));
    }
    if (activeTab === 'readiness' && readiness === null) {
      setReadinessLoading(true);
      fetch('/api/sandbox/readiness')
        .then((r) => r.json())
        .then((j) => setReadiness(j))
        .catch(() => setReadiness(null))
        .finally(() => setReadinessLoading(false));
    }
    if (activeTab === 'history' && history === null) {
      void loadHistory();
    }
  }, [activeTab, leaderboard, lessons, readiness, history, loadHistory]);

  const statusCards = useMemo(() => {
    const status = data?.status;
    return [
      ['Active customers', status?.activeCustomers ?? 0],
      ['Active leads', status?.activeLeads ?? 0],
      ['Active jobs', status?.activeJobs ?? 0],
      ['Initiatives', status?.activeInitiatives ?? 0],
      ['Approvals', status?.activeApprovals ?? 0],
    ];
  }, [data]);

  const metricCards = useMemo(() => {
    const metrics = data?.metrics;
    return [
      ['Leads generated', metrics?.leadsGenerated ?? 0],
      ['Quotes generated', metrics?.quotesGenerated ?? 0],
      ['Jobs completed', metrics?.jobsCompleted ?? 0],
      ['Reviews generated', metrics?.reviewsGenerated ?? 0],
      ['Initiatives created', metrics?.initiativesCreated ?? 0],
      ['Agent actions', metrics?.agentActionsCreated ?? 0],
    ];
  }, [data]);

  const filteredScenarios = useMemo(() => {
    if (selectedCategory === 'all') return SANDBOX_SCENARIOS;
    return SANDBOX_SCENARIOS.filter((s) => s.category === selectedCategory);
  }, [selectedCategory]);

  const categories: Array<ScenarioCategory | 'all'> = [
    'all', 'customer', 'participant', 'marketplace', 'ndis', 'ops', 'growth', 'finance',
  ];

  function invalidateArenaData() {
    setLeaderboard(null);
    setLessons(null);
    setReadiness(null);
    setHistory(null);
  }

  async function executeScenario(slug: string): Promise<RunResult> {
    const res = await fetch('/api/sandbox/run-scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || 'Scenario run failed');
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
      message: 'Scenario run started. Waiting for agent response...',
    });
    toast.info('Scenario started', { description: scenario?.title ?? slug });
    try {
      const payload = await executeScenario(slug);
      const result = payload as RunResult;
      setLastResult(result);
      if (scenario) {
        setSelectedResult(toPackResult(scenario, result));
        setPackResults([toPackResult(scenario, result)]);
      }
      setRunStatus((current) => current ? {
        ...current,
        status: result.status === 'failed' ? 'failed' : 'complete',
        message: `Scenario ${result.status === 'failed' ? 'failed' : 'completed'} with F1 ${result.score?.f1Score?.toFixed(2) ?? 'n/a'}.`,
      } : current);
      setNotice(`Scenario completed — F1: ${result.score?.f1Score ?? 'n/a'}`);
      if (result.status === 'failed') {
        toast.error('Scenario failed', { description: scenario?.title ?? slug });
      } else {
        toast.success('Scenario completed', { description: `F1 ${result.score.f1Score.toFixed(2)} · ${scenario?.title ?? slug}` });
      }
      invalidateArenaData();
      await load();
      await loadHistory();
    } catch (err) {
      setRunStatus((current) => current ? { ...current, status: 'failed', message: err instanceof Error ? err.message : String(err) } : current);
      setError(err instanceof Error ? err.message : String(err));
      toast.error('Scenario failed', { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusySlug(null);
    }
  }

  async function runPack(category: ScenarioCategory | 'stress') {
    const scenarios =
      category === 'stress'
        ? SANDBOX_SCENARIOS.filter((scenario) => scenario.slug === 'stress-agent-cascade')
        : SANDBOX_SCENARIOS.filter((scenario) => scenario.category === category);

    if (scenarios.length === 0) {
      setError('No matching scenarios found for this pack.');
      return;
    }

    setBusyPack(category);
    setError(null);
    setNotice(null);
    setLastResult(null);
    setLastScenario(null);
    setSelectedResult(null);
    setPackResults([]);
    setRunStatus({
      kind: 'pack',
      label: category === 'stress' ? 'Stress Test' : `${category} pack`,
      status: 'running',
      startedAt: Date.now(),
      currentIndex: 0,
      total: scenarios.length,
      currentScenario: scenarios[0]?.title,
      message: `Pack started. 0 of ${scenarios.length} scenarios complete.`,
    });
    toast.info('Pack started', { description: `${scenarios.length} scenario${scenarios.length === 1 ? '' : 's'} queued.` });

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
      const avgF1 = completed.length === 0
        ? 0
        : completed.reduce((sum, row) => sum + row.result.score.f1Score, 0) / completed.length;
      setRunStatus((current) => current ? {
        ...current,
        status: 'complete',
        currentIndex: scenarios.length,
        message: `Pack complete. ${passCount}/${completed.length} passed. Avg F1 ${avgF1.toFixed(2)}.`,
      } : current);
      setNotice(`Pack completed — ${completed.length} scenarios run, ${passCount} passed.`);
      toast.success('Pack completed', { description: `${passCount}/${completed.length} passed · Avg F1 ${avgF1.toFixed(2)}` });
      invalidateArenaData();
      await load();
      await loadHistory();
    } catch (err) {
      setRunStatus((current) => current ? { ...current, status: 'failed', message: err instanceof Error ? err.message : String(err) } : current);
      setError(err instanceof Error ? err.message : String(err));
      toast.error('Pack failed', { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusyPack(null);
    }
  }

  const isBusy = busySlug !== null || busyPack !== null;

  return (
    <div className="grid gap-5 px-1 pb-8 sm:px-2">

      {/* Header banner */}
      <section className="rounded-[8px] border border-amber-300 bg-amber-100 px-4 py-3 text-amber-950 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-white">
            SANDBOX
          </span>
          <div>
            <h1 className="text-xl font-black">Agent Training Arena</h1>
            <p className="text-sm font-semibold">
              Run agents against scripted scenarios. No emails, no Stripe calls, no production writes.
            </p>
          </div>
        </div>
      </section>

      {/* Alerts */}
      {error ? (
        <div className="rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-[8px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {notice}
        </div>
      ) : null}

      {runStatus ? (
        <RunStatusPanel status={runStatus} />
      ) : null}

      {/* Last result inline */}
      {lastResult ? (
        <LastResultCard
          result={lastResult}
          scenario={lastScenario}
          onOpen={() => {
            if (lastScenario) setSelectedResult(toPackResult(lastScenario, lastResult));
          }}
        />
      ) : null}

      {/* Sandbox status */}
      <section className="grid gap-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-[#17392b]">Sandbox Status</h2>
            <p className="text-sm font-semibold text-[#7f9187]">All counts are sandbox-only.</p>
          </div>
          <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-amber-800">
            Production excluded
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {statusCards.map(([label, value]) => (
            <StatCard key={label as string} label={label as string} value={value as number} loading={loading} />
          ))}
        </div>
      </section>

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-[#dfe9e2]">
        {(['actions', 'history', 'health', 'leaderboard', 'lessons', 'readiness'] as ArenaTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={
              activeTab === tab
                ? 'rounded-t-[6px] border-b-2 border-[#1C7C54] px-4 py-2 text-sm font-black text-[#17392b]'
                : 'px-4 py-2 text-sm font-bold text-[#7f9187] transition hover:text-[#17392b]'
            }
          >
            {tab === 'actions' ? 'Run Scenarios' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab: Health (continuous monitoring) */}
      {activeTab === 'health' ? <HealthTab /> : null}

      {/* Tab: Run Scenarios */}
      {activeTab === 'actions' ? (
        <section className="grid gap-5">

          {/* Arena quick-launch row */}
          <div className="grid gap-3 rounded-[8px] border border-[#dfe9e2] bg-white px-4 py-4 shadow-[0_18px_48px_rgba(15,61,46,0.07)]">
            <h2 className="text-lg font-black text-[#17392b]">Arena Actions</h2>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <ArenaActionButton
                label="Run Customer Pack"
                description="All customer scenarios"
                busy={busyPack === 'customer'}
                disabled={isBusy}
                onClick={() => runPack('customer')}
              />
              <ArenaActionButton
                label="Run Ops Pack"
                description="All ops scenarios"
                busy={busyPack === 'ops'}
                disabled={isBusy}
                onClick={() => runPack('ops')}
              />
              <ArenaActionButton
                label="Run Finance Pack"
                description="All finance scenarios"
                busy={busyPack === 'finance'}
                disabled={isBusy}
                onClick={() => runPack('finance')}
              />
              <ArenaActionButton
                label="Stress Test"
                description="Multi-agent cascade"
                busy={busyPack === 'stress'}
                disabled={isBusy}
                onClick={() => runPack('stress')}
                tone="warning"
              />
            </div>
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={
                  selectedCategory === cat
                    ? 'rounded-full bg-[#17392b] px-3 py-1 text-xs font-black text-white'
                    : 'rounded-full border border-[#dfe9e2] bg-white px-3 py-1 text-xs font-bold text-[#617269] transition hover:border-[#3c8259]'
                }
              >
                {cat === 'all' ? `All (${SANDBOX_SCENARIOS.length})` : `${cat} (${SANDBOX_SCENARIOS.filter((s) => s.category === cat).length})`}
              </button>
            ))}
          </div>

          {/* Scenario cards */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredScenarios.map((scenario) => (
              <ScenarioCard
                key={scenario.slug}
                scenario={scenario}
                busy={busySlug === scenario.slug}
                disabled={isBusy}
                onRun={runScenario}
              />
            ))}
          </div>

          {packResults.length > 0 ? (
            <PackResultsTable
              rows={packResults}
              onSelect={setSelectedResult}
            />
          ) : null}
        </section>
      ) : null}

      {/* Tab: Run History */}
      {activeTab === 'history' ? (
        <RunHistoryPanel
          history={history}
          loading={historyLoading}
          onRefresh={() => {
            setHistory(null);
            void loadHistory();
          }}
          onSelect={(row) => setSelectedResult(historyRowToPackResult(row))}
        />
      ) : null}

      {/* Tab: Leaderboard */}
      {activeTab === 'leaderboard' ? (
        <section className="grid gap-3 rounded-[8px] border border-[#dfe9e2] bg-white px-4 py-4 shadow-[0_18px_48px_rgba(15,61,46,0.07)]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-[#17392b]">Agent Leaderboard</h2>
            <button
              type="button"
              onClick={() => { setLeaderboard(null); setActiveTab('leaderboard'); }}
              className="rounded-[6px] border border-[#dfe9e2] px-3 py-1.5 text-xs font-bold text-[#617269] hover:border-[#3c8259]"
            >
              Refresh
            </button>
          </div>
          {leaderboardLoading ? (
            <p className="text-sm font-semibold text-[#7f9187]">Loading...</p>
          ) : leaderboard && leaderboard.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#dfe9e2]">
                    <th className="pb-2 text-left text-xs font-black uppercase tracking-wider text-[#7f9187]">Agent</th>
                    <th className="pb-2 text-right text-xs font-black uppercase tracking-wider text-[#7f9187]">Scenarios</th>
                    <th className="pb-2 text-right text-xs font-black uppercase tracking-wider text-[#7f9187]">Avg F1</th>
                    <th className="pb-2 text-right text-xs font-black uppercase tracking-wider text-[#7f9187]">Precision</th>
                    <th className="pb-2 text-right text-xs font-black uppercase tracking-wider text-[#7f9187]">Recall</th>
                    <th className="pb-2 text-right text-xs font-black uppercase tracking-wider text-[#7f9187]">Hit Rate</th>
                    <th className="pb-2 text-right text-xs font-black uppercase tracking-wider text-[#7f9187]">Cost</th>
                    <th className="pb-2 text-left text-xs font-black uppercase tracking-wider text-[#7f9187]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row, i) => (
                    <tr key={row.agentId} className="border-b border-[#f4faf6]">
                      <td className="py-2 font-bold text-[#17392b]">
                        <span className="mr-2 text-xs text-[#7f9187]">#{i + 1}</span>
                        {row.agentId}
                      </td>
                      <td className="py-2 text-right font-bold text-[#617269]">{row.scenarioCount}</td>
                      <td className="py-2 text-right">
                        <F1Badge f1={row.avgF1} />
                      </td>
                      <td className="py-2 text-right font-bold text-[#617269]">{pct(row.avgPrecision)}</td>
                      <td className="py-2 text-right font-bold text-[#617269]">{pct(row.avgRecall)}</td>
                      <td className="py-2 text-right font-bold text-[#617269]">{pct(row.hitRate)}</td>
                      <td className="py-2 text-right font-bold text-[#617269]">{row.totalCostCents}¢</td>
                      <td className="py-2">
                        <LeaderboardStatusChip row={row} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No runs yet. Run some scenarios to build the leaderboard." />
          )}
        </section>
      ) : null}

      {/* Tab: Lessons Learned */}
      {activeTab === 'lessons' ? (
        <section className="grid gap-3 rounded-[8px] border border-[#dfe9e2] bg-white px-4 py-4 shadow-[0_18px_48px_rgba(15,61,46,0.07)]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-[#17392b]">Lessons Learned</h2>
            <button
              type="button"
              onClick={() => { setLessons(null); setActiveTab('lessons'); }}
              className="rounded-[6px] border border-[#dfe9e2] px-3 py-1.5 text-xs font-bold text-[#617269] hover:border-[#3c8259]"
            >
              Refresh
            </button>
          </div>
          {lessonsLoading ? (
            <p className="text-sm font-semibold text-[#7f9187]">Loading...</p>
          ) : lessons && lessons.length > 0 ? (
            <div className="grid gap-3">
              {lessons.map((lesson) => (
                <div key={lesson.id} className="rounded-[8px] border border-[#dfe9e2] px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-[#17392b]">{lesson.title}</p>
                      <p className="text-xs font-bold text-[#7f9187]">{lesson.agentId}</p>
                    </div>
                    <SeverityBadge severity={lesson.severity} />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-[#617269]">{lesson.observation}</p>
                  {lesson.recommendation ? (
                    <p className="mt-1 text-xs font-semibold text-[#1C7C54]">{lesson.recommendation}</p>
                  ) : null}
                  <p className="mt-2 text-[10px] font-bold text-[#7f9187]">
                    {new Date(lesson.createdAt).toLocaleString()} — {lesson.source}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No lessons yet. Low-scoring runs automatically generate lessons." />
          )}
        </section>
      ) : null}

      {/* Tab: Readiness */}
      {activeTab === 'readiness' ? (
        <section className="grid gap-5">
          <div className="grid gap-3 rounded-[8px] border border-[#dfe9e2] bg-white px-4 py-4 shadow-[0_18px_48px_rgba(15,61,46,0.07)]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-[#17392b]">Fleet Readiness</h2>
              <button
                type="button"
                onClick={() => { setReadiness(null); setActiveTab('readiness'); }}
                className="rounded-[6px] border border-[#dfe9e2] px-3 py-1.5 text-xs font-bold text-[#617269] hover:border-[#3c8259]"
              >
                Refresh
              </button>
            </div>
            {readinessLoading ? (
              <p className="text-sm font-semibold text-[#7f9187]">Loading...</p>
            ) : readiness ? (
              <>
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full border-4 text-2xl font-black"
                    style={{
                      borderColor: readiness.overallReadiness >= 70 ? '#1C7C54' : readiness.overallReadiness >= 40 ? '#d97706' : '#ef4444',
                      color:       readiness.overallReadiness >= 70 ? '#1C7C54' : readiness.overallReadiness >= 40 ? '#d97706' : '#ef4444',
                    }}
                  >
                    {readiness.overallReadiness}%
                  </div>
                  <div>
                    <p className="text-sm font-black text-[#17392b]">Overall Readiness</p>
                    <p className="text-xs font-semibold text-[#7f9187]">
                      {readiness.readyScenarios} of {readiness.totalScenarios} scenarios scored F1 &ge; 0.5
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[#617269]">
                      Scenarios with no runs yet are excluded from this count.
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {Object.entries(readiness.byCategory).map(([cat, { ready, total }]) => (
                    <div key={cat} className="rounded-[8px] bg-[#f4faf6] px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-[#617269]">{cat}</span>
                        <span className="text-sm font-black text-[#17392b]">{Math.round((ready / total) * 100)}%</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#dfe9e2]">
                        <div
                          className="h-full rounded-full bg-[#1C7C54]"
                          style={{ width: `${Math.round((ready / total) * 100)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] font-bold text-[#7f9187]">{ready}/{total} ready</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState message="No readiness data yet. Run scenarios to populate this view." />
            )}
          </div>
        </section>
      ) : null}

      {/* Sandbox metrics (always visible) */}
      <section className="grid gap-3 rounded-[8px] border border-[#dfe9e2] bg-white px-4 py-4 shadow-[0_18px_48px_rgba(15,61,46,0.07)]">
        <h2 className="text-lg font-black text-[#17392b]">Sandbox Metrics</h2>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {metricCards.map(([label, value]) => (
            <div key={label as string} className="flex items-center justify-between rounded-[8px] bg-[#f4faf6] px-3 py-2">
              <span className="text-sm font-bold text-[#617269]">{label}</span>
              <span className="text-lg font-black text-[#17392b]">{loading ? '-' : value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Isolation note */}
      <section className="rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
        <h2 className="font-black">Isolation Rules</h2>
        <p className="mt-1 font-semibold">
          Sandbox rows are written with <code>environment=&quot;sandbox&quot;</code>.
          The arena interceptor captures all proposed actions without dispatching them to Resend, Stripe, or Twilio.
          Production dashboards default to production-only data.
        </p>
      </section>

      {selectedResult ? (
        <ScenarioResultDrawer result={selectedResult} onClose={() => setSelectedResult(null)} />
      ) : null}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

// Required fields every scenario card must render — validated before display.
const REQUIRED_SCENARIO_FIELDS = ['slug', 'title', 'description', 'agentId', 'category', 'difficulty'] as const;

function ScenarioCard({
  scenario,
  busy,
  disabled,
  onRun,
}: {
  scenario: SandboxScenarioTemplate;
  busy: boolean;
  disabled: boolean;
  onRun: (slug: string) => void;
}) {
  // Validate all required fields are present and non-empty.
  const missingFields = REQUIRED_SCENARIO_FIELDS.filter(
    (f) => !scenario[f] || (typeof scenario[f] === 'string' && (scenario[f] as string).trim() === ''),
  );

  if (missingFields.length > 0) {
    return (
      <div className="flex flex-col gap-2 rounded-[8px] border border-red-200 bg-red-50 px-4 py-3">
        <p className="text-xs font-black uppercase tracking-wider text-red-700">Incomplete scenario</p>
        <p className="text-xs font-semibold text-red-600">
          Missing: {missingFields.join(', ')}
        </p>
        <p className="text-[10px] font-bold text-red-500">{scenario.slug || '(no slug)'}</p>
      </div>
    );
  }

  const categoryColour = CATEGORY_COLOURS[scenario.category] ?? 'bg-gray-100 text-gray-700';
  const difficultyColour = DIFFICULTY_COLOURS[scenario.difficulty] ?? 'bg-gray-100 text-gray-700';

  return (
    <div className="flex flex-col gap-3 rounded-[8px] border border-[#dfe9e2] bg-white px-4 py-3 shadow-[0_12px_32px_rgba(15,61,46,0.05)]">
      {/* Badges row */}
      <div className="flex flex-wrap gap-1">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${categoryColour}`}>
          {scenario.category}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${difficultyColour}`}>
          {scenario.difficulty}
        </span>
      </div>
      {/* Title + description */}
      <div>
        <p className="text-sm font-black text-[#17392b]">{scenario.title}</p>
        <p className="mt-0.5 text-xs font-semibold text-[#7f9187]">{scenario.description}</p>
      </div>
      {/* Agent row + Run button — always rendered as a single flex row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-[#617269]">
          Agent: <span className="text-[#17392b]">{scenario.agentId}</span>
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onRun(scenario.slug)}
          className="rounded-[6px] bg-[#1C7C54] px-3 py-1.5 text-xs font-black text-white transition hover:bg-[#17392b] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Running...' : 'Run'}
        </button>
      </div>
    </div>
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

function ArenaActionButton({
  label,
  description,
  busy,
  disabled,
  onClick,
  tone = 'default',
}: {
  label: string;
  description: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
  tone?: 'default' | 'warning';
}) {
  const base = 'rounded-[8px] px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60';
  const styles =
    tone === 'warning'
      ? `${base} border border-amber-300 bg-amber-50 hover:bg-amber-100`
      : `${base} border border-[#dfe9e2] bg-[#f4faf6] hover:border-[#3c8259] hover:bg-white`;

  return (
    <button type="button" disabled={disabled} onClick={onClick} className={styles}>
      <p className="text-sm font-black text-[#17392b]">{busy ? 'Running...' : label}</p>
      <p className="text-xs font-semibold text-[#7f9187]">{description}</p>
    </button>
  );
}

function RunStatusPanel({ status }: { status: RunStatus }) {
  const progress = status.total === 0 ? 0 : Math.round((status.currentIndex / status.total) * 100);
  const elapsed = Math.max(0, Math.round((Date.now() - status.startedAt) / 1000));
  const tone =
    status.status === 'failed' ? 'border-red-200 bg-red-50 text-red-800'
    : status.status === 'complete' ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : 'border-amber-200 bg-amber-50 text-amber-900';

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
      {status.currentScenario ? (
        <p className="mt-2 text-xs font-bold">Current: {status.currentScenario}</p>
      ) : null}
    </section>
  );
}

function LastResultCard({
  result,
  scenario,
  onOpen,
}: {
  result: RunResult;
  scenario: SandboxScenarioTemplate | null;
  onOpen: () => void;
}) {
  const passed = isPass(result);
  const statusColour = passed ? 'text-emerald-700' : 'text-red-700';
  return (
    <section className="rounded-[8px] border border-[#dfe9e2] bg-white px-4 py-4 shadow-[0_12px_32px_rgba(15,61,46,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-black text-[#17392b]">Last Run Result</h3>
          {scenario ? <p className="text-xs font-bold text-[#7f9187]">{scenario.title}</p> : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span className={`text-sm font-black ${statusColour}`}>{passed ? 'PASS' : 'FAIL'}</span>
          <F1Badge f1={result.score.f1Score} />
          {scenario ? (
            <button
              type="button"
              onClick={onOpen}
              className="rounded-[6px] border border-[#dfe9e2] px-3 py-1.5 text-xs font-black text-[#17392b] hover:border-[#3c8259]"
            >
              Details
            </button>
          ) : null}
        </div>
      </div>
      <p className="mt-1 text-xs font-semibold text-[#617269]">{result.summary}</p>
      <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-[#7f9187]">
        <span>LLM calls: {result.llmCalls}</span>
        <span>Cost: {result.costCents}¢</span>
        <span>Duration: {(result.durationMs / 1000).toFixed(1)}s</span>
        <span>Precision: {pct(result.score.precisionScore)}</span>
        <span>Recall: {pct(result.score.recallScore)}</span>
      </div>
      {result.proposedActions.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {result.proposedActions.map((a, i) => (
            <span key={i} className="rounded-full bg-[#f4faf6] px-2 py-0.5 text-[10px] font-black text-[#617269]">
              {a.action_type}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs font-semibold text-[#7f9187]">No actions proposed.</p>
      )}
    </section>
  );
}

function PackResultsTable({
  rows,
  onSelect,
}: {
  rows: PackResult[];
  onSelect: (row: PackResult) => void;
}) {
  const passCount = rows.filter((row) => isPass(row.result)).length;
  const avgF1 = rows.length === 0
    ? 0
    : rows.reduce((sum, row) => sum + row.result.score.f1Score, 0) / rows.length;

  return (
    <section className="grid gap-3 rounded-[8px] border border-[#dfe9e2] bg-white px-4 py-4 shadow-[0_18px_48px_rgba(15,61,46,0.07)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-black text-[#17392b]">Pack Summary</h2>
          <p className="text-sm font-semibold text-[#7f9187]">
            {passCount}/{rows.length} passed · Avg F1 {avgF1.toFixed(2)}
          </p>
        </div>
        <span className="rounded-full bg-[#f4faf6] px-3 py-1 text-xs font-black text-[#617269]">
          {rows.length} result{rows.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="overflow-x-auto">
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
                  <button
                    type="button"
                    onClick={() => onSelect(row)}
                    className="text-left font-black text-[#17392b] hover:text-[#1C7C54]"
                  >
                    {row.scenarioTitle}
                  </button>
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
    </section>
  );
}

function RunHistoryPanel({
  history,
  loading,
  onRefresh,
  onSelect,
}: {
  history: HistoryRow[] | null;
  loading: boolean;
  onRefresh: () => void;
  onSelect: (row: HistoryRow) => void;
}) {
  return (
    <section className="grid gap-3 rounded-[8px] border border-[#dfe9e2] bg-white px-4 py-4 shadow-[0_18px_48px_rgba(15,61,46,0.07)]">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-[#17392b]">Run History</h2>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-[6px] border border-[#dfe9e2] px-3 py-1.5 text-xs font-bold text-[#617269] hover:border-[#3c8259]"
        >
          Refresh
        </button>
      </div>
      {loading ? (
        <p className="text-sm font-semibold text-[#7f9187]">Loading...</p>
      ) : history && history.length > 0 ? (
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
                    <button
                      type="button"
                      onClick={() => onSelect(row)}
                      className="text-left font-black text-[#17392b] hover:text-[#1C7C54]"
                    >
                      {row.scenario.title}
                    </button>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#7f9187]">
                      {row.batchId ? `Batch ${row.batchId.slice(0, 8)}` : row.trigger}
                    </p>
                  </td>
                  <td className="py-2 pr-4 font-bold text-[#617269]">{row.scenario.agentId}</td>
                  <td className="py-2"><PassFailChip passed={row.score ? row.score.f1Score >= 0.5 : row.status === 'complete'} /></td>
                  <td className="py-2 text-right">{row.score ? <F1Badge f1={row.score.f1Score} /> : '—'}</td>
                  <td className="py-2 text-right font-bold text-[#617269]">{row.lessonCount}</td>
                  <td className="py-2 text-xs font-bold text-[#7f9187]">{new Date(row.startedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState message="No run history yet. Run a scenario or pack to create history." />
      )}
    </section>
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
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-[#f4faf6] px-3 py-1.5 text-sm font-black text-[#617269] hover:bg-[#dfe9e2]"
          >
            Close
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniMetric label="Result" value={isPass(result.result) ? 'PASS' : 'FAIL'} />
          <MiniMetric label="Precision" value={pct(result.result.score.precisionScore)} />
          <MiniMetric label="Recall" value={pct(result.result.score.recallScore)} />
          <MiniMetric label="F1" value={result.result.score.f1Score.toFixed(2)} />
        </div>

        <div className="mt-4 grid gap-3">
          <ActionComparePanel
            title="Expected Actions"
            actions={result.expectedActionTypes}
          />
          <ActionComparePanel
            title="Actual Actions"
            actions={actualActionTypes}
            expectedSet={expectedSet}
          />
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

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] bg-[#f4faf6] px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-wider text-[#7f9187]">{label}</p>
      <p className="text-lg font-black text-[#17392b]">{value}</p>
    </div>
  );
}

function ActionComparePanel({
  title,
  actions,
  expectedSet,
}: {
  title: string;
  actions: string[];
  expectedSet?: Set<string>;
}) {
  return (
    <section className="rounded-[8px] border border-[#dfe9e2] px-4 py-3">
      <h3 className="text-sm font-black text-[#17392b]">{title}</h3>
      {actions.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {actions.map((action, index) => {
            const matched = expectedSet ? expectedSet.has(action) : true;
            return (
              <span
                key={`${action}-${index}`}
                className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                  matched ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                }`}
              >
                {action}
              </span>
            );
          })}
        </div>
      ) : (
        <p className="mt-2 text-sm font-semibold text-[#7f9187]">None.</p>
      )}
    </section>
  );
}

function F1Badge({ f1 }: { f1: number }) {
  const colour =
    f1 >= 0.7 ? 'bg-emerald-100 text-emerald-800' :
    f1 >= 0.4 ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800';
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-black ${colour}`}>
      F1 {f1.toFixed(2)}
    </span>
  );
}

function PassFailChip({ passed }: { passed: boolean }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
      passed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
    }`}>
      {passed ? 'Pass' : 'Fail'}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colour =
    severity === 'critical' ? 'bg-red-100 text-red-800' :
    severity === 'warning'  ? 'bg-yellow-100 text-yellow-800' :
                              'bg-blue-100 text-blue-800';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${colour}`}>
      {severity}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[8px] bg-[#f4faf6] px-4 py-6 text-center">
      <p className="text-sm font-semibold text-[#7f9187]">{message}</p>
    </div>
  );
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function isPass(result: RunResult): boolean {
  return result.status !== 'failed' && result.score.f1Score >= 0.5;
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

// Simplified promotion status from F1 only (leaderboard has no root-cause context).
type LeaderboardStatus = 'promote' | 'healthy' | 'monitor' | 'no data';

function leaderboardStatus(row: LeaderboardRow): LeaderboardStatus {
  if (row.scenarioCount === 0) return 'no data';
  if (row.avgF1 >= 0.95) return 'promote';
  if (row.avgF1 >= 0.80) return 'healthy';
  return 'monitor';
}

const LEADERBOARD_STATUS_STYLES: Record<LeaderboardStatus, string> = {
  promote:   'bg-[#e5f4ec] text-[#1C7C54]',
  healthy:   'bg-[#e8f4fb] text-[#1a5f8a]',
  monitor:   'bg-[#fff6e0] text-[#9a6700]',
  'no data': 'bg-[#eef2f0] text-[#617269]',
};

const LEADERBOARD_STATUS_LABELS: Record<LeaderboardStatus, string> = {
  promote:   '★ Promote',
  healthy:   '✓ Healthy',
  monitor:   '◎ Monitor',
  'no data': '— No data',
};

function LeaderboardStatusChip({ row }: { row: LeaderboardRow }) {
  const status = leaderboardStatus(row);
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${LEADERBOARD_STATUS_STYLES[status]}`}
    >
      {LEADERBOARD_STATUS_LABELS[status]}
    </span>
  );
}
