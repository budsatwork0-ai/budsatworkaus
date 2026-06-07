import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock Supabase ───────────────────────────────────────────────────────────
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
}));

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}));

// ─── Mock fetch for healthcheck ──────────────────────────────────────────────
const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
vi.stubGlobal('fetch', mockFetch);

// ─── Import after mocks ──────────────────────────────────────────────────────
import { runObserver } from '../../../src/agents/bud-observer/index';
import { pingHealthcheck } from '../../../src/agents/bud-observer/health-check';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeSelectChain(rows: unknown[], error: null | { message: string } = null) {
  const chain = {
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: error ? null : rows, error }),
  };
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default insert succeeds
  mockInsert.mockResolvedValue({ error: null });
});

afterEach(() => {
  delete process.env.HEALTHCHECK_URL;
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('runObserver — degraded snapshot (some sources fail)', () => {
  it('returns data_quality:degraded when one source errors', async () => {
    // error_spikes fails, others succeed with empty arrays
    mockFrom.mockImplementation((table: string) => {
      if (table === 'agent_logs') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: null, error: { message: 'DB unavailable' } }),
              }),
            }),
          }),
        };
      }
      if (table === 'observer_snapshots') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return {
        select: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      };
    });

    const snapshot = await runObserver();
    expect(snapshot.data_quality).toBe('degraded');
    expect(snapshot.errors.length).toBeGreaterThan(0);
    expect(snapshot.errors[0]).toContain('supabase error_spikes');
  });
});

describe('runObserver — failed snapshot (invalid raw input)', () => {
  it('returns data_quality:failed and no signals for totally invalid input', async () => {
    // Insert should still be called? No — on schema fail we return early.
    // We need from(observer_snapshots) not to be needed.
    mockFrom.mockImplementation(() => ({
      select: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    }));

    const snapshot = await runObserver({ signals: 'not-an-array' });
    expect(snapshot.data_quality).toBe('failed');
    expect(snapshot.signals).toHaveLength(0);
    expect(snapshot.errors[0]).toContain('input schema invalid');
  });
});

describe('runObserver — full success', () => {
  it('returns data_quality:ok when all sources return valid data', async () => {
    const validSignal = { type: 'error', value: 42, source: 'test-agent' };
    mockFrom.mockImplementation((table: string) => {
      if (table === 'observer_snapshots') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: [validSignal], error: null }),
            }),
          }),
          order: () => ({
            limit: () => Promise.resolve({ data: [validSignal], error: null }),
          }),
        }),
      };
    });

    const snapshot = await runObserver();
    expect(snapshot.data_quality).toBe('ok');
    expect(snapshot.errors).toHaveLength(0);
    expect(snapshot.signals.length).toBeGreaterThan(0);
  });
});

describe('pingHealthcheck — healthcheck ping', () => {
  it('does nothing when HEALTHCHECK_URL is not set', async () => {
    delete process.env.HEALTHCHECK_URL;
    await expect(pingHealthcheck()).resolves.toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('pings HEALTHCHECK_URL when set', async () => {
    process.env.HEALTHCHECK_URL = 'https://hc-ping.example.com/uuid-abc';
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
    await pingHealthcheck();
    expect(mockFetch).toHaveBeenCalledWith(
      'https://hc-ping.example.com/uuid-abc',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('does not throw when ping returns non-200', async () => {
    process.env.HEALTHCHECK_URL = 'https://hc-ping.example.com/uuid-abc';
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(pingHealthcheck()).resolves.toBeUndefined();
  });

  it('does not throw when fetch rejects (network failure)', async () => {
    process.env.HEALTHCHECK_URL = 'https://hc-ping.example.com/uuid-abc';
    mockFetch.mockRejectedValueOnce(new Error('network error'));
    await expect(pingHealthcheck()).resolves.toBeUndefined();
  });
});
