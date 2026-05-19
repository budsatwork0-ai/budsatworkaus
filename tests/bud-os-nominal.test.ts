import { describe, it, expect } from 'vitest';
import { evaluateGlobalHealth } from '../src/lib/bud/health';

describe('Buds OS strict nominal rules', () => {
  const empty = { agents: [], runs: [], actions: [] };
  it('nominal when nothing is wrong', () => {
    const r = evaluateGlobalHealth(empty);
    expect(r.global_status).toBe('nominal');
    expect(r.is_nominal).toBe(true);
  });
  it('blocked when blocked_repairs > 0', () => {
    const r = evaluateGlobalHealth({ ...empty, blockedRepairs: 1 });
    expect(r.global_status).toBe('blocked');
    expect(r.is_nominal).toBe(false);
  });
  it('attention_required for failed runs (broken agent)', () => {
    const r = evaluateGlobalHealth({
      agents: [{ id: 'a', status: 'broken' }],
      runs: [{ id: 'r', agent_id: 'a', status: 'failed', summary: 'broken', started_at: new Date().toISOString() }],
      actions: [],
    });
    expect(r.is_nominal).toBe(false);
    expect(r.global_status).toBe('attention_required');
  });
  it('repairing when repairs in flight and nothing else broken', () => {
    const r = evaluateGlobalHealth({ ...empty, repairsInFlight: 1 });
    expect(r.global_status).toBe('repairing');
  });
  it('degraded for pending approvals only', () => {
    const r = evaluateGlobalHealth({
      agents: [], runs: [], actions: [{ id: 'p', status: 'pending' }],
    });
    expect(r.global_status).toBe('degraded');
  });
  it('blocked beats every other state', () => {
    const r = evaluateGlobalHealth({
      ...empty,
      blockedRepairs: 1,
      repairsInFlight: 1,
      actions: [{ id: 'p', status: 'pending' }],
    });
    expect(r.global_status).toBe('blocked');
  });
});
