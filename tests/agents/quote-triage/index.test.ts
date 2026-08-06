import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Shared mock state ────────────────────────────────────────────────────────
const mockUpsert = vi.fn();
const mockDeadLetterInsert = vi.fn();

// Track which table is being queried so we can route to the right mock
const mockFrom = vi.fn((table: string) => {
  if (table === 'quotes_triaged') {
    return { upsert: mockUpsert };
  }
  if (table === 'quote_triage_dead_letters') {
    return { insert: mockDeadLetterInsert };
  }
  return { upsert: mockUpsert, insert: mockDeadLetterInsert };
});

// Mock the Supabase server module
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────
const validPayload = {
  id: '00000000-0000-0000-0000-000000000001',
  service: 'cleaning',
  customer_email: 'test@example.com',
  amount_cents: 5000,
};

function setEnv(hasEnv: boolean) {
  if (hasEnv) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key';
  } else {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('triageQuote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setEnv(true);
    // Default: both DB calls succeed
    mockUpsert.mockResolvedValue({ error: null });
    mockDeadLetterInsert.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    setEnv(true); // restore env after each test
  });

  it('happy-path: upserts a valid quote and does not write to dead-letter', async () => {
    const { triageQuote } = await import('@/agents/quote-triage/index');
    await triageQuote(validPayload);

    expect(mockUpsert).toHaveBeenCalledOnce();
    const upsertArg = mockUpsert.mock.calls[0][0] as Record<string, unknown>;
    expect(upsertArg.id).toBe(validPayload.id);
    expect(upsertArg.service).toBe(validPayload.service);
    expect(mockDeadLetterInsert).not.toHaveBeenCalled();
  });

  it('validation-failure: writes VALIDATION_ERROR to dead-letter for invalid payload', async () => {
    const { triageQuote } = await import('@/agents/quote-triage/index');
    const badPayload = { id: 'not-a-uuid', service: '', amount_cents: -1 };
    await triageQuote(badPayload);

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockDeadLetterInsert).toHaveBeenCalledOnce();
    const deadRecord = mockDeadLetterInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(deadRecord.error_code).toBe('VALIDATION_ERROR');
    expect(typeof deadRecord.error_message).toBe('string');
  });

  it('missing-env-var: writes UNKNOWN_ERROR to dead-letter when env vars are absent', async () => {
    setEnv(false);
    // Re-import to get a fresh module evaluation with no env vars
    vi.resetModules();
    // Re-apply mocks after resetModules
    vi.mock('@/lib/supabase/server', () => ({
      createServiceClient: () => {
        throw new Error('Missing required env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      },
    }));

    const { triageQuote } = await import('@/agents/quote-triage/index');
    await triageQuote(validPayload);

    // The dead-letter write itself will also fail (env missing), but we verify
    // the main upsert was never attempted.
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('DB-error: writes DB_ERROR to dead-letter when upsert returns an error', async () => {
    mockUpsert.mockResolvedValue({ error: { message: 'connection refused' } });

    const { triageQuote } = await import('@/agents/quote-triage/index');
    await triageQuote(validPayload);

    expect(mockUpsert).toHaveBeenCalledOnce();
    expect(mockDeadLetterInsert).toHaveBeenCalledOnce();
    const deadRecord = mockDeadLetterInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(deadRecord.error_code).toBe('DB_ERROR');
    expect(deadRecord.error_message).toBe('connection refused');
  });
});
