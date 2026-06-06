import { describe, it, expect } from 'vitest';
import {
  assertAgentOutput,
  AgentOutputMissingError,
} from '@/lib/agent-utils/assert-agent-output';

const AGENT_ID = 'test-agent';
const RUN_ID = 'run-abc-123';

describe('AgentOutputMissingError', () => {
  it('is an instance of Error', () => {
    const err = new AgentOutputMissingError(AGENT_ID, RUN_ID);
    expect(err).toBeInstanceOf(Error);
  });

  it('sets the correct name', () => {
    const err = new AgentOutputMissingError(AGENT_ID, RUN_ID);
    expect(err.name).toBe('AgentOutputMissingError');
  });

  it('exposes agentId and runId on the instance', () => {
    const err = new AgentOutputMissingError(AGENT_ID, RUN_ID);
    expect(err.agentId).toBe(AGENT_ID);
    expect(err.runId).toBe(RUN_ID);
  });

  it('includes agentId and runId in the message', () => {
    const err = new AgentOutputMissingError(AGENT_ID, RUN_ID);
    expect(err.message).toContain(AGENT_ID);
    expect(err.message).toContain(RUN_ID);
  });
});

describe('assertAgentOutput — passing cases', () => {
  it('does not throw for a non-empty string', () => {
    expect(() => assertAgentOutput('hello', AGENT_ID, RUN_ID)).not.toThrow();
  });

  it('does not throw for a non-empty object', () => {
    expect(() =>
      assertAgentOutput({ result: 'ok' }, AGENT_ID, RUN_ID),
    ).not.toThrow();
  });

  it('does not throw for a non-empty array', () => {
    expect(() => assertAgentOutput([1, 2, 3], AGENT_ID, RUN_ID)).not.toThrow();
  });

  it('does not throw for the number 0 (falsy but valid output)', () => {
    expect(() => assertAgentOutput(0, AGENT_ID, RUN_ID)).not.toThrow();
  });

  it('does not throw for boolean false (falsy but valid output)', () => {
    expect(() => assertAgentOutput(false, AGENT_ID, RUN_ID)).not.toThrow();
  });

  it('does not throw for a whitespace-only surroundings with real content', () => {
    expect(() => assertAgentOutput('  ok  ', AGENT_ID, RUN_ID)).not.toThrow();
  });
});

describe('assertAgentOutput — failing cases', () => {
  it('throws AgentOutputMissingError for null', () => {
    expect(() => assertAgentOutput(null, AGENT_ID, RUN_ID)).toThrow(
      AgentOutputMissingError,
    );
  });

  it('throws AgentOutputMissingError for undefined', () => {
    expect(() => assertAgentOutput(undefined, AGENT_ID, RUN_ID)).toThrow(
      AgentOutputMissingError,
    );
  });

  it('throws AgentOutputMissingError for an empty string', () => {
    expect(() => assertAgentOutput('', AGENT_ID, RUN_ID)).toThrow(
      AgentOutputMissingError,
    );
  });

  it('throws AgentOutputMissingError for a whitespace-only string', () => {
    expect(() => assertAgentOutput('   ', AGENT_ID, RUN_ID)).toThrow(
      AgentOutputMissingError,
    );
  });

  it('thrown error carries the correct agentId and runId', () => {
    try {
      assertAgentOutput(null, AGENT_ID, RUN_ID);
      // Should not reach here
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(AgentOutputMissingError);
      const typed = err as AgentOutputMissingError;
      expect(typed.agentId).toBe(AGENT_ID);
      expect(typed.runId).toBe(RUN_ID);
    }
  });
});
