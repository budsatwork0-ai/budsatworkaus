import { describe, it, expect } from 'vitest';
import {
  isEmptyPayload,
  AgentOutputMissingError,
  assertAgentOutput,
  assertQuoteTriageOutput,
} from '../src/lib/agents/agent-output-guard';
import {
  applyOutputGuard,
  MAX_OUTPUT_RETRIES,
} from '../src/lib/agents/runner-output-middleware';

describe('isEmptyPayload', () => {
  it('returns true for null', () => expect(isEmptyPayload(null)).toBe(true));
  it('returns true for undefined', () => expect(isEmptyPayload(undefined)).toBe(true));
  it('returns true for empty string', () => expect(isEmptyPayload('')).toBe(true));
  it('returns true for whitespace string', () => expect(isEmptyPayload('   ')).toBe(true));
  it('returns true for empty array', () => expect(isEmptyPayload([])).toBe(true));
  it('returns true for empty object', () => expect(isEmptyPayload({})).toBe(true));
  it('returns false for non-empty string', () => expect(isEmptyPayload('hello')).toBe(false));
  it('returns false for non-empty array', () => expect(isEmptyPayload([1])).toBe(false));
  it('returns false for non-empty object', () => expect(isEmptyPayload({ a: 1 })).toBe(false));
  it('returns false for number 0', () => expect(isEmptyPayload(0)).toBe(false));
  it('returns false for boolean false', () => expect(isEmptyPayload(false)).toBe(false));
});

describe('AgentOutputMissingError', () => {
  it('sets name and message correctly', () => {
    const err = new AgentOutputMissingError('my-agent', 'run-1', 'no data');
    expect(err.name).toBe('AgentOutputMissingError');
    expect(err.message).toContain('my-agent');
    expect(err.message).toContain('run-1');
    expect(err.message).toContain('no data');
    expect(err.agentId).toBe('my-agent');
    expect(err.runId).toBe('run-1');
  });

  it('is an instance of Error', () => {
    const err = new AgentOutputMissingError('a', 'b', 'c');
    expect(err instanceof Error).toBe(true);
  });
});

describe('assertAgentOutput', () => {
  it('does not throw for a valid payload', () => {
    expect(() => assertAgentOutput({ result: 'ok' }, 'a', 'r')).not.toThrow();
  });

  it('throws AgentOutputMissingError for null', () => {
    expect(() => assertAgentOutput(null, 'a', 'r')).toThrow(AgentOutputMissingError);
  });

  it('throws AgentOutputMissingError for empty object', () => {
    expect(() => assertAgentOutput({}, 'a', 'r')).toThrow(AgentOutputMissingError);
  });

  // Fleet-wide invariant: empty-output agents must never resolve as 'succeeded'
  it('invariant: every empty payload variant throws', () => {
    const empties = [null, undefined, '', '  ', [], {}];
    for (const e of empties) {
      expect(() => assertAgentOutput(e, 'agent', 'run')).toThrow(AgentOutputMissingError);
    }
  });
});

describe('assertQuoteTriageOutput', () => {
  it('passes for a valid triage payload', () => {
    expect(() =>
      assertQuoteTriageOutput(
        { triage_category: 'residential', priority: 'high', notes: '' },
        'run-42',
      ),
    ).not.toThrow();
  });

  it('throws when triage_category is missing', () => {
    expect(() =>
      assertQuoteTriageOutput({ priority: 'low' }, 'run-43'),
    ).toThrow(AgentOutputMissingError);
  });

  it('throws when priority is missing', () => {
    expect(() =>
      assertQuoteTriageOutput({ triage_category: 'commercial' }, 'run-44'),
    ).toThrow(AgentOutputMissingError);
  });

  it('throws for completely empty payload', () => {
    expect(() => assertQuoteTriageOutput({}, 'run-45')).toThrow(AgentOutputMissingError);
  });
});

describe('applyOutputGuard', () => {
  it('passes through failed status unchanged', () => {
    const r = applyOutputGuard('ag', 'r1', { status: 'failed', output: null });
    expect(r.status).toBe('failed');
  });

  it('passes through succeeded with valid output', () => {
    const r = applyOutputGuard('ag', 'r1', { status: 'succeeded', output: { x: 1 } });
    expect(r.status).toBe('succeeded');
  });

  it('re-classifies empty succeeded as succeeded_no_output', () => {
    const r = applyOutputGuard('ag', 'r1', { status: 'succeeded', output: null });
    expect(r.status).toBe('succeeded_no_output');
    expect(r.warning).toBeDefined();
  });

  it('includes agentId, runId, guardedAt in all results', () => {
    const r = applyOutputGuard('ag', 'r1', { status: 'succeeded', output: { y: 2 } });
    expect(r.agentId).toBe('ag');
    expect(r.runId).toBe('r1');
    expect(typeof r.guardedAt).toBe('string');
  });

  it(`throws after ${MAX_OUTPUT_RETRIES} consecutive empty outputs`, () => {
    expect(() =>
      applyOutputGuard('ag', 'r1', { status: 'succeeded', output: null }, MAX_OUTPUT_RETRIES),
    ).toThrow(AgentOutputMissingError);
  });

  it('does NOT throw before MAX_OUTPUT_RETRIES is reached', () => {
    expect(() =>
      applyOutputGuard('ag', 'r1', { status: 'succeeded', output: null }, MAX_OUTPUT_RETRIES - 1),
    ).not.toThrow();
  });
});
