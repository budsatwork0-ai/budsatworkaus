import { describe, it, expect, vi } from 'vitest';
import { runAgent } from '../../../src/agents/shared/runAgent';
import { AgentEmptyOutputError } from '../../../src/agents/shared/withOutputGuard';
import { z } from 'zod';

const AGENT = 'test-agent';

describe('runAgent', () => {
  // ── Happy path ────────────────────────────────────────────────────────────

  it('returns success=true and the output when the agent produces a value', async () => {
    const fn = vi.fn(async (_input: { x: number }) => ({ result: 42 }));
    const res = await runAgent({ agentName: AGENT, fn, input: { x: 1 } });

    expect(res.success).toBe(true);
    expect(res.output).toEqual({ result: 42 });
    expect(res.reason).toBeUndefined();
  });

  it('passes the schema-validation happy path', async () => {
    const schema = z.object({ result: z.number() });
    const fn = vi.fn(async () => ({ result: 7 }));
    const res = await runAgent({ agentName: AGENT, fn, input: null, outputSchema: schema });

    expect(res.success).toBe(true);
    expect(res.output).toEqual({ result: 7 });
  });

  // ── Empty-output failure mode ─────────────────────────────────────────────

  it('returns success=false with reason=empty_output when fn returns null', async () => {
    // We intentionally cast to bypass TypeScript so we can test the guard
    const fn = vi.fn(async () => null as unknown as { result: number });
    const res = await runAgent({ agentName: AGENT, fn, input: null });

    expect(res.success).toBe(false);
    expect(res.reason).toBe('empty_output');
    expect(res.error).toBeInstanceOf(AgentEmptyOutputError);
  });

  it('returns success=false with reason=empty_output when fn returns undefined', async () => {
    const fn = vi.fn(async () => undefined as unknown as string);
    const res = await runAgent({ agentName: AGENT, fn, input: null });

    expect(res.success).toBe(false);
    expect(res.reason).toBe('empty_output');
  });

  it('returns success=false with reason=empty_output when fn returns an empty string', async () => {
    const fn = vi.fn(async () => '   ');
    const res = await runAgent({ agentName: AGENT, fn, input: null });

    expect(res.success).toBe(false);
    expect(res.reason).toBe('empty_output');
  });

  it('returns success=false with reason=empty_output when output fails schema validation', async () => {
    const schema = z.object({ result: z.number() });
    // Returns wrong shape
    const fn = vi.fn(async () => ({ result: 'not-a-number' } as unknown as { result: number }));
    const res = await runAgent({ agentName: AGENT, fn, input: null, outputSchema: schema });

    expect(res.success).toBe(false);
    expect(res.reason).toBe('empty_output');
    expect(res.error).toBeInstanceOf(AgentEmptyOutputError);
  });

  // ── Runtime error ─────────────────────────────────────────────────────────

  it('returns success=false with reason=runtime_error when fn throws', async () => {
    const fn = vi.fn(async () => { throw new Error('boom'); });
    const res = await runAgent({ agentName: AGENT, fn, input: null });

    expect(res.success).toBe(false);
    expect(res.reason).toBe('runtime_error');
    expect(res.error?.message).toBe('boom');
  });
});
