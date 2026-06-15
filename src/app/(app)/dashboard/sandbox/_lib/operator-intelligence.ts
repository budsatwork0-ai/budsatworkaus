import { SANDBOX_SCENARIOS } from '@/lib/sandbox/scenarios';
import type { AgentRow, FailingScenario, HealthData, HealthRow, HistoryRow, Lesson, OperatorIntelligence, ReadinessData, RootCause, TrendDirection } from './types';
import { titleCase } from './format';

export function buildOperatorIntelligence({
  agents,
  health,
  history,
  lessons,
  readiness,
  activeRootCauses,
  resolvedRootCauses,
  fleetHealth,
}: {
  agents: AgentRow[];
  health: HealthData | null;
  history: HistoryRow[];
  lessons: Lesson[];
  readiness: ReadinessData | null;
  activeRootCauses: RootCause[];
  resolvedRootCauses: RootCause[];
  fleetHealth: 'Healthy' | 'Investigate' | 'Blocked';
}): OperatorIntelligence {
  const totalAgents = Math.max(agents.length, 1);
  const passingAgents = agents.filter((agent) => agent.passRate !== null && agent.passRate >= 0.5).length;
  const totalScenarios = readiness?.totalScenarios ?? SANDBOX_SCENARIOS.length;
  const passingScenarios = readiness?.readyScenarios ?? latestScenarioPassCount(history);
  const promotionReady = agents.filter((agent) => agent.status === 'Promote').length;
  const regressions = health?.regressions.length ?? 0;
  const passingAgentComponent = (passingAgents / totalAgents) * 35;
  const passingScenarioComponent = (passingScenarios / Math.max(totalScenarios, 1)) * 30;
  const promotionComponent = Math.min(15, (promotionReady / totalAgents) * 20);
  const rootCausePenalty = Math.min(20, activeRootCauses.length * 5);
  const regressionPenalty = Math.min(15, regressions * 5);
  const fleetScore = clampScore(Math.round(passingAgentComponent + passingScenarioComponent + promotionComponent + 20 - rootCausePenalty - regressionPenalty));

  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const lastDayStart = now - oneDay;
  const previousDayStart = now - (oneDay * 2);
  const recentLessons = lessons.filter((lesson) => inWindow(lesson.createdAt, lastDayStart, now)).length;
  const previousLessons = lessons.filter((lesson) => inWindow(lesson.createdAt, previousDayStart, lastDayStart)).length;
  const recentRootCauseEvents = [...activeRootCauses, ...resolvedRootCauses].filter((rc) => inWindow(rc.latestAt, lastDayStart, now)).length;
  const previousRootCauseEvents = [...activeRootCauses, ...resolvedRootCauses].filter((rc) => inWindow(rc.latestAt, previousDayStart, lastDayStart)).length;
  const recentRuns = history.filter((row) => inWindow(row.startedAt, lastDayStart, now));
  const previousRuns = history.filter((row) => inWindow(row.startedAt, previousDayStart, lastDayStart));
  const recentPassRate = runPassRate(recentRuns);
  const previousPassRate = runPassRate(previousRuns);
  const latestCategoryGains = categoryF1Gains(recentRuns, previousRuns);

  const rootCausesTrend = activeRootCauses.length === 0
    ? 'improving'
    : trendFromCounts(recentRootCauseEvents, previousRootCauseEvents, true);
  const lessonsTrend = trendFromCounts(recentLessons, previousLessons, false);
  const passingScenariosTrend = previousPassRate === null || recentPassRate === null
    ? (regressions > 0 ? 'worsening' : 'unchanged')
    : trendFromValues(recentPassRate, previousPassRate, false);
  const readyToPromoteTrend = agents.some((agent) => agent.status === 'Promote' && agent.trend === 'improving')
    ? 'improving'
    : agents.some((agent) => agent.status === 'Promote' && agent.trend === 'degrading')
      ? 'worsening'
      : 'unchanged';
  const fleetScoreTrend = fleetHealth === 'Healthy' && regressions === 0 && activeRootCauses.length === 0
    ? 'improving'
    : regressions > 0 || activeRootCauses.length > previousRootCauseEvents
      ? 'worsening'
      : 'unchanged';

  const healthyDays = estimateHealthyDays(activeRootCauses, health?.failingScenarios ?? [], health?.regressions ?? []);
  const recentChanges = [
    changeLine(promotionReady, 0, 'promotable agents', 'now'),
    changeLine(activeRootCauses.length, previousRootCauseEvents, 'root causes'),
    changeLine(recentLessons, previousLessons, 'lessons generated'),
    ...latestCategoryGains,
  ].filter(Boolean) as string[];

  return {
    fleetScore,
    fleetScoreTrend,
    passingScenariosTrend,
    readyToPromoteTrend,
    rootCausesTrend,
    lessonsTrend,
    executiveSummary: buildExecutiveSummary({
      fleetHealth,
      passingScenarios,
      totalScenarios,
      activeRootCauses: activeRootCauses.length,
      promotionReady,
      regressions,
      failingScenarios: health?.failingScenarios.length ?? 0,
      recentRootCauseEvents,
    }),
    recentChanges,
    healthyDays,
  };
}

function buildExecutiveSummary({
  fleetHealth,
  passingScenarios,
  totalScenarios,
  activeRootCauses,
  promotionReady,
  regressions,
  failingScenarios,
  recentRootCauseEvents,
}: {
  fleetHealth: 'Healthy' | 'Investigate' | 'Blocked';
  passingScenarios: number;
  totalScenarios: number;
  activeRootCauses: number;
  promotionReady: number;
  regressions: number;
  failingScenarios: number;
  recentRootCauseEvents: number;
}): string {
  if (fleetHealth === 'Healthy') {
    return `All ${passingScenarios}/${totalScenarios} scenarios are passing. No active root causes remain. ${promotionReady} agent${promotionReady === 1 ? ' is' : 's are'} promotable. No operator action required.`;
  }
  const attention = regressions > 0
    ? `${regressions} regression${regressions === 1 ? '' : 's'} detected`
    : `${activeRootCauses} active root cause${activeRootCauses === 1 ? '' : 's'} detected`;
  const failing = failingScenarios > 0 ? `${failingScenarios} scenario${failingScenarios === 1 ? ' is' : 's are'} failing.` : 'Scenario pass state is otherwise stable.';
  const recent = recentRootCauseEvents > 0 ? `${recentRootCauseEvents} root cause event${recentRootCauseEvents === 1 ? '' : 's'} appeared in the last 24 hours.` : 'No new root cause events appeared in the last 24 hours.';
  return `Attention required. ${attention}. ${failing} ${recent}`;
}

function trendFromCounts(current: number, previous: number, lowerIsBetter: boolean): TrendDirection {
  if (current === previous) return 'unchanged';
  const improved = lowerIsBetter ? current < previous : current > previous;
  return improved ? 'improving' : 'worsening';
}

function trendFromValues(current: number, previous: number, lowerIsBetter: boolean): TrendDirection {
  if (Math.abs(current - previous) < 0.01) return 'unchanged';
  const improved = lowerIsBetter ? current < previous : current > previous;
  return improved ? 'improving' : 'worsening';
}

function inWindow(value: string, start: number, end: number): boolean {
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= start && time < end;
}

function runPassRate(rows: HistoryRow[]): number | null {
  if (rows.length === 0) return null;
  return rows.filter((row) => row.score ? row.score.f1Score >= 0.5 : row.status === 'complete').length / rows.length;
}

function latestScenarioPassCount(history: HistoryRow[]): number {
  const latest = new Map<string, HistoryRow>();
  history.forEach((row) => {
    const key = row.scenario.slug ?? row.scenario.id;
    const existing = latest.get(key);
    if (!existing || new Date(row.startedAt).getTime() > new Date(existing.startedAt).getTime()) latest.set(key, row);
  });
  return [...latest.values()].filter((row) => row.score && row.score.f1Score >= 0.5).length;
}

function categoryF1Gains(recentRuns: HistoryRow[], previousRuns: HistoryRow[]): string[] {
  const categories = new Set([...recentRuns, ...previousRuns].map((row) => row.scenario.category));
  return [...categories].flatMap((category) => {
    const recent = averageF1(recentRuns.filter((row) => row.scenario.category === category));
    const previous = averageF1(previousRuns.filter((row) => row.scenario.category === category));
    if (recent === null || previous === null || Math.abs(recent - previous) < 0.05) return [];
    const verb = recent > previous ? 'improved' : 'fell';
    return [`${titleCase(category)} F1 ${verb} from ${previous.toFixed(2)} → ${recent.toFixed(2)}`];
  }).slice(0, 3);
}

function averageF1(rows: HistoryRow[]): number | null {
  const scored = rows.map((row) => row.score?.f1Score).filter((score): score is number => typeof score === 'number');
  if (scored.length === 0) return null;
  return scored.reduce((sum, score) => sum + score, 0) / scored.length;
}

function changeLine(current: number, previous: number, label: string, suffix = 'since yesterday'): string | null {
  if (suffix === 'now') return `${current} ${label} now`;
  const delta = current - previous;
  if (delta === 0) return `0 ${label} changed ${suffix}`;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta} ${label} ${suffix}`;
}

function estimateHealthyDays(activeRootCauses: RootCause[], failingScenarios: FailingScenario[], regressions: HealthRow[]): number {
  if (activeRootCauses.length > 0 || failingScenarios.length > 0 || regressions.length > 0) return 0;
  const latestIssue = [
    ...activeRootCauses.map((rc) => rc.latestAt),
    ...failingScenarios.map((scenario) => scenario.scoredAt),
    ...regressions.map((regression) => regression.computed_at),
  ]
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];
  if (!latestIssue) return 7;
  return Math.max(1, Math.floor((Date.now() - latestIssue) / (24 * 60 * 60 * 1000)));
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}
