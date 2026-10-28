import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentMonitor, setAgentMonitor } from '../agent-monitor';

// ---- helpers ----------------------------------------------------------------

function makeSupabaseMock(rollingCount: number, weekCount: number) {
  const headMock = vi.fn().mockImplementation(function (this: unknown) {
    return this;
  });
  // We need a chainable builder that ultimately returns the right count.
  // We track calls so the first resolves rollingCount, second resolves weekCount.
  let call = 0;
  const terminal = vi.fn().mockImplementation(() => {
    const count = call === 0 ? rollingCount : weekCount;
    call++;
    return Promise.resolve({ count, error: null });
  });

  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockImplementation(() => terminal()),
  };

  // .gte without a subsequent .lt resolves via the terminal (rolling window query)
  chain.gte.mockImplementation(() => ({
    ...chain,
    // override so bare .gte chain resolves for rolling query
    then: terminal,
    lt: vi.fn().mockImplementation(() => terminal()),
  }));

  return {
    from: vi.fn().mockReturnValue(chain),
  };
}

function makeFetchMock(ok = true) {
  return vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 500 });
}

// AgentMonitor accesses private `supabase` — we bypass via casting for tests.
function buildMonitor(
  rollingCount: number,
  weekCount: number,
  fetchMock: ReturnType<typeof makeFetchMock>,
  opts: { absoluteThreshold?: number; baselineMultiplier?: number } = {},
) {
  const monitor = new AgentMonitor({
    supabaseUrl: 'http://localhost',
    supabaseServiceKey: 'test-key',
    slackWebhookUrl: 'https://hooks.slack.com/test',
    ...opts,
  });

  // Patch the Supabase client with our mock
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (monitor as any).supabase = buildChainableSupabase(rollingCount, weekCount);
  // Patch global fetch
  vi.stubGlobal('fetch', fetchMock);
  return monitor;
}

/**
 * Builds a chainable Supabase mock that returns rollingCount on the first
 * terminal call and weekCount on the second.
 */
function buildChainableSupabase(rollingCount: number, weekCount: number) {
  let queryIndex = 0;
  const counts = [rollingCount, weekCount];

  function makeChain(): Record<string, unknown> {
    const chain: Record<string, unknown> = {
      select: vi.fn().mockReturnValue(makeChain()),
      eq: vi.fn().mockReturnValue(makeChain()),
      gte: vi.fn().mockReturnValue(makeChain()),
      lt: vi.fn().mockImplementation(() =>
        Promise.resolve({ count: counts[queryIndex++] ?? 0, error: null }),
      ),
    };
    // Make the chain itself thenable so bare awaits work
    (chain as unknown as Promise<unknown>).then = vi.fn().mockImplementation(
      (resolve: (v: unknown) => void) =>
        resolve({ count: counts[queryIndex++] ?? 0, error: null }),
    );
    return chain;
  }

  return { from: vi.fn().mockReturnValue(makeChain()) };
}

// ---- tests ------------------------------------------------------------------

describe('AgentMonitor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAgentMonitor(null as unknown as AgentMonitor); // reset singleton
  });

  it('fires a Slack alert when rolling count exceeds absolute threshold', async () => {
    const fetchMock = makeFetchMock(true);
    const monitor = buildMonitor(15, 0, fetchMock, { absoluteThreshold: 10 });

    const result = await monitor.check('agent-x');

    expect(result.breached).toBe(true);
    expect(result.alertFired).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown[][])[1].body as string) as { text: string };
    expect(body.text).toContain('Alert');
  });

  it('fires a Slack alert when rolling count exceeds 2× last-week baseline', async () => {
    // 7 hours of last-week data ÷ 167 hours ≈ 0.042/hr baseline; 2× = 0.084
    // rolling count = 1 should NOT breach (too low)
    // rolling count = 5, weekCount = 83 → baseline = 83/167 ≈ 0.497, threshold ≈ 0.99 → breach
    const fetchMock = makeFetchMock(true);
    const monitor = buildMonitor(5, 83, fetchMock, { absoluteThreshold: 100, baselineMultiplier: 2 });

    const result = await monitor.check('agent-y');

    expect(result.breached).toBe(true);
    expect(result.alertFired).toBe(true);
  });

  it('does NOT fire an alert when counts are below both thresholds', async () => {
    const fetchMock = makeFetchMock(true);
    // rollingCount = 2, weekCount = 0 → baseline = 0 → only absolute threshold applies
    const monitor = buildMonitor(2, 0, fetchMock, { absoluteThreshold: 10 });

    const result = await monitor.check('agent-z');

    expect(result.breached).toBe(false);
    expect(result.alertFired).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports breached=false after a counter-reset (rolling count drops to 0)', async () => {
    const fetchMock = makeFetchMock(true);
    const monitor = buildMonitor(0, 0, fetchMock, { absoluteThreshold: 10 });

    const result = await monitor.check('agent-reset');

    expect(result.rollingCount).toBe(0);
    expect(result.breached).toBe(false);
    expect(result.alertFired).toBe(false);
  });

  it('returns alertFired=false when Slack webhook call fails', async () => {
    const fetchMock = makeFetchMock(false);
    const monitor = buildMonitor(15, 0, fetchMock, { absoluteThreshold: 10 });

    const result = await monitor.check('agent-fail');

    expect(result.breached).toBe(true);
    expect(result.alertFired).toBe(false);
  });
});
