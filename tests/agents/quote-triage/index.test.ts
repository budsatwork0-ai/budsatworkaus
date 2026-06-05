import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock Supabase ────────────────────────────────────────────────────────────
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}));

// ─── Mock fetch (LLM calls) ───────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ─── Helper: valid quote payload ─────────────────────────────────────────────
function validPayload() {
  return {
    quote_id: '00000000-0000-0000-0000-000000000001',
    service: 'window_cleaning',
    total_price: 150,
    customer_email: 'test@example.com',
    line_items: [{ label: 'Standard windows', amount: 150 }],
  };
}

function makeLLMResponse(decision: string, reason = 'ok') {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        choices: [{ message: { content: JSON.stringify({ decision, reason }) } }],
      }),
    text: () => Promise.resolve(''),
    status: 200,
  };
}

describe('triageQuote', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Reset insert mock to succeed by default
    mockInsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: mockInsert });
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it('returns SCHEMA_VALIDATION_ERROR for invalid input', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const { triageQuote } = await import('@/agents/quote-triage/index');

    const result = await triageQuote({ quote_id: 'not-a-uuid', service: '' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_code).toBe('SCHEMA_VALIDATION_ERROR');
    }
    // Dead-letter insert should have been called
    expect(mockFrom).toHaveBeenCalledWith('quote_triage_dead_letters');
  });

  it('returns MISSING_ENV when OPENAI_API_KEY is absent', async () => {
    delete process.env.OPENAI_API_KEY;
    // Re-import to pick up env state (module may be cached — we test the runtime check)
    const { triageQuote } = await import('@/agents/quote-triage/index');

    const result = await triageQuote(validPayload());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_code).toBe('MISSING_ENV');
    }
  });

  it('returns auto_approve decision', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockFetch.mockResolvedValueOnce(makeLLMResponse('auto_approve', 'Low value, standard service'));
    const { triageQuote } = await import('@/agents/quote-triage/index');

    const result = await triageQuote(validPayload());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.decision).toBe('auto_approve');
      expect(result.quote_id).toBe('00000000-0000-0000-0000-000000000001');
    }
  });

  it('returns manual_review decision', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockFetch.mockResolvedValueOnce(makeLLMResponse('manual_review', 'Needs human check'));
    const { triageQuote } = await import('@/agents/quote-triage/index');

    const result = await triageQuote(validPayload());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.decision).toBe('manual_review');
    }
  });

  it('returns reject decision', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockFetch.mockResolvedValueOnce(makeLLMResponse('reject', 'Out of service area'));
    const { triageQuote } = await import('@/agents/quote-triage/index');

    const result = await triageQuote(validPayload());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.decision).toBe('reject');
    }
  });

  it('returns DB_ERROR and writes dead-letter when DB insert fails', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockFetch.mockResolvedValueOnce(makeLLMResponse('auto_approve'));

    // First call (quote_triage_results insert) fails; second call (dead-letter) succeeds
    mockInsert
      .mockResolvedValueOnce({ error: { message: 'DB connection refused' } })
      .mockResolvedValueOnce({ error: null });

    const { triageQuote } = await import('@/agents/quote-triage/index');
    const result = await triageQuote(validPayload());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_code).toBe('DB_ERROR');
    }
    // Dead-letter insert attempted
    expect(mockFrom).toHaveBeenCalledWith('quote_triage_dead_letters');
  });

  it('retries LLM call on transient failure and succeeds', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    // First attempt fails, second succeeds
    mockFetch
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockResolvedValueOnce(makeLLMResponse('auto_approve', 'Retry succeeded'));

    const { triageQuote } = await import('@/agents/quote-triage/index');
    const result = await triageQuote(validPayload());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.decision).toBe('auto_approve');
    }
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
