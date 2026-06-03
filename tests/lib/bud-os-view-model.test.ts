import { describe, expect, it } from 'vitest';
import {
  buildBudOsActionQueue,
  deriveBudOsState,
  deriveAgentBizValue,
  deriveAgentDisplayStatus,
  buildAgentImpactMap,
  HIGH_VALUE_AGENT_IDS,
} from '@/lib/bud/os-view-model';
import { deriveGlobalTruth } from '@/lib/bud/overview-v2';
import type { MissionControlHealth } from '@/lib/bud/health';

const baseCommandState: MissionControlHealth = {
  command_name: 'Bud OS',
  operating_mode: 'monitoring',
  status: 'nominal',
  bud_status: 'nominal',
  counts: {
    failed_runs: 0,
    broken_agents: 0,
    needs_repair_agents: 0,
    watch_agents: 0,
    pending_approvals: 0,
    parse_failures: 0,
    unresolved_alerts: 0,
    low_success_rate_agents: 0,
    blocked_repairs: 0,
  },
  agents_needing_attention: [],
  summary: 'Bud is watching.',
  is_nominal: true,
  agents: [
    {
      id: 'quote-triage',
      name: 'Quote Triage',
      category: 'customer',
      autonomy: 'review',
      configured_status: 'enabled',
      lifecycle: 'idle',
      health: {
        score: 100,
        label: 'healthy',
        reasons: [],
        parse_valid: true,
        output_useful: true,
        repeated_failures: false,
      },
      runs_7d: 1,
      successes_7d: 1,
      failures_7d: 0,
      pending_approvals: 0,
      last_run_at: '2026-05-19T00:00:00.000Z',
      last_failure: null,
      recommended_action: 'No action needed',
    },
  ],
  repair_sessions: [],
  deployment: {
    connected: false,
    status: 'unknown',
    last_event_at: null,
    last_success_at: null,
    last_failure_at: null,
    last_url: null,
    summary: 'No deployment telemetry is reaching Bud yet.',
  },
  capabilities: [],
  memory: {
    connected: false,
    recent_count: 0,
    last_write_at: null,
    learning_ready: false,
  },
  approvals: {
    pending_agent_actions: 0,
    pending_bud_approvals: 0,
    actionable_pending: 0,
    needs_manual_review: 0,
    archived_stale: 0,
    blocked_historical: 0,
    total_pending: 0,
  },
};

describe('Bud OS view model', () => {
  it('does not describe an issue state as nominal or idle', () => {
    const state = deriveBudOsState({
      ...baseCommandState,
      status: 'attention_required',
      bud_status: 'critical',
      is_nominal: false,
      summary: 'Bud OS requires attention.',
      counts: { ...baseCommandState.counts, failed_runs: 1 },
    }, 'idle');

    expect(state.label).toBe('Investigating');
    expect(state.summary).toContain('attention');
    expect(state.hasIssues).toBe(true);
  });

  it('groups approvals before suggested improvements and watch items', () => {
    const queue = buildBudOsActionQueue({
      commandState: baseCommandState,
      runs: [
        {
          id: 'run-failed',
          agent_id: 'quote-triage',
          status: 'failed',
          summary: 'Quote parser failed.',
          started_at: '2026-05-19T00:00:00.000Z',
        },
      ],
      actions: [
        {
          id: 'action-1',
          agent_id: 'quote-triage',
          action_type: 'send_quote',
          preview: 'Send reviewed quote',
          created_at: '2026-05-19T00:01:00.000Z',
        },
      ],
      insights: [
        {
          id: 'insight-1',
          agent_id: null,
          category: 'ux',
          severity: 'info',
          title: 'Simplify quote review',
          created_at: '2026-05-19T00:02:00.000Z',
        },
      ],
      budApprovals: [],
      uxEvolution: [],
    });

    expect(queue.map((item) => item.group)).toEqual([
      'needs_approval',
      'suggested_improvements',
      'watch_items',
    ]);
  });

  it('excludes blocked and archived Bud approvals from the decision queue', () => {
    const queue = buildBudOsActionQueue({
      commandState: baseCommandState,
      runs: [],
      actions: [],
      insights: [],
      budApprovals: [
        {
          id: 'approval-actionable',
          task_id: 'task-1',
          action_type: 'run_improvement_pipeline',
          payload: {},
          status: 'pending',
          requested_by: null,
          reviewed_by: null,
          reviewed_at: null,
          notes: null,
          created_at: '2026-05-19T00:00:00.000Z',
          truth_label: 'Actionable',
        },
        {
          id: 'approval-manual',
          task_id: 'task-2',
          action_type: 'run_improvement_pipeline',
          payload: {},
          status: 'pending',
          requested_by: null,
          reviewed_by: null,
          reviewed_at: null,
          notes: null,
          created_at: '2026-05-19T00:01:00.000Z',
          truth_label: 'Needs manual review',
        },
        {
          id: 'approval-blocked',
          task_id: 'task-3',
          action_type: 'run_improvement_pipeline',
          payload: {},
          status: 'pending',
          requested_by: null,
          reviewed_by: null,
          reviewed_at: null,
          notes: null,
          created_at: '2026-05-19T00:02:00.000Z',
          truth_label: 'Blocked',
        },
        {
          id: 'approval-archived',
          task_id: 'task-4',
          action_type: 'run_improvement_pipeline',
          payload: {},
          status: 'archived',
          requested_by: null,
          reviewed_by: null,
          reviewed_at: null,
          notes: null,
          created_at: '2026-05-19T00:03:00.000Z',
          truth_label: 'Archived',
        },
      ],
      uxEvolution: [],
    });

    expect(queue.map((item) => item.source_id)).toEqual([
      'approval-manual',
      'approval-actionable',
    ]);
    expect(queue.every((item) => item.group === 'needs_approval')).toBe(true);
  });

  it('treats approval thresholds as awaiting decision, not platform blocked', () => {
    const truth = deriveGlobalTruth({
      ...baseCommandState,
      global_status: 'blocked',
      status: 'attention_required',
      bud_status: 'critical',
      is_nominal: false,
      counts: { ...baseCommandState.counts, blocked_repairs: 1 },
    });

    expect(truth.state).toBe('approval');
    expect(truth.headline).toBe('Awaiting decision');
  });

  it('keeps failed deployments in the blocked state', () => {
    const truth = deriveGlobalTruth({
      ...baseCommandState,
      global_status: 'blocked',
      status: 'attention_required',
      bud_status: 'critical',
      is_nominal: false,
      deployment: {
        ...baseCommandState.deployment,
        status: 'failed',
        summary: 'Last deployment failed.',
      },
    });

    expect(truth.state).toBe('blocked');
  });

  it('improvement approval with full metadata surfaces evidence fields', () => {
    const queue = buildBudOsActionQueue({
      commandState: baseCommandState,
      runs: [],
      actions: [],
      insights: [],
      budApprovals: [
        {
          id: 'approval-improvement-full',
          task_id: 'task-10',
          action_type: 'run_improvement_pipeline',
          payload: {
            description: 'Quote form has high drop-off on mobile.',
            proposed_approach: 'Reduce form steps from 4 to 2.',
            reference_files: ['src/app/(public)/services/page.tsx'],
            affected_area: 'quote-triage',
            signal_type: 'ux_friction',
            pr_url: 'https://github.com/org/repo/pull/42',
          },
          status: 'pending',
          requested_by: null,
          reviewed_by: null,
          reviewed_at: null,
          notes: null,
          created_at: '2026-06-03T00:00:00.000Z',
          truth_label: 'Actionable',
          // bud_tasks is joined at the DB layer; the view model casts internally
          bud_tasks: { confidence: 0.85, risk_level: 'medium', source_agent: 'bud-observer' },
        } as unknown as import('@/lib/bud/types').BudApprovalItem,
      ],
      uxEvolution: [],
    });

    expect(queue).toHaveLength(1);
    const approval = queue[0].approval!;
    expect(approval.action_type).toBe('run_improvement_pipeline');
    expect(approval.confidence).toBe(0.85);
    expect(approval.risk_level).toBe('medium');
    expect(approval.affected_area).toBe('quote-triage');
    expect(approval.signal_type).toBe('ux_friction');
    expect(approval.linked_pr).toBe('https://github.com/org/repo/pull/42');
    expect(approval.affected_files).toContain('src/app/(public)/services/page.tsx');
    expect(approval.source_agent).toBe('bud-observer');
  });

  it('improvement approval with empty payload shows null for missing evidence fields', () => {
    const queue = buildBudOsActionQueue({
      commandState: baseCommandState,
      runs: [],
      actions: [],
      insights: [],
      budApprovals: [
        {
          id: 'approval-improvement-empty',
          task_id: null,
          action_type: 'run_improvement_pipeline',
          payload: {},
          status: 'pending',
          requested_by: null,
          reviewed_by: null,
          reviewed_at: null,
          notes: null,
          created_at: '2026-06-03T00:00:00.000Z',
          truth_label: 'Actionable',
        },
      ],
      uxEvolution: [],
    });

    expect(queue).toHaveLength(1);
    const approval = queue[0].approval!;
    expect(approval.confidence).toBeNull();
    expect(approval.risk_level).toBeNull();
    expect(approval.affected_area).toBeNull();
    expect(approval.signal_type).toBeNull();
    expect(approval.linked_pr).toBeNull();
  });

  it('non-improvement approval has null affected_area and signal_type', () => {
    const queue = buildBudOsActionQueue({
      commandState: baseCommandState,
      runs: [],
      actions: [
        {
          id: 'action-non-improvement',
          agent_id: 'quote-triage',
          action_type: 'send_email',
          preview: 'Send confirmation email to customer',
          created_at: '2026-06-03T00:00:00.000Z',
        },
      ],
      insights: [],
      budApprovals: [],
      uxEvolution: [],
    });

    expect(queue).toHaveLength(1);
    const approval = queue[0].approval!;
    expect(approval.affected_area).toBeNull();
    expect(approval.signal_type).toBeNull();
  });
});

describe('Agent value classification (Phase 7)', () => {
  it('classifies all six required high-value agents correctly', () => {
    const required = [
      'quote-triage', 'customer-reply', 'scheduling',
      'lead-scorer', 'reviews', 'cash-flow-forecaster',
    ];
    for (const id of required) {
      expect(deriveAgentBizValue(id)).toBe('high');
    }
  });

  it('classifies ops/finance support agents as medium value', () => {
    expect(deriveAgentBizValue('reconciliation')).toBe('medium');
    expect(deriveAgentBizValue('lapsed-win-back')).toBe('medium');
    expect(deriveAgentBizValue('crew-briefing')).toBe('medium');
  });

  it('classifies unknown or meta agents as low value', () => {
    expect(deriveAgentBizValue('ab-test-architect')).toBe('low');
    expect(deriveAgentBizValue('heatmap-analyst')).toBe('low');
    expect(deriveAgentBizValue('some-unknown-agent')).toBe('low');
  });

  it('HIGH_VALUE_AGENT_IDS set contains exactly the six required agents', () => {
    const required = [
      'quote-triage', 'customer-reply', 'scheduling',
      'lead-scorer', 'reviews', 'cash-flow-forecaster',
    ];
    for (const id of required) {
      expect(HIGH_VALUE_AGENT_IDS.has(id)).toBe(true);
    }
  });

  it('derives healthy status for an active, healthy agent', () => {
    const status = deriveAgentDisplayStatus({
      configured_status: 'enabled',
      lifecycle: 'active',
      health: { label: 'healthy', score: 95 },
    });
    expect(status).toBe('healthy');
  });

  it('derives watch status when health label is watch', () => {
    const status = deriveAgentDisplayStatus({
      configured_status: 'enabled',
      lifecycle: 'active',
      health: { label: 'watch', score: 70 },
    });
    expect(status).toBe('watch');
  });

  it('derives watch status when health score falls below 60', () => {
    const status = deriveAgentDisplayStatus({
      configured_status: 'enabled',
      lifecycle: 'active',
      health: { label: 'healthy', score: 55 },
    });
    expect(status).toBe('watch');
  });

  it('derives failing status for broken and needs_repair agents', () => {
    expect(deriveAgentDisplayStatus({
      configured_status: 'enabled', lifecycle: 'active',
      health: { label: 'broken', score: 0 },
    })).toBe('failing');
    expect(deriveAgentDisplayStatus({
      configured_status: 'enabled', lifecycle: 'active',
      health: { label: 'needs_repair', score: 30 },
    })).toBe('failing');
  });

  it('derives disabled status for explicitly disabled agents', () => {
    expect(deriveAgentDisplayStatus({
      configured_status: 'disabled', lifecycle: 'idle',
      health: { label: 'healthy', score: 80 },
    })).toBe('disabled');
  });

  it('derives disabled status for dormant and retired lifecycle states', () => {
    expect(deriveAgentDisplayStatus({
      configured_status: 'enabled', lifecycle: 'dormant',
      health: { label: 'inactive', score: 0 },
    })).toBe('disabled');
    expect(deriveAgentDisplayStatus({
      configured_status: 'enabled', lifecycle: 'retired',
      health: { label: 'inactive', score: 0 },
    })).toBe('disabled');
  });

  it('derives disabled status when health label is inactive', () => {
    const status = deriveAgentDisplayStatus({
      configured_status: 'enabled',
      lifecycle: 'idle',
      health: { label: 'inactive', score: 0 },
    });
    expect(status).toBe('disabled');
  });
});

describe('buildAgentImpactMap (Phase 7.5)', () => {
  it('counts all action rows per agent regardless of status', () => {
    const map = buildAgentImpactMap({
      actionRows: [
        { agent_id: 'quote-triage', status: 'pending' },
        { agent_id: 'quote-triage', status: 'approved' },
        { agent_id: 'customer-reply', status: 'executed' },
      ],
      outputRows: [],
    });
    expect(map['quote-triage'].actions_last_30d).toBe(2);
    expect(map['customer-reply'].actions_last_30d).toBe(1);
  });

  it('counts only approved and executed actions as approvals', () => {
    const map = buildAgentImpactMap({
      actionRows: [
        { agent_id: 'quote-triage', status: 'pending' },
        { agent_id: 'quote-triage', status: 'approved' },
        { agent_id: 'quote-triage', status: 'executed' },
        { agent_id: 'quote-triage', status: 'rejected' },
      ],
      outputRows: [],
    });
    expect(map['quote-triage'].approvals_last_30d).toBe(2);
  });

  it('counts succeeded run rows as outputs per agent', () => {
    const map = buildAgentImpactMap({
      actionRows: [],
      outputRows: [
        { agent_id: 'scheduling' },
        { agent_id: 'scheduling' },
        { agent_id: 'lead-scorer' },
      ],
    });
    expect(map['scheduling'].outputs_last_30d).toBe(2);
    expect(map['lead-scorer'].outputs_last_30d).toBe(1);
  });

  it('returns an empty map when both input arrays are empty', () => {
    const map = buildAgentImpactMap({ actionRows: [], outputRows: [] });
    expect(Object.keys(map)).toHaveLength(0);
  });

  it('silently skips rows with null agent_id', () => {
    const map = buildAgentImpactMap({
      actionRows: [{ agent_id: null, status: 'approved' }],
      outputRows: [{ agent_id: null }],
    });
    expect(Object.keys(map)).toHaveLength(0);
  });

  it('merges action and output data for the same agent', () => {
    const map = buildAgentImpactMap({
      actionRows: [{ agent_id: 'reviews', status: 'executed' }],
      outputRows: [{ agent_id: 'reviews' }, { agent_id: 'reviews' }],
    });
    expect(map['reviews'].actions_last_30d).toBe(1);
    expect(map['reviews'].approvals_last_30d).toBe(1);
    expect(map['reviews'].outputs_last_30d).toBe(2);
  });

  it('agents with no impact data are absent from the map — component shows "Not available"', () => {
    const map = buildAgentImpactMap({ actionRows: [], outputRows: [] });
    expect(map['cash-flow-forecaster']).toBeUndefined();
  });
});
