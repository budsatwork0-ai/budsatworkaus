/**
 * smoke.quote-triage.test.ts
 *
 * Happy-path smoke test for the quote-triage agent entry point.
 * Mocks the LLM client so no real network calls are made.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the LLM client before any module under test is imported
// ---------------------------------------------------------------------------
vi.mock('@/lib/llm/client', () => ({
  createLLMClient: vi.fn(() => ({
    chat: vi.fn(async () => ({
      content: JSON.stringify({
        premium: 1200,
        currency: 'USD',
        carrier: 'MockCarrier',
        coverageType: 'comprehensive',
        validUntil: '2025-12-31',
      }),
    })),
  })),
}));

// Mock Supabase so no DB connection is required
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(async () => ({ error: null })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({ data: null, error: null })),
        })),
      })),
    })),
  })),
}));

// Provide the minimum env vars that assertLLMConfig() requires
beforeEach(() => {
  process.env.LLM_API_KEY = 'smoke-test-key';
  process.env.LLM_MODEL = 'gpt-4o';
  process.env.LLM_BASE_URL = 'https://api.openai.com/v1';
});

describe('quote-triage agent — smoke test', () => {
  it('invokes the agent runner without throwing and returns a valid quote shape', async () => {
    // Dynamic import so mocks are already registered
    const { runQuoteTriageAgent } = await import('@/lib/agent-runner/index');

    const payload = {
      applicantAge: 30,
      vehicleMake: 'Toyota',
      vehicleModel: 'Camry',
      vehicleYear: 2022,
      zipCode: '90210',
    };

    const result = await runQuoteTriageAgent(payload);

    // Assert the output has the required quote fields
    expect(result).toBeDefined();
    expect(typeof result.premium).toBe('number');
    expect(typeof result.currency).toBe('string');
    expect(typeof result.carrier).toBe('string');
    expect(typeof result.coverageType).toBe('string');
    expect(typeof result.validUntil).toBe('string');
  });
});
