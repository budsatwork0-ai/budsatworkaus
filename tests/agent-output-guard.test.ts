import { describe, it, expect } from 'vitest';
import {
  isEmptyPayload,
  AgentOutputMissingError,
  assertAgentOutput,
} from '@/lib/agents/agent-output-guard';

describe('isEmptyPayload', () => {
  it('returns true for null', () => expect(isEmptyPayload(null)).toBe(true));
  it('returns true for undefined', () => expect(isEmptyPayload(undefined)).toBe(true));
  it('returns true for empty object', () => expect(isEmptyPayload({})).toBe(true));
  it('returns true for empty array', () => expect(isEmptyPayload([])).toBe(true));
  it('returns false for non-empty object', () => expect(isEmptyPayload({ a: 1 })).toBe(false));
  it('returns false for non-empty array', () => expect(isEmptyPayload([1])).toBe(false));
  it('returns false for a string', () => expect(isEmptyPayload('hello')).toBe(false));
  it('returns false for a number', () => expect(isEmptyPayload(0)).toBe(false));
  it('returns false for false boolean', () => expect(isEmptyPayload(false)).toBe(false));
});

describe('AgentOutputMissingError', () => {
  it('is an instance of Error', () => {
    const err = new AgentOutputMissingError('my-agent', 'run-123');
    expect(err).toBeInstanceOf(Error);
  });

  it('is an instance of AgentOutputMissingError', () => {
    const err = new AgentOutputMissingError('my-agent', 'run-123');
    expect(err).toBeInstanceOf(AgentOutputMissingError);
  });

  it('has correct name', () => {
    const err = new AgentOutputMissingError('my-agent', 'run-123');
    expect(err.name).toBe('AgentOutputMissingError');
  });

  it('exposes agentId and runId', () => {
    const err = new AgentOutputMissingError('my-agent', 'run-123');
    expect(err.agentId).toBe('my-agent');
    expect(err.runId).toBe('run-123');
  });

  it('message contains agentId and runId', () => {
    const err = new AgentOutputMissingError('my-agent', 'run-123');
    expect(err.message).toContain('my-agent');
    expect(err.message).toContain('run-123');
  });
});

describe('assertAgentOutput', () => {
  it('throws AgentOutputMissingError for null output', () => {
    expect(() => assertAgentOutput(null, 'agent-a', 'run-1')).toThrow(AgentOutputMissingError);
  });

  it('throws AgentOutputMissingError for undefined output', () => {
    expect(() => assertAgentOutput(undefined, 'agent-a', 'run-1')).toThrow(AgentOutputMissingError);
  });

  it('throws AgentOutputMissingError for empty object output', () => {
    expect(() => assertAgentOutput({}, 'agent-a', 'run-1')).toThrow(AgentOutputMissingError);
  });

  it('throws AgentOutputMissingError for empty array output', () => {
    expect(() => assertAgentOutput([], 'agent-a', 'run-1')).toThrow(AgentOutputMissingError);
  });

  it('does NOT throw for a valid non-empty object', () => {
    expect(() => assertAgentOutput({ status: 'ok' }, 'agent-a', 'run-1')).not.toThrow();
  });

  it('does NOT throw for a non-empty array', () => {
    expect(() => assertAgentOutput([{ id: 1 }], 'agent-a', 'run-1')).not.toThrow();
  });

  /**
   * Fleet-wide invariant: an empty-output agent must NEVER resolve as 'succeeded'.
   * This test simulates a minimal runner that calls assertAgentOutput and verifies
   * the status is set to 'failed' — never 'succeeded' — when output is empty.
   */
  it('empty-output agents never resolve as succeeded', () => {
    type RunStatus = 'succeeded' | 'failed';

    function simulateRun(output: unknown): RunStatus {
      try {
        assertAgentOutput(output, 'test-agent', 'run-xyz');
        return 'succeeded';
      } catch {
        return 'failed';
      }
    }

    const emptyOutputs: unknown[] = [null, undefined, {}, []];
    for (const empty of emptyOutputs) {
      expect(simulateRun(empty)).toBe('failed');
    }

    // Sanity-check: real output resolves as succeeded
    expect(simulateRun({ items: 3 })).toBe('succeeded');
  });
});
