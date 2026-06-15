/**
 * Improvement Proposal Engine — Arena Phase 2
 *
 * Converts root-cause groups from sandbox_lessons_learned into structured,
 * actionable improvement proposals. Also computes per-agent promotion
 * recommendations based on health snapshots and root-cause status.
 *
 * Read-only: no code changes, no writes to agent config, no promotions.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type ProposalSeverity = 'critical' | 'warning' | 'info';

export interface ImprovementProposal {
  id: string;
  title: string;
  affectedAgent: string;
  severity: ProposalSeverity;
  confidence: number;         // 0–100
  likelyRootCause: string;
  suggestedFix: string;
  expectedF1Impact: string;   // e.g. "0.00 → 1.00"
  suggestedFiles: string[];
  suggestedTests: string[];
  rollbackPlan: string;
  sourceRootCauseKey: string;
  lessonCount: number;
  createdAt: string;
}

export type PromotionStatus = 'promote' | 'healthy' | 'monitor' | 'investigate' | 'blocked';

export interface PromotionRecommendation {
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
}

// Input types that mirror the shapes returned by the health API.
export type RootCauseInput = {
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

export type AgentHealthInput = {
  agent_id: string;
  avg_f1: number | null;
  baseline_f1: number | null;
  delta_f1: number | null;
  trend: 'improving' | 'stable' | 'degrading';
};

// ── File map — known agent source locations ────────────────────────────────

const AGENT_FILE_MAP: Record<string, string> = {
  'quote-triage': 'src/lib/agents/agents/quote-triage.ts',
  'customer-reply': 'src/lib/agents/agents/customer-reply.ts',
  'reviews': 'src/lib/agents/agents/reviews.ts',
  'lapsed-win-back': 'src/lib/agents/agents/lapsed-win-back.ts',
  'scheduling': 'src/lib/agents/agents/scheduling.ts',
  'cash-flow-forecaster': 'src/lib/agents/agents/cash-flow-forecaster.ts',
  'ndis-compliance': 'src/lib/agents/agents/ndis-compliance.ts',
  'ndis-plan-matcher': 'src/lib/agents/agents/ndis-plan-matcher.ts',
  'whs-safety-reminder': 'src/lib/agents/agents/whs-safety-reminder.ts',
  'lead-scorer': 'src/lib/agents/agents/lead-scorer.ts',
  'seo-meta': 'src/lib/agents/agents/seo-meta.ts',
  'conversion-funnel': 'src/lib/agents/agents/conversion-funnel.ts',
  'ab-test-architect': 'src/lib/agents/agents/ab-test-architect.ts',
  'reconciliation': 'src/lib/agents/agents/reconciliation.ts',
  'stripe-dispute-manager': 'src/lib/agents/agents/stripe-dispute-manager.ts',
  'photo-qa': 'src/lib/agents/agents/photo-qa.ts',
  'internal-qa': 'src/lib/agents/agents/internal-qa.ts',
  'applicant-screener': 'src/lib/agents/agents/applicant-screener.ts',
  'price-optimizer': 'src/lib/agents/agents/price-optimizer.ts',
  'cfo-agent': 'src/lib/agents/agents/cfo-agent.ts',
};

const SANDBOX_INPUT_FILE = 'src/lib/agents/sandbox-input.ts';

function agentFile(agentId: string): string {
  return AGENT_FILE_MAP[agentId] ?? `src/lib/agents/agents/${agentId}.ts`;
}

function fmtF1(v: number | null): string {
  return v === null ? 'N/A' : Number(v).toFixed(2);
}

// ── Proposal generation ────────────────────────────────────────────────────

export function buildProposalFromRootCause(
  rc: RootCauseInput,
  health: AgentHealthInput | undefined,
): ImprovementProposal {
  const currentF1 = health?.avg_f1 !== null && health?.avg_f1 !== undefined
    ? Number(health.avg_f1)
    : 0;
  const id = `proposal::${rc.agentId}::${rc.key}`;

  if (rc.failureType === 'zero_action') {
    return {
      id,
      title: `Add sandbox input detection to ${rc.agentId}`,
      affectedAgent: rc.agentId,
      severity: rc.severity,
      confidence: 90,
      likelyRootCause:
        'Agent relies on a DB query to find work items, but sandbox mode has no real DB rows. ' +
        'Without sandbox input injection, the agent exits silently with zero proposed actions.',
      suggestedFix:
        `1. Add a sandbox input detector in the agent's run() function that checks ctx.input before falling through to the DB query.\n` +
        `2. When ctx.input contains the scenario's signal fields, build a synthetic work item from ctx.input.\n` +
        `3. Propose a deterministic flag_for_review or send_email action so the arena scores > 0.\n` +
        `See src/lib/agents/agents/quote-triage.ts for a reference implementation of this pattern.`,
      expectedF1Impact: `${fmtF1(currentF1)} → 1.00`,
      suggestedFiles: [agentFile(rc.agentId), SANDBOX_INPUT_FILE],
      suggestedTests: ['tests/lib/agent-sandbox-fallbacks.test.ts'],
      rollbackPlan:
        'Revert the ctx.input guard in the agent run() function. ' +
        'No production behaviour changes — sandbox detection only fires when ctx.input is populated by the arena interceptor.',
      sourceRootCauseKey: rc.key,
      lessonCount: rc.lessonCount,
      createdAt: rc.latestAt,
    };
  }

  // wrong_actions
  return {
    id,
    title: `Align ${rc.agentId} output to expected action types`,
    affectedAgent: rc.agentId,
    severity: rc.severity,
    confidence: 75,
    likelyRootCause:
      "Agent proposes action types that differ from the arena's expected set. " +
      'This may mean the system prompt is too broad, the agent proposes extra actions not in expectedActionTypes, ' +
      'or the action_type string does not exactly match the expected value.',
    suggestedFix:
      `1. Review the failing scenario's expectedActionTypes in src/lib/sandbox/scenarios.ts.\n` +
      `2. Run the scenario in the UI and check "Last Result" → "Proposed Actions" to see what the agent actually returns.\n` +
      `3. Update the agent system prompt to stay within the expected action set, or add the extra action to expectedActionTypes if it is correct behaviour.`,
    expectedF1Impact: `${fmtF1(currentF1)} → ~0.80`,
    suggestedFiles: [agentFile(rc.agentId), 'src/lib/sandbox/scenarios.ts'],
    suggestedTests: [
      'tests/lib/quote-triage-arena.test.ts',
      'tests/lib/agent-sandbox-fallbacks.test.ts',
    ],
    rollbackPlan:
      'Revert system prompt changes and re-run the full pack to confirm no regressions. ' +
      'The arena will catch any new regressions in the next nightly full pack.',
    sourceRootCauseKey: rc.key,
    lessonCount: rc.lessonCount,
    createdAt: rc.latestAt,
  };
}

export function buildProposals(
  rootCauses: RootCauseInput[],
  healthByAgent: Map<string, AgentHealthInput>,
): ImprovementProposal[] {
  return rootCauses.map((rc) =>
    buildProposalFromRootCause(rc, healthByAgent.get(rc.agentId)),
  );
}

// ── Promotion recommendations ──────────────────────────────────────────────

export function computePromotionRecommendation(
  agentId: string,
  health: AgentHealthInput | undefined,
  activeRootCauses: RootCauseInput[],
  lessonCount: number,
): PromotionRecommendation {
  const currentF1 =
    health?.avg_f1 !== null && health?.avg_f1 !== undefined ? Number(health.avg_f1) : null;
  const baselineF1 =
    health?.baseline_f1 !== null && health?.baseline_f1 !== undefined
      ? Number(health.baseline_f1)
      : null;
  const trend = health?.trend ?? 'stable';
  const hasRegression = trend === 'degrading';
  const agentRootCauses = activeRootCauses.filter((rc) => rc.agentId === agentId);
  const hasActiveRootCauses = agentRootCauses.length > 0;
  const rootCauseCount = agentRootCauses.length;

  let status: PromotionStatus;
  let rationale: string;

  if (hasRegression) {
    status = 'blocked';
    rationale = `F1 is degrading vs baseline (${fmtF1(currentF1)} vs ${fmtF1(baselineF1)}). Resolve the regression before promoting.`;
  } else if (hasActiveRootCauses) {
    status = 'investigate';
    rationale = `${rootCauseCount} active root cause${rootCauseCount !== 1 ? 's' : ''} require attention before this agent can advance.`;
  } else if (currentF1 === null) {
    status = 'monitor';
    rationale = 'No arena runs recorded yet. Run arena scenarios to establish a baseline.';
  } else if (currentF1 >= 0.95) {
    status = 'promote';
    rationale = `F1 ${fmtF1(currentF1)} ≥ 0.95, no regressions, no active root causes. Ready for production promotion.`;
  } else if (currentF1 >= 0.80 && (trend === 'improving' || trend === 'stable')) {
    status = 'healthy';
    rationale = `F1 ${fmtF1(currentF1)} ≥ 0.80, trend is ${trend}. Continue monitoring.`;
  } else if (trend === 'improving') {
    status = 'monitor';
    rationale = `F1 improving (${fmtF1(currentF1)}) but below 0.80 target. Keep running scenarios.`;
  } else {
    status = 'monitor';
    rationale = `F1 ${fmtF1(currentF1)} is below the 0.80 target. More training runs needed.`;
  }

  return {
    agentId,
    status,
    currentF1,
    baselineF1,
    trend,
    hasRegression,
    hasActiveRootCauses,
    lessonCount,
    rootCauseCount,
    rationale,
  };
}

/**
 * Compute recommendations for every agent that has health data.
 * Agents with active root causes get Investigate/Blocked; clean agents with
 * high F1 get Promote.
 */
export function buildRecommendations(
  healthRows: AgentHealthInput[],
  activeRootCauses: RootCauseInput[],
  lessonsByAgent: Map<string, number>,
): PromotionRecommendation[] {
  return healthRows.map((h) =>
    computePromotionRecommendation(
      h.agent_id,
      h,
      activeRootCauses,
      lessonsByAgent.get(h.agent_id) ?? 0,
    ),
  );
}
