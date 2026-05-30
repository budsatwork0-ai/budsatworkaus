/**
 * Smoke integration test — runs both agents against the real runtime LLM config.
 * Requires CI secrets: OPENAI_API_KEY (or equivalent), SUPABASE_URL, SUPABASE_ANON_KEY.
 * Skipped automatically when the secrets are absent so local dev is unaffected.
 */

import { runAgent } from '@/lib/agent-runner';

const SECRETS_PRESENT =
  Boolean(process.env.OPENAI_API_KEY) &&
  Boolean(process.env.SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_ANON_KEY);

const describeIfSecrets = SECRETS_PRESENT ? describe : describe.skip;

/** Minimal synthetic payload for the quote-triage agent */
const QUOTE_TRIAGE_PAYLOAD = {
  agentId: 'quote-triage',
  input: {
    quoteId: 'smoke-test-quote-001',
    customerEmail: 'smoke@example.com',
    items: [
      { sku: 'WIDGET-A', quantity: 10, unitPrice: 9.99 },
    ],
    totalAmount: 99.9,
    currency: 'USD',
    requestedAt: new Date().toISOString(),
  },
};

/** Minimal synthetic payload for the customer-reply agent */
const CUSTOMER_REPLY_PAYLOAD = {
  agentId: 'customer-reply',
  input: {
    threadId: 'smoke-test-thread-001',
    customerEmail: 'smoke@example.com',
    subject: 'Question about my order',
    body: 'Hi, can you confirm my order is on the way?',
    sentAt: new Date().toISOString(),
  },
};

describeIfSecrets('Agent smoke — live LLM config', () => {
  jest.setTimeout(60_000); // LLM round-trips can be slow

  it('quote-triage returns a structured, non-error response', async () => {
    const result = await runAgent(QUOTE_TRIAGE_PAYLOAD);

    expect(result).toBeDefined();
    expect(result).not.toHaveProperty('error');
    // Agent runner must return an object (structured output)
    expect(typeof result).toBe('object');
  });

  it('customer-reply returns a structured, non-error response', async () => {
    const result = await runAgent(CUSTOMER_REPLY_PAYLOAD);

    expect(result).toBeDefined();
    expect(result).not.toHaveProperty('error');
    expect(typeof result).toBe('object');
  });
});
