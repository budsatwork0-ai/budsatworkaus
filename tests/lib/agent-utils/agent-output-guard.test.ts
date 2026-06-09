import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  assertAgentOutput,
  OutputContractError,
} from '../../../src/lib/agent-utils/agent-output-guard';

const schema = z.object({
  summary: z.string(),
  score: z.number(),
});

describe('assertAgentOutput', () => {
  it('returns parsed output when the schema passes', () => {
    const input = { summary: 'ok', score: 42 };
    const result = assertAgentOutput('test-agent', schema, input);
    expect(result).toEqual(input);
  });

  it('throws OutputContractError when output is null', () => {
    expect(() => assertAgentOutput('test-agent', schema, null)).toThrow(
      OutputContractError,
    );
    try {
      assertAgentOutput('test-agent', schema, null);
    } catch (err) {
      expect(err).toBeInstanceOf(OutputContractError);
      const e = err as OutputContractError;
      expect(e.agentId).toBe('test-agent');
      expect(e.issues).toContain('output was null or undefined');
    }
  });

  it('throws OutputContractError when output is undefined', () => {
    expect(() => assertAgentOutput('test-agent', schema, undefined)).toThrow(
      OutputContractError,
    );
  });

  it('throws OutputContractError with field-level issues when schema fails', () => {
    const bad = { summary: 123, score: 'not-a-number' };
    expect(() => assertAgentOutput('test-agent', schema, bad)).toThrow(
      OutputContractError,
    );
    try {
      assertAgentOutput('test-agent', schema, bad);
    } catch (err) {
      expect(err).toBeInstanceOf(OutputContractError);
      const e = err as OutputContractError;
      expect(e.agentId).toBe('test-agent');
      expect(e.issues.length).toBeGreaterThan(0);
      // At least one issue should mention the failing field
      expect(e.issues.some((s) => s.includes('summary') || s.includes('score'))).toBe(true);
    }
  });

  it('error message includes agent id', () => {
    try {
      assertAgentOutput('my-special-agent', schema, null);
    } catch (err) {
      expect((err as Error).message).toContain('my-special-agent');
    }
  });
});
