import { describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
import type { PaymentRepository, PaymentRow } from '@/lib/payments/repository';
import { resolveStripePaymentIntent } from '@/lib/payments/stripe-correlation';

const payment: PaymentRow = {
  id: 'payment-1', order_id: 'order-1', customer_id: 'customer-1', subscription_id: null,
  amount: 100, currency: 'aud', payment_method: 'card', payment_provider: 'stripe',
  payment_reference: null, provider_event_id: null, status: 'pending', environment: 'production',
  paid_at: null, notes: null,
};

function setup(overrides: { amount?: number; currency?: string; sessions?: Array<Record<string, unknown>> } = {}) {
  const repository = {
    resolveByProviderObject: vi.fn(async () => ({ payment, mapping: { id: 'map-1', payment_id: payment.id, environment: 'production', provider: 'stripe', object_type: 'checkout_session', object_id: 'cs_1', created_at: 'now', updated_at: 'now' } })),
    attachProviderObject: vi.fn(async () => ({ id: 'map-2' })),
  } as unknown as PaymentRepository;
  const stripe = {
    paymentIntents: { retrieve: vi.fn(async () => ({ id: 'pi_1', amount: overrides.amount ?? 10000, currency: overrides.currency ?? 'aud', metadata: { order_id: 'forged-order', workspace: 'sandbox' } })) },
    checkout: { sessions: { list: vi.fn(async () => ({ data: overrides.sessions ?? [{ id: 'cs_1', payment_intent: 'pi_1', metadata: { order_id: 'forged-order' } }] })) } },
  } as unknown as Stripe;
  return { repository, stripe };
}

describe('Stripe PaymentIntent correlation', () => {
  it('resolves an early PaymentIntent through Stripe session lookup and stored session mapping', async () => {
    const { repository, stripe } = setup();
    await expect(resolveStripePaymentIntent(stripe, repository, 'pi_1')).resolves.toEqual(payment);
    expect(stripe.checkout.sessions.list).toHaveBeenCalledWith({ payment_intent: 'pi_1', limit: 2 });
    expect(repository.resolveByProviderObject).toHaveBeenCalledWith('stripe', 'checkout_session', 'cs_1');
    expect(repository.attachProviderObject).toHaveBeenCalledWith('payment-1', 'stripe', 'payment_intent', 'pi_1');
  });

  it('does not use forged metadata to redirect ownership', async () => {
    const { repository, stripe } = setup();
    await resolveStripePaymentIntent(stripe, repository, 'pi_1');
    expect(repository.resolveByProviderObject).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), 'forged-order');
  });

  it('returns no ownership for unknown or ambiguous Checkout Sessions', async () => {
    const empty = setup({ sessions: [] });
    await expect(resolveStripePaymentIntent(empty.stripe, empty.repository, 'pi_1')).resolves.toBeNull();
    const ambiguous = setup({ sessions: [{ id: 'cs_1' }, { id: 'cs_2' }] });
    await expect(resolveStripePaymentIntent(ambiguous.stripe, ambiguous.repository, 'pi_1')).resolves.toBeNull();
  });

  it('rejects amount and currency mismatches before association', async () => {
    const amount = setup({ amount: 9999 });
    await expect(resolveStripePaymentIntent(amount.stripe, amount.repository, 'pi_1')).rejects.toThrow('amount mismatch');
    expect(amount.repository.attachProviderObject).not.toHaveBeenCalled();
    const currency = setup({ currency: 'usd' });
    await expect(resolveStripePaymentIntent(currency.stripe, currency.repository, 'pi_1')).rejects.toThrow('currency mismatch');
  });
});
