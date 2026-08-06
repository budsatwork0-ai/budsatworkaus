/**
 * Smoke tests for quote-triage agent.
 * Run with: npx jest src/agents/quote-triage/index.test.ts
 */
import { triageQuote } from './index';

describe('quote-triage smoke tests', () => {
  it('returns VALIDATION_ERROR for missing text field', async () => {
    const result = await triageQuote({ id: 'test-1' }); // missing `text`
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns VALIDATION_ERROR for non-object input', async () => {
    const result = await triageQuote(null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns LLM_ERROR for valid input when LLM is not implemented', async () => {
    const result = await triageQuote({
      id: 'quote-42',
      text: 'We need general liability coverage for a small restaurant.',
    });
    // classifyWithLLM is a stub — expected category path is LLM_ERROR until wired up
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('LLM_ERROR');
    }
  });
});
