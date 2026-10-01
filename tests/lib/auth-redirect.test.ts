import { describe, expect, it } from 'vitest';
import { authCallbackUrl, safeAuthRedirect } from '@/lib/auth-redirect';

describe('quote authentication return path', () => {
  it('returns through the code-exchange callback to the service wizard', () => {
    expect(authCallbackUrl('https://budsatwork.test', '/services?service=windows')).toBe('https://budsatwork.test/auth/callback?redirect=%2Fservices%3Fservice%3Dwindows');
    expect(safeAuthRedirect('/portal/quotes')).toBe('/portal/quotes');
  });
  it.each(['https://example.test', '//example.test', '/\\example.test', 'javascript:alert(1)', '/\nexample.test'])('rejects unsafe redirect %s', value => {
    expect(safeAuthRedirect(value)).toBeNull();
  });
});
