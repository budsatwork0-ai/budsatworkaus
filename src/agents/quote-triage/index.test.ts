/**
 * Smoke tests for the quote-triage agent.
 *
 * Covers:
 *  1. Validation failure path (bad input → VALIDATION_FAILED + dead-letter)
 *  2. Missing env-var path (no Supabase config → MISSING_ENV_VAR + dead-letter)
 *  3. Happy path (valid quote, mocked Supabase → ok: true)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Supabase mock — must be hoisted before the module under test is imported
// ---------------------------------------------------------------------------

const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

// Import the agent AFTER the mock is in place
import { triageQuote } from './index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_QUOTE = {
  id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  customer_id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
  line_items: [{ sku: 'SKU-001', qty: 2, unit_price_cents: 1999 }],
  requested_at: '2024-01-15T10:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('triageQuote', () => {
  beforeEach(() => {
    vi.resetModules();
    mockInsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: mockInsert });

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  // -------------------------------------------------------------------------
  it('returns VALIDATION_FAILED and writes dead-letter for invalid input', async () => {
    const result = await triageQuote({ not_a_quote: true });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('VALIDATION_FAILED');

    // Dead-letter insert should have been called
    const deadLetterCall = mockFrom.mock.calls.find(
      (c: unknown[]) => c[0] === 'quote_triage_dead_letter'
    );
    expect(deadLetterCall).toBeDefined();
  });

  // -------------------------------------------------------------------------
  it('returns MISSING_ENV_VAR and writes dead-letter when Supabase env vars are absent', async () => {
    // Remove env vars to trigger the lazy-init guard
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Reset the cached client so the lazy init runs again
    // We do this by re-importing after vi.resetModules()
    vi.resetModules();

    // Re-mock after resetModules
    vi.mock('@supabase/supabase-js', () => ({
      createClient: vi.fn(() => ({ from: mockFrom })),
    }));

    const { triageQuote: freshTriageQuote } = await import('./index');

    const result = await freshTriageQuote(VALID_QUOTE);

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('MISSING_ENV_VAR');
  });

  // -------------------------------------------------------------------------
  it('returns ok: true for a valid quote when Supabase succeeds', async () => {
    const result = await triageQuote(VALID_QUOTE);

    expect(result.ok).toBe(true);
    expect(result.quoteId).toBe(VALID_QUOTE.id);
    expect(result.error).toBeUndefined();

    // The triaged-quotes table should have been written
    const triageCall = mockFrom.mock.calls.find(
      (c: unknown[]) => c[0] === 'quotes_triaged'
    );
    expect(triageCall).toBeDefined();
  });

  // -------------------------------------------------------------------------
  it('returns DB_INSERT_FAILED and writes dead-letter when Supabase insert errors', async () => {
    mockInsert.mockImplementation((data: unknown) => {
      // Fail the quotes_triaged insert, succeed on dead-letter
      if (mockFrom.mock.calls.at(-1)?.[0] === 'quotes_triaged') {
        return Promise.resolve({ error: { message: 'DB error', code: '23505' } });
      }
      return Promise.resolve({ error: null });
    });

    // Reconfigure mock to fail on quotes_triaged
    mockFrom.mockImplementation((table: string) => ({
      insert: () =>
        table === 'quotes_triaged'
          ? Promise.resolve({ error: { message: 'unique violation', code: '23505' } })
          : Promise.resolve({ error: null }),
    }));

    const result = await triageQuote(VALID_QUOTE);

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('DB_INSERT_FAILED');
  });
});
