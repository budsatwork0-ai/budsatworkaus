import { describe, expect, it } from 'vitest';
import { cleanupProjection, summarize } from '../../scripts/cleanup-bud-approvals.mjs';

const staleDate = '2026-01-01T00:00:00.000Z';

function approval(overrides = {}) {
  return {
    id: 'approval',
    task_id: 'task',
    action_type: 'run_improvement_pipeline',
    payload: {},
    status: 'pending',
    created_at: staleDate,
    blocked_at: null,
    blocked_reason: null,
    bud_tasks: {
      id: 'task',
      status: 'pending',
      risk_level: 'low',
      linked_pr: null,
    },
    ...overrides,
  };
}

describe('Bud approval historical cleanup', () => {
  it('marks blocked pending approvals as blocked', () => {
    const { candidates, projected } = cleanupProjection([
      approval({
        id: 'blocked-approval',
        bud_tasks: {
          id: 'task-blocked',
          status: 'pending',
          risk_level: 'high',
          linked_pr: null,
        },
      }),
    ], '2026-06-03T00:00:00.000Z');

    expect(candidates).toHaveLength(1);
    expect(projected[0].status).toBe('blocked');
    expect(projected[0].blocked_at).toBe('2026-06-03T00:00:00.000Z');
    expect(projected[0].blocked_reason).toContain('stale high-risk approval');
  });

  it('leaves actionable pending approvals pending', () => {
    const { candidates, projected } = cleanupProjection([
      approval({
        id: 'actionable-approval',
        bud_tasks: {
          id: 'task-actionable',
          status: 'pending',
          risk_level: 'low',
          linked_pr: null,
        },
      }),
    ]);

    expect(candidates).toHaveLength(0);
    expect(projected[0].status).toBe('pending');
  });

  it('leaves manual-review pending approvals pending', () => {
    const { candidates, projected } = cleanupProjection([
      approval({
        id: 'manual-review-approval',
        created_at: new Date().toISOString(),
        bud_tasks: {
          id: 'task-manual',
          status: 'pending',
          risk_level: 'high',
          linked_pr: null,
        },
      }),
    ]);

    expect(candidates).toHaveLength(0);
    expect(projected[0].status).toBe('pending');
  });

  it('leaves archived approvals untouched', () => {
    const row = approval({
      id: 'archived-approval',
      status: 'archived',
      archived_at: '2026-05-01T00:00:00.000Z',
      archive_reason: 'Already archived.',
      bud_tasks: {
        id: 'task-archived',
        status: 'completed',
        risk_level: 'high',
        linked_pr: null,
      },
    });

    const { candidates, projected } = cleanupProjection([row]);

    expect(candidates).toHaveLength(0);
    expect(projected[0]).toEqual(row);
  });

  it('is idempotent', () => {
    const first = cleanupProjection([
      approval({
        id: 'blocked-approval',
        bud_tasks: {
          id: 'task-blocked',
          status: 'completed',
          risk_level: 'low',
          linked_pr: null,
        },
      }),
    ], '2026-06-03T00:00:00.000Z');
    const second = cleanupProjection(first.projected, '2026-06-03T00:05:00.000Z');

    expect(first.candidates).toHaveLength(1);
    expect(second.candidates).toHaveLength(0);
    expect(second.projected[0].status).toBe('blocked');
    expect(second.projected[0].blocked_at).toBe('2026-06-03T00:00:00.000Z');
  });

  it('moves blocked rows out of pending counts while preserving audit counts', () => {
    const beforeRows = [
      approval({
        id: 'blocked-approval',
        bud_tasks: {
          id: 'task-blocked',
          status: 'pending',
          risk_level: 'high',
          linked_pr: null,
        },
      }),
      approval({
        id: 'actionable-approval',
        bud_tasks: {
          id: 'task-actionable',
          status: 'pending',
          risk_level: 'low',
          linked_pr: null,
        },
      }),
    ];
    const afterRows = cleanupProjection(beforeRows).projected;

    expect(summarize(beforeRows).pending_bud_approvals).toBe(2);
    expect(summarize(afterRows).pending_bud_approvals).toBe(1);
    expect(summarize(afterRows).blocked_historical).toBe(1);
  });
});
