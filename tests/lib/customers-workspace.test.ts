import { describe, expect, it } from 'vitest';
import { resolveCustomerWorkspace } from '@/lib/customers/workspace';

describe('resolveCustomerWorkspace', () => {
  it('defaults to production when no workspace param is present', () => {
    const params = new URLSearchParams();
    expect(resolveCustomerWorkspace(params, 'admin')).toBe('production');
    expect(resolveCustomerWorkspace(params, 'employee')).toBe('production');
  });

  it('resolves invalid workspace values safely to production regardless of role', () => {
    const params = new URLSearchParams({ workspace: 'not-a-real-workspace' });
    expect(resolveCustomerWorkspace(params, 'admin')).toBe('production');
    expect(resolveCustomerWorkspace(params, 'employee')).toBe('production');
  });

  it('grants sandbox only to an admin', () => {
    const params = new URLSearchParams({ workspace: 'sandbox' });
    expect(resolveCustomerWorkspace(params, 'admin')).toBe('sandbox');
  });

  it('forces a requested sandbox workspace back to production for a non-admin', () => {
    const params = new URLSearchParams({ workspace: 'sandbox' });
    expect(resolveCustomerWorkspace(params, 'employee')).toBe('production');
    expect(resolveCustomerWorkspace(params, 'customer')).toBe('production');
  });
});
