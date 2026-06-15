import type { SandboxScenarioTemplate } from '@/lib/sandbox/scenarios';
import type { AgentRow, FleetBucket, HealthData, ImprovementProposal, Lesson, OperatorPromotionStatus, PromotionStatus, RootCause } from './types';
import { fmtF1 } from './format';

export function buildAgentRows(health: HealthData | null, lessons: Lesson[], scenarios: SandboxScenarioTemplate[]): AgentRow[] {
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

export function bucketForAgent(agent: AgentRow): FleetBucket {
  if (agent.status === 'Promote') return 'promote';
  if (agent.status === 'Blocked') return 'blocked';
  if (agent.status === 'Investigate') return 'investigate';
  return 'monitor';
}

export function buildRequiredActions(health: HealthData | null, agents: AgentRow[], activeRootCauses: RootCause[], proposals: ImprovementProposal[]) {
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

export function promotionReason(agent: AgentRow): string {
  if (agent.status === 'Promote') return 'Passing, stable, and no active blockers.';
  if (agent.blockers.length > 0) return agent.blockers[0];
  if (agent.f1 === null || agent.passRate === null) return 'Not enough history.';
  if (agent.passRate < 0.8) return 'Insufficient run volume or pass rate.';
  if (agent.f1 < 0.8) return 'Confidence too low.';
  if (agent.trend === 'degrading') return 'Awaiting validation after regression.';
  return 'Awaiting validation.';
}

export function trendLabel(trend: AgentRow['trend']): string {
  return trend === 'improving' ? 'improving vs 7d baseline' : trend === 'degrading' ? 'worsening vs 7d baseline' : 'unchanged vs 7d baseline';
}
