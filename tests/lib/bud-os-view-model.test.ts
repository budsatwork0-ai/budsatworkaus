import { describe, expect, it } from 'vitest';
import { buildBudOsActionQueue, deriveBudOsState } from '@/lib/bud/os-view-model';
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
});
