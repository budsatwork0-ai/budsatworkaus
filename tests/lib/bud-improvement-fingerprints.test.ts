import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  computeApprovalIdentity,
  computeImprovementFingerprint,
  queueApproval,
  triggerImprovement,
} from '@/lib/bud/orchestrator';

vi.mock('@/lib/pipeline/engine', () => ({
  emitStage: vi.fn(),
  finalizePipelineRun: vi.fn(),
  signalToSurface: vi.fn(() => 'admin'),
}));

vi.mock('@/lib/bud/github-executor', () => ({
  createIssue: vi.fn(),
  createBranch: vi.fn(),
  budBranchName: vi.fn(() => 'bud/fix-test'),
  branchExists: vi.fn(),
}));

type Row = Record<string, unknown>;

class Query {
  private filters: Array<{ key: string; value: unknown }> = [];
  private inFilters: Array<{ key: string; values: unknown[] }> = [];
  private mode: 'select' | 'insert' | 'update';

  constructor(
    private db: MockSupabase,
    private table: string,
    mode: 'select' | 'insert' | 'update',
    private payload?: Row,
  ) {
    this.mode = mode;
  }

  select() { return this; }
  eq(key: string, value: unknown) { this.filters.push({ key, value }); return this; }
  in(key: string, values: unknown[]) { this.inFilters.push({ key, values }); return this; }
  gte() { return this; }
  limit() { return this; }
  order() { return this; }

  private rows(): Row[] {
    return this.db.rows(this.table).filter((row) => (
      this.filters.every((filter) => row[filter.key] === filter.value) &&
      this.inFilters.every((filter) => filter.values.includes(row[filter.key]))
    ));
  }

  maybeSingle() {
    const data = this.rows()[0] ?? null;
    return Promise.resolve({ data, error: null });
  }

  single() {
    if (this.mode === 'insert') {
      const row = { id: `${this.table}-${this.db.rows(this.table).length + 1}`, ...this.payload };
      this.db.rows(this.table).push(row);
      return Promise.resolve({ data: row, error: null });
    }
    if (this.mode === 'update') {
      const data = this.rows()[0] ?? null;
      if (data) Object.assign(data, this.payload);
      return Promise.resolve({ data, error: data ? null : { message: 'not found' } });
    }
    const data = this.rows()[0] ?? null;
    return Promise.resolve({ data, error: data ? null : { message: 'not found' } });
  }

  then(resolve: (value: { data: Row[] | null; error: null }) => void) {
    if (this.mode === 'update') {
      for (const row of this.rows()) Object.assign(row, this.payload);
      resolve({ data: this.rows(), error: null });
      return;
    }
    resolve({ data: this.rows(), error: null });
  }
}

class MockSupabase {
  taskInserts = 0;
  approvalInserts = 0;
  private tables: Record<string, Row[]> = {
    bud_improvement_signals: [],
    pipeline_kill_switch: [],
    pipeline_policy: [],
    pipeline_runs: [],
    bud_tasks: [],
    bud_approval_queue: [],
    bud_activity_feed: [],
  };

  rows(table: string): Row[] {
    this.tables[table] ??= [];
    return this.tables[table];
  }

  seed(table: string, row: Row) {
    this.rows(table).push(row);
  }

  from(table: string) {
    return {
      select: () => new Query(this, table, 'select'),
      update: (payload: Row) => new Query(this, table, 'update', payload),
      insert: (payload: Row) => {
        if (table === 'bud_tasks') this.taskInserts++;
        if (table === 'bud_approval_queue') this.approvalInserts++;
        return new Query(this, table, 'insert', payload);
      },
    };
  }
}

describe('improvement signal fingerprints', () => {
  beforeEach(() => {
    process.env.BUD_AUTONOMY_LEVEL = '1';
  });

  it('uses the same fingerprint for the same customer-reply error spike with different counts', () => {
    const first = computeImprovementFingerprint({
      signalType: 'error_spike',
      affectedArea: 'customer-reply',
      title: 'Customer Reply error spike: 21 failures',
    });
    const second = computeImprovementFingerprint({
      signalType: 'error_spike',
      affectedArea: 'customer-reply',
      title: 'Customer Reply error spike: 84 failures',
    });

    expect(second).toBe(first);
  });

  it('uses a different fingerprint for a different agent', () => {
    const customerReply = computeImprovementFingerprint({
      signalType: 'error_spike',
      affectedArea: 'customer-reply',
      title: 'Customer Reply error spike: 21 failures',
    });
    const quoteTriage = computeImprovementFingerprint({
      signalType: 'error_spike',
      affectedArea: 'quote-triage',
      title: 'Customer Reply error spike: 21 failures',
    });

    expect(quoteTriage).not.toBe(customerReply);
  });

  it('uses a different fingerprint for a different issue type', () => {
    const errorSpike = computeImprovementFingerprint({
      signalType: 'error_spike',
      affectedArea: 'customer-reply',
      title: 'Customer Reply error spike: 21 failures',
    });
    const performance = computeImprovementFingerprint({
      signalType: 'performance',
      affectedArea: 'customer-reply',
      title: 'Customer Reply error spike: 21 failures',
    });

    expect(performance).not.toBe(errorSpike);
  });

  it('updates an active duplicate signal without creating a duplicate approval', async () => {
    const supabase = new MockSupabase();
    const fingerprint = computeImprovementFingerprint({
      signalType: 'error_spike',
      affectedArea: 'customer-reply',
      title: 'Customer Reply error spike: 21 failures',
    });
    supabase.seed('bud_improvement_signals', {
      id: 'signal-existing',
      signal_type: 'error_spike',
      affected_area: 'customer-reply',
      title: 'Customer Reply error spike: 21 failures',
      status: 'queued',
      fingerprint,
      metadata: { latest_observed_count: 21 },
    });

    const result = await triggerImprovement(supabase as never, {
      source: 'observer',
      signalType: 'error_spike',
      severity: 'high',
      title: 'Customer Reply error spike: 84 failures',
      description: 'Customer Reply has a new error spike.',
      affectedArea: 'customer-reply',
      metadata: { error_count: 84 },
      requestedBy: 'bud-observer',
    });

    expect(result).toEqual({ signalId: 'signal-existing', status: 'deduplicated' });
    expect(supabase.taskInserts).toBe(0);
    expect(supabase.approvalInserts).toBe(0);
    expect(supabase.rows('bud_improvement_signals')[0].metadata).toMatchObject({
      latest_observed_count: 84,
      error_count: 84,
    });
  });

  it('updates an existing duplicate improvement approval', async () => {
    const supabase = new MockSupabase();
    const payload = { signal_id: 'signal-1', title: 'Customer Reply error spike: 21 failures' };
    const approvalIdentity = computeApprovalIdentity({
      action_type: 'run_improvement_pipeline',
      payload,
    });
    supabase.seed('bud_approval_queue', {
      id: 'approval-existing',
      task_id: 'task-1',
      action_type: 'run_improvement_pipeline',
      status: 'pending',
      approval_identity: approvalIdentity,
      payload: { signal_id: 'signal-1', title: 'Customer Reply error spike: 21 failures' },
    });

    const id = await queueApproval(supabase as never, {
      task_id: 'task-2',
      action_type: 'run_improvement_pipeline',
      payload: { signal_id: 'signal-1', title: 'Customer Reply error spike: 84 failures', error_count: 84 },
      requested_by: 'bud-observer',
    });

    expect(id).toBe('approval-existing');
    expect(supabase.approvalInserts).toBe(0);
    expect(supabase.rows('bud_approval_queue')).toHaveLength(1);
    expect(supabase.rows('bud_approval_queue')[0].payload).toMatchObject({
      signal_id: 'signal-1',
      title: 'Customer Reply error spike: 84 failures',
      error_count: 84,
    });
    expect(supabase.rows('bud_approval_queue')[0].last_seen_at).toBeTruthy();
  });

  it('creates a separate approval for a different signal_id', async () => {
    const supabase = new MockSupabase();
    supabase.seed('bud_approval_queue', {
      id: 'approval-existing',
      task_id: 'task-1',
      action_type: 'run_improvement_pipeline',
      status: 'pending',
      approval_identity: computeApprovalIdentity({
        action_type: 'run_improvement_pipeline',
        payload: { signal_id: 'signal-1' },
      }),
      payload: { signal_id: 'signal-1' },
    });

    const id = await queueApproval(supabase as never, {
      task_id: 'task-2',
      action_type: 'run_improvement_pipeline',
      payload: { signal_id: 'signal-2', title: 'Another improvement' },
      requested_by: 'bud-observer',
    });

    expect(id).toBe('bud_approval_queue-2');
    expect(supabase.approvalInserts).toBe(1);
    expect(supabase.rows('bud_approval_queue')).toHaveLength(2);
  });

  it('does not reuse blocked or archived approvals as active approvals', async () => {
    const supabase = new MockSupabase();
    const approvalIdentity = computeApprovalIdentity({
      action_type: 'run_improvement_pipeline',
      payload: { signal_id: 'signal-1' },
    });
    supabase.seed('bud_approval_queue', {
      id: 'approval-blocked',
      task_id: 'task-1',
      action_type: 'run_improvement_pipeline',
      status: 'blocked',
      approval_identity: approvalIdentity,
      payload: { signal_id: 'signal-1' },
    });
    supabase.seed('bud_approval_queue', {
      id: 'approval-archived',
      task_id: 'task-2',
      action_type: 'run_improvement_pipeline',
      status: 'archived',
      approval_identity: approvalIdentity,
      payload: { signal_id: 'signal-1' },
    });

    const id = await queueApproval(supabase as never, {
      task_id: 'task-3',
      action_type: 'run_improvement_pipeline',
      payload: { signal_id: 'signal-1', title: 'Fresh approval after blocked history' },
      requested_by: 'bud-observer',
    });

    expect(id).toBe('bud_approval_queue-3');
    expect(supabase.approvalInserts).toBe(1);
    expect(supabase.rows('bud_approval_queue')).toHaveLength(3);
    expect(supabase.rows('bud_approval_queue')[2].status).toBe('pending');
  });
});
