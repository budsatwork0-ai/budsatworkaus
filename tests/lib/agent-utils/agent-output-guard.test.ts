import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { assertAgentOutput, OutputContractError } from '@/lib/agent-utils/agent-output-guard';
import { validateAgentOutput } from '@/lib/agent-utils/validate-agent-output';

const schema = z.object({
  status: z.string(),
  reason: z.string().optional(),
});

// ─── assertAgentOutput ────────────────────────────────────────────────────────

describe('assertAgentOutput', () => {
  it('passes when output matches the schema', () => {
    expect(() =>
      assertAgentOutput('agent-a', schema, { status: 'ok' })
    ).not.toThrow();
  });

  it('passes when optional field is present', () => {
    expect(() =>
      assertAgentOutput('agent-a', schema, { status: 'ok', reason: 'all good' })
    ).not.toThrow();
  });

  it('throws OutputContractError when output is null', () => {
    expect(() =>
      assertAgentOutput('agent-a', schema, null)
    ).toThrow(OutputContractError);
  });

  it('throws OutputContractError when output is undefined', () => {
    expect(() =>
      assertAgentOutput('agent-a', schema, undefined)
    ).toThrow(OutputContractError);
  });

  it('throws OutputContractError when schema validation fails', () => {
    expect(() =>
      assertAgentOutput('agent-a', schema, { notStatus: 123 })
    ).toThrow(OutputContractError);
  });

  it('includes agentId in the thrown error', () => {
    let caught: OutputContractError | undefined;
    try {
      assertAgentOutput('my-agent', schema, null);
    } catch (err) {
      caught = err as OutputContractError;
    }
    expect(caught).toBeInstanceOf(OutputContractError);
    expect(caught?.agentId).toBe('my-agent');
  });

  it('includes ZodIssue details in the thrown error', () => {
    let caught: OutputContractError | undefined;
    try {
      assertAgentOutput('my-agent', schema, { notStatus: 123 });
    } catch (err) {
      caught = err as OutputContractError;
    }
    expect(caught?.issues.length).toBeGreaterThan(0);
  });
});

// ─── validateAgentOutput ─────────────────────────────────────────────────────

describe('validateAgentOutput', () => {
  it('returns valid:true for an agent with no registered schema', () => {
    const result = validateAgentOutput('unknown-agent-xyz', { anything: true });
    expect(result.valid).toBe(true);
  });

  it('returns valid:true for quote-triage with a conforming output', () => {
    const result = validateAgentOutput('quote-triage', { status: 'accepted' });
    expect(result.valid).toBe(true);
  });

  it('returns valid:false for quote-triage with a non-conforming output', () => {
    const result = validateAgentOutput('quote-triage', { wrongField: 99 });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBeInstanceOf(OutputContractError);
      expect(result.error.agentId).toBe('quote-triage');
    }
  });

  it('returns valid:false when output is null for a registered agent', () => {
    const result = validateAgentOutput('quote-triage', null);
    expect(result.valid).toBe(false);
  });
});
