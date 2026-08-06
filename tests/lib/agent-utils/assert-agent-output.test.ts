import { describe, it, expect } from 'vitest';
import {
  assertAgentOutput,
  AgentNoOutputError,
} from '../../../src/lib/agent-utils/assert-agent-output';

const AGENT = 'test-agent';

describe('assertAgentOutput', () => {
  // ── cases that MUST throw ──────────────────────────────────────────────────

  it('throws AgentNoOutputError for null', () => {
    expect(() => assertAgentOutput(null, AGENT)).toThrow(AgentNoOutputError);
  });

  it('throws AgentNoOutputError for undefined', () => {
    expect(() => assertAgentOutput(undefined, AGENT)).toThrow(AgentNoOutputError);
  });

  it('throws for an empty string', () => {
    expect(() => assertAgentOutput('', AGENT)).toThrow(AgentNoOutputError);
  });

  it('throws for a whitespace-only string', () => {
    expect(() => assertAgentOutput('   \t\n', AGENT)).toThrow(AgentNoOutputError);
  });

  it('throws for an empty array', () => {
    expect(() => assertAgentOutput([], AGENT)).toThrow(AgentNoOutputError);
  });

  it('includes the agentId on the thrown error', () => {
    try {
      assertAgentOutput(null, AGENT);
    } catch (err) {
      expect(err).toBeInstanceOf(AgentNoOutputError);
      expect((err as AgentNoOutputError).agentId).toBe(AGENT);
    }
  });

  it('error message references the agentId', () => {
    expect(() => assertAgentOutput(null, AGENT)).toThrowError(/test-agent/);
  });

  // ── cases that MUST NOT throw ──────────────────────────────────────────────

  it('passes for a non-empty string', () => {
    expect(() => assertAgentOutput('hello', AGENT)).not.toThrow();
  });

  it('passes for a non-empty array', () => {
    expect(() => assertAgentOutput([1, 2], AGENT)).not.toThrow();
  });

  it('passes for a plain object (even empty)', () => {
    expect(() => assertAgentOutput({}, AGENT)).not.toThrow();
  });

  it('passes for false', () => {
    expect(() => assertAgentOutput(false, AGENT)).not.toThrow();
  });

  it('passes for zero', () => {
    expect(() => assertAgentOutput(0, AGENT)).not.toThrow();
  });

  it('passes for a structured result object', () => {
    expect(() =>
      assertAgentOutput({ summary: 'done', items: [] }, AGENT)
    ).not.toThrow();
  });
});

describe('AgentNoOutputError', () => {
  it('has name AgentNoOutputError', () => {
    const err = new AgentNoOutputError('my-agent');
    expect(err.name).toBe('AgentNoOutputError');
  });

  it('exposes agentId property', () => {
    const err = new AgentNoOutputError('my-agent');
    expect(err.agentId).toBe('my-agent');
  });

  it('includes optional detail in message', () => {
    const err = new AgentNoOutputError('my-agent', 'custom detail');
    expect(err.message).toContain('custom detail');
  });

  it('is an instance of Error', () => {
    expect(new AgentNoOutputError('x')).toBeInstanceOf(Error);
  });
});
