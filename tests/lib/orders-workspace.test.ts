import { describe, expect, it } from 'vitest';
import { isAuthorizedForOrderWorkspace, orderWorkspace, resolveOrderWorkspace } from '@/lib/orders/workspace';

describe('resolveOrderWorkspace', () => {
  it('defaults to production with no workspace param, for any role including anonymous', () => {
    const params = new URLSearchParams();
    expect(resolveOrderWorkspace(params, 'admin')).toBe('production');
    expect(resolveOrderWorkspace(params, 'employee')).toBe('production');
    expect(resolveOrderWorkspace(params, null)).toBe('production');
  });

  it('resolves an invalid workspace value safely to production regardless of role', () => {
    const params = new URLSearchParams({ workspace: 'bogus' });
    expect(resolveOrderWorkspace(params, 'admin')).toBe('production');
    expect(resolveOrderWorkspace(params, null)).toBe('production');
  });

  it('grants sandbox only to an admin', () => {
    const params = new URLSearchParams({ workspace: 'sandbox' });
    expect(resolveOrderWorkspace(params, 'admin')).toBe('sandbox');
  });

  it('forces a requested sandbox workspace back to production for a non-admin', () => {
    const params = new URLSearchParams({ workspace: 'sandbox' });
    expect(resolveOrderWorkspace(params, 'employee')).toBe('production');
    expect(resolveOrderWorkspace(params, 'customer')).toBe('production');
    expect(resolveOrderWorkspace(params, null)).toBe('production');
  });
});

describe('orderWorkspace', () => {
  it('reads a valid environment value off a record', () => {
    expect(orderWorkspace({ environment: 'sandbox' })).toBe('sandbox');
    expect(orderWorkspace({ environment: 'production' })).toBe('production');
  });

  it('falls back to production for a missing, invalid, or legacy-seed record', () => {
    expect(orderWorkspace({})).toBe('production');
    expect(orderWorkspace({ environment: null })).toBe('production');
    expect(orderWorkspace({ environment: 'not-a-real-workspace' })).toBe('production');
  });

  it('is generic over any workspace-scoped row, not just orders (used for related quote/customer checks)', () => {
    expect(orderWorkspace({ id: 'q1', environment: 'sandbox' })).toBe('sandbox');
    expect(orderWorkspace({ id: 'c1', environment: 'production' })).toBe('production');
  });
});

describe('isAuthorizedForOrderWorkspace', () => {
  it('always authorizes the production workspace, for any role', () => {
    expect(isAuthorizedForOrderWorkspace('production', 'employee')).toBe(true);
    expect(isAuthorizedForOrderWorkspace('production', 'customer')).toBe(true);
    expect(isAuthorizedForOrderWorkspace('production', null)).toBe(true);
  });

  it('authorizes the sandbox workspace only for an admin', () => {
    expect(isAuthorizedForOrderWorkspace('sandbox', 'admin')).toBe(true);
    expect(isAuthorizedForOrderWorkspace('sandbox', 'employee')).toBe(false);
    expect(isAuthorizedForOrderWorkspace('sandbox', 'customer')).toBe(false);
    expect(isAuthorizedForOrderWorkspace('sandbox', null)).toBe(false);
  });
});
