/**
 * Smoke tests for the quote-triage agent.
 * Covers the two highest-risk regression paths:
 *   1. Validation failure (malformed payload)
 *   2. Missing environment variables (cold-start crash)
 */

import { triageQuote, QuotePayloadSchema } from './index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_PAYLOAD = {
  id: '00000000-0000-0000-0000-000000000001',
  customer_id: '00000000-0000-0000-0000-000000000002',
  items: [
    { sku: 'SKU-001', quantity: 2, unit_price_cents: 4999 },
  ],
  currency: 'USD',
  created_at: '2024-01-01T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Schema unit tests (no I/O)
// ---------------------------------------------------------------------------

describe('QuotePayloadSchema', () => {
  it('accepts a valid payload', () => {
    const result = QuotePayloadSchema.safeParse(VALID_PAYLOAD);
    expect(result.success).toBe(true);
  });

  it('rejects a payload missing required fields', () => {
    const result = QuotePayloadSchema.safeParse({ id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects a payload with an empty items array', () => {
    const result = QuotePayloadSchema.safeParse({ ...VALID_PAYLOAD, items: [] });
    expect(result.success).toBe(false);
  });

  it('rejects a payload with a non-ISO created_at', () => {
    const result = QuotePayloadSchema.safeParse({
      ...VALID_PAYLOAD,
      created_at: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// triageQuote integration smoke tests
// ---------------------------------------------------------------------------

describe('triageQuote', () => {
  // Capture and suppress console.error noise from dead-letter writer stubs
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Path 1 — Validation failure
  // -------------------------------------------------------------------------
  it('returns VALIDATION_FAILED for a malformed payload without throwing', async () => {
    // Mock the dead-letter writer's Supabase call so it does not crash in CI
    jest.mock('@supabase/supabase-js', () => ({
      createClient: () => ({
        from: () => ({
          insert: async () => ({ error: null }),
          update: () => ({ eq: async () => ({ error: null }) }),
        }),
      }),
    }));

    const result = await triageQuote({ bad: 'data' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_FAILED');
    }
  });

  // -------------------------------------------------------------------------
  // Path 2 — Missing environment variables
  // -------------------------------------------------------------------------
  it('returns MISSING_ENV_VAR when Supabase env vars are absent', async () => {
    const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const savedServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const savedAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Reset module registry so the lazy init runs fresh
    jest.resetModules();
    // Re-import after env mutation
    const { triageQuote: triageQuoteFresh } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./index') as typeof import('./index');

    const result = await triageQuoteFresh(VALID_PAYLOAD);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('MISSING_ENV_VAR');
    }

    // Restore
    if (savedUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
    if (savedServiceKey !== undefined)
      process.env.SUPABASE_SERVICE_ROLE_KEY = savedServiceKey;
    if (savedAnonKey !== undefined)
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = savedAnonKey;
  });
});
