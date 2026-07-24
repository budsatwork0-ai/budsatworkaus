import { describe, expect, it } from 'vitest';
import {
  LIVE_WORKSPACE,
  WORKSPACE_COLUMN,
  WORKSPACES,
  assertValidWorkspace,
  isWorkspace,
} from '@/lib/workspace/types';

describe('workspace types', () => {
  it('accepts every supported workspace value', () => {
    for (const workspace of WORKSPACES) {
      expect(isWorkspace(workspace)).toBe(true);
    }
  });

  it('rejects unsupported or malformed values', () => {
    expect(isWorkspace('demo')).toBe(false);
    expect(isWorkspace('production ')).toBe(false);
    expect(isWorkspace('')).toBe(false);
    expect(isWorkspace(null)).toBe(false);
    expect(isWorkspace(undefined)).toBe(false);
    expect(isWorkspace(123)).toBe(false);
  });

  it('assertValidWorkspace throws with the supported list on an invalid value', () => {
    expect(() => assertValidWorkspace('demo')).toThrow(/Invalid workspace/);
    expect(() => assertValidWorkspace('demo')).toThrow(/production, sandbox/);
  });

  it('assertValidWorkspace does not throw on a supported value', () => {
    expect(() => assertValidWorkspace('sandbox')).not.toThrow();
  });

  it('exposes the live workspace and the database column mapping as the single source of truth', () => {
    expect(LIVE_WORKSPACE).toBe('production');
    expect(WORKSPACE_COLUMN).toBe('environment');
  });
});
