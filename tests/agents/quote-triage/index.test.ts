import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ────────────────────────────────────────────────────────────
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('quote-triage run()', () => {
  beforeEach(() => {
    vi.resetModules();
    mockInsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: mockInsert });
    process.env['NEXT_PUBLIC_SUPABASE_URL'] = 'https://test.supabase.co';
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role-key';
  });

  it('returns SCHEMA_VALIDATION_ERROR for invalid input', async () => {
    const { run } = await import('@/agents/quote-triage/index');
    const result = await run({ not: 'a valid quote' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe('SCHEMA_VALIDATION_ERROR');
    }
  });

  it('returns MISSING_ENV_VAR when env var is absent', async () => {
    delete process.env['SUPABASE_SERVICE_ROLE_KEY'];
    const { run } = await import('@/agents/quote-triage/index');
    const result = await run({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe('MISSING_ENV_VAR');
    }
  });

  it('returns ok:true for a valid auto-approve quote', async () => {
    const { run } = await import('@/agents/quote-triage/index');
    const result = await run({
      id: 'q_001',
      service: 'cleaning',
      customer_email: 'test@example.com',
      price_cents: 5000,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tier).toBe('auto_approve');
      expect(result.quoteId).toBe('q_001');
    }
  });

  it('returns ok:true with manual_review tier for high-value quote', async () => {
    const { run } = await import('@/agents/quote-triage/index');
    const result = await run({
      id: 'q_002',
      service: 'yard',
      customer_email: 'vip@example.com',
      price_cents: 200_000,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tier).toBe('manual_review');
    }
  });

  it('returns ok:true with reject tier for zero-price quote', async () => {
    const { run } = await import('@/agents/quote-triage/index');
    const result = await run({
      id: 'q_003',
      service: 'windows',
      customer_email: 'zero@example.com',
      price_cents: 0,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tier).toBe('reject');
    }
  });

  it('returns TRIAGE_LOGIC_ERROR and inserts dead-letter when DB insert fails', async () => {
    mockInsert.mockResolvedValueOnce({ error: { message: 'DB connection refused' } });
    const { run } = await import('@/agents/quote-triage/index');
    const result = await run({
      id: 'q_004',
      service: 'dump',
      customer_email: 'fail@example.com',
      price_cents: 8000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe('TRIAGE_LOGIC_ERROR');
      expect(result.quoteId).toBe('q_004');
    }
    // Dead-letter insert should have been called
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });
});
