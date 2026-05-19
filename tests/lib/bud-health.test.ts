import { describe, expect, it } from 'vitest';
import { evaluateGlobalHealth } from '@/lib/bud/health';

const now = new Date('2026-05-19T00:00:00.000Z').toISOString();

describe('evaluateGlobalHealth', () => {
  it('only reports nominal when every global health signal is clear', () => {
    const health = evaluateGlobalHealth({
      agents: [{ id: 'cash-flow-forecaster', status: 'enabled' }],
      runs: [
        {
          id: 'run-1',
          agent_id: 'cash-flow-forecaster',
          status: 'succeeded',
          summary: 'Cash flow forecast updated with actionable weekly variance analysis.',
          output: {
            status: 'success',
            summary: 'Cash flow forecast updated.',
            findings: ['Receivables are stable'],
            recommended_actions: [],
            confidence: 0.9,
            risk_level: 'low',
          },
          started_at: now,
        },
      ],
      actions: [],
    });

    expect(health.is_nominal).toBe(true);
    expect(health.status).toBe('nominal');
    expect(health.bud_status).toBe('nominal');
  });

  it('blocks nominal when failed, broken, repair, watch, approval, parse, and alert signals exist', () => {
    const health = evaluateGlobalHealth({
      agents: [
        { id: 'cash-flow-forecaster', status: 'broken' },
        { id: 'admin-ux-designer', status: 'needs_repair' },
        { id: 'competitor-scout', status: 'watch' },
        { id: 'lobby-theme-curator', status: 'enabled' },
      ],
      runs: [
        {
          id: 'run-failed',
          agent_id: 'cash-flow-forecaster',
          status: 'failed',
          summary: 'Unexpected error',
          started_at: now,
        },
        {
          id: 'run-parse',
          agent_id: 'lobby-theme-curator',
          status: 'needs_repair',
          summary: 'Could not parse theme JSON',
          started_at: now,
        },
      ],
      actions: [
        { id: 'approval-1', agent_id: 'competitor-scout', status: 'pending' },
        { id: 'approval-2', agent_id: null, status: 'pending' },
      ],
      unresolvedAlerts: 1,
    });

    expect(health.is_nominal).toBe(false);
    expect(health.status).toBe('attention_required');
    expect(health.bud_status).toBe('critical');
    expect(health.counts.failed_runs).toBe(1);
    expect(health.counts.broken_agents).toBeGreaterThan(0);
    expect(health.counts.needs_repair_agents).toBeGreaterThan(0);
    expect(health.counts.watch_agents).toBeGreaterThan(0);
    expect(health.counts.pending_approvals).toBe(2);
    expect(health.counts.parse_failures).toBe(1);
    expect(health.counts.unresolved_alerts).toBe(1);
    expect(health.summary).toContain('Operational review complete — attention required.');
  });

  it('reports degraded for watch and approval issues without hard failures', () => {
    const health = evaluateGlobalHealth({
      agents: [{ id: 'competitor-scout', status: 'watch' }],
      runs: [],
      actions: [{ id: 'approval-1', agent_id: 'competitor-scout', status: 'pending' }],
    });

    expect(health.status).toBe('degraded');
    expect(health.bud_status).toBe('elevated');
  });
});
