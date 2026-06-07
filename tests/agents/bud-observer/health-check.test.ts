import { describe, it, expect, vi, beforeEach } from 'vitest';
import { budObserverHealthCheck } from '@/agents/bud-observer/health-check';

describe('budObserverHealthCheck', () => {
  it('returns healthy:true for a valid probe', () => {
    const result = budObserverHealthCheck();
    expect(result.healthy).toBe(true);
  });

  it('is callable multiple times without side effects', () => {
    expect(budObserverHealthCheck().healthy).toBe(true);
    expect(budObserverHealthCheck().healthy).toBe(true);
  });
});
