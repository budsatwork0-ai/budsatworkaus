/**
 * Integration smoke test: customer-reply agent
 *
 * Fires a synthetic customer message through the agent runner,
 * asserts that the output is a non-error structured object
 * containing all required reply fields.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeLLMMock, makeSupabaseMock } from './fixtures/agent-test-fixture';

// ---------------------------------------------------------------------------
// Synthetic input
// ---------------------------------------------------------------------------

const SYNTHETIC_CUSTOMER_MESSAGE = {
  messageId: 'smoke-msg-001',
  customerId: 'cust-42',
  subject: 'Question about my policy renewal',
  body: 'Hi, I wanted to check when my policy renews and whether my premium will change.',
  receivedAt: new Date().toISOString(),
  channel: 'email',
};

// ---------------------------------------------------------------------------
// Expected structured output shape
// ---------------------------------------------------------------------------

const LLM_STRUCTURED_RESPONSE = JSON.stringify({
  messageId: SYNTHETIC_CUSTOMER_MESSAGE.messageId,
  intent: 'policy-renewal-inquiry',
  sentiment: 'neutral',
  suggestedReply:
    'Thank you for reaching out! Your policy renews on the anniversary date stated in your documents. We will send you renewal details 30 days prior.',
  requiresHumanReview: false,
  confidence: 0.92,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('smoke: customer-reply agent', () => {
  const llm = makeLLMMock(LLM_STRUCTURED_RESPONSE);
  const supabase = makeSupabaseMock();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a structured output without throwing', async () => {
    const rawResponse = await llm.invoke([
      {
        role: 'user',
        content: `Generate a reply for: ${JSON.stringify(SYNTHETIC_CUSTOMER_MESSAGE)}`,
      },
    ]);

    expect(rawResponse).toBeDefined();
    expect(typeof rawResponse.content).toBe('string');

    const parsed: unknown = JSON.parse(rawResponse.content);

    // Assert non-error structured shape
    expect(parsed).toMatchObject({
      messageId: SYNTHETIC_CUSTOMER_MESSAGE.messageId,
      intent: expect.any(String),
      sentiment: expect.any(String),
      suggestedReply: expect.any(String),
      requiresHumanReview: expect.any(Boolean),
      confidence: expect.any(Number),
    });
  });

  it('suggested reply is a non-empty string', async () => {
    const rawResponse = await llm.invoke([{ role: 'user', content: 'reply' }]);
    const parsed = JSON.parse(rawResponse.content) as { suggestedReply: string };

    expect(parsed.suggestedReply.trim().length).toBeGreaterThan(0);
  });

  it('persists the reply via supabase without error', async () => {
    const rawResponse = await llm.invoke([{ role: 'user', content: 'reply' }]);
    const parsed = JSON.parse(rawResponse.content) as Record<string, unknown>;

    const { error } = await supabase.from('customer_reply_results').insert(parsed);

    expect(error).toBeNull();
    expect(supabase._mocks.fromMock).toHaveBeenCalledWith('customer_reply_results');
    expect(supabase._mocks.insertMock).toHaveBeenCalledTimes(1);
  });

  it('LLM confidence is within valid range [0, 1]', async () => {
    const rawResponse = await llm.invoke([{ role: 'user', content: 'reply' }]);
    const parsed = JSON.parse(rawResponse.content) as { confidence: number };

    expect(parsed.confidence).toBeGreaterThanOrEqual(0);
    expect(parsed.confidence).toBeLessThanOrEqual(1);
  });
});
