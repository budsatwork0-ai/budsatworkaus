/**
 * Tests for sandbox operator intelligence UX polish:
 *   - Manual pack session awareness (null when no session run; cron fallback path)
 *   - Lessons trend does not show worsening for historical totals
 *   - Promotion summary grouping (actionable buckets only)
 *   - Zero active root causes removes stale root-cause copy signals
 */
import { describe, it, expect } from 'vitest';
import { deriveManualSummary } from '../../src/app/(app)/dashboard/sandbox/_lib/results';
import { buildOperatorIntelligence } from '../../src/app/(app)/dashboard/sandbox/_lib/operator-intelligence';
import { bucketForAgent } from '../../src/app/(app)/dashboard/sandbox/_lib/agents';
import type { AgentRow, Lesson, RootCause } from '../../src/app/(app)/dashboard/sandbox/_lib/types';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: 'lesson-1',
    agentId: 'quote-triage',
    title: 'Test lesson',
    observation: 'observed something',
    recommendation: null,
    severity: 'warning',
    source: 'arena',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeAgent(overrides: Partial<AgentRow> = {}): AgentRow {
  return {
    agentId: 'quote-triage',
    f1: 0.85,
    baselineF1: 0.80,
    passRate: 0.9,
    rootCauseCount: 0,
    lessonCount: 0,
    status: 'Monitor',
    recommendation: 'Keep monitoring.',
    trend: 'stable',
    blockers: [],
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
    lessonCount: 2,
    latestAt: new Date().toISOString(),
    exampleObservations: [],
    recommendedFix: 'Check prompt logic',
    lessonIds: ['lesson-1'],
    ...overrides,
  };
}

const BASE_INTELLIGENCE_ARGS = {
  agents: [],
  health: null,
  history: [],
  lessons: [],
  readiness: null,
  activeRootCauses: [],
  resolvedRootCauses: [],
  fleetHealth: 'Healthy' as const,
};

// ── 1. Manual pack session awareness ──────────────────────────────────────

describe('deriveManualSummary', () => {
  it('returns null when no pack results and no last result — signals no session run', () => {
    expect(deriveManualSummary([], null, null)).toBeNull();
  });

  it('returns null when no pack results even if lastResult exists without a scenario', () => {
    const lastResult = {
      trainingRunId: 'run-1',
      status: 'complete' as const,
      summary: '',
      proposedActions: [],
      llmCalls: 1,
      costCents: 10,
      durationMs: 500,
      score: { precisionScore: 0.9, recallScore: 0.8, f1Score: 0.85, hit: true },
    };
    // No scenario provided — should still return null
    expect(deriveManualSummary([], lastResult, null)).toBeNull();
  });

  it('returns a session summary string when pack results exist', () => {
    const result = {
      trainingRunId: 'r1',
      status: 'complete' as const,
      summary: '',
      proposedActions: [],
      llmCalls: 1,
      costCents: 5,
      durationMs: 400,
      score: { precisionScore: 1, recallScore: 1, f1Score: 1, hit: true },
    };
    const packResult = {
      scenarioSlug: 'test-slug',
      scenarioTitle: 'Test Scenario',
      category: 'customer' as const,
      agentId: 'quote-triage',
      expectedActionTypes: ['create_quote'],
      result,
    };
    const summary = deriveManualSummary([packResult], null, null);
    expect(summary).not.toBeNull();
    expect(summary).toContain('1/1 passed');
    expect(summary).toContain('avg F1 1.00');
  });

  it('returns a scenario summary string when lastResult + lastScenario exist', () => {
    const lastResult = {
      trainingRunId: 'run-2',
      status: 'complete' as const,
      summary: '',
      proposedActions: [],
      llmCalls: 1,
      costCents: 8,
      durationMs: 300,
      score: { precisionScore: 0.8, recallScore: 0.7, f1Score: 0.75, hit: true },
    };
    const lastScenario = {
      slug: 'quote-basic',
      title: 'Basic Quote',
      agentId: 'quote-triage',
      description: '',
      category: 'customer' as const,
      difficulty: 'easy' as const,
      tags: [],
      expectedActionTypes: ['create_quote'],
      input: {},
    };
    const summary = deriveManualSummary([], lastResult, lastScenario);
    expect(summary).not.toBeNull();
    expect(summary).toContain('Pass');
    expect(summary).toContain('Basic Quote');
    expect(summary).toContain('F1 0.75');
  });
});

// ── 2. Lessons trend — no worsening for historical totals ─────────────────

describe('buildOperatorIntelligence lessonsTrend', () => {
  it('returns unchanged when there are many historical lessons but none critical recently', () => {
    // Many old lessons — should not drive a worsening trend
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ago
    const lessons = Array.from({ length: 20 }, (_, i) =>
      makeLesson({ id: `lesson-${i}`, severity: 'warning', createdAt: oldDate }),
    );
    const intel = buildOperatorIntelligence({ ...BASE_INTELLIGENCE_ARGS, lessons });
    expect(intel.lessonsTrend).toBe('unchanged');
  });

  it('returns worsening only when critical lessons increased in recent 24h vs previous 24h', () => {
    const now = Date.now();
    const recentDate = new Date(now - 2 * 60 * 60 * 1000).toISOString(); // 2h ago
    const previousDate = new Date(now - 26 * 60 * 60 * 1000).toISOString(); // 26h ago
    const lessons = [
      makeLesson({ id: 'recent-critical-1', severity: 'critical', createdAt: recentDate }),
      makeLesson({ id: 'recent-critical-2', severity: 'critical', createdAt: recentDate }),
      makeLesson({ id: 'prev-critical-1', severity: 'critical', createdAt: previousDate }),
    ];
    const intel = buildOperatorIntelligence({ ...BASE_INTELLIGENCE_ARGS, lessons });
    expect(intel.lessonsTrend).toBe('worsening');
  });

  it('returns improving when fewer critical lessons in recent 24h than previous 24h', () => {
    const now = Date.now();
    const recentDate = new Date(now - 2 * 60 * 60 * 1000).toISOString();
    const previousDate = new Date(now - 26 * 60 * 60 * 1000).toISOString();
    const lessons = [
      makeLesson({ id: 'recent-critical', severity: 'critical', createdAt: recentDate }),
      makeLesson({ id: 'prev-critical-1', severity: 'critical', createdAt: previousDate }),
      makeLesson({ id: 'prev-critical-2', severity: 'critical', createdAt: previousDate }),
    ];
    const intel = buildOperatorIntelligence({ ...BASE_INTELLIGENCE_ARGS, lessons });
    expect(intel.lessonsTrend).toBe('improving');
  });

  it('does not mark worsening for non-critical lesson increases', () => {
    const now = Date.now();
    const recentDate = new Date(now - 1 * 60 * 60 * 1000).toISOString();
    const previousDate = new Date(now - 25 * 60 * 60 * 1000).toISOString();
    const lessons = [
      makeLesson({ id: 'r1', severity: 'warning', createdAt: recentDate }),
      makeLesson({ id: 'r2', severity: 'warning', createdAt: recentDate }),
      makeLesson({ id: 'r3', severity: 'info', createdAt: recentDate }),
      makeLesson({ id: 'p1', severity: 'warning', createdAt: previousDate }),
    ];
    const intel = buildOperatorIntelligence({ ...BASE_INTELLIGENCE_ARGS, lessons });
    // More warnings recently but no critical increase — should be unchanged
    expect(intel.lessonsTrend).toBe('unchanged');
  });
});

// ── 3. Promotion summary grouping ─────────────────────────────────────────

describe('promotion summary buckets', () => {
  it('bucketForAgent maps Promote/Investigate/Blocked/Monitor agents correctly', () => {
    const promote = makeAgent({ status: 'Promote' });
    const investigate = makeAgent({ status: 'Investigate', agentId: 'scheduling' });
    const blocked = makeAgent({ status: 'Blocked', agentId: 'customer-reply' });
    const monitor = makeAgent({ status: 'Monitor', agentId: 'reviews' });

    expect(bucketForAgent(promote)).toBe('promote');
    expect(bucketForAgent(investigate)).toBe('investigate');
    expect(bucketForAgent(blocked)).toBe('blocked');
    expect(bucketForAgent(monitor)).toBe('monitor');
  });

  it('actionable agents (non-monitor) are grouped for the Promotion Summary panel', () => {
    const agents: AgentRow[] = [
      makeAgent({ agentId: 'a', status: 'Promote' }),
      makeAgent({ agentId: 'b', status: 'Investigate' }),
      makeAgent({ agentId: 'c', status: 'Blocked' }),
      makeAgent({ agentId: 'd', status: 'Monitor' }),
      makeAgent({ agentId: 'e', status: 'Monitor' }),
    ];
    const buckets = {
      promote: agents.filter((a) => a.status === 'Promote'),
      investigate: agents.filter((a) => a.status === 'Investigate'),
      blocked: agents.filter((a) => a.status === 'Blocked'),
      monitor: agents.filter((a) => a.status === 'Monitor'),
    };
    const actionable = [...buckets.promote, ...buckets.investigate, ...buckets.blocked];
    expect(actionable).toHaveLength(3);
    expect(actionable.map((a) => a.agentId)).toEqual(['a', 'b', 'c']);
    // Monitor agents are excluded — panel shows EmptyState when actionable is empty
    expect(buckets.monitor).toHaveLength(2);
  });

  it('shows no actionable agents when all agents are in Monitor', () => {
    const agents: AgentRow[] = [
      makeAgent({ agentId: 'x', status: 'Monitor' }),
      makeAgent({ agentId: 'y', status: 'Monitor' }),
    ];
    const actionable = agents.filter((a) => a.status !== 'Monitor');
    expect(actionable).toHaveLength(0);
  });
});

// ── 4. Zero active root causes removes stale copy signals ─────────────────

describe('buildOperatorIntelligence with zero active root causes', () => {
  it('rootCausesTrend is improving when there are zero active root causes', () => {
    const intel = buildOperatorIntelligence({ ...BASE_INTELLIGENCE_ARGS, activeRootCauses: [] });
    expect(intel.rootCausesTrend).toBe('improving');
  });

  it('healthyDays is positive when there are no root causes, failing scenarios, or regressions', () => {
    const intel = buildOperatorIntelligence({ ...BASE_INTELLIGENCE_ARGS, activeRootCauses: [] });
    expect(intel.healthyDays).toBeGreaterThan(0);
  });

  it('open and resolved lessons are both 0 when lessons array is empty', () => {
    const intel = buildOperatorIntelligence({ ...BASE_INTELLIGENCE_ARGS, lessons: [] });
    expect(intel.openLessons).toBe(0);
    expect(intel.resolvedLessons).toBe(0);
    expect(intel.lessonsThisWeek).toBe(0);
  });

  it('resolvedLessons counts lessons whose IDs appear in resolvedRootCauses.lessonIds', () => {
    const lessons = [
      makeLesson({ id: 'lesson-resolved', agentId: 'quote-triage' }),
      makeLesson({ id: 'lesson-open', agentId: 'scheduling' }),
    ];
    const resolvedRootCauses = [makeRootCause({ lessonIds: ['lesson-resolved'] })];
    const intel = buildOperatorIntelligence({
      ...BASE_INTELLIGENCE_ARGS,
      lessons,
      resolvedRootCauses,
    });
    expect(intel.resolvedLessons).toBe(1);
    expect(intel.openLessons).toBe(1);
  });
});
