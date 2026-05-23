import { describe, expect, it } from 'vitest';
import { coerceLeadSource, resolveLeadSource } from '@/lib/leads/source';

describe('resolveLeadSource', () => {
  it("defaults to 'website' when no signals are present", () => {
    expect(resolveLeadSource({})).toBe('website');
    expect(resolveLeadSource({ source: null, utm_source: '', referrer: undefined })).toBe('website');
  });

  it('respects an explicit, valid source', () => {
    expect(resolveLeadSource({ source: 'messenger' })).toBe('messenger');
    expect(resolveLeadSource({ source: 'phone' })).toBe('phone');
    expect(resolveLeadSource({ source: 'REFERRAL' })).toBe('referral');
  });

  it('ignores an explicit but unknown source', () => {
    expect(resolveLeadSource({ source: 'tiktok' })).toBe('website');
  });

  it('maps known utm_source values', () => {
    expect(resolveLeadSource({ utm_source: 'facebook' })).toBe('messenger');
    expect(resolveLeadSource({ utm_source: 'Instagram' })).toBe('instagram');
    expect(resolveLeadSource({ utm_source: 'email' })).toBe('email');
    expect(resolveLeadSource({ utm_source: 'partner' })).toBe('referral');
  });

  it("falls back to 'website' for unmapped utm_source", () => {
    expect(resolveLeadSource({ utm_source: 'google' })).toBe('website');
    expect(resolveLeadSource({ utm_source: 'bing' })).toBe('website');
  });

  it('maps known referrer hosts', () => {
    expect(resolveLeadSource({ referrer: 'https://m.me/budsatwork' })).toBe('messenger');
    expect(resolveLeadSource({ referrer: 'https://www.facebook.com/foo' })).toBe('messenger');
    expect(resolveLeadSource({ referrer: 'https://www.instagram.com/p/abc' })).toBe('instagram');
  });

  it('accepts a bare host as the referrer', () => {
    expect(resolveLeadSource({ referrer: 'messenger.com' })).toBe('messenger');
  });

  it('explicit source beats utm beats referrer', () => {
    expect(
      resolveLeadSource({
        source: 'phone',
        utm_source: 'facebook',
        referrer: 'https://www.instagram.com',
      })
    ).toBe('phone');
    expect(
      resolveLeadSource({ utm_source: 'facebook', referrer: 'https://www.instagram.com' })
    ).toBe('messenger');
    expect(resolveLeadSource({ referrer: 'https://www.instagram.com' })).toBe('instagram');
  });
});

describe('coerceLeadSource', () => {
  it('returns the source when valid', () => {
    expect(coerceLeadSource('messenger')).toBe('messenger');
    expect(coerceLeadSource('  WEBSITE ')).toBe('website');
  });

  it('returns null when invalid', () => {
    expect(coerceLeadSource('tiktok')).toBeNull();
    expect(coerceLeadSource(null)).toBeNull();
    expect(coerceLeadSource(undefined)).toBeNull();
    expect(coerceLeadSource(123)).toBeNull();
  });
});
