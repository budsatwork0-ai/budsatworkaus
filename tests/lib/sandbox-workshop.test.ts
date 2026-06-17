/**
 * Tests for the Agent Workshop data layer (Batch 1).
 *
 * Covers:
 *   - WORKSHOP_QUEUE_DEFAULT shape and ordering
 *   - deriveCertificationStatus: certified / blocked / in_progress paths
 *   - deriveActiveAgentProgress: metric derivation
 *   - buildWorkshopState: queue creation, completion percentage, active agent focus
 *   - readWorkshopQueue / writeWorkshopQueue: server-side no-op (node env)
 */
import { describe, it, expect } from 'vitest';
import {
  WORKSHOP_QUEUE_DEFAULT,
  buildWorkshopState,
  deriveCertificationStatus,
  deriveActiveAgentProgress,
  readWorkshopQueue,
  writeWorkshopQueue,
  type PersistedWorkshopQueue,
} from '../../src/app/(app)/dashboard/sandbox/_lib/workshop';
import type {
  AgentIntegrityReport,
  AgentRow,
  HealthData,
  Lesson,
  RootCause,
  WorkshopState,
} from '../../src/app/(app)/dashboard/sandbox/_lib/types';

// ── Test fixtures ───────────────────────────────────────────────────────────

function makeLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: 'lesson-1',
    agentId: 'quote-triage',
    title: 'Test lesson',
    observation: 'Agent missed urgency signal',
    recommendation: 'Add urgency to prompt',
    severity: 'warning',
    source: 'arena',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeRootCause(overrides: Partial<RootCause> = {}): RootCause {
  return {
    key: 'rc-1',
    title: 'Zero action failure',
    severity: 'critical',
    agentId: 'quote-triage',
    failureType: 'zero_action',
    rootCauseSummary: 'Agent returned no actions',
    lessonCount: 1,
    latestAt: new Date().toISOString(),
    exampleObservations: [],
    recommendedFix: 'Fix prompt logic',
    lessonIds: ['lesson-1'],
    ...overrides,
  };
}

function makeAgentRow(overrides: Partial<AgentRow> = {}): AgentRow {
  return {
    agentId: 'quote-triage',
    f1: 0.85,
    baselineF1: 0.80,
    passRate: 0.9,
    rootCauseCount: 0,
    lessonCount: 0,
    status: 'Promote',
    recommendation: 'Ready to promote.',
    trend: 'stable',
    blockers: [],
    ...overrides,
  };
}

function makeIntegrityReport(overrides: Partial<AgentIntegrityReport> = {}): AgentIntegrityReport {
  return {
    agentId: 'quote-triage',
    agentName: 'Quote Triage',
    category: 'sales',
    intendedCapability: 'Triage incoming quotes',
    integrityScore: 85,
    integrityStatus: 'ready_to_promote',
    dataSources: [],
    integrations: [],
    missingConnections: [],
    sandboxFixtures: [],
    scenarioCoverage: [],
    scenarioCount: 3,
    recommendation: 'Promote when stable.',
    riskIfPromoted: 'Low risk.',
    generateFixPrompt: '',
    repairPlan: {
      disposition: 'no_repair_required',
      summary: 'No repairs needed.',
      rootCauseSummary: '',
      totalScenarios: 3,
      passedScenarios: 3,
      failingScenarios: [],
      missingIntegrations: [],
      missingFixtures: [],
      coverageGaps: [],
      recommendedImplementation: '',
      validationRecommendation: null,
      likelyAffectedFiles: [],
      expectedOutcome: 'Stable.',
    },
    recommendedConnections: [],
    repairPromptPreview: '',
    integrationDetails: [],
    ...overrides,
  };
}

const EMPTY_HEALTH: HealthData = {
  lastCronRun: null,
  batches: [],
  health: [],
  regressions: [],
  failingScenarios: [],
  needsReview: [],
  rootCauses: [],
  activeRootCauses: [],
  resolvedRootCauses: [],
  proposals: [],
  recommendations: [],
};

// ── WORKSHOP_QUEUE_DEFAULT ──────────────────────────────────────────────────

describe('WORKSHOP_QUEUE_DEFAULT', () => {
  it('contains exactly 7 agents', () => {
    expect(WORKSHOP_QUEUE_DEFAULT).toHaveLength(7);
  });

  it('starts with quote-triage as the highest priority agent', () => {
    expect(WORKSHOP_QUEUE_DEFAULT[0]).toBe('quote-triage');
  });

  it('contains all required agents in the correct order', () => {
    expect(WORKSHOP_QUEUE_DEFAULT).toEqual([
      'quote-triage',
      'customer-reply',
      'reviews',
      'scheduling',
      'ndis-compliance',
      'reconciliation',
      'bud',
    ]);
  });

  it('has no duplicate agent IDs', () => {
    const unique = new Set(WORKSHOP_QUEUE_DEFAULT);
    expect(unique.size).toBe(WORKSHOP_QUEUE_DEFAULT.length);
  });
});

// ── deriveCertificationStatus ───────────────────────────────────────────────

describe('deriveCertificationStatus', () => {
  const base = {
    agentId: 'quote-triage',
    agentLessons: [],
    agentActiveRootCauses: [],
  };

  it('returns certified when all positive gates pass', () => {
    const status = deriveCertificationStatus({
      ...base,
      integrityReport: makeIntegrityReport({ integrityStatus: 'ready_to_promote' }),
      agentRow: makeAgentRow({ status: 'Promote' }),
    });
    expect(status).toBe('certified');
  });

  it('returns blocked when integrityStatus is unsafe_to_promote', () => {
    const status = deriveCertificationStatus({
      ...base,
      integrityReport: makeIntegrityReport({ integrityStatus: 'unsafe_to_promote' }),
      agentRow: makeAgentRow({ status: 'Promote' }),
    });
    expect(status).toBe('blocked');
  });

  it('returns blocked when promotionStatus is Blocked', () => {
    const status = deriveCertificationStatus({
      ...base,
      integrityReport: makeIntegrityReport({ integrityStatus: 'ready_to_promote' }),
      agentRow: makeAgentRow({ status: 'Blocked', blockers: ['Failing scenario'] }),
    });
    expect(status).toBe('blocked');
  });

  it('returns blocked when a critical active root cause exists', () => {
    const status = deriveCertificationStatus({
      ...base,
      integrityReport: makeIntegrityReport({ integrityStatus: 'ready_to_promote' }),
      agentRow: makeAgentRow({ status: 'Promote' }),
      agentActiveRootCauses: [makeRootCause({ severity: 'critical' })],
    });
    expect(status).toBe('blocked');
  });

  it('returns in_progress (not certified) when a critical lesson exists', () => {
    const status = deriveCertificationStatus({
      ...base,
      integrityReport: makeIntegrityReport({ integrityStatus: 'ready_to_promote' }),
      agentRow: makeAgentRow({ status: 'Promote' }),
      agentLessons: [makeLesson({ severity: 'critical' })],
    });
    expect(status).toBe('in_progress');
  });

  it('returns in_progress when integrity is ready_to_test but promotion is not confirmed', () => {
    const status = deriveCertificationStatus({
      ...base,
      integrityReport: makeIntegrityReport({ integrityStatus: 'ready_to_test' }),
      agentRow: makeAgentRow({ status: 'Monitor' }),
    });
    expect(status).toBe('in_progress');
  });

  it('returns in_progress when no integrity report is available', () => {
    const status = deriveCertificationStatus({
      ...base,
      integrityReport: null,
      agentRow: makeAgentRow({ status: 'Promote' }),
    });
    expect(status).toBe('in_progress');
  });

  it('returns in_progress when no agent row is available', () => {
    const status = deriveCertificationStatus({
      ...base,
      integrityReport: makeIntegrityReport({ integrityStatus: 'ready_to_promote' }),
      agentRow: null,
    });
    expect(status).toBe('in_progress');
  });

  it('warning-severity root cause does not block (only critical does)', () => {
    const status = deriveCertificationStatus({
      ...base,
      integrityReport: makeIntegrityReport({ integrityStatus: 'ready_to_promote' }),
      agentRow: makeAgentRow({ status: 'Promote' }),
      agentActiveRootCauses: [makeRootCause({ severity: 'warning' })],
    });
    // Warning root cause prevents certification (noActiveRootCauses = false) but
    // does not trigger the hard block path — falls through to in_progress.
    expect(status).toBe('in_progress');
  });
});

// ── deriveActiveAgentProgress ───────────────────────────────────────────────

describe('deriveActiveAgentProgress', () => {
  const base = {
    agentId: 'quote-triage',
    health: EMPTY_HEALTH,
    lessons: [],
    integrityReport: null,
    agentRow: null,
  };

  it('returns zero readiness when no integrity report', () => {
    const progress = deriveActiveAgentProgress(base);
    expect(progress.readinessPercentage).toBe(0);
  });

  it('reads integrityScore as readinessPercentage', () => {
    const progress = deriveActiveAgentProgress({
      ...base,
      integrityReport: makeIntegrityReport({ integrityScore: 72 }),
    });
    expect(progress.readinessPercentage).toBe(72);
  });

  it('reads passRate from agentRow', () => {
    const progress = deriveActiveAgentProgress({
      ...base,
      agentRow: makeAgentRow({ passRate: 0.75 }),
    });
    expect(progress.passRate).toBe(0.75);
  });

  it('returns null passRate when no agentRow', () => {
    const progress = deriveActiveAgentProgress(base);
    expect(progress.passRate).toBeNull();
  });

  it('counts blockers from agentRow.blockers', () => {
    const progress = deriveActiveAgentProgress({
      ...base,
      agentRow: makeAgentRow({ blockers: ['Failing scenario: X', 'Root cause: Y'] }),
    });
    expect(progress.blockerCount).toBe(2);
  });

  it('counts open lessons (excludes resolved-by-root-cause lessons)', () => {
    const resolvedLesson = makeLesson({ id: 'lesson-resolved', agentId: 'quote-triage' });
    const openLesson = makeLesson({ id: 'lesson-open', agentId: 'quote-triage' });
    const health: HealthData = {
      ...EMPTY_HEALTH,
      resolvedRootCauses: [
        makeRootCause({ lessonIds: ['lesson-resolved'] }),
      ],
    };
    const progress = deriveActiveAgentProgress({
      ...base,
      health,
      lessons: [resolvedLesson, openLesson],
    });
    expect(progress.openLessons).toBe(1);
  });

  it('counts open root causes for this agent only', () => {
    const health: HealthData = {
      ...EMPTY_HEALTH,
      activeRootCauses: [
        makeRootCause({ agentId: 'quote-triage' }),
        makeRootCause({ agentId: 'quote-triage', key: 'rc-2' }),
        makeRootCause({ agentId: 'customer-reply', key: 'rc-other' }),
      ],
    };
    const progress = deriveActiveAgentProgress({ ...base, health });
    expect(progress.openRootCauses).toBe(2);
  });

  it('ignores lessons belonging to other agents', () => {
    const progress = deriveActiveAgentProgress({
      ...base,
      lessons: [
        makeLesson({ agentId: 'customer-reply' }),
        makeLesson({ agentId: 'customer-reply', id: 'lesson-2' }),
      ],
    });
    expect(progress.openLessons).toBe(0);
  });

  describe('nextAction', () => {
    it('prioritises critical integration gaps', () => {
      const progress = deriveActiveAgentProgress({
        ...base,
        integrityReport: makeIntegrityReport({
          repairPlan: {
            disposition: 'repair_required',
            summary: '',
            rootCauseSummary: '',
            totalScenarios: 0,
            passedScenarios: 0,
            failingScenarios: [],
            missingIntegrations: [
              {
                integration: 'NDIS Commission notification',
                whyRequired: 'Must not call live endpoint',
                blockedCapability: 'Compliance reporting',
                severity: 'critical',
                recommendedFix: 'Wire propose-action adapter',
              },
            ],
            missingFixtures: [],
            coverageGaps: [],
            recommendedImplementation: '',
            validationRecommendation: null,
            likelyAffectedFiles: [],
            expectedOutcome: '',
          },
        }),
      });
      expect(progress.nextAction).toContain('critical integrations');
    });

    it('surfaces failing scenarios when no critical integration gap', () => {
      const progress = deriveActiveAgentProgress({
        ...base,
        integrityReport: makeIntegrityReport({
          repairPlan: {
            disposition: 'repair_required',
            summary: '',
            rootCauseSummary: '',
            totalScenarios: 3,
            passedScenarios: 1,
            failingScenarios: [
              { title: 'Urgent quote', category: 'sales' },
              { title: 'Out-of-area', category: 'sales' },
            ],
            missingIntegrations: [],
            missingFixtures: [],
            coverageGaps: [],
            recommendedImplementation: '',
            validationRecommendation: null,
            likelyAffectedFiles: [],
            expectedOutcome: '',
          },
        }),
      });
      expect(progress.nextAction).toContain('2 failing scenario');
    });

    it('recommends certification run when no issues remain', () => {
      const progress = deriveActiveAgentProgress({
        ...base,
        integrityReport: makeIntegrityReport(),
        agentRow: makeAgentRow({ passRate: 0.95 }),
      });
      expect(progress.nextAction).toContain('certif');
    });
  });

  describe('estimatedWork', () => {
    it('returns "Ready to certify." when no open items', () => {
      const progress = deriveActiveAgentProgress({
        ...base,
        integrityReport: makeIntegrityReport(),
        agentRow: makeAgentRow(),
      });
      expect(progress.estimatedWork).toBe('Ready to certify.');
    });

    it('returns "1–2 hours." for 1–2 open items', () => {
      const progress = deriveActiveAgentProgress({
        ...base,
        agentRow: makeAgentRow({ blockers: ['one blocker'] }),
        integrityReport: makeIntegrityReport(),
      });
      expect(progress.estimatedWork).toBe('1–2 hours.');
    });

    it('returns "Half a day." for 3–5 open items', () => {
      const health: HealthData = {
        ...EMPTY_HEALTH,
        activeRootCauses: [
          makeRootCause({ key: 'rc-1' }),
          makeRootCause({ key: 'rc-2' }),
          makeRootCause({ key: 'rc-3' }),
        ],
      };
      const progress = deriveActiveAgentProgress({
        ...base,
        health,
        agentRow: makeAgentRow({ blockers: ['b1', 'b2'] }),
        integrityReport: makeIntegrityReport(),
      });
      // 3 root causes + 2 blockers = 5 open items
      expect(progress.estimatedWork).toBe('Half a day.');
    });
  });
});

// ── buildWorkshopState ──────────────────────────────────────────────────────

describe('buildWorkshopState', () => {
  const base = {
    persistedQueue: null,
    health: EMPTY_HEALTH,
    lessons: [],
    integrityReports: [],
    agentRows: [],
  };

  it('creates a queue with 7 items matching WORKSHOP_QUEUE_DEFAULT', () => {
    const state = buildWorkshopState(base);
    expect(state.queue).toHaveLength(7);
    state.queue.forEach((item, index) => {
      expect(item.agentId).toBe(WORKSHOP_QUEUE_DEFAULT[index]);
    });
  });

  it('assigns 1-based positions to queue items', () => {
    const state = buildWorkshopState(base);
    state.queue.forEach((item, index) => {
      expect(item.position).toBe(index + 1);
    });
  });

  it('defaults activeAgentId to quote-triage when no persisted queue', () => {
    const state = buildWorkshopState(base);
    expect(state.activeAgentId).toBe('quote-triage');
  });

  it('restores activeAgentId from persisted queue', () => {
    const persisted: PersistedWorkshopQueue = {
      version: 1,
      activeAgentId: 'scheduling',
      statusOverrides: {},
    };
    const state = buildWorkshopState({ ...base, persistedQueue: persisted });
    expect(state.activeAgentId).toBe('scheduling');
  });

  it('marks the active agent queue item as status "active"', () => {
    const state = buildWorkshopState(base);
    const activeItem = state.queue.find((i) => i.agentId === 'quote-triage');
    expect(activeItem?.status).toBe('active');
  });

  it('marks all non-active items as status "pending" by default', () => {
    const state = buildWorkshopState(base);
    const nonActive = state.queue.filter((i) => i.agentId !== 'quote-triage');
    nonActive.forEach((item) => {
      expect(item.status).toBe('pending');
    });
  });

  describe('completion percentage', () => {
    it('returns 0% when no agents are certified', () => {
      const state = buildWorkshopState(base);
      expect(state.certifiedCount).toBe(0);
      expect(state.completionPercentage).toBe(0);
    });

    it('returns 14% (1/7 rounded) when one agent is certified', () => {
      const state = buildWorkshopState({
        ...base,
        integrityReports: [makeIntegrityReport({ agentId: 'quote-triage', integrityStatus: 'ready_to_promote' })],
        agentRows: [makeAgentRow({ agentId: 'quote-triage', status: 'Promote', blockers: [] })],
      });
      expect(state.certifiedCount).toBe(1);
      expect(state.completionPercentage).toBe(14); // round(1/7 * 100) = 14
    });

    it('returns 100% when all agents are certified', () => {
      const allReports = WORKSHOP_QUEUE_DEFAULT.map((id) =>
        makeIntegrityReport({ agentId: id, integrityStatus: 'ready_to_promote' }),
      );
      const allRows = WORKSHOP_QUEUE_DEFAULT.map((id) =>
        makeAgentRow({ agentId: id, status: 'Promote', blockers: [] }),
      );
      const state = buildWorkshopState({
        ...base,
        integrityReports: allReports,
        agentRows: allRows,
      });
      expect(state.certifiedCount).toBe(7);
      expect(state.completionPercentage).toBe(100);
    });

    it('totalCount always equals WORKSHOP_QUEUE_DEFAULT length', () => {
      const state = buildWorkshopState(base);
      expect(state.totalCount).toBe(WORKSHOP_QUEUE_DEFAULT.length);
    });
  });

  describe('certified status precedence', () => {
    it('marks item as certified when data signals certification regardless of override', () => {
      // Even if operator had manually moved to 'backlog', data-certified wins.
      const persisted: PersistedWorkshopQueue = {
        version: 1,
        activeAgentId: 'customer-reply',
        statusOverrides: { 'quote-triage': 'backlog' },
      };
      const state = buildWorkshopState({
        ...base,
        persistedQueue: persisted,
        integrityReports: [makeIntegrityReport({ agentId: 'quote-triage', integrityStatus: 'ready_to_promote' })],
        agentRows: [makeAgentRow({ agentId: 'quote-triage', status: 'Promote', blockers: [] })],
      });
      const item = state.queue.find((i) => i.agentId === 'quote-triage');
      expect(item?.status).toBe('certified');
      expect(item?.certificationStatus).toBe('certified');
    });

    it('applies backlog override when agent is not certified', () => {
      const persisted: PersistedWorkshopQueue = {
        version: 1,
        activeAgentId: 'customer-reply',
        statusOverrides: { 'reviews': 'backlog' },
      };
      const state = buildWorkshopState({ ...base, persistedQueue: persisted });
      const item = state.queue.find((i) => i.agentId === 'reviews');
      expect(item?.status).toBe('backlog');
    });
  });

  it('derives activeAgentProgress for the active agent', () => {
    const state = buildWorkshopState({
      ...base,
      integrityReports: [makeIntegrityReport({ agentId: 'quote-triage', integrityScore: 60 })],
    });
    expect(state.activeAgentProgress.readinessPercentage).toBe(60);
  });

  it('certificationStatus is in_progress for agents with no data', () => {
    const state = buildWorkshopState(base);
    state.queue.forEach((item) => {
      expect(item.certificationStatus).toBe('in_progress');
    });
  });
});

// ── Persistence helpers (server-side / node env) ────────────────────────────

describe('readWorkshopQueue (node environment)', () => {
  it('returns null when window is not defined (server-side)', () => {
    // In vitest node env, window is not available, so safeLocalStorage returns null.
    expect(readWorkshopQueue()).toBeNull();
  });
});

describe('writeWorkshopQueue (node environment)', () => {
  it('does not throw when window is not defined (server-side)', () => {
    const persisted: PersistedWorkshopQueue = {
      version: 1,
      activeAgentId: 'quote-triage',
      statusOverrides: {},
    };
    expect(() => writeWorkshopQueue(persisted)).not.toThrow();
  });
});
