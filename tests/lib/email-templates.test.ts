import { describe, expect, it } from 'vitest';
import { formatEmailName, quoteFinalizedEmail } from '@/lib/email/templates';

describe('email templates', () => {
  it('capitalizes first and last names for email greetings', () => {
    expect(formatEmailName('jackson taylor')).toBe('Jackson Taylor');
    expect(formatEmailName('  MARY-jane   oCONNOR  ')).toBe('Mary-Jane Oconnor');
    expect(formatEmailName('there')).toBe('there');
  });

  it('uses formatted customer names in quote finalized emails', () => {
    const email = quoteFinalizedEmail({
      customerName: 'jackson taylor',
      serviceLabel: 'Window Cleaning',
      total: 288,
      quoteId: '80a3f7a6-e27f-4ced-8f7e-0e7615729387',
      paymentUrl: 'https://checkout.stripe.test/cs_test_123',
    });

    expect(email.html).toContain('Your quote is ready, Jackson Taylor!');
    expect(email.html).not.toContain('jackson taylor');
  });
});
