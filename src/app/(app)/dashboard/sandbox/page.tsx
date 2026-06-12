'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SANDBOX_SCENARIOS } from '@/lib/sandbox/scenarios';
import type { ScenarioCategory, SandboxScenarioTemplate } from '@/lib/sandbox/scenarios';

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

type ArenaTab = 'actions' | 'leaderboard' | 'lessons' | 'readiness';

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
  status: 'completed' | 'failed';
  summary: string;
  proposedActions: Array<{ action_type: string; preview: string }>;
  llmCalls: number;
  costCents: number;
  durationMs: number;
  score: { precisionScore: number; recallScore: number; f1Score: number; hit: boolean };
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
  const [selectedCategory, setSelectedCategory] = useState<ScenarioCategory | 'all'>('all');

  // Data tabs
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[] | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [readiness, setReadiness] = useState<ReadinessData | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);

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
  }, [activeTab, leaderboard, lessons, readiness]);

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

  async function runScenario(slug: string) {
    setBusySlug(slug);
    setError(null);
    setNotice(null);
    setLastResult(null);
    try {
      const res = await fetch('/api/sandbox/run-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Scenario run failed');
      setLastResult(payload as RunResult);
      setNotice(`Scenario completed — F1: ${payload.score?.f1Score ?? 'n/a'}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusySlug(null);
    }
  }

  async function runPack(category: ScenarioCategory | 'stress') {
    setBusyPack(category);
    setError(null);
    setNotice(null);
    setLastResult(null);
    try {
      const body =
        category === 'stress'
          ? { slugs: ['stress-agent-cascade'] }
          : { category };
      const res = await fetch('/api/sandbox/run-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Pack run failed');
      setNotice(`Pack completed — ${payload.count} scenario${payload.count !== 1 ? 's' : ''} run.`);
      // Refresh leaderboard if it was already loaded
      if (leaderboard !== null) setLeaderboard(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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

      {/* Last result inline */}
      {lastResult ? (
        <LastResultCard result={lastResult} />
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
        {(['actions', 'leaderboard', 'lessons', 'readiness'] as ArenaTab[]).map((tab) => (
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
        </section>
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

function LastResultCard({ result }: { result: RunResult }) {
  const statusColour = result.status === 'completed' ? 'text-emerald-700' : 'text-red-700';
  return (
    <section className="rounded-[8px] border border-[#dfe9e2] bg-white px-4 py-4 shadow-[0_12px_32px_rgba(15,61,46,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-black text-[#17392b]">Last Run Result</h3>
        <div className="flex gap-3">
          <span className={`text-sm font-black ${statusColour}`}>{result.status.toUpperCase()}</span>
          <F1Badge f1={result.score.f1Score} />
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
