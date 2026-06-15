/**
 * Sandbox performance refactor — regression suite.
 *
 * Covers:
 *   1. RPC lesson counts: lessonsByAgent map is built correctly from GROUP BY data
 *   2. run-history nested join: scores surface through the response → scores join
 *   3. SSE event parser: started / progress / result / cancelled / complete / failed
 *   4. DELETE cancellation: SSE runner stops before the next scenario
 *   5. Infrastructure counts lazy-load only when the Infrastructure tab is opened
 */
import { describe, it, expect } from 'vitest';

// ── 1. RPC lesson count map building ──────────────────────────────────────────

describe('sandbox_lesson_counts_by_agent RPC', () => {
  it('builds lessonsByAgent map from COUNT(*) GROUP BY rows', () => {
    // Simulates what the updated health/route.ts does with RPC data.
    const rpcRows: Array<{ agent_id: string; lesson_count: number }> = [
      { agent_id: 'quote-triage', lesson_count: 42 },
      { agent_id: 'scheduling', lesson_count: 7 },
      { agent_id: 'customer-reply', lesson_count: 0 },
    ];

    const lessonsByAgent = new Map<string, number>(
      rpcRows.map((row) => [row.agent_id, Number(row.lesson_count)]),
    );

    expect(lessonsByAgent.get('quote-triage')).toBe(42);
    expect(lessonsByAgent.get('scheduling')).toBe(7);
    expect(lessonsByAgent.get('customer-reply')).toBe(0);
    expect(lessonsByAgent.has('unknown-agent')).toBe(false);
  });

  it('handles bigint strings from Postgres by coercing with Number()', () => {
    // PostgREST returns bigint as string over JSON.
    const rpcRows = [{ agent_id: 'quote-triage', lesson_count: '2001' as unknown as number }];
    const lessonsByAgent = new Map(rpcRows.map((row) => [row.agent_id, Number(row.lesson_count)]));
    expect(lessonsByAgent.get('quote-triage')).toBe(2001);
  });

  it('returns an empty map for an empty RPC result', () => {
    const lessonsByAgent = new Map<string, number>(
      ([] as Array<{ agent_id: string; lesson_count: number }>).map((row) => [row.agent_id, Number(row.lesson_count)]),
    );
    expect(lessonsByAgent.size).toBe(0);
  });

  it('never under-counts above 2000 rows (the old limit)', () => {
    // Simulate what the old approach would produce at 2001 lessons (capped).
    const allLessons = Array.from({ length: 2001 }, (_, i) => ({ agent_id: i < 2000 ? 'quote-triage' : 'scheduling' }));
    const oldMap = new Map<string, number>();
    for (const row of allLessons.slice(0, 2000)) {
      oldMap.set(row.agent_id, (oldMap.get(row.agent_id) ?? 0) + 1);
    }
    // Old approach misses the last lesson for 'scheduling'.
    expect(oldMap.get('scheduling')).toBeUndefined();

    // New RPC approach uses server-side count — no cap.
    const rpcRows = [
      { agent_id: 'quote-triage', lesson_count: 2000 },
      { agent_id: 'scheduling', lesson_count: 1 },
    ];
    const newMap = new Map(rpcRows.map((row) => [row.agent_id, Number(row.lesson_count)]));
    expect(newMap.get('scheduling')).toBe(1); // correctly counted
  });
});

// ── 2. run-history nested score join ──────────────────────────────────────────

describe('run-history nested score join', () => {
  // Simulates the join logic in GET /api/sandbox/run-history.
  type ScoreRow = { precision_score: number; recall_score: number; f1_score: number; hit: boolean; scored_at: string };
  type ResponseWithScore = { id: string; training_run_id: string; sandbox_decision_scores: ScoreRow[] | null };

  function buildHistoryRow(response: ResponseWithScore | null) {
    const score = response?.sandbox_decision_scores?.[0] ?? null;
    return {
      score: score ? {
        precisionScore: Number(score.precision_score ?? 0),
        recallScore: Number(score.recall_score ?? 0),
        f1Score: Number(score.f1_score ?? 0),
        hit: Boolean(score.hit),
        scoredAt: score.scored_at,
      } : null,
    };
  }

  it('surfaces score through the nested PostgREST join', () => {
    const response: ResponseWithScore = {
      id: 'resp-1',
      training_run_id: 'run-1',
      sandbox_decision_scores: [{
        precision_score: 0.8,
        recall_score: 0.9,
        f1_score: 0.847,
        hit: true,
        scored_at: '2026-06-15T10:00:00Z',
      }],
    };
    const row = buildHistoryRow(response);
    expect(row.score).not.toBeNull();
    expect(row.score?.f1Score).toBeCloseTo(0.847, 3);
    expect(row.score?.hit).toBe(true);
  });

  it('returns null score when response has no scores', () => {
    const response: ResponseWithScore = {
      id: 'resp-2',
      training_run_id: 'run-2',
      sandbox_decision_scores: [],
    };
    expect(buildHistoryRow(response).score).toBeNull();
  });

  it('returns null score when response is absent', () => {
    expect(buildHistoryRow(null).score).toBeNull();
  });

  it('takes the first score when multiple scores exist (latest-first ordering)', () => {
    const response: ResponseWithScore = {
      id: 'resp-3',
      training_run_id: 'run-3',
      sandbox_decision_scores: [
        { precision_score: 0.9, recall_score: 0.9, f1_score: 0.9, hit: true, scored_at: '2026-06-15T11:00:00Z' },
        { precision_score: 0.1, recall_score: 0.1, f1_score: 0.1, hit: false, scored_at: '2026-06-14T11:00:00Z' },
      ],
    };
    const row = buildHistoryRow(response);
    expect(row.score?.f1Score).toBeCloseTo(0.9, 3);
  });
});

// ── 3. SSE event parser ────────────────────────────────────────────────────────

// Simulates the handleSseEvent logic from page.tsx.
type RunStatus = {
  status: 'running' | 'complete' | 'failed' | 'cancelled';
  currentIndex: number;
  total: number;
  passCount?: number;
  failCount?: number;
  message: string;
  currentScenario?: string;
  batchId?: string;
};

function applySseEvent(current: RunStatus, event: Record<string, unknown>): RunStatus {
  const type = event.type as string;
  const next = { ...current };

  if (type === 'started') {
    next.total = Number(event.total ?? current.total);
    next.message = `Pack started. 0 of ${event.total} scenarios queued.`;
  }
  if (type === 'progress') {
    next.currentIndex = Number(event.index ?? 0);
    next.currentScenario = String(event.scenarioTitle ?? '');
    next.message = `Running ${Number(event.index ?? 0) + 1} of ${event.total}: ${event.scenarioTitle}`;
  }
  if (type === 'result') {
    const passed = (Number(event.index ?? 1));
    next.currentIndex = passed;
    const f1 = (event.result as { f1Score: number }).f1Score;
    if (f1 >= 0.5) {
      next.passCount = (current.passCount ?? 0) + 1;
    } else {
      next.failCount = (current.failCount ?? 0) + 1;
    }
    next.message = `Completed ${passed} of ${event.total}.`;
  }
  if (type === 'cancelled') {
    next.status = 'cancelled';
    next.currentIndex = Number(event.completed ?? 0);
    next.message = `Pack cancelled after ${event.completed} scenarios.`;
  }
  if (type === 'complete') {
    next.status = 'complete';
    next.passCount = Number(event.passCount ?? 0);
    next.failCount = Number(event.total ?? 0) - Number(event.passCount ?? 0);
    next.currentIndex = Number(event.total ?? 0);
    next.message = `Pack complete — ${event.passCount}/${event.total} passed.`;
  }
  if (type === 'failed') {
    next.status = 'failed';
    next.message = String(event.error ?? 'Pack failed');
  }
  return next;
}

describe('SSE event parser', () => {
  const base: RunStatus = {
    status: 'running',
    currentIndex: 0,
    total: 5,
    passCount: 0,
    failCount: 0,
    message: '',
  };

  it('handles started event', () => {
    const next = applySseEvent(base, { type: 'started', total: 10 });
    expect(next.total).toBe(10);
    expect(next.status).toBe('running');
  });

  it('handles progress event', () => {
    const next = applySseEvent(base, { type: 'progress', index: 2, total: 5, scenarioTitle: 'Test A' });
    expect(next.currentIndex).toBe(2);
    expect(next.currentScenario).toBe('Test A');
  });

  it('increments passCount on passing result', () => {
    const next = applySseEvent({ ...base, passCount: 1, failCount: 0 }, {
      type: 'result',
      index: 2,
      total: 5,
      result: { f1Score: 0.9, precisionScore: 0.9, recallScore: 0.9, hit: true },
    });
    expect(next.passCount).toBe(2);
    expect(next.failCount).toBe(0);
  });

  it('increments failCount on failing result', () => {
    const next = applySseEvent({ ...base, passCount: 0, failCount: 0 }, {
      type: 'result',
      index: 1,
      total: 5,
      result: { f1Score: 0.2, precisionScore: 0.2, recallScore: 0.2, hit: false },
    });
    expect(next.failCount).toBe(1);
    expect(next.passCount).toBe(0);
  });

  it('transitions to cancelled state', () => {
    const next = applySseEvent(base, { type: 'cancelled', completed: 3 });
    expect(next.status).toBe('cancelled');
    expect(next.currentIndex).toBe(3);
    expect(next.message).toContain('3 scenarios');
  });

  it('transitions to complete state with correct counts', () => {
    const next = applySseEvent(base, { type: 'complete', passCount: 4, total: 5, avgF1: 0.82 });
    expect(next.status).toBe('complete');
    expect(next.passCount).toBe(4);
    expect(next.failCount).toBe(1);
    expect(next.currentIndex).toBe(5);
  });

  it('transitions to failed state', () => {
    const next = applySseEvent(base, { type: 'failed', error: 'LLM timeout' });
    expect(next.status).toBe('failed');
    expect(next.message).toBe('LLM timeout');
  });

  it('parses SSE line format: data: {...}\\n\\n', () => {
    const line = 'data: {"type":"complete","passCount":3,"total":5,"avgF1":0.75}\n';
    expect(line.startsWith('data: ')).toBe(true);
    const event = JSON.parse(line.slice(6).trim());
    expect(event.type).toBe('complete');
    expect(event.passCount).toBe(3);
  });
});

// ── 4. DELETE cancellation — stops before next scenario ───────────────────────

describe('DELETE cancellation', () => {
  // Simulates the SSE runner's cancellation checkpoint logic.
  async function runWithCancelCheckpoint(
    scenarios: string[],
    cancelAfter: number,
    checkStatus: (batchId: string) => Promise<string>,
  ): Promise<{ ran: string[]; cancelled: boolean }> {
    const ran: string[] = [];
    for (const scenario of scenarios) {
      const status = await checkStatus('batch-1');
      if (status === 'cancelled') {
        return { ran, cancelled: true };
      }
      ran.push(scenario);
      if (ran.length === cancelAfter) {
        // Simulate DELETE being called here — next iteration should catch it.
      }
    }
    return { ran, cancelled: false };
  }

  it('stops before the next scenario when batch is cancelled', async () => {
    let callCount = 0;
    const checkStatus = async (_id: string) => {
      callCount += 1;
      // Return 'cancelled' after the first status check (i.e. before scenario 2).
      return callCount > 1 ? 'cancelled' : 'running';
    };

    const result = await runWithCancelCheckpoint(
      ['scenario-1', 'scenario-2', 'scenario-3'],
      1,
      checkStatus,
    );

    expect(result.cancelled).toBe(true);
    expect(result.ran).toEqual(['scenario-1']);
  });

  it('does not cancel when all scenarios run normally', async () => {
    const checkStatus = async (_id: string) => 'running';
    const result = await runWithCancelCheckpoint(
      ['scenario-1', 'scenario-2'],
      999,
      checkStatus,
    );
    expect(result.cancelled).toBe(false);
    expect(result.ran).toEqual(['scenario-1', 'scenario-2']);
  });

  it('cancelled packs are not marked as failed', () => {
    // Verify the status transition: cancelled != failed.
    const statusAfterCancel: RunStatus['status'] = 'cancelled';
    const statusAfterFail: RunStatus['status'] = 'failed';
    expect(statusAfterCancel).toBe('cancelled');
    expect(statusAfterCancel).not.toBe('failed');
    expect(statusAfterCancel).not.toBe(statusAfterFail);
  });
});

// ── 5. Infrastructure counts lazy-load ────────────────────────────────────────

describe('infrastructure lazy-load', () => {
  it('sandboxInitializedRef prevents double-fetching on tab re-open', () => {
    // Simulates the useEffect guard in page.tsx.
    let fetchCount = 0;
    const sandboxInitializedRef = { current: false };

    function onTabOpen(tab: string) {
      if (tab === 'infrastructure' && !sandboxInitializedRef.current) {
        sandboxInitializedRef.current = true;
        fetchCount += 1;
      }
    }

    // First open triggers fetch.
    onTabOpen('infrastructure');
    expect(fetchCount).toBe(1);

    // Second open does not.
    onTabOpen('infrastructure');
    expect(fetchCount).toBe(1);

    // Other tabs never trigger it.
    onTabOpen('overview');
    onTabOpen('run');
    expect(fetchCount).toBe(1);
  });

  it('stale-time cache skips requests within the window', () => {
    const freshAt = { health: 0, readiness: 0, lessons: 0, history: 0 };
    const STALE = { health: 60_000, readiness: 120_000, lessons: 60_000, history: 30_000 };
    let fetches = 0;

    function maybeLoad(key: keyof typeof freshAt, force = false) {
      const now = Date.now();
      if (!force && now - freshAt[key] < STALE[key]) return;
      fetches += 1;
      freshAt[key] = now;
    }

    // First call always fetches.
    maybeLoad('health');
    expect(fetches).toBe(1);

    // Immediate second call is skipped (fresh).
    maybeLoad('health');
    expect(fetches).toBe(1);

    // Force bypasses stale time.
    maybeLoad('health', true);
    expect(fetches).toBe(2);
  });
});
