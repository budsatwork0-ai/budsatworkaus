import { describe, it, expect } from 'vitest';
import {
  isEmptyPayload,
  AgentOutputMissingError,
  assertAgentOutput,
} from '../src/lib/agents/agent-output-guard';
import { z } from 'zod';

describe('isEmptyPayload', () => {
  it('returns true for null', () => expect(isEmptyPayload(null)).toBe(true));
  it('returns true for undefined', () => expect(isEmptyPayload(undefined)).toBe(true));
  it('returns true for empty string', () => expect(isEmptyPayload('')).toBe(true));
  it('returns true for whitespace-only string', () => expect(isEmptyPayload('   ')).toBe(true));
  it('returns true for empty array', () => expect(isEmptyPayload([])).toBe(true));
  it('returns true for empty object', () => expect(isEmptyPayload({})).toBe(true));
  it('returns false for non-empty string', () => expect(isEmptyPayload('hello')).toBe(false));
  it('returns false for non-empty array', () => expect(isEmptyPayload([1])).toBe(false));
  it('returns false for non-empty object', () => expect(isEmptyPayload({ a: 1 })).toBe(false));
  it('returns false for number', () => expect(isEmptyPayload(42)).toBe(false));
  it('returns false for boolean false', () => expect(isEmptyPayload(false)).toBe(false));
});

describe('AgentOutputMissingError', () => {
  it('is an instance of Error', () => {
    const err = new AgentOutputMissingError('test-agent', null);
    expect(err).toBeInstanceOf(Error);
  });

  it('exposes agentId and output', () => {
    const err = new AgentOutputMissingError('quote-triage', {});
    expect(err.agentId).toBe('quote-triage');
    expect(err.output).toEqual({});
  });

  it('has the correct name', () => {
    const err = new AgentOutputMissingError('any', null);
    expect(err.name).toBe('AgentOutputMissingError');
  });

  it('message includes agentId', () => {
    const err = new AgentOutputMissingError('my-agent', null);
    expect(err.message).toContain('my-agent');
  });
});

describe('assertAgentOutput — no schema (heuristic mode)', () => {
  it('does not throw for a non-empty object', () => {
    expect(() => assertAgentOutput('agent-1', { result: 'ok' })).not.toThrow();
  });

  it('does not throw for a non-empty string', () => {
    expect(() => assertAgentOutput('agent-1', 'result')).not.toThrow();
  });

  it('throws AgentOutputMissingError for null', () => {
    expect(() => assertAgentOutput('agent-1', null)).toThrow(AgentOutputMissingError);
  });

  it('throws AgentOutputMissingError for empty object', () => {
    expect(() => assertAgentOutput('agent-1', {})).toThrow(AgentOutputMissingError);
  });

  it('throws AgentOutputMissingError for empty array', () => {
    expect(() => assertAgentOutput('agent-1', [])).toThrow(AgentOutputMissingError);
  });

  it('fleet invariant — empty-output agents never resolve as succeeded', () => {
    const emptyOutputs: unknown[] = [null, undefined, '', '   ', [], {}];
    for (const output of emptyOutputs) {
      expect(() => assertAgentOutput('fleet-agent', output)).toThrow(AgentOutputMissingError);
    }
  });
});

describe('assertAgentOutput — with Zod schema', () => {
  const schema = z.object({ id: z.string(), value: z.number() });

  it('does not throw when output matches schema', () => {
    expect(() =>
      assertAgentOutput('agent-2', { id: 'abc', value: 42 }, schema)
    ).not.toThrow();
  });

  it('throws AgentOutputMissingError when output does not match schema', () => {
    expect(() =>
      assertAgentOutput('agent-2', { id: 'abc' }, schema)
    ).toThrow(AgentOutputMissingError);
  });

  it('throws AgentOutputMissingError for null even with schema', () => {
    expect(() =>
      assertAgentOutput('agent-2', null, schema)
    ).toThrow(AgentOutputMissingError);
  });

  it('preserves agentId on schema-mode error', () => {
    try {
      assertAgentOutput('schema-agent', { bad: true }, schema);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AgentOutputMissingError);
      expect((err as AgentOutputMissingError).agentId).toBe('schema-agent');
    }
  });
});
