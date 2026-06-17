/**
 * Agent Workshop data layer.
 *
 * Builds Workshop mode state entirely from existing Sandbox signals —
 * health, readiness, integrity reports, agent rows, and lessons.
 * No new APIs, no DB tables, no new scoring systems.
 */
import type {
  ActiveAgentProgress,
  AgentIntegrityReport,
  AgentRow,
  HealthData,
  Lesson,
  RootCause,
  WorkshopCertificationStatus,
  WorkshopQueueItem,
  WorkshopQueueStatus,
  WorkshopState,
} from './types';

// ── Queue definition ────────────────────────────────────────────────────────

/**
 * Ordered list of agent IDs to certify in the Workshop.
 * Position in the array = priority (index 0 = highest).
 */
export const WORKSHOP_QUEUE_DEFAULT: ReadonlyArray<string> = [
  'quote-triage',
  'customer-reply',
  'reviews',
  'scheduling',
  'ndis-compliance',
  'reconciliation',
  'bud',
] as const;

// ── Persistence ─────────────────────────────────────────────────────────────

/** Shape stored in localStorage under STORAGE_KEY. */
export type PersistedWorkshopQueue = {
  version: 1;
  /** Which agent the operator is currently focused on. */
  activeAgentId: string;
  /**
   * Operator-driven status overrides (e.g. 'backlog', 'certified').
   * Computed certificationStatus always supersedes 'certified' here —
   * this lets operators move items to backlog without losing computed state.
   */
  statusOverrides: Record<string, WorkshopQueueStatus>;
  /**
   * Optional drag-reordered agent ID list. When present, overrides
   * WORKSHOP_QUEUE_DEFAULT order. Only non-certified agents are tracked
   * here; certified agents always sort to the bottom at render time.
   */
  customOrder?: string[];
};

const STORAGE_KEY = 'workshopQueue';

function safeLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Read persisted Workshop queue from localStorage.
 * Returns null when running server-side, when the key is absent,
 * or when the stored value is malformed.
 */
export function readWorkshopQueue(): PersistedWorkshopQueue | null {
  const storage = safeLocalStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      (parsed as Record<string, unknown>).version !== 1
    ) {
      return null;
    }
    return parsed as PersistedWorkshopQueue;
  } catch {
    return null;
  }
}

/**
 * Persist Workshop queue state to localStorage.
 * Silently no-ops server-side or when storage is unavailable.
 */
export function writeWorkshopQueue(data: PersistedWorkshopQueue): void {
  const storage = safeLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Quota exceeded or private browsing — fail silently.
  }
}

// ── Certification derivation ────────────────────────────────────────────────

/**
 * Map existing Sandbox signals onto a certification status.
 *
 * certified  — integrity gate passed, promotion recommendation is positive,
 *              no active root causes, no critical open lessons.
 * blocked    — unsafe_to_promote integrity, Blocked promotion status,
 *              or a critical active root cause.
 * in_progress — everything else.
 */
export function deriveCertificationStatus(params: {
  agentId: string;
  integrityReport: AgentIntegrityReport | null;
  agentRow: AgentRow | null;
  agentLessons: Lesson[];
  agentActiveRootCauses: RootCause[];
}): WorkshopCertificationStatus {
  const { integrityReport, agentRow, agentLessons, agentActiveRootCauses } = params;

  const integrityStatus = integrityReport?.integrityStatus ?? null;
  const promotionStatus = agentRow?.status ?? null;

  // Hard block: any of these signals means work is required before certification.
  if (
    integrityStatus === 'unsafe_to_promote' ||
    promotionStatus === 'Blocked' ||
    agentActiveRootCauses.some((rc) => rc.severity === 'critical')
  ) {
    return 'blocked';
  }

  // Certified: every positive gate must pass simultaneously.
  const isReadyToPromote = integrityStatus === 'ready_to_promote';
  const isPromotable = promotionStatus === 'Promote';
  const noCriticalLessons = !agentLessons.some((l) => l.severity === 'critical');
  const noActiveRootCauses = agentActiveRootCauses.length === 0;

  if (isReadyToPromote && isPromotable && noCriticalLessons && noActiveRootCauses) {
    return 'certified';
  }

  return 'in_progress';
}

// ── Active agent progress ───────────────────────────────────────────────────

/**
 * Derive per-metric progress for the currently active Workshop agent.
 * All values come from existing Sandbox data — no new scoring.
 */
export function deriveActiveAgentProgress(params: {
  agentId: string;
  health: HealthData | null;
  lessons: Lesson[];
  integrityReport: AgentIntegrityReport | null;
  agentRow: AgentRow | null;
}): ActiveAgentProgress {
  const { agentId, health, lessons, integrityReport, agentRow } = params;

  const activeRootCauses = (
    health?.activeRootCauses ?? health?.rootCauses ?? []
  ).filter((rc) => rc.agentId === agentId);

  const agentLessons = lessons.filter((l) => l.agentId === agentId);

  // Lessons whose IDs appear in a resolved root cause are considered closed.
  const resolvedLessonIds = new Set(
    (health?.resolvedRootCauses ?? []).flatMap((rc) => rc.lessonIds),
  );
  const openLessons = agentLessons.filter((l) => !resolvedLessonIds.has(l.id)).length;

  const readinessPercentage = integrityReport?.integrityScore ?? 0;
  const passRate = agentRow?.passRate ?? null;
  const blockerCount = agentRow?.blockers.length ?? 0;
  const openRootCauses = activeRootCauses.length;

  return {
    readinessPercentage,
    passRate,
    blockerCount,
    openLessons,
    openRootCauses,
    nextAction: deriveNextAction({ integrityReport, agentRow, openRootCauses, openLessons }),
    estimatedWork: deriveEstimatedWork({
      blockerCount,
      openRootCauses,
      openLessons,
      integrityReport,
    }),
  };
}

function deriveNextAction(params: {
  integrityReport: AgentIntegrityReport | null;
  agentRow: AgentRow | null;
  openRootCauses: number;
  openLessons: number;
}): string {
  const { integrityReport, agentRow, openRootCauses, openLessons } = params;

  // Critical integration gap — must be wired before scenarios have meaning.
  const hasCriticalIntegration = integrityReport?.repairPlan.missingIntegrations.some(
    (i) => i.severity === 'critical',
  );
  if (hasCriticalIntegration) return 'Wire critical integrations before running scenarios.';

  // Failing scenarios are the most actionable concrete signal.
  const failingCount = integrityReport?.repairPlan.failingScenarios.length ?? 0;
  if (failingCount > 0) {
    return `Fix ${failingCount} failing scenario${failingCount === 1 ? '' : 's'} then retest.`;
  }

  // Missing fixtures block meaningful scenario runs.
  const missingFixtures = integrityReport?.repairPlan.missingFixtures.length ?? 0;
  if (missingFixtures > 0) return 'Add missing sandbox fixtures before running scenarios.';

  // Active root causes indicate known systemic failures.
  if (openRootCauses > 0) {
    return `Resolve ${openRootCauses} active root cause${openRootCauses === 1 ? '' : 's'}.`;
  }

  // Open lessons indicate knowledge that hasn't been acted on.
  if (openLessons > 0) {
    return `Review ${openLessons} open lesson${openLessons === 1 ? '' : 's'}.`;
  }

  // Low pass rate — needs more scenario runs.
  if (agentRow?.passRate !== null && agentRow?.passRate !== undefined && agentRow.passRate < 0.8) {
    return 'Run full scenario pack to improve pass rate.';
  }

  // Agent is in good shape — prompt for certification.
  return 'Run full scenario pack and mark certified if all pass.';
}

function deriveEstimatedWork(params: {
  blockerCount: number;
  openRootCauses: number;
  openLessons: number;
  integrityReport: AgentIntegrityReport | null;
}): string {
  const { blockerCount, openRootCauses, openLessons, integrityReport } = params;

  const missingIntegrations = integrityReport?.repairPlan.missingIntegrations.length ?? 0;
  const missingFixtures = integrityReport?.repairPlan.missingFixtures.length ?? 0;
  const coverageGaps = integrityReport?.repairPlan.coverageGaps.length ?? 0;

  const totalOpenItems =
    blockerCount + openRootCauses + openLessons + missingIntegrations + missingFixtures + coverageGaps;

  if (totalOpenItems === 0) return 'Ready to certify.';
  if (totalOpenItems <= 2) return '1–2 hours.';
  if (totalOpenItems <= 5) return 'Half a day.';
  if (totalOpenItems <= 10) return '1–2 days.';
  return 'Multiple sessions.';
}

// ── Workshop state builder ──────────────────────────────────────────────────

/**
 * Build the full Workshop state from existing Sandbox page data.
 *
 * Call once per page load / data refresh — this is a pure derivation,
 * not an effect or side-effect.
 */
export function buildWorkshopState(params: {
  persistedQueue: PersistedWorkshopQueue | null;
  health: HealthData | null;
  lessons: Lesson[];
  integrityReports: AgentIntegrityReport[];
  agentRows: AgentRow[];
}): WorkshopState {
  const { persistedQueue, health, lessons, integrityReports, agentRows } = params;

  const activeAgentId =
    persistedQueue?.activeAgentId ?? (WORKSHOP_QUEUE_DEFAULT[0] as string);
  const statusOverrides: Record<string, WorkshopQueueStatus> =
    persistedQueue?.statusOverrides ?? {};

  // Use persisted custom order when present, falling back to the default.
  const effectiveOrder: ReadonlyArray<string> =
    persistedQueue?.customOrder ?? WORKSHOP_QUEUE_DEFAULT;

  const reportByAgent = new Map(integrityReports.map((r) => [r.agentId, r]));
  const rowByAgent = new Map(agentRows.map((r) => [r.agentId, r]));
  const activeRootCauses: RootCause[] = health?.activeRootCauses ?? health?.rootCauses ?? [];

  const queue: WorkshopQueueItem[] = effectiveOrder.map((agentId, index) => {
    const integrityReport = reportByAgent.get(agentId) ?? null;
    const agentRow = rowByAgent.get(agentId) ?? null;
    const agentActiveRootCauses = activeRootCauses.filter((rc) => rc.agentId === agentId);
    const agentLessons = lessons.filter((l) => l.agentId === agentId);

    const certificationStatus = deriveCertificationStatus({
      agentId,
      integrityReport,
      agentRow,
      agentLessons,
      agentActiveRootCauses,
    });

    // Computed 'certified' always wins — data is the source of truth.
    // Operator overrides ('backlog') apply only when data doesn't certify.
    let status: WorkshopQueueStatus;
    if (certificationStatus === 'certified') {
      status = 'certified';
    } else if (statusOverrides[agentId] && statusOverrides[agentId] !== 'certified') {
      status = statusOverrides[agentId];
    } else if (agentId === activeAgentId) {
      status = 'active';
    } else {
      status = 'pending';
    }

    return {
      agentId,
      position: index + 1,
      status,
      certificationStatus,
    };
  });

  const certifiedCount = queue.filter((item) => item.certificationStatus === 'certified').length;
  const totalCount = queue.length;
  const completionPercentage =
    totalCount > 0 ? Math.round((certifiedCount / totalCount) * 100) : 0;

  const activeReport = reportByAgent.get(activeAgentId) ?? null;
  const activeRow = rowByAgent.get(activeAgentId) ?? null;
  const activeAgentProgress = deriveActiveAgentProgress({
    agentId: activeAgentId,
    health,
    lessons,
    integrityReport: activeReport,
    agentRow: activeRow,
  });

  return {
    queue,
    activeAgentId,
    activeAgentProgress,
    certifiedCount,
    totalCount,
    completionPercentage,
  };
}

// ── Why-not-certified explanation ───────────────────────────────────────────

/**
 * Produce a plain-English explanation of why an agent has not been certified.
 * Used by the "Why Not Certified?" panel in the Workshop UI.
 */
export function buildWhyNotCertifiedMessage(params: {
  agentId: string;
  certificationStatus: WorkshopCertificationStatus;
  integrityReport: AgentIntegrityReport | null;
  agentRow: AgentRow | null;
  agentActiveRootCauses: RootCause[];
  agentLessons: Lesson[];
}): string {
  const { certificationStatus, integrityReport, agentRow, agentActiveRootCauses, agentLessons } =
    params;

  if (certificationStatus === 'certified') {
    return 'This agent has passed all certification requirements and is ready to promote.';
  }

  const reasons: string[] = [];

  const criticalRootCauses = agentActiveRootCauses.filter((rc) => rc.severity === 'critical');
  if (criticalRootCauses.length > 0) {
    reasons.push(
      `${criticalRootCauses.length} critical root cause${criticalRootCauses.length === 1 ? '' : 's'} remain unresolved`,
    );
  }

  const integrityStatus = integrityReport?.integrityStatus ?? null;
  if (integrityStatus === 'unsafe_to_promote') {
    reasons.push('integrity status is unsafe to promote');
  } else if (integrityStatus === 'missing_integration') {
    reasons.push('required integrations are missing');
  } else if (integrityStatus === 'missing_data') {
    reasons.push('sandbox fixtures or data sources are missing');
  } else if (integrityStatus === null) {
    reasons.push('integrity has not yet been evaluated — open the Doctor tab first');
  }

  const promotionStatus = agentRow?.status ?? null;
  if (promotionStatus === 'Blocked') {
    reasons.push('promotion is currently blocked by active failures');
  } else if (promotionStatus === 'Investigate') {
    reasons.push('agent is under investigation and not yet cleared for promotion');
  } else if (promotionStatus !== 'Promote' && promotionStatus !== null) {
    reasons.push('agent has not yet reached the promotion threshold');
  } else if (promotionStatus === null) {
    reasons.push('no run history exists — scenarios must be executed first');
  }

  const criticalLessons = agentLessons.filter((l) => l.severity === 'critical');
  if (criticalLessons.length > 0) {
    reasons.push(
      `${criticalLessons.length} critical lesson${criticalLessons.length === 1 ? '' : 's'} remain open`,
    );
  }

  if (reasons.length === 0) {
    return certificationStatus === 'in_progress'
      ? 'Agent is making progress. Run more scenarios to build confidence before certifying.'
      : 'Agent is not yet certified.';
  }

  const prefix =
    certificationStatus === 'blocked'
      ? 'Agent is blocked because'
      : 'Agent is not yet certified because';

  if (reasons.length === 1) return `${prefix} ${reasons[0]}.`;

  const last = reasons[reasons.length - 1];
  const rest = reasons.slice(0, -1);
  return `${prefix} ${rest.join(', ')} and ${last}.`;
}

// ── Repair plan items ───────────────────────────────────────────────────────

/** A single prioritised repair action for the "Recommended Repair Plan" panel. */
export type RepairPlanItem = {
  /** 1-based display rank after sorting. */
  rank: number;
  title: string;
  detail: string;
  type: 'integration' | 'fixture' | 'scenario' | 'root_cause' | 'lesson' | 'pass_rate';
  severity: 'critical' | 'high' | 'medium' | 'low';
};

/**
 * Derive an ordered list of repair actions for the active Workshop agent.
 * Uses existing health/integrity data — no new scoring invented.
 * Returns up to 5 items, ranked by impact.
 */
export function buildRepairPlanItems(params: {
  integrityReport: AgentIntegrityReport | null;
  agentRow: AgentRow | null;
  agentActiveRootCauses: RootCause[];
  openLessons: number;
}): RepairPlanItem[] {
  const { integrityReport, agentRow, agentActiveRootCauses, openLessons } = params;

  type ScoredItem = RepairPlanItem & { score: number };
  const items: ScoredItem[] = [];

  // Critical and high-severity missing integrations — highest priority.
  for (const integration of integrityReport?.repairPlan.missingIntegrations ?? []) {
    const score =
      integration.severity === 'critical' ? 100 : integration.severity === 'high' ? 70 : 40;
    items.push({
      rank: 0,
      score,
      title: `Wire integration: ${integration.integration}`,
      detail: integration.recommendedFix,
      type: 'integration',
      severity: integration.severity,
    });
  }

  // Active root causes — systemic failures that recur until addressed.
  for (const rootCause of agentActiveRootCauses) {
    items.push({
      rank: 0,
      score: rootCause.severity === 'critical' ? 90 : 55,
      title: rootCause.title,
      detail: rootCause.recommendedFix,
      type: 'root_cause',
      severity: rootCause.severity === 'critical' ? 'critical' : 'high',
    });
  }

  // Failing scenarios — concrete test failures with known inputs.
  for (const scenario of integrityReport?.repairPlan.failingScenarios ?? []) {
    items.push({
      rank: 0,
      score: 80,
      title: `Fix failing scenario: ${scenario.title}`,
      detail: `Scenario in "${scenario.category}" category is currently failing. Fix the agent logic or prompt, then retest.`,
      type: 'scenario',
      severity: 'high',
    });
  }

  // Missing fixtures — without them, scenario runs produce no signal.
  for (const fixture of integrityReport?.repairPlan.missingFixtures ?? []) {
    items.push({
      rank: 0,
      score: 60,
      title: `Add sandbox fixture: ${fixture.fixture}`,
      detail: fixture.recommendedFixture,
      type: 'fixture',
      severity: 'medium',
    });
  }

  // Low pass rate — agent is running but not passing enough scenarios.
  if (agentRow?.passRate !== null && agentRow?.passRate !== undefined && agentRow.passRate < 0.8) {
    items.push({
      rank: 0,
      score: 55,
      title: 'Improve scenario pass rate',
      detail: `Current pass rate is ${(agentRow.passRate * 100).toFixed(0)}%. Run the full scenario pack, inspect failures, and adjust the agent prompt.`,
      type: 'pass_rate',
      severity: agentRow.passRate < 0.5 ? 'high' : 'medium',
    });
  }

  // Open lessons — knowledge that hasn't been acted on yet.
  if (openLessons > 0) {
    items.push({
      rank: 0,
      score: 30,
      title: `Review ${openLessons} open lesson${openLessons === 1 ? '' : 's'}`,
      detail:
        'Unresolved lessons may reveal recurring failure patterns. Read each lesson and apply the recommended change.',
      type: 'lesson',
      severity: 'low',
    });
  }

  return items
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item, index) => {
      // Destructure to drop `score` before returning.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { score: _score, ...rest } = item;
      return { ...rest, rank: index + 1 };
    });
}

// ── Queue advancement ───────────────────────────────────────────────────────

/**
 * Pure state transition for the "Advance Workshop" action.
 *
 * Finds the next agent in the queue that is pending (not certified, not backlog)
 * and returns a new PersistedWorkshopQueue with that agent as active.
 *
 * If no next agent exists, the current active agent is preserved.
 */
export function advanceWorkshopQueue(
  persistedQueue: PersistedWorkshopQueue | null,
  workshopState: WorkshopState,
): PersistedWorkshopQueue {
  const currentActiveId = workshopState.activeAgentId;
  const currentIndex = workshopState.queue.findIndex((item) => item.agentId === currentActiveId);

  // Only 'pending' items are candidates — certified and backlog items are skipped.
  const afterCurrent = workshopState.queue.slice(currentIndex + 1);
  const nextCandidate = afterCurrent.find((item) => item.status === 'pending');

  // If none found after current, wrap around from the beginning (excluding current).
  const nextAgent =
    nextCandidate ??
    workshopState.queue.find(
      (item) => item.agentId !== currentActiveId && item.status === 'pending',
    );

  const base: PersistedWorkshopQueue = persistedQueue ?? {
    version: 1,
    activeAgentId: currentActiveId,
    statusOverrides: {},
  };

  return {
    ...base,
    activeAgentId: nextAgent?.agentId ?? currentActiveId,
  };
}

// ── Agent display name helper ───────────────────────────────────────────────

/**
 * Format an agent ID into a human-readable display name.
 * e.g. 'quote-triage' → 'Quote Triage'
 */
export function formatAgentDisplayName(agentId: string): string {
  return agentId
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
