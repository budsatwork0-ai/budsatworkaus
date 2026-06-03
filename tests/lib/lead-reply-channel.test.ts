import { describe, expect, it } from 'vitest';
import { deriveReplyChannel } from '@/lib/leads/reply-channel';

describe('deriveReplyChannel', () => {
  // Social sources — channel wins regardless of contact data
  it('returns messenger for source=messenger', () => {
    expect(deriveReplyChannel('messenger', 'a@b.com', '0400000000')).toBe('messenger');
  });

  it('returns instagram for source=instagram', () => {
    expect(deriveReplyChannel('instagram', 'a@b.com', '0400000000')).toBe('instagram');
  });

  it('returns phone for source=phone', () => {
    expect(deriveReplyChannel('phone', null, null)).toBe('phone');
  });

  it('returns sms for source=sms', () => {
    expect(deriveReplyChannel('sms', null, null)).toBe('sms');
  });

  // Website / referral / email leads — email wins when present
  it('returns email for source=website with customer_email (website quote lead)', () => {
    expect(deriveReplyChannel('website', 'customer@example.com', null)).toBe('email');
  });

  it('returns email for source=referral with customer_email', () => {
    expect(deriveReplyChannel('referral', 'ref@example.com', null)).toBe('email');
  });

  it('returns email for source=email with customer_email', () => {
    expect(deriveReplyChannel('email', 'e@example.com', null)).toBe('email');
  });

  // Phone-only fallback
  it('returns sms when phone present but no email and source is website', () => {
    expect(deriveReplyChannel('website', null, '0411111111')).toBe('sms');
  });

  it('returns sms when phone present but no email and source is unknown', () => {
    expect(deriveReplyChannel('unknown', null, '0422222222')).toBe('sms');
  });

  // Nothing usable
  it('returns null when no source, email, or phone', () => {
    expect(deriveReplyChannel(null, null, null)).toBeNull();
  });

  it('returns null for source=unknown with no contact', () => {
    expect(deriveReplyChannel('unknown', null, null)).toBeNull();
  });

  it('returns null for undefined source and no contact data', () => {
    expect(deriveReplyChannel(undefined, undefined, undefined)).toBeNull();
  });

  // Social source always wins — ignores email/phone
  it('messenger source overrides email', () => {
    expect(deriveReplyChannel('messenger', 'x@y.com', null)).toBe('messenger');
  });

  it('instagram source overrides phone', () => {
    expect(deriveReplyChannel('instagram', null, '0400000000')).toBe('instagram');
  });
});
