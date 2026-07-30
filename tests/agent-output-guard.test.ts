import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isEmptyPayload,
  AgentOutputMissingError,
  assertAgentOutput,
} from '../src/lib/agents/agent-output-guard';
import {
  applyOutputGuard,
  MAX_OUTPUT_RETRIES,
  type AgentRunResult,
} from '../src/lib/agents/runner-output-middleware';

// ─── isEmptyPayload ───────────────────────────────────────────────────────────
describe('isEmptyPayload', () => {
  it('returns true for null', () => expect(isEmptyPayload(null)).toBe(true));
  it('returns true for undefined', () => expect(isEmptyPayload(undefined)).toBe(true));
  it('returns true for empty object', () => expect(isEmptyPayload({})).toBe(true));
  it('returns true for empty array', () => expect(isEmptyPayload([])).toBe(true));
  it('returns false for non-empty object', () => expect(isEmptyPayload({ a: 1 })).toBe(false));
  it('returns false for non-empty array', () => expect(isEmptyPayload([1])).toBe(false));
});

// ─── AgentOutputMissingError ──────────────────────────────────────────────────
describe('AgentOutputMissingError', () => {
  it('stores agentId and runId', () => {
    const err = new AgentOutputMissingError('my-agent', 'run-001');
    expect(err.agentId).toBe('my-agent');
    expect(err.runId).toBe('run-001');
    expect(err.name).toBe('AgentOutputMissingError');
    expect(err).toBeInstanceOf(Error);
  });
});

// ─── assertAgentOutput ────────────────────────────────────────────────────────
describe('assertAgentOutput', () => {
  it('does not throw for non-empty object', () => {
    expect(() => assertAgentOutput({ result: 'ok' }, 'a', 'r')).not.toThrow();
  });
  it('throws AgentOutputMissingError for empty object', () => {
    expect(() => assertAgentOutput({}, 'a', 'r')).toThrow(AgentOutputMissingError);
  });
  it('throws AgentOutputMissingError for null', () => {
    expect(() => assertAgentOutput(null, 'a', 'r')).toThrow(AgentOutputMissingError);
  });
  it('fleet-wide invariant: empty-output agents never resolve as succeeded', () => {
    // Any empty payload must throw — never silently pass through as succeeded.
    const empties = [null, undefined, {}, []] as const;
    for (const payload of empties) {
      expect(() => assertAgentOutput(payload, 'fleet-agent', 'run-x')).toThrow(AgentOutputMissingError);
    }
  });
});

// ─── applyOutputGuard ────────────────────────────────────────────────────────
describe('applyOutputGuard', () => {
  const baseResult: AgentRunResult = {
    runId: 'run-001',
    agentId: 'test-agent',
    status: 'succeeded',
    output: { data: 'hello' },
    attempt: 1,
  };

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('returns succeeded unchanged when output is non-empty', async () => {
    const result = await applyOutputGuard(baseResult);
    expect(result.status).toBe('succeeded');
    expect(result.output).toEqual({ data: 'hello' });
  });

  it('downgrades to succeeded_no_output when output is empty and no executor', async () => {
    const result = await applyOutputGuard({ ...baseResult, output: {} });
    expect(result.status).toBe('succeeded_no_output');
  });

  it('emits a console.warn event when output is empty', async () => {
    await applyOutputGuard({ ...baseResult, output: null });
    expect(console.warn).toHaveBeenCalled();
    const call = (console.warn as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string;
    const event = JSON.parse(call);
    expect(event.eventType).toBe('agent_silent_success');
    expect(event.agentId).toBe('test-agent');
  });

  it('retries via executor and returns succeeded if retry yields output', async () => {
    const executor = vi.fn().mockResolvedValue({ recovered: true });
    const result = await applyOutputGuard({ ...baseResult, output: {} }, executor);
    expect(result.status).toBe('succeeded');
    expect(result.output).toEqual({ recovered: true });
    expect(executor).toHaveBeenCalledTimes(1);
  });

  it('retries MAX_OUTPUT_RETRIES times then gives up as succeeded_no_output', async () => {
    const executor = vi.fn().mockResolvedValue({});
    const result = await applyOutputGuard({ ...baseResult, output: {}, attempt: 1 }, executor);
    expect(result.status).toBe('succeeded_no_output');
    expect(executor).toHaveBeenCalledTimes(MAX_OUTPUT_RETRIES - 1);
  });
});
