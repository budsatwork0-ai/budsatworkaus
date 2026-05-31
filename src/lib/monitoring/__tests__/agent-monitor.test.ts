import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock env before importing the module
vi.mock('@/lib/env', () => ({
  env: {
    ALERT_WEBHOOK_URL: 'https://hooks.slack.com/test',
    AGENT_ERROR_THRESHOLD: 3,
  },
}));

// We need to reset the singleton between tests
let agentMonitor: Awaited<typeof import('../agent-monitor')>['agentMonitor'];

beforeEach(async () => {
  const mod = await import('../agent-monitor');
  agentMonitor = mod.agentMonitor;
  agentMonitor._reset();
});

aftterEach(() => {
  vi.restoreAllMocks();
});

describe('AgentMonitor', () => {
  it('does not send alert below threshold', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
    await agentMonitor.recordError('agent-a');
    await agentMonitor.recordError('agent-a');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(agentMonitor.getErrorCount('agent-a')).toBe(2);
  });

  it('sends alert when error count reaches threshold', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
    await agentMonitor.recordError('agent-b');
    await agentMonitor.recordError('agent-b');
    await agentMonitor.recordError('agent-b');
    expect(fetchSpy).toHaveBeenCalledOnce();
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.text).toContain('agent-b');
    expect(body.text).toContain('3');
  });

  it('tracks errors independently per agent', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
    await agentMonitor.recordError('agent-c');
    await agentMonitor.recordError('agent-d');
    expect(agentMonitor.getErrorCount('agent-c')).toBe(1);
    expect(agentMonitor.getErrorCount('agent-d')).toBe(1);
  });

  it('prunes records older than 1 hour', async () => {
    const now = Date.now();
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(now - 61 * 60 * 1000) // old record
      .mockReturnValue(now);
    await agentMonitor.recordError('agent-e');
    // Second call uses current time
    await agentMonitor.recordError('agent-e');
    expect(agentMonitor.getErrorCount('agent-e')).toBe(1);
  });

  it('does not throw when webhook fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'));
    // Should not throw even though fetch rejects
    await expect(
      Promise.all([
        agentMonitor.recordError('agent-f'),
        agentMonitor.recordError('agent-f'),
        agentMonitor.recordError('agent-f'),
      ])
    ).resolves.not.toThrow();
  });
});
