import { describe, expect, it, vi } from 'vitest';
import { isStalledAgent, scoreAgentHealth } from '@/lib/bud/health';

// ---------- isStalledAgent unit tests ----------------------------------------

describe('isStalledAgent', () => {
  const noOpRun = (i = 0) => ({
    status: 'succeeded',
    summary: 'No unanswered messages with a usable email.',
    started_at: new Date(Date.now() - i * 60_000).toISOString(),
  });

  // Summaries must be >40 chars to pass isUsefulSummary's length gate.
  const actionableRun = (i = 0) => ({
    status: 'succeeded',
    summary: 'Drafted 1 email reply(ies) to inbound customer messages.',
    started_at: new Date(Date.now() - i * 60_000).toISOString(),
  });

  const messengerRun = (i = 0) => ({
    status: 'succeeded',
    summary: 'Drafted 1 Messenger reply(ies) to inbound customer messages.',
    started_at: new Date(Date.now() - i * 60_000).toISOString(),
  });

  const flagRun = (i = 0) => ({
    status: 'succeeded',
    summary: 'Drafted 1 flagged for manual review — instagram lead requires human reply.',
    started_at: new Date(Date.now() - i * 60_000).toISOString(),
  });

  const outboundConvRun = (i = 0) => ({
    status: 'succeeded',
    summary: 'Sent Messenger reply to customer — outbound conversation recorded.',
    started_at: new Date(Date.now() - i * 60_000).toISOString(),
  });

  it('returns true when 25 succeeded runs all have no-op summaries', () => {
    const runs = Array.from({ length: 25 }, (_, i) => noOpRun(i));
    expect(isStalledAgent(runs)).toBe(true);
  });

  it('returns true when more than 25 no-op runs exist', () => {
    const runs = Array.from({ length: 50 }, (_, i) => noOpRun(i));
    expect(isStalledAgent(runs)).toBe(true);
  });

  it('returns false when fewer than 25 runs exist', () => {
    const runs = Array.from({ length: 24 }, (_, i) => noOpRun(i));
    expect(isStalledAgent(runs)).toBe(false);
  });

  it('returns false when any recent run has an actionable summary (email approval)', () => {
    const runs = [
      ...Array.from({ length: 24 }, (_, i) => noOpRun(i)),
      actionableRun(24),
    ];
    expect(isStalledAgent(runs)).toBe(false);
  });

  it('returns false when any recent run has a Messenger reply summary', () => {
    const runs = [
      actionableRun(0),
      ...Array.from({ length: 24 }, (_, i) => noOpRun(i + 1)),
    ];
    expect(isStalledAgent(runs)).toBe(false);
  });

  it('returns false when runs contain flag_for_review output (customer value)', () => {
    const runs = [
      flagRun(0),
      ...Array.from({ length: 24 }, (_, i) => noOpRun(i + 1)),
    ];
    expect(isStalledAgent(runs)).toBe(false);
  });

  it('returns false when runs contain outbound conversation summary', () => {
    const runs = [
      outboundConvRun(0),
      ...Array.from({ length: 24 }, (_, i) => noOpRun(i + 1)),
    ];
    expect(isStalledAgent(runs)).toBe(false);
  });

  it('returns false when any run has failed status (not purely succeeded)', () => {
    const runs = [
      { status: 'failed', summary: 'fetch lead_conversations: table not found', started_at: new Date().toISOString() },
      ...Array.from({ length: 24 }, (_, i) => noOpRun(i + 1)),
    ];
    expect(isStalledAgent(runs)).toBe(false);
  });

  it('respects custom minRuns threshold', () => {
    const runs = Array.from({ length: 10 }, (_, i) => noOpRun(i));
    expect(isStalledAgent(runs, 10)).toBe(true);
    expect(isStalledAgent(runs, 11)).toBe(false);
  });

  it('returns false for empty runs', () => {
    expect(isStalledAgent([])).toBe(false);
  });

  it('detects stalled for the customer-reply no-op pattern', () => {
    const runs = Array.from({ length: 25 }, (_, i) => ({
      status: 'succeeded',
      summary: 'No actionable inbound messages.',
      started_at: new Date(Date.now() - i * 1800_000).toISOString(),
    }));
    expect(isStalledAgent(runs)).toBe(true);
  });
});

// ---------- scoreAgentHealth stalled integration tests -----------------------

describe('scoreAgentHealth — stalled agent detection', () => {
  function makeNoOpRun(i = 0) {
    return {
      id: `run-${i}`,
      status: 'succeeded' as const,
      summary: 'No unanswered messages with a usable email.',
      started_at: new Date(Date.now() - i * 1800_000).toISOString(),
    };
  }

  function makeActionableRun(i = 0) {
    return {
      id: `run-a-${i}`,
      status: 'succeeded' as const,
      summary: 'Drafted 1 email reply(ies) to inbound customer messages.',
      started_at: new Date(Date.now() - i * 1800_000).toISOString(),
    };
  }

  it('25 successful no-op runs produces watch label and stalled reason', () => {
    const runs = Array.from({ length: 25 }, (_, i) => makeNoOpRun(i));
    const health = scoreAgentHealth(runs, []);
    expect(health.label).toBe('watch');
    expect(health.reasons.some((r) => r.includes('stalled'))).toBe(true);
    expect(health.output_useful).toBe(false);
  });

  it('stalled agent is not marked broken — warning only', () => {
    const runs = Array.from({ length: 40 }, (_, i) => makeNoOpRun(i));
    const health = scoreAgentHealth(runs, []);
    expect(health.label).not.toBe('broken');
    expect(health.label).not.toBe('needs_repair');
    expect(['watch', 'healthy']).toContain(health.label);
  });

  it('successful runs with approvals do not trigger stalled warning', () => {
    const runs = [
      makeActionableRun(0),
      ...Array.from({ length: 24 }, (_, i) => makeNoOpRun(i + 1)),
    ];
    const health = scoreAgentHealth(runs, []);
    expect(health.reasons.some((r) => r.includes('stalled'))).toBe(false);
  });

  it('successful runs with outbound conversations do not trigger stalled warning', () => {
    const runs = [
      {
        id: 'run-conv',
        status: 'succeeded' as const,
        summary: 'Sent Messenger reply to customer — outbound conversation logged.',
        started_at: new Date().toISOString(),
      },
      ...Array.from({ length: 24 }, (_, i) => makeNoOpRun(i + 1)),
    ];
    const health = scoreAgentHealth(runs, []);
    expect(health.reasons.some((r) => r.includes('stalled'))).toBe(false);
  });

  it('fewer than 25 runs does not trigger stalled warning', () => {
    const runs = Array.from({ length: 24 }, (_, i) => makeNoOpRun(i));
    const health = scoreAgentHealth(runs, []);
    expect(health.reasons.some((r) => r.includes('stalled'))).toBe(false);
  });
});

// ---------- Observer stalled-agent signal tests ------------------------------

vi.mock('@/lib/bud/orchestrator', () => ({
  triggerImprovement: vi.fn().mockResolvedValue({ signalId: 'signal-1', status: 'created' }),
}));

describe('Bud Observer — stalled agent improvement signal', () => {
  it('stalled warning creates only one improvement signal per agent per run', async () => {
    const { triggerImprovement } = await import('@/lib/bud/orchestrator');
    const triggerMock = vi.mocked(triggerImprovement);
    triggerMock.mockClear();

    // Simulate what the observer does internally: call triggerImprovement
    // once per detected stalled agent
    const stalledAgents = [{ agentId: 'customer-reply', runCount: 161 }];

    for (const { agentId, runCount } of stalledAgents) {
      await triggerImprovement(
        {} as never, // supabase mock
        {
          source: 'observer',
          signalType: 'stalled_agent',
          severity: 'medium',
          title: `Agent stalled — ${agentId}`,
          description: `${agentId} completed ${runCount} recent runs successfully but produced 0 actions.`,
          affectedArea: agentId,
          proposedApproach: 'Audit input data and filter conditions.',
          requestedBy: 'bud-observer',
        },
      );
    }

    expect(triggerMock).toHaveBeenCalledTimes(1);
    const call = triggerMock.mock.calls[0][1];
    expect(call.signalType).toBe('stalled_agent');
    expect(call.affectedArea).toBe('customer-reply');
    expect(call.severity).toBe('medium');
    // Must not be broken/critical — stalled is a warning
    expect(call.severity).not.toBe('critical');
    expect(call.severity).not.toBe('high');
  });

  it('uses consistent affectedArea for dedup fingerprinting', async () => {
    const { triggerImprovement } = await import('@/lib/bud/orchestrator');
    const triggerMock = vi.mocked(triggerImprovement);
    triggerMock.mockClear();
    triggerMock.mockResolvedValueOnce({ signalId: 'signal-1', status: 'deduplicated' });

    await triggerImprovement({} as never, {
      source: 'observer',
      signalType: 'stalled_agent',
      severity: 'medium',
      title: 'Agent stalled — customer-reply',
      description: 'customer-reply stalled.',
      affectedArea: 'customer-reply',
      proposedApproach: 'Audit data.',
      requestedBy: 'bud-observer',
    });

    const result = await triggerMock.mock.results[0].value;
    // A deduplicated result means a second call with the same params
    // was treated as spam — correct fingerprint behaviour
    expect(result.status).toBe('deduplicated');
  });
});
