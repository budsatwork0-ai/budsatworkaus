import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';

const mocks = vi.hoisted(() => {
  const payment = { id: 'payment-1', order_id: 'order-1', customer_id: 'customer-1', subscription_id: null,
    amount: 100, currency: 'aud', payment_method: 'card', payment_provider: 'stripe', payment_reference: null,
    provider_event_id: null, status: 'pending', environment: 'production', paid_at: null, notes: null };
  const repository = {
    claimEvent: vi.fn(), finishEvent: vi.fn(), transitionOperational: vi.fn(),
    attachProviderObject: vi.fn(), expireOperationalCheckout: vi.fn(),
    recordRefund: vi.fn(), applyRefundParentState: vi.fn(), attachStripeCustomer: vi.fn(),
  };
  return { payment, repository, discover: vi.fn(), discoverIntent: vi.fn() };
});

vi.mock('@/lib/payments/repository', async () => {
  const actual = await vi.importActual<typeof import('@/lib/payments/repository')>('@/lib/payments/repository');
  return { ...actual, createPaymentRepository: vi.fn(() => mocks.repository), discoverPaymentByProviderObject: mocks.discover };
});
vi.mock('@/lib/payments/stripe-correlation', () => ({ discoverStripePaymentIntent: mocks.discoverIntent }));
vi.mock('@/lib/email/resend', () => ({ getResendClient: vi.fn(() => null), FROM_ADDRESS: 'ops@example.test' }));
vi.mock('@/lib/email/templates', () => ({
  bookingConfirmedEmail: vi.fn(() => ({ subject: 'confirmed', html: 'ok' })),
  adminPaymentReceivedEmail: vi.fn(() => ({ subject: 'received', html: 'ok' })),
}));
vi.mock('@/lib/analytics/server', () => ({ recordAnalyticsEvent: vi.fn(() => Promise.resolve()) }));

import { handleOperationalStripeEvent } from '@/lib/payments/stripe-webhook';

function event(type: string, object: Record<string, unknown>, id = 'evt_1', livemode = true) {
  return { id, type, livemode, data: { object } } as unknown as Stripe.Event;
}

function client() {
  const calls: Array<{ table: string; method: string; value?: unknown }> = [];
  const from = (table: string) => {
    const chain = {
      insert: (value: unknown) => { calls.push({ table, method: 'insert', value }); return chain; },
      update: (value: unknown) => { calls.push({ table, method: 'update', value }); return chain; },
      eq: (column: string, value: unknown) => { calls.push({ table, method: `eq:${column}`, value }); return chain; },
      is: (column: string, value: unknown) => { calls.push({ table, method: `is:${column}`, value }); return Promise.resolve({ error: null }); },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
    };
    return chain;
  };
  return { db: { from } as never, calls };
}

function stripe(refunds: Array<Record<string, unknown>> = []) {
  return {
    refunds: { list: vi.fn(() => ({ async *[Symbol.asyncIterator]() { for (const refund of refunds) yield refund; } })) },
    charges: { retrieve: vi.fn(async (id: string) => ({ id, payment_intent: 'pi_1' })) },
  } as unknown as Stripe;
}

describe('operational Stripe webhook service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.payment.environment = 'production';
    mocks.discover.mockResolvedValue({ payment: mocks.payment, mapping: { id: 'map-1' } });
    mocks.discoverIntent.mockResolvedValue(mocks.payment);
    mocks.repository.claimEvent.mockResolvedValue({ claimed: true, event: { id: 'event-1' } });
    mocks.repository.finishEvent.mockResolvedValue({ id: 'event-1' });
    mocks.repository.transitionOperational.mockResolvedValue({ changed: true, payment_id: 'payment-1', order_id: 'order-1', quote_id: 'quote-1', customer_id: 'customer-1' });
  });

  it('claims and completes a trusted PaymentIntent exactly once', async () => {
    const state = client();
    const pi = { id: 'pi_1', amount: 10000, currency: 'aud', metadata: { order_id: 'forged' } };
    await expect(handleOperationalStripeEvent(state.db, stripe(), event('payment_intent.succeeded', pi))).resolves.toBe(true);
    expect(mocks.repository.transitionOperational).toHaveBeenCalledWith('succeeded', 'payment-1', 'pi_1', 100, 'aud');
    expect(mocks.repository.finishEvent).toHaveBeenCalledWith('event-1', 'processed', 'payment-1');
    expect(mocks.discoverIntent).toHaveBeenCalledWith(state.db, expect.anything(), 'pi_1');
  });

  it('does not repeat mutation for a duplicate pending or processed claim', async () => {
    mocks.repository.claimEvent.mockResolvedValue({ claimed: false, event: { id: 'event-1', status: 'pending' } });
    await handleOperationalStripeEvent(client().db, stripe(), event('payment_intent.succeeded', { id: 'pi_1', amount: 10000, currency: 'aud' }));
    expect(mocks.repository.transitionOperational).not.toHaveBeenCalled();
  });

  it('scopes Stripe customer persistence through the trusted payment repository, never email', async () => {
    const state = client();
    mocks.repository.transitionOperational.mockResolvedValue({ changed: true, payment_id: 'payment-1', order_id: 'order-1', quote_id: 'quote-1', customer_id: 'customer-1' });
    await handleOperationalStripeEvent(state.db, stripe(), event('checkout.session.completed', {
      id: 'cs_1', payment_intent: 'pi_1', payment_status: 'paid', amount_total: 10000,
      currency: 'aud', customer: 'cus_1', customer_email: 'collision@example.com', metadata: {},
    }));
    expect(mocks.repository.attachStripeCustomer).toHaveBeenCalledWith('payment-1', 'cus_1');
    expect(state.calls.some((call) => call.method === 'eq:email')).toBe(false);
  });

  it('fans one charge delivery out to multiple independent refunds', async () => {
    const refundRows = [
      { id: 're_1', payment_intent: 'pi_1', amount: 4000, currency: 'aud', status: 'succeeded', reason: null, created: 1 },
      { id: 're_2', payment_intent: 'pi_1', amount: 6000, currency: 'aud', status: 'succeeded', reason: null, created: 2 },
    ];
    await handleOperationalStripeEvent(client().db, stripe(refundRows), event('charge.refunded', { id: 'ch_1', payment_intent: 'pi_1', metadata: {} }));
    expect(mocks.repository.recordRefund).toHaveBeenCalledTimes(2);
    expect(mocks.repository.recordRefund).toHaveBeenNthCalledWith(1, expect.objectContaining({ providerRefundReference: 're_1', providerEventReference: 'evt_1' }));
    expect(mocks.repository.applyRefundParentState).toHaveBeenCalledWith('payment-1');
  });

  it('quarantines invariant failures and marks transient failures retryable', async () => {
    mocks.repository.transitionOperational.mockRejectedValueOnce(new Error('Payment amount mismatch'));
    await expect(handleOperationalStripeEvent(client().db, stripe(), event('payment_intent.succeeded', { id: 'pi_1', amount: 9999, currency: 'aud' }))).resolves.toBe(true);
    expect(mocks.repository.finishEvent).toHaveBeenCalledWith('event-1', 'quarantined', 'payment-1', 'Payment amount mismatch');
    mocks.repository.transitionOperational.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(handleOperationalStripeEvent(client().db, stripe(), event('payment_intent.succeeded', { id: 'pi_1', amount: 10000, currency: 'aud' }, 'evt_2'))).rejects.toThrow('database unavailable');
    expect(mocks.repository.finishEvent).toHaveBeenCalledWith('event-1', 'failed', 'payment-1', 'database unavailable');
  });

  it('leaves payout and fundraising events on their inherited paths', async () => {
    await expect(handleOperationalStripeEvent(client().db, stripe(), event('payout.paid', { id: 'po_1' }))).resolves.toBe(false);
    await expect(handleOperationalStripeEvent(client().db, stripe(), event('payment_intent.succeeded', { id: 'pi_fund', metadata: { fundraising_item_id: 'fund-1' } }))).resolves.toBe(false);
    expect(mocks.repository.claimEvent).not.toHaveBeenCalled();
  });

  it('quarantines production and sandbox livemode crossover', async () => {
    await expect(handleOperationalStripeEvent(client().db, stripe(), event('payment_intent.succeeded', { id: 'pi_1', amount: 10000, currency: 'aud' }, 'evt_cross', false))).resolves.toBe(true);
    expect(mocks.repository.transitionOperational).not.toHaveBeenCalled();
    expect(mocks.repository.finishEvent).toHaveBeenCalledWith('event-1', 'quarantined', 'payment-1', 'Stripe livemode workspace mismatch');
  });

  it('processes a trusted sandbox record without treating it as production', async () => {
    mocks.payment.environment = 'sandbox';
    await expect(handleOperationalStripeEvent(client().db, stripe(), event('payment_intent.succeeded', { id: 'pi_1', amount: 10000, currency: 'aud' }, 'evt_sandbox', false))).resolves.toBe(true);
    expect(mocks.repository.transitionOperational).toHaveBeenCalledWith('succeeded', 'payment-1', 'pi_1', 100, 'aud');
  });

  it('safely acknowledges malformed or unknown provider objects without mutation', async () => {
    mocks.discoverIntent.mockResolvedValueOnce(null);
    await expect(handleOperationalStripeEvent(client().db, stripe(), event('payment_intent.succeeded', { id: 'pi_unknown', amount: 10000, currency: 'aud' }))).resolves.toBe(true);
    await expect(handleOperationalStripeEvent(client().db, stripe(), event('checkout.session.completed', { payment_status: 'paid' }))).resolves.toBe(true);
    expect(mocks.repository.transitionOperational).not.toHaveBeenCalled();
  });
});
