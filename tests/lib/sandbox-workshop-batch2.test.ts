/**
 * Tests for Agent Workshop Batch 2 pure-function additions.
 *
 * Covers:
 *   - buildWhyNotCertifiedMessage: message derivation for all certification states
 *   - buildRepairPlanItems: ranking, ordering, 5-item cap, type tagging
 *   - advanceWorkshopQueue: finds next pending agent, wraps around, handles edge cases
 *   - buildWorkshopState with customOrder: respects persisted ordering
 *   - formatAgentDisplayName: id → display name
 *   - Workshop empty and all-certified states
 *   - Progress calculations for edge cases
 */
import { describe, it, expect } from 'vitest';
import {
  advanceWorkshopQueue,
  buildRepairPlanItems,
  buildWhyNotCertifiedMessage,
  buildWorkshopState,
  formatAgentDisplayName,
  WORKSHOP_QUEUE_DEFAULT,
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

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: 'lesson-1',
    agentId: 'quote-triage',
    title: 'Test lesson',
    observation: 'Agent missed urgency signal',
    recommendation: 'Fix prompt',
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

function makeFullWorkshopState(overrides: Partial<WorkshopState> = {}): WorkshopState {
  return {
    queue: WORKSHOP_QUEUE_DEFAULT.map((agentId, index) => ({
      agentId,
      position: index + 1,
      status: index === 0 ? 'active' : 'pending',
      certificationStatus: 'in_progress',
    })),
    activeAgentId: WORKSHOP_QUEUE_DEFAULT[0] as string,
    activeAgentProgress: {
      readinessPercentage: 50,
      passRate: 0.6,
      blockerCount: 1,
      openLessons: 2,
      openRootCauses: 1,
      nextAction: 'Fix failing scenario.',
      estimatedWork: '1–2 hours.',
    },
    certifiedCount: 0,
    totalCount: 7,
    completionPercentage: 0,
    ...overrides,
  };
}

// ── formatAgentDisplayName ──────────────────────────────────────────────────

describe('formatAgentDisplayName', () => {
  it('converts hyphenated id to title case words', () => {
    expect(formatAgentDisplayName('quote-triage')).toBe('Quote Triage');
    expect(formatAgentDisplayName('customer-reply')).toBe('Customer Reply');
    expect(formatAgentDisplayName('ndis-compliance')).toBe('Ndis Compliance');
  });

  it('handles single-word IDs', () => {
    expect(formatAgentDisplayName('bud')).toBe('Bud');
    expect(formatAgentDisplayName('reviews')).toBe('Reviews');
  });

  it('handles three-word IDs', () => {
    expect(formatAgentDisplayName('cash-flow-forecaster')).toBe('Cash Flow Forecaster');
  });
});

// ── buildWhyNotCertifiedMessage ─────────────────────────────────────────────

describe('buildWhyNotCertifiedMessage', () => {
  const base = {
    agentId: 'quote-triage',
    agentActiveRootCauses: [] as RootCause[],
    agentLessons: [] as Lesson[],
  };

  it('returns "passed all requirements" for a certified agent', () => {
    const msg = buildWhyNotCertifiedMessage({
      ...base,
      certificationStatus: 'certified',
      integrityReport: makeIntegrityReport(),
      agentRow: makeAgentRow(),
    });
    expect(msg).toContain('passed all certification requirements');
  });

  it('explains blocked state with critical root cause', () => {
    const msg = buildWhyNotCertifiedMessage({
      ...base,
      certificationStatus: 'blocked',
      integrityReport: makeIntegrityReport({ integrityStatus: 'ready_to_promote' }),
      agentRow: makeAgentRow({ status: 'Promote' }),
      agentActiveRootCauses: [makeRootCause({ severity: 'critical' })],
    });
    expect(msg).toContain('blocked');
    expect(msg).toContain('critical root cause');
  });

  it('explains blocked state with unsafe_to_promote integrity', () => {
    const msg = buildWhyNotCertifiedMessage({
      ...base,
      certificationStatus: 'blocked',
      integrityReport: makeIntegrityReport({ integrityStatus: 'unsafe_to_promote' }),
      agentRow: makeAgentRow({ status: 'Promote' }),
    });
    expect(msg).toContain('unsafe to promote');
  });

  it('explains in_progress state with missing data', () => {
    const msg = buildWhyNotCertifiedMessage({
      ...base,
      certificationStatus: 'in_progress',
      integrityReport: makeIntegrityReport({ integrityStatus: 'missing_data' }),
      agentRow: makeAgentRow({ status: 'Monitor' }),
    });
    expect(msg).toContain('not yet certified');
    expect(msg).toContain('missing');
  });

  it('combines multiple reasons with "and"', () => {
    const msg = buildWhyNotCertifiedMessage({
      ...base,
      certificationStatus: 'in_progress',
      integrityReport: makeIntegrityReport({ integrityStatus: 'missing_data' }),
      agentRow: makeAgentRow({ status: 'Investigate' }),
    });
    expect(msg).toContain(' and ');
  });

  it('falls back gracefully when no integrity report or agent row', () => {
    const msg = buildWhyNotCertifiedMessage({
      ...base,
      certificationStatus: 'in_progress',
      integrityReport: null,
      agentRow: null,
    });
    // Should not throw; should produce a coherent message.
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(10);
  });

  it('mentions critical lessons when present', () => {
    const msg = buildWhyNotCertifiedMessage({
      ...base,
      certificationStatus: 'in_progress',
      integrityReport: makeIntegrityReport({ integrityStatus: 'ready_to_promote' }),
      agentRow: makeAgentRow({ status: 'Promote' }),
      agentLessons: [makeLesson({ severity: 'critical' })],
    });
    expect(msg).toContain('critical lesson');
  });

  it('returns progress message when in_progress with no concrete blockers', () => {
    const msg = buildWhyNotCertifiedMessage({
      ...base,
      certificationStatus: 'in_progress',
      integrityReport: makeIntegrityReport({ integrityStatus: 'ready_to_test' }),
      agentRow: makeAgentRow({ status: 'Monitor' }),
    });
    // Should explain why even though not blocking
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(10);
  });
});

// ── buildRepairPlanItems ────────────────────────────────────────────────────

describe('buildRepairPlanItems', () => {
  it('returns an empty array when no issues exist', () => {
    const items = buildRepairPlanItems({
      integrityReport: makeIntegrityReport(),
      agentRow: makeAgentRow({ passRate: 0.95 }),
      agentActiveRootCauses: [],
      openLessons: 0,
    });
    expect(items).toHaveLength(0);
  });

  it('ranks critical integration missing as first item', () => {
    const items = buildRepairPlanItems({
      integrityReport: makeIntegrityReport({
        repairPlan: {
          disposition: 'repair_required',
          summary: '',
          rootCauseSummary: '',
          totalScenarios: 1,
          passedScenarios: 0,
          failingScenarios: [{ title: 'Scenario A', category: 'ops' }],
          missingIntegrations: [
            {
              integration: 'NDIS Commission notification',
              whyRequired: 'Regulatory',
              blockedCapability: 'Compliance',
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
      agentRow: makeAgentRow({ passRate: 0.9 }),
      agentActiveRootCauses: [],
      openLessons: 0,
    });

    expect(items[0].type).toBe('integration');
    expect(items[0].severity).toBe('critical');
    expect(items[0].rank).toBe(1);
  });

  it('ranks critical root cause above failing scenarios', () => {
    const items = buildRepairPlanItems({
      integrityReport: makeIntegrityReport({
        repairPlan: {
          disposition: 'repair_required',
          summary: '',
          rootCauseSummary: '',
          totalScenarios: 2,
          passedScenarios: 0,
          failingScenarios: [{ title: 'Scenario A', category: 'ops' }],
          missingIntegrations: [],
          missingFixtures: [],
          coverageGaps: [],
          recommendedImplementation: '',
          validationRecommendation: null,
          likelyAffectedFiles: [],
          expectedOutcome: '',
        },
      }),
      agentRow: makeAgentRow({ passRate: 0.9 }),
      agentActiveRootCauses: [makeRootCause({ severity: 'critical' })],
      openLessons: 0,
    });

    const firstType = items[0].type;
    expect(firstType).toBe('root_cause');
  });

  it('caps result at 5 items', () => {
    const items = buildRepairPlanItems({
      integrityReport: makeIntegrityReport({
        repairPlan: {
          disposition: 'repair_required',
          summary: '',
          rootCauseSummary: '',
          totalScenarios: 4,
          passedScenarios: 0,
          failingScenarios: [
            { title: 'S1', category: 'ops' },
            { title: 'S2', category: 'ops' },
            { title: 'S3', category: 'ops' },
          ],
          missingIntegrations: [
            {
              integration: 'Email',
              whyRequired: '',
              blockedCapability: '',
              severity: 'high',
              recommendedFix: '',
            },
          ],
          missingFixtures: [
            { fixture: 'Fixture A', whyItMatters: '', recommendedFixture: '' },
            { fixture: 'Fixture B', whyItMatters: '', recommendedFixture: '' },
          ],
          coverageGaps: [],
          recommendedImplementation: '',
          validationRecommendation: null,
          likelyAffectedFiles: [],
          expectedOutcome: '',
        },
      }),
      agentRow: makeAgentRow({ passRate: 0.3 }),
      agentActiveRootCauses: [makeRootCause({ severity: 'critical' })],
      openLessons: 3,
    });

    expect(items.length).toBeLessThanOrEqual(5);
  });

  it('assigns sequential 1-based ranks', () => {
    const items = buildRepairPlanItems({
      integrityReport: makeIntegrityReport({
        repairPlan: {
          disposition: 'repair_required',
          summary: '',
          rootCauseSummary: '',
          totalScenarios: 1,
          passedScenarios: 0,
          failingScenarios: [{ title: 'Failing scenario', category: 'sales' }],
          missingIntegrations: [],
          missingFixtures: [],
          coverageGaps: [],
          recommendedImplementation: '',
          validationRecommendation: null,
          likelyAffectedFiles: [],
          expectedOutcome: '',
        },
      }),
      agentRow: makeAgentRow({ passRate: 0.9 }),
      agentActiveRootCauses: [],
      openLessons: 1,
    });

    items.forEach((item, index) => {
      expect(item.rank).toBe(index + 1);
    });
  });

  it('includes open lessons as a low-severity item', () => {
    const items = buildRepairPlanItems({
      integrityReport: makeIntegrityReport(),
      agentRow: makeAgentRow({ passRate: 0.95 }),
      agentActiveRootCauses: [],
      openLessons: 3,
    });
    const lessonItem = items.find((item) => item.type === 'lesson');
    expect(lessonItem).toBeDefined();
    expect(lessonItem?.severity).toBe('low');
  });

  it('includes low pass rate as a repair item', () => {
    const items = buildRepairPlanItems({
      integrityReport: makeIntegrityReport(),
      agentRow: makeAgentRow({ passRate: 0.4 }),
      agentActiveRootCauses: [],
      openLessons: 0,
    });
    const passRateItem = items.find((item) => item.type === 'pass_rate');
    expect(passRateItem).toBeDefined();
    expect(passRateItem?.severity).toBe('high');
  });
});

// ── advanceWorkshopQueue ────────────────────────────────────────────────────

describe('advanceWorkshopQueue', () => {
  it('advances to the next pending agent', () => {
    const state = makeFullWorkshopState({
      activeAgentId: 'quote-triage',
      queue: [
        { agentId: 'quote-triage', position: 1, status: 'active', certificationStatus: 'in_progress' },
        { agentId: 'customer-reply', position: 2, status: 'pending', certificationStatus: 'in_progress' },
        { agentId: 'reviews', position: 3, status: 'pending', certificationStatus: 'in_progress' },
      ],
    });
    const result = advanceWorkshopQueue(null, state);
    expect(result.activeAgentId).toBe('customer-reply');
  });

  it('skips certified agents', () => {
    const state = makeFullWorkshopState({
      activeAgentId: 'quote-triage',
      queue: [
        { agentId: 'quote-triage', position: 1, status: 'active', certificationStatus: 'in_progress' },
        { agentId: 'customer-reply', position: 2, status: 'certified', certificationStatus: 'certified' },
        { agentId: 'reviews', position: 3, status: 'pending', certificationStatus: 'in_progress' },
      ],
    });
    const result = advanceWorkshopQueue(null, state);
    expect(result.activeAgentId).toBe('reviews');
  });

  it('wraps around to the first pending agent when at the end', () => {
    const state = makeFullWorkshopState({
      activeAgentId: 'reviews',
      queue: [
        { agentId: 'quote-triage', position: 1, status: 'pending', certificationStatus: 'in_progress' },
        { agentId: 'customer-reply', position: 2, status: 'certified', certificationStatus: 'certified' },
        { agentId: 'reviews', position: 3, status: 'active', certificationStatus: 'in_progress' },
      ],
    });
    const result = advanceWorkshopQueue(null, state);
    expect(result.activeAgentId).toBe('quote-triage');
  });

  it('stays on current agent when no other pending agents exist', () => {
    const state = makeFullWorkshopState({
      activeAgentId: 'quote-triage',
      queue: [
        { agentId: 'quote-triage', position: 1, status: 'active', certificationStatus: 'in_progress' },
        { agentId: 'customer-reply', position: 2, status: 'certified', certificationStatus: 'certified' },
        { agentId: 'reviews', position: 3, status: 'backlog', certificationStatus: 'in_progress' },
      ],
    });
    const result = advanceWorkshopQueue(null, state);
    // 'reviews' is in backlog — should not advance to it; stays on quote-triage
    expect(result.activeAgentId).toBe('quote-triage');
  });

  it('preserves existing status overrides in the persisted queue', () => {
    const persisted: PersistedWorkshopQueue = {
      version: 1,
      activeAgentId: 'quote-triage',
      statusOverrides: { scheduling: 'backlog' },
    };
    const state = makeFullWorkshopState({
      activeAgentId: 'quote-triage',
      queue: [
        { agentId: 'quote-triage', position: 1, status: 'active', certificationStatus: 'in_progress' },
        { agentId: 'customer-reply', position: 2, status: 'pending', certificationStatus: 'in_progress' },
      ],
    });
    const result = advanceWorkshopQueue(persisted, state);
    expect(result.statusOverrides).toMatchObject({ scheduling: 'backlog' });
  });

  it('sets version 1 when no persisted queue exists', () => {
    const state = makeFullWorkshopState();
    const result = advanceWorkshopQueue(null, state);
    expect(result.version).toBe(1);
  });
});

// ── buildWorkshopState with customOrder ─────────────────────────────────────

describe('buildWorkshopState with customOrder', () => {
  const BASE = {
    health: EMPTY_HEALTH,
    lessons: [],
    integrityReports: [],
    agentRows: [],
  };

  it('uses WORKSHOP_QUEUE_DEFAULT order when no customOrder persisted', () => {
    const state = buildWorkshopState({ persistedQueue: null, ...BASE });
    state.queue.forEach((item, index) => {
      expect(item.agentId).toBe(WORKSHOP_QUEUE_DEFAULT[index]);
    });
  });

  it('uses customOrder when persisted', () => {
    const customOrder = ['reviews', 'bud', 'scheduling', 'quote-triage', 'customer-reply', 'ndis-compliance', 'reconciliation'];
    const persisted: PersistedWorkshopQueue = {
      version: 1,
      activeAgentId: 'reviews',
      statusOverrides: {},
      customOrder,
    };
    const state = buildWorkshopState({ persistedQueue: persisted, ...BASE });
    state.queue.forEach((item, index) => {
      expect(item.agentId).toBe(customOrder[index]);
    });
  });

  it('assigns correct positions after reorder', () => {
    const customOrder = ['bud', 'reviews', 'quote-triage', 'customer-reply', 'scheduling', 'ndis-compliance', 'reconciliation'];
    const persisted: PersistedWorkshopQueue = {
      version: 1,
      activeAgentId: 'bud',
      statusOverrides: {},
      customOrder,
    };
    const state = buildWorkshopState({ persistedQueue: persisted, ...BASE });
    expect(state.queue[0].agentId).toBe('bud');
    expect(state.queue[0].position).toBe(1);
    expect(state.queue[1].agentId).toBe('reviews');
    expect(state.queue[1].position).toBe(2);
  });

  it('active agent in customOrder is marked as active', () => {
    const persisted: PersistedWorkshopQueue = {
      version: 1,
      activeAgentId: 'scheduling',
      statusOverrides: {},
      customOrder: ['scheduling', 'bud', 'quote-triage', 'customer-reply', 'reviews', 'ndis-compliance', 'reconciliation'],
    };
    const state = buildWorkshopState({ persistedQueue: persisted, ...BASE });
    const schedulingItem = state.queue.find((item) => item.agentId === 'scheduling');
    expect(schedulingItem?.status).toBe('active');
  });
});

// ── Empty and all-certified states ──────────────────────────────────────────

describe('Workshop empty and completion states', () => {
  it('returns 0% completion when no agents are certified', () => {
    const state = buildWorkshopState({
      persistedQueue: null,
      health: EMPTY_HEALTH,
      lessons: [],
      integrityReports: [],
      agentRows: [],
    });
    expect(state.completionPercentage).toBe(0);
    expect(state.certifiedCount).toBe(0);
  });

  it('returns 100% completion when all agents are certified', () => {
    const allReports = WORKSHOP_QUEUE_DEFAULT.map((id) =>
      makeIntegrityReport({ agentId: id, integrityStatus: 'ready_to_promote' }),
    );
    const allRows = WORKSHOP_QUEUE_DEFAULT.map((id) =>
      makeAgentRow({ agentId: id, status: 'Promote', blockers: [] }),
    );
    const state = buildWorkshopState({
      persistedQueue: null,
      health: EMPTY_HEALTH,
      lessons: [],
      integrityReports: allReports,
      agentRows: allRows,
    });
    expect(state.certifiedCount).toBe(WORKSHOP_QUEUE_DEFAULT.length);
    expect(state.completionPercentage).toBe(100);
  });

  it('calculates partial completion correctly: 2/7 = 29%', () => {
    const allReports = WORKSHOP_QUEUE_DEFAULT.map((id, index) =>
      makeIntegrityReport({
        agentId: id,
        integrityStatus: index < 2 ? 'ready_to_promote' : 'ready_to_test',
      }),
    );
    const allRows = WORKSHOP_QUEUE_DEFAULT.map((id, index) =>
      makeAgentRow({
        agentId: id,
        status: index < 2 ? 'Promote' : 'Monitor',
        blockers: [],
      }),
    );
    const state = buildWorkshopState({
      persistedQueue: null,
      health: EMPTY_HEALTH,
      lessons: [],
      integrityReports: allReports,
      agentRows: allRows,
    });
    expect(state.certifiedCount).toBe(2);
    expect(state.completionPercentage).toBe(29); // round(2/7 * 100)
  });
});

// ── Queue rendering helpers ─────────────────────────────────────────────────

describe('Queue rendering invariants', () => {
  it('every queue item has a 1-based position', () => {
    const state = buildWorkshopState({
      persistedQueue: null,
      health: EMPTY_HEALTH,
      lessons: [],
      integrityReports: [],
      agentRows: [],
    });
    state.queue.forEach((item, index) => {
      expect(item.position).toBe(index + 1);
    });
  });

  it('exactly one item is active by default', () => {
    const state = buildWorkshopState({
      persistedQueue: null,
      health: EMPTY_HEALTH,
      lessons: [],
      integrityReports: [],
      agentRows: [],
    });
    const activeItems = state.queue.filter((item) => item.status === 'active');
    expect(activeItems).toHaveLength(1);
  });

  it('backlog override is respected for non-active items', () => {
    const persisted: PersistedWorkshopQueue = {
      version: 1,
      activeAgentId: 'quote-triage',
      statusOverrides: { 'customer-reply': 'backlog', scheduling: 'backlog' },
    };
    const state = buildWorkshopState({
      persistedQueue: persisted,
      health: EMPTY_HEALTH,
      lessons: [],
      integrityReports: [],
      agentRows: [],
    });
    const customerReply = state.queue.find((item) => item.agentId === 'customer-reply');
    const scheduling = state.queue.find((item) => item.agentId === 'scheduling');
    expect(customerReply?.status).toBe('backlog');
    expect(scheduling?.status).toBe('backlog');
  });

  it('certified status from data overrides backlog override', () => {
    const persisted: PersistedWorkshopQueue = {
      version: 1,
      activeAgentId: 'customer-reply',
      statusOverrides: { 'quote-triage': 'backlog' },
    };
    const state = buildWorkshopState({
      persistedQueue: persisted,
      health: EMPTY_HEALTH,
      lessons: [],
      integrityReports: [makeIntegrityReport({ agentId: 'quote-triage', integrityStatus: 'ready_to_promote' })],
      agentRows: [makeAgentRow({ agentId: 'quote-triage', status: 'Promote', blockers: [] })],
    });
    // Data says certified — data wins over backlog override.
    const quoteTriage = state.queue.find((item) => item.agentId === 'quote-triage');
    expect(quoteTriage?.status).toBe('certified');
    expect(quoteTriage?.certificationStatus).toBe('certified');
  });
});
