import { describe, expect, it } from 'vitest';
import { isAuthorizedForQuoteWorkspace, quoteWorkspace, resolveQuoteWorkspace } from '@/lib/quotes/workspace';

describe('resolveQuoteWorkspace', () => {
  it('defaults to production with no workspace param, for any role including anonymous', () => {
    const params = new URLSearchParams();
    expect(resolveQuoteWorkspace(params, 'admin')).toBe('production');
    expect(resolveQuoteWorkspace(params, 'employee')).toBe('production');
    expect(resolveQuoteWorkspace(params, null)).toBe('production');
  });

  it('resolves an invalid workspace value safely to production regardless of role', () => {
    const params = new URLSearchParams({ workspace: 'bogus' });
    expect(resolveQuoteWorkspace(params, 'admin')).toBe('production');
    expect(resolveQuoteWorkspace(params, null)).toBe('production');
  });

  it('grants sandbox only to an admin', () => {
    const params = new URLSearchParams({ workspace: 'sandbox' });
    expect(resolveQuoteWorkspace(params, 'admin')).toBe('sandbox');
  });

  it('forces a requested sandbox workspace back to production for a non-admin, including anonymous public submissions', () => {
    const params = new URLSearchParams({ workspace: 'sandbox' });
    expect(resolveQuoteWorkspace(params, 'employee')).toBe('production');
    expect(resolveQuoteWorkspace(params, 'customer')).toBe('production');
    expect(resolveQuoteWorkspace(params, null)).toBe('production');
  });
});

describe('quoteWorkspace', () => {
  it('reads a valid environment value off a record', () => {
    expect(quoteWorkspace({ environment: 'sandbox' })).toBe('sandbox');
    expect(quoteWorkspace({ environment: 'production' })).toBe('production');
  });

  it('falls back to production for a missing, invalid, or legacy-seed record', () => {
    expect(quoteWorkspace({})).toBe('production');
    expect(quoteWorkspace({ environment: null })).toBe('production');
    expect(quoteWorkspace({ environment: 'not-a-real-workspace' })).toBe('production');
  });
});

describe('isAuthorizedForQuoteWorkspace', () => {
  it('always authorizes the production workspace, for any role', () => {
    expect(isAuthorizedForQuoteWorkspace('production', 'employee')).toBe(true);
    expect(isAuthorizedForQuoteWorkspace('production', 'customer')).toBe(true);
    expect(isAuthorizedForQuoteWorkspace('production', null)).toBe(true);
  });

  it('authorizes the sandbox workspace only for an admin', () => {
    expect(isAuthorizedForQuoteWorkspace('sandbox', 'admin')).toBe(true);
    expect(isAuthorizedForQuoteWorkspace('sandbox', 'employee')).toBe(false);
    expect(isAuthorizedForQuoteWorkspace('sandbox', 'customer')).toBe(false);
    expect(isAuthorizedForQuoteWorkspace('sandbox', null)).toBe(false);
  });
});
