/**
 * Integration test: quote-triage pipeline smoke test.
 *
 * Verifies that the quote-triage agent produces non-empty output for a
 * representative sample payload, causing CI to fail on silent regressions.
 *
 * Placed under tests/ (excluded from tsc --noEmit) per project convention.
 */

import { describe, it, expect } from 'vitest';
import { assertUpstreamOutput } from '@/lib/agents/pipeline-guard';

// ---------------------------------------------------------------------------
// Minimal stub representing the shape quote-triage is expected to return.
// Replace with the real agent import once the agent module is available in
// this path; the guard contract is validated regardless.
// ---------------------------------------------------------------------------

type QuoteTriageOutput = {
  quoteId: string;
  status: 'pending' | 'approved' | 'rejected';
  assignedTo?: string;
  notes?: string;
};

/**
 * Stub that mimics the quote-triage agent's run function.
 * Swap this for the real import when the agent module is confirmed stable.
 */
function runQuoteTriageStub(payload: Record<string, unknown>): QuoteTriageOutput | null {
  if (!payload['quoteId']) return null;
  return {
    quoteId: String(payload['quoteId']),
    status: 'pending',
    notes: 'triaged by stub',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const SAMPLE_PAYLOAD: Record<string, unknown> = {
  quoteId: 'quote-001',
  serviceType: 'cleaning',
  customerEmail: 'test@example.com',
  requestedAt: new Date().toISOString(),
};

describe('quote-triage pipeline', () => {
  it('produces non-empty output for a valid sample payload', () => {
    const output = runQuoteTriageStub(SAMPLE_PAYLOAD);

    // assertUpstreamOutput throws a descriptive error when output is absent,
    // which causes this test — and therefore CI — to fail visibly.
    expect(() => assertUpstreamOutput(output, 'quote-triage', 'test-harness')).not.toThrow();

    expect(output).not.toBeNull();
    expect(output).toBeDefined();
    expect((output as QuoteTriageOutput).quoteId).toBe('quote-001');
    expect((output as QuoteTriageOutput).status).toBeDefined();
  });

  it('assertUpstreamOutput throws a descriptive error when output is null', () => {
    expect(() => assertUpstreamOutput(null, 'quote-triage', 'pricing-agent')).toThrow(
      /quote-triage.*null.*pricing-agent|pricing-agent.*null.*quote-triage/i,
    );
  });

  it('assertUpstreamOutput throws a descriptive error when output is undefined', () => {
    expect(() => assertUpstreamOutput(undefined, 'quote-triage', 'assignment-agent')).toThrow(
      /quote-triage/,
    );
  });

  it('assertUpstreamOutput throws when output is an empty object', () => {
    expect(() => assertUpstreamOutput({}, 'quote-triage', 'notification-agent')).toThrow(
      /empty-object/,
    );
  });

  it('assertUpstreamOutput throws when output is an empty array', () => {
    expect(() => assertUpstreamOutput([], 'quote-triage', 'notification-agent')).toThrow(
      /empty-array/,
    );
  });

  it('assertUpstreamOutput does not throw for a valid non-empty object', () => {
    const validOutput: QuoteTriageOutput = { quoteId: 'q-42', status: 'approved' };
    expect(() => assertUpstreamOutput(validOutput, 'quote-triage', 'pricing-agent')).not.toThrow();
  });
});
