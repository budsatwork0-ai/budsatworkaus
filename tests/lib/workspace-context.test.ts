import { describe, expect, it } from 'vitest';
import {
  currentWorkspace,
  isLiveWorkspace,
  resolveGatedWorkspaceFromRequest,
  resolveWorkspaceFromRequest,
  withWorkspaceContext,
} from '@/lib/workspace/context';
import { LIVE_WORKSPACE } from '@/lib/workspace/types';

describe('withWorkspaceContext / currentWorkspace', () => {
  it('defaults to the live workspace outside any context', () => {
    expect(currentWorkspace()).toBe(LIVE_WORKSPACE);
    expect(isLiveWorkspace()).toBe(true);
  });

  it('exposes the selected workspace inside nested asynchronous calls', async () => {
    async function nested(): Promise<string> {
      await new Promise((resolve) => setTimeout(resolve, 0));
      return currentWorkspace();
    }

    const observed = await withWorkspaceContext('sandbox', async () => {
      await Promise.resolve();
      return nested();
    });

    expect(observed).toBe('sandbox');
  });

  it('does not leak context between separate concurrent executions', async () => {
    const results = await Promise.all([
      withWorkspaceContext('sandbox', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return currentWorkspace();
      }),
      withWorkspaceContext('production', async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        return currentWorkspace();
      }),
    ]);

    expect(results).toEqual(['sandbox', 'production']);
    // Execution has returned to the outer (context-free) scope — the default applies again.
    expect(currentWorkspace()).toBe(LIVE_WORKSPACE);
  });

  it('rejects an invalid workspace rather than silently entering an unknown context', () => {
    expect(() => withWorkspaceContext('demo' as never, () => undefined)).toThrow(/Invalid workspace/);
  });
});

describe('resolveWorkspaceFromRequest', () => {
  it('resolves a supported value from the query string', () => {
    const params = new URLSearchParams({ workspace: 'sandbox' });
    expect(resolveWorkspaceFromRequest(params)).toBe('sandbox');
  });

  it('resolves safely to production when the parameter is missing', () => {
    const params = new URLSearchParams();
    expect(resolveWorkspaceFromRequest(params)).toBe(LIVE_WORKSPACE);
  });

  it('resolves safely to production for an unsupported or malicious value', () => {
    const params = new URLSearchParams({ workspace: "sandbox'; DROP TABLE customers;--" });
    expect(resolveWorkspaceFromRequest(params)).toBe(LIVE_WORKSPACE);
  });

  it('supports a custom parameter name without affecting the default one', () => {
    const params = new URLSearchParams({ ws: 'sandbox' });
    expect(resolveWorkspaceFromRequest(params, 'ws')).toBe('sandbox');
    expect(resolveWorkspaceFromRequest(params, 'workspace')).toBe(LIVE_WORKSPACE);
  });
});

describe('resolveGatedWorkspaceFromRequest', () => {
  it('grants the requested sandbox workspace when authorized', () => {
    const params = new URLSearchParams({ workspace: 'sandbox' });
    expect(resolveGatedWorkspaceFromRequest(params, true)).toBe('sandbox');
  });

  it('holds an unauthorized request to production even if sandbox was requested', () => {
    const params = new URLSearchParams({ workspace: 'sandbox' });
    expect(resolveGatedWorkspaceFromRequest(params, false)).toBe(LIVE_WORKSPACE);
  });

  it('resolves to production regardless of authorization when nothing (or something invalid) was requested', () => {
    expect(resolveGatedWorkspaceFromRequest(new URLSearchParams(), true)).toBe(LIVE_WORKSPACE);
    expect(resolveGatedWorkspaceFromRequest(new URLSearchParams({ workspace: 'bogus' }), true)).toBe(LIVE_WORKSPACE);
  });

  it('treats selection and authorization as independent — production never needs authorization', () => {
    const params = new URLSearchParams({ workspace: 'production' });
    expect(resolveGatedWorkspaceFromRequest(params, false)).toBe('production');
  });
});
