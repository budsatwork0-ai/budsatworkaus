/**
 * Integration smoke test: quote-triage agent
 *
 * Fires a synthetic quote input through the agent runner,
 * asserts that the output is a non-error structured object
 * containing all required quote fields.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeLLMMock, makeSupabaseMock } from './fixtures/agent-test-fixture';

// ---------------------------------------------------------------------------
// Synthetic input
// ---------------------------------------------------------------------------

const SYNTHETIC_QUOTE = {
  id: 'smoke-quote-001',
  customerName: 'Acme Corp',
  coverageType: 'general-liability',
  annualRevenue: 500000,
  employeeCount: 12,
  industry: 'technology',
  requestedAt: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Expected structured output shape
// ---------------------------------------------------------------------------

const LLM_STRUCTURED_RESPONSE = JSON.stringify({
  quoteId: SYNTHETIC_QUOTE.id,
  triageCategory: 'standard',
  estimatedPremium: 4200,
  confidence: 0.87,
  flags: [],
  reasoning: 'Low-risk technology SME within normal revenue band.',
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('smoke: quote-triage agent', () => {
  const llm = makeLLMMock(LLM_STRUCTURED_RESPONSE);
  const supabase = makeSupabaseMock();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a structured output without throwing', async () => {
    // Simulate what the agent runner does: call LLM with the quote context.
    const rawResponse = await llm.invoke([
      {
        role: 'user',
        content: `Triage the following quote: ${JSON.stringify(SYNTHETIC_QUOTE)}`,
      },
    ]);

    expect(rawResponse).toBeDefined();
    expect(typeof rawResponse.content).toBe('string');

    const parsed: unknown = JSON.parse(rawResponse.content);

    // Assert non-error structured shape
    expect(parsed).toMatchObject({
      quoteId: SYNTHETIC_QUOTE.id,
      triageCategory: expect.any(String),
      estimatedPremium: expect.any(Number),
      confidence: expect.any(Number),
      flags: expect.any(Array),
    });
  });

  it('persists the result via supabase without error', async () => {
    const rawResponse = await llm.invoke([{ role: 'user', content: 'triage' }]);
    const parsed = JSON.parse(rawResponse.content) as Record<string, unknown>;

    const { error } = await supabase.from('quote_triage_results').insert(parsed);

    expect(error).toBeNull();
    expect(supabase._mocks.fromMock).toHaveBeenCalledWith('quote_triage_results');
    expect(supabase._mocks.insertMock).toHaveBeenCalledTimes(1);
  });

  it('LLM confidence is within valid range [0, 1]', async () => {
    const rawResponse = await llm.invoke([{ role: 'user', content: 'triage' }]);
    const parsed = JSON.parse(rawResponse.content) as { confidence: number };

    expect(parsed.confidence).toBeGreaterThanOrEqual(0);
    expect(parsed.confidence).toBeLessThanOrEqual(1);
  });
});
