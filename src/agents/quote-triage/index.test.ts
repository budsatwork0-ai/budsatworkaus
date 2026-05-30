/**
 * Minimal smoke tests for quote-triage agent.
 * Covers the validation-failure and missing-env-var paths so
 * regressions are caught in CI before they reach production.
 */

import { triageQuote } from './index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validInput = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  text: 'The best way to get started is to quit talking and begin doing.',
  source: 'Walt Disney',
};

// ---------------------------------------------------------------------------
// Validation-failure path
// ---------------------------------------------------------------------------

describe('triageQuote – validation', () => {
  it('returns VALIDATION_ERROR when id is not a UUID', async () => {
    const result = await triageQuote({ ...validInput, id: 'not-a-uuid' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe('VALIDATION_ERROR');
      if (result.errorCode === 'VALIDATION_ERROR') {
        expect(result.details.length).toBeGreaterThan(0);
      }
    }
  });

  it('returns VALIDATION_ERROR when text is empty', async () => {
    const result = await triageQuote({ ...validInput, text: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    }
  });

  it('returns VALIDATION_ERROR when input is null', async () => {
    const result = await triageQuote(null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    }
  });
});

// ---------------------------------------------------------------------------
// Missing-env-var path
// ---------------------------------------------------------------------------

describe('triageQuote – missing env vars', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Shallow clone so we can restore later.
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns MISSING_ENV when Supabase env-vars are absent', async () => {
    const result = await triageQuote(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe('MISSING_ENV');
      if (result.errorCode === 'MISSING_ENV') {
        expect(result.missing).toContain('SUPABASE_URL');
      }
    }
  });
});
