import { describe, expect, it } from 'vitest';
import { classifyRepositoryIdentityVersion, classifyRepositoryStateIdentityVersion } from '@/lib/architecture-doctor/v2/migration-governance';

const CURRENT = 2;

describe('classifyRepositoryIdentityVersion', () => {
  it('classifies the current version as current', () => {
    expect(classifyRepositoryIdentityVersion(2, CURRENT)).toBe('current');
  });

  it('classifies an absent/undefined version as legacy', () => {
    expect(classifyRepositoryIdentityVersion(undefined, CURRENT)).toBe('legacy');
  });

  it('classifies a greater integer as unsupported_future', () => {
    expect(classifyRepositoryIdentityVersion(3, CURRENT)).toBe('unsupported_future');
  });

  it('classifies a lower integer with no compatibility table entry as malformed', () => {
    expect(classifyRepositoryIdentityVersion(1, CURRENT)).toBe('malformed');
  });

  it('classifies zero as malformed', () => {
    expect(classifyRepositoryIdentityVersion(0, CURRENT)).toBe('malformed');
  });

  it('classifies a negative integer as malformed', () => {
    expect(classifyRepositoryIdentityVersion(-1, CURRENT)).toBe('malformed');
  });

  it('classifies a float as malformed', () => {
    expect(classifyRepositoryIdentityVersion(2.5, CURRENT)).toBe('malformed');
  });

  it('classifies NaN as malformed', () => {
    expect(classifyRepositoryIdentityVersion(Number.NaN, CURRENT)).toBe('malformed');
  });

  it('classifies Infinity and -Infinity as malformed', () => {
    expect(classifyRepositoryIdentityVersion(Number.POSITIVE_INFINITY, CURRENT)).toBe('malformed');
    expect(classifyRepositoryIdentityVersion(Number.NEGATIVE_INFINITY, CURRENT)).toBe('malformed');
  });

  it('classifies a string as malformed', () => {
    expect(classifyRepositoryIdentityVersion('2', CURRENT)).toBe('malformed');
  });

  it('classifies null as malformed', () => {
    expect(classifyRepositoryIdentityVersion(null, CURRENT)).toBe('malformed');
  });

  it('classifies an object as malformed', () => {
    expect(classifyRepositoryIdentityVersion({ version: 2 }, CURRENT)).toBe('malformed');
  });

  it('never throws for any input', () => {
    const inputs: unknown[] = [undefined, null, NaN, Infinity, -Infinity, '2', {}, [], true, Symbol('x'), () => {}];
    for (const input of inputs) {
      expect(() => classifyRepositoryIdentityVersion(input, CURRENT)).not.toThrow();
    }
  });
});

describe('classifyRepositoryStateIdentityVersion', () => {
  it('classifies a full repository state by its identityAlgorithmVersion field', () => {
    expect(classifyRepositoryStateIdentityVersion({ commitSha: 'a', identityAlgorithmVersion: 2 }, CURRENT)).toBe('current');
    expect(classifyRepositoryStateIdentityVersion({ commitSha: 'a' }, CURRENT)).toBe('legacy');
    expect(classifyRepositoryStateIdentityVersion({ commitSha: 'a', identityAlgorithmVersion: 5 }, CURRENT)).toBe('unsupported_future');
    expect(classifyRepositoryStateIdentityVersion(undefined, CURRENT)).toBe('legacy');
  });
});
