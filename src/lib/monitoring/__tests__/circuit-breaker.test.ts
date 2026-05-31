import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreakerRegistry } from '../circuit-breaker';

const TRIP = 3;
const WINDOW = 10_000;
const RECOVERY = 5_000;

function makeRegistry(webhookUrl?: string) {
  return new CircuitBreakerRegistry({
    tripThreshold: TRIP,
    windowMs: WINDOW,
    recoveryMs: RECOVERY,
    alertWebhookUrl: webhookUrl,
  });
}

describe('CircuitBreakerRegistry', () => {
  let registry: CircuitBreakerRegistry;

  beforeEach(() => {
    registry = makeRegistry();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in CLOSED state', () => {
    expect(registry.getState('agent-a')).toBe('CLOSED');
    expect(registry.isOpen('agent-a')).toBe(false);
  });

  it('stays CLOSED below the trip threshold', async () => {
    await registry.recordFailure('agent-a');
    await registry.recordFailure('agent-a');
    expect(registry.getState('agent-a')).toBe('CLOSED');
    expect(registry.isOpen('agent-a')).toBe(false);
  });

  it('transitions to OPEN when threshold is reached', async () => {
    for (let i = 0; i < TRIP; i++) {
      await registry.recordFailure('agent-a');
    }
    expect(registry.getState('agent-a')).toBe('OPEN');
    expect(registry.isOpen('agent-a')).toBe(true);
  });

  it('isolates state per agent', async () => {
    for (let i = 0; i < TRIP; i++) {
      await registry.recordFailure('agent-a');
    }
    expect(registry.getState('agent-b')).toBe('CLOSED');
  });

  it('transitions OPEN → HALF_OPEN after recoveryMs', async () => {
    for (let i = 0; i < TRIP; i++) {
      await registry.recordFailure('agent-a');
    }
    expect(registry.getState('agent-a')).toBe('OPEN');
    vi.advanceTimersByTime(RECOVERY);
    expect(registry.getState('agent-a')).toBe('HALF_OPEN');
    expect(registry.isOpen('agent-a')).toBe(false);
  });

  it('resets to CLOSED on success in HALF_OPEN', async () => {
    for (let i = 0; i < TRIP; i++) {
      await registry.recordFailure('agent-a');
    }
    vi.advanceTimersByTime(RECOVERY);
    expect(registry.getState('agent-a')).toBe('HALF_OPEN');
    registry.recordSuccess('agent-a');
    expect(registry.getState('agent-a')).toBe('CLOSED');
  });

  it('returns to OPEN on failure in HALF_OPEN', async () => {
    for (let i = 0; i < TRIP; i++) {
      await registry.recordFailure('agent-a');
    }
    vi.advanceTimersByTime(RECOVERY);
    expect(registry.getState('agent-a')).toBe('HALF_OPEN');
    await registry.recordFailure('agent-a');
    expect(registry.getState('agent-a')).toBe('OPEN');
  });

  it('prunes failures outside the sliding window', async () => {
    await registry.recordFailure('agent-a');
    await registry.recordFailure('agent-a');
    // Advance past the window so those failures expire
    vi.advanceTimersByTime(WINDOW + 1);
    // These two are now fresh but below threshold
    await registry.recordFailure('agent-a');
    await registry.recordFailure('agent-a');
    expect(registry.getState('agent-a')).toBe('CLOSED');
  });

  it('dispatches a webhook alert when the breaker trips', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);

    const reg = makeRegistry('https://hooks.example.com/alert');
    for (let i = 0; i < TRIP; i++) {
      await reg.recordFailure('agent-x');
    }

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://hooks.example.com/alert');
    const body = JSON.parse(opts.body as string) as { agentId: string; failureCount: number };
    expect(body.agentId).toBe('agent-x');
    expect(body.failureCount).toBe(TRIP);

    vi.unstubAllGlobals();
  });

  it('does not throw when webhook dispatch fails', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('network error'));
    vi.stubGlobal('fetch', mockFetch);

    const reg = makeRegistry('https://hooks.example.com/alert');
    await expect(
      (async () => {
        for (let i = 0; i < TRIP; i++) {
          await reg.recordFailure('agent-y');
        }
      })()
    ).resolves.toBeUndefined();

    vi.unstubAllGlobals();
  });

  it('recordSuccess resets CLOSED state and clears failures', async () => {
    await registry.recordFailure('agent-a');
    await registry.recordFailure('agent-a');
    registry.recordSuccess('agent-a');
    // After reset, two more failures should still be below threshold
    await registry.recordFailure('agent-a');
    await registry.recordFailure('agent-a');
    expect(registry.getState('agent-a')).toBe('CLOSED');
  });
});
