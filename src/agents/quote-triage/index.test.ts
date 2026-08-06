/**
 * Smoke tests for the quote-triage agent entry point.
 * Run with: pnpm jest src/agents/quote-triage/index.test.ts
 */
import { handleQuoteTriage } from './index';

// ---------------------------------------------------------------------------
// Shared valid payload fixture
// ---------------------------------------------------------------------------
const validPayload = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  customer_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  amount: 150.0,
  currency: 'USD',
  line_items: [
    { description: 'Widget A', quantity: 2, unit_price: 75.0 },
  ],
};

// ---------------------------------------------------------------------------
// Helpers to mock the Supabase module loaded via require() inside the agent
// ---------------------------------------------------------------------------
const mockInsert = jest.fn().mockResolvedValue({ error: null });
const mockUpsert = jest.fn().mockResolvedValue({ error: null });
const mockFrom = jest.fn((table: string) => ({
  insert: mockInsert,
  upsert: mockUpsert,
}));

const mockCreateClient = jest.fn(() => ({ from: mockFrom }));

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

beforeEach(() => {
  jest.resetModules();
  mockInsert.mockResolvedValue({ error: null });
  mockUpsert.mockResolvedValue({ error: null });
  // Provide env vars by default
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('handleQuoteTriage', () => {
  describe('validation-failure path', () => {
    it('returns VALIDATION_FAILED for a completely empty payload', async () => {
      const result = await handleQuoteTriage({});
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error_code).toBe('VALIDATION_FAILED');
        expect(result.detail.length).toBeGreaterThan(0);
      }
    });

    it('returns VALIDATION_FAILED when amount is negative', async () => {
      const result = await handleQuoteTriage({ ...validPayload, amount: -10 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error_code).toBe('VALIDATION_FAILED');
      }
    });

    it('returns VALIDATION_FAILED when currency is too long', async () => {
      const result = await handleQuoteTriage({
        ...validPayload,
        currency: 'TOOLONG',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error_code).toBe('VALIDATION_FAILED');
      }
    });

    it('returns VALIDATION_FAILED when line_items is empty', async () => {
      const result = await handleQuoteTriage({
        ...validPayload,
        line_items: [],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error_code).toBe('VALIDATION_FAILED');
      }
    });
  });

  describe('missing-env-var path', () => {
    it('returns ENV_VAR_MISSING when Supabase URL is absent', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      // Reset the module so the cached client is cleared
      jest.isolateModules(async () => {
        const { handleQuoteTriage: isolated } = await import('./index');
        const result = await isolated(validPayload);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error_code).toBe('ENV_VAR_MISSING');
        }
      });
    });
  });

  describe('happy path', () => {
    it('returns ok:true with the quote_id on success', async () => {
      const result = await handleQuoteTriage(validPayload);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.quote_id).toBe(validPayload.id);
      }
    });
  });

  describe('DB-error path', () => {
    it('returns DB_UPSERT_FAILED and writes to dead-letter when upsert errors', async () => {
      mockUpsert.mockResolvedValueOnce({
        error: { message: 'unique constraint violation' },
      });

      const result = await handleQuoteTriage(validPayload);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error_code).toBe('DB_UPSERT_FAILED');
        expect(result.detail).toContain('unique constraint violation');
      }
      // Dead-letter insert should have been attempted
      expect(mockInsert).toHaveBeenCalled();
    });
  });
});
