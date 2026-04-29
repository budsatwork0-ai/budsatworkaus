import Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

type DbCall = {
  table: string;
  method: 'insert' | 'update' | 'upsert';
  rows: unknown;
  options?: unknown;
};

const mocks = vi.hoisted(() => {
  const calls: DbCall[] = [];
  const state = {
    ordersById: new Map<string, Record<string, unknown>>(),
    ordersByPaymentIntent: new Map<string, Record<string, unknown>>(),
    paymentsByReference: new Map<string, Record<string, unknown>>(),
  };
  const serviceClient = {
    from: vi.fn((table: string) => {
      const filters: Record<string, unknown> = {};
      let operation: 'insert' | 'update' | null = null;
      let rows: unknown;

      const builder = {
        insert: vi.fn((nextRows: unknown) => {
          operation = 'insert';
          rows = nextRows;
          calls.push({ table, method: 'insert', rows: nextRows });
          return builder;
        }),
        update: vi.fn((nextRows: unknown) => {
          operation = 'update';
          rows = nextRows;
          calls.push({ table, method: 'update', rows: nextRows });
          return builder;
        }),
        upsert: vi.fn((rows: unknown, options?: unknown) => {
          calls.push({ table, method: 'upsert', rows, options });
          return Promise.resolve({ data: null, error: null });
        }),
        select: vi.fn(() => builder),
        eq: vi.fn((column: string, value: unknown) => {
          filters[column] = value;
          return builder;
        }),
        is: vi.fn((column: string, value: unknown) => {
          filters[column] = value;
          return builder;
        }),
        maybeSingle: vi.fn(() => {
          if (table === 'orders' && filters.stripe_payment_intent_id) {
            return Promise.resolve({
              data: state.ordersByPaymentIntent.get(String(filters.stripe_payment_intent_id)) ?? null,
              error: null,
            });
          }
          if (table === 'orders' && filters.id) {
            const order = state.ordersById.get(String(filters.id)) ?? null;
            if (operation === 'update' && order && rows && typeof rows === 'object') {
              Object.assign(order, rows);
              const paymentIntentId = order.stripe_payment_intent_id;
              if (typeof paymentIntentId === 'string') {
                state.ordersByPaymentIntent.set(paymentIntentId, order);
              }
            }
            return Promise.resolve({ data: order, error: null });
          }
          if (table === 'payments' && filters.payment_reference) {
            return Promise.resolve({
              data: state.paymentsByReference.get(String(filters.payment_reference)) ?? null,
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        }),
        single: vi.fn(() => Promise.resolve({ data: { id: 'pay_test_123' }, error: null })),
        then: vi.fn((resolve: (value: { data: null; error: null }) => unknown) => {
          return Promise.resolve({ data: null, error: null }).then(resolve);
        }),
        catch: vi.fn(() => Promise.resolve({ data: null, error: null })),
      };
      return builder;
    }),
  };

  return { calls, serviceClient, state };
});

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => mocks.serviceClient),
}));

vi.mock('@/lib/stripe/server', async () => {
  const StripeModule = await import('stripe');
  const stripe = new StripeModule.default('sk_test_webhook', {
    apiVersion: '2026-01-28.clover',
    typescript: true,
  });

  return {
    createStripeClient: vi.fn(() => stripe),
  };
});

vi.mock('@/lib/email/resend', () => ({
  FROM_ADDRESS: 'ops@example.test',
  getResendClient: vi.fn(() => null),
}));

vi.mock('@/lib/email/templates', () => ({
  bookingConfirmedEmail: vi.fn(() => ({ subject: 'Booking confirmed', html: '<p>ok</p>' })),
  checkoutExpiredEmail: vi.fn(() => ({ subject: 'Checkout expired', html: '<p>ok</p>' })),
}));

vi.mock('@/lib/analytics/server', () => ({
  recordAnalyticsEvent: vi.fn(() => Promise.resolve()),
}));

const webhookSecret = 'whsec_test_secret';
const stripe = new Stripe('sk_test_webhook', {
  apiVersion: '2026-01-28.clover',
  typescript: true,
});

function payloadFor(type: string, object: Record<string, unknown>) {
  return JSON.stringify({
    id: `evt_${type.replaceAll('.', '_')}`,
    object: 'event',
    api_version: '2026-01-28.clover',
    created: 1_700_000_000,
    data: { object },
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type,
  });
}

function signedRequest(payload: string, signature?: string): NextRequest {
  const stripeSignature =
    signature ??
    stripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
    });

  return new Request('https://budsatwork.test/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': stripeSignature },
    body: payload,
  }) as NextRequest;
}

async function postEvent(type: string, object: Record<string, unknown>, signature?: string) {
  const { POST } = await import('@/app/api/webhooks/stripe/route');
  return POST(signedRequest(payloadFor(type, object), signature));
}

const basePayout = {
  id: 'po_test_123',
  object: 'payout',
  amount: 12345,
  currency: 'aud',
  arrival_date: 1_700_086_400,
  description: 'Buds At Work payout',
};

describe('Stripe webhook route', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.calls.length = 0;
    mocks.serviceClient.from.mockClear();
    mocks.state.ordersById.clear();
    mocks.state.ordersByPaymentIntent.clear();
    mocks.state.paymentsByReference.clear();
    process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
  });

  it('accepts a valid Stripe signature', async () => {
    const response = await postEvent('some.unhandled.event', { id: 'obj_123', object: 'thing' });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
  });

  it('rejects an invalid Stripe signature', async () => {
    const response = await postEvent(
      'payout.created',
      basePayout,
      't=1700000000,v1=not-a-real-signature',
    );

    expect(response.status).toBe(400);
    expect(mocks.serviceClient.from).not.toHaveBeenCalled();
  });

  it('upserts payout.created as pending', async () => {
    const response = await postEvent('payout.created', basePayout);

    expect(response.status).toBe(200);
    expect(mocks.calls).toContainEqual({
      table: 'payouts',
      method: 'upsert',
      rows: [{
        stripe_payout_id: 'po_test_123',
        amount: 123.45,
        currency: 'aud',
        status: 'pending',
        arrival_date: '2023-11-15T22:13:20.000Z',
        description: 'Buds At Work payout',
      }],
      options: { onConflict: 'stripe_payout_id' },
    });
    expect(mocks.calls).toContainEqual(expect.objectContaining({
      table: 'audit_log',
      method: 'insert',
    }));
  });

  it('upserts payout.paid as paid', async () => {
    const response = await postEvent('payout.paid', basePayout);

    expect(response.status).toBe(200);
    expect(mocks.calls).toContainEqual(expect.objectContaining({
      table: 'payouts',
      method: 'upsert',
      rows: [expect.objectContaining({ stripe_payout_id: 'po_test_123', status: 'paid' })],
    }));
  });

  it('upserts payout.failed with failure details', async () => {
    const response = await postEvent('payout.failed', {
      ...basePayout,
      failure_code: 'account_closed',
      failure_message: 'The bank account has been closed.',
    });

    expect(response.status).toBe(200);
    expect(mocks.calls).toContainEqual(expect.objectContaining({
      table: 'payouts',
      method: 'upsert',
      rows: [expect.objectContaining({
        stripe_payout_id: 'po_test_123',
        status: 'failed',
        failure_code: 'account_closed',
        failure_message: 'The bank account has been closed.',
      })],
    }));
  });

  it('confirms an order when payment_intent.succeeded arrives before checkout.session.completed', async () => {
    mocks.state.ordersById.set('ord_test_123', {
      id: 'ord_test_123',
      status: 'pending',
      quote_id: 'quote_test_123',
    });

    const response = await postEvent('payment_intent.succeeded', {
      id: 'pi_test_123',
      object: 'payment_intent',
      amount: 12345,
      metadata: {
        order_id: 'ord_test_123',
        quote_id: 'quote_test_123',
      },
    });

    expect(response.status).toBe(200);
    expect(mocks.calls).toContainEqual({
      table: 'orders',
      method: 'update',
      rows: {
        stripe_payment_intent_id: 'pi_test_123',
        status: 'confirmed',
      },
    });
    expect(mocks.calls).toContainEqual(expect.objectContaining({
      table: 'quotes',
      method: 'update',
      rows: expect.objectContaining({
        status: 'paid',
        payment_status: 'paid',
        stripe_payment_intent_id: 'pi_test_123',
        converted_order_id: 'ord_test_123',
      }),
    }));
    expect(mocks.calls).toContainEqual(expect.objectContaining({
      table: 'payments',
      method: 'insert',
      rows: [expect.objectContaining({
        order_id: 'ord_test_123',
        amount: 123.45,
        payment_reference: 'pi_test_123',
        status: 'completed',
      })],
    }));
  });

  it('marks an order failed from payment_intent.payment_failed metadata', async () => {
    mocks.state.ordersById.set('ord_test_123', {
      id: 'ord_test_123',
      status: 'pending',
      quote_id: 'quote_test_123',
      analytics_session_id: 'analytics_test_123',
      service_type: 'cleaning',
      context: 'home',
      scope: 'standard',
    });

    const response = await postEvent('payment_intent.payment_failed', {
      id: 'pi_test_failed',
      object: 'payment_intent',
      amount: 12345,
      metadata: {
        order_id: 'ord_test_123',
        quote_id: 'quote_test_123',
      },
      last_payment_error: {
        message: 'Your card was declined.',
      },
    });

    expect(response.status).toBe(200);
    expect(mocks.calls).toContainEqual(expect.objectContaining({
      table: 'orders',
      method: 'update',
      rows: {
        stripe_payment_intent_id: 'pi_test_failed',
        status: 'failed',
      },
    }));
    expect(mocks.calls).toContainEqual(expect.objectContaining({
      table: 'quotes',
      method: 'update',
      rows: expect.objectContaining({
        status: 'finalized',
        payment_status: 'not_requested',
        stripe_checkout_url: null,
      }),
    }));
  });

  it('logs charge.dispute.created with useful dispute status data', async () => {
    const response = await postEvent('charge.dispute.created', {
      id: 'dp_test_123',
      object: 'dispute',
      amount: 5000,
      currency: 'aud',
      charge: 'ch_test_123',
      payment_intent: 'pi_test_123',
      reason: 'fraudulent',
      status: 'needs_response',
      evidence_details: { due_by: 1_700_172_800 },
      livemode: false,
    });

    expect(response.status).toBe(200);
    expect(mocks.calls).toContainEqual({
      table: 'audit_log',
      method: 'insert',
      rows: [{
        entity_type: 'dispute',
        entity_id: 'dp_test_123',
        action: 'dispute_created',
        new_value: {
          amount: 50,
          currency: 'aud',
          charge_id: 'ch_test_123',
          payment_intent: 'pi_test_123',
          reason: 'fraudulent',
          status: 'needs_response',
          evidence_due_by: 1_700_172_800,
          livemode: false,
        },
        source: 'webhook',
      }],
    });
  });

  it('returns safe success for unknown events without writing records', async () => {
    const response = await postEvent('customer.updated', { id: 'cus_test_123', object: 'customer' });

    expect(response.status).toBe(200);
    expect(mocks.calls).toEqual([]);
  });
});
