import { describe, expect, it } from 'vitest';
import {
  MINIMUM_STRIPE_CHARGE_CENTS,
  calculateStripeFeeEstimate,
  dollarsToCents,
  getStripeCheckoutPolicy,
} from '@/lib/payments/pricing';

describe('payment pricing rules', () => {
  it('blocks A$0.50 from normal Stripe checkout', () => {
    const policy = getStripeCheckoutPolicy(dollarsToCents(0.5));

    expect(policy.allowed).toBe(false);
    expect(policy.minimumChargeCents).toBe(MINIMUM_STRIPE_CHARGE_CENTS);
    expect(policy.message).toContain('Minimum booking amount applies');
  });

  it('enforces the A$10 Stripe checkout minimum', () => {
    expect(MINIMUM_STRIPE_CHARGE_CENTS).toBe(1000);
    expect(getStripeCheckoutPolicy(dollarsToCents(9.99)).allowed).toBe(false);
    expect(getStripeCheckoutPolicy(dollarsToCents(10)).allowed).toBe(true);
    expect(getStripeCheckoutPolicy(dollarsToCents(20)).allowed).toBe(true);
  });

  it('estimates Stripe fees and net amount for A$60', () => {
    const estimate = calculateStripeFeeEstimate(dollarsToCents(60));

    expect(estimate.feeCents).toBe(132);
    expect(estimate.netCents).toBe(5868);
  });

  it('leaves larger job amounts unchanged apart from fee estimates', () => {
    const amountCents = dollarsToCents(250);
    const policy = getStripeCheckoutPolicy(amountCents);
    const estimate = calculateStripeFeeEstimate(amountCents);

    expect(policy.allowed).toBe(true);
    expect(policy.amountCents).toBe(amountCents);
    expect(estimate.amountCents).toBe(amountCents);
    expect(estimate.feeCents).toBe(455);
    expect(estimate.netCents).toBe(24545);
  });
});
