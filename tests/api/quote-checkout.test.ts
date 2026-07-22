import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => {
  const stripe = {
    customers: {
      create: vi.fn(() => Promise.resolve({ id: 'cus_test_123' })),
    },
    checkout: {
      sessions: {
        create: vi.fn(() =>
          Promise.resolve({
            id: 'cs_test_123',
            url: 'https://checkout.stripe.test/cs_test_123',
          })
        ),
        expire: vi.fn(() => Promise.resolve({ id: 'cs_test_123', status: 'expired' })),
      },
    },
  };

  const state = {
    quote: {
      id: 'quote_test_123',
      customer_id: null,
      customer_name: 'Test Customer',
      customer_email: 'test@example.com',
      customer_phone: '0400000000',
      service_type: 'cleaning',
      context: 'home',
      scope: 'clean_std',
      frequency: 'none',
      analytics_session_id: null,
      submitted_total: 60,
      reviewed_total: 60,
      total: 60,
      status: 'finalized',
      payment_status: 'not_requested',
      notes: null,
      converted_order_id: null,
      environment: 'production',
    } as Record<string, unknown>,
    fromCalls: [] as string[],
    inserts: [] as Array<{ table: string; rows: unknown }>,
    updates: [] as Array<{ table: string; rows: unknown }>,
  };

  const serviceClient = {
    rpc: vi.fn((name: string) => {
      if (name === 'create_or_get_pending_payment') return Promise.resolve({ data: { id: 'payment_test_123', environment: 'production' }, error: null });
      if (name === 'attach_payment_provider_object') return Promise.resolve({ data: { id: 'mapping_test_123', payment_id: 'payment_test_123', environment: 'production' }, error: null });
      return Promise.resolve({ data: null, error: null });
    }),
    from: vi.fn((table: string) => {
      state.fromCalls.push(table);
      let operation: 'insert' | 'update' | null = null;
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        insert: vi.fn((nextRows: unknown) => {
          operation = 'insert';
          state.inserts.push({ table, rows: nextRows });
          return builder;
        }),
        update: vi.fn((nextRows: unknown) => {
          operation = 'update';
          state.updates.push({ table, rows: nextRows });
          return builder;
        }),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        single: vi.fn(() => {
          if (table === 'quotes') {
            return Promise.resolve({ data: state.quote, error: null });
          }
          if (table === 'orders' && operation === 'insert') {
            return Promise.resolve({ data: { id: 'order_test_123', quote_id: 'quote_test_123', environment: 'production' }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      };
      return builder;
    }),
  };

  return { serviceClient, state, stripe };
});

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(() =>
    Promise.resolve({
      id: 'admin_test_123',
      role: 'admin',
      email: 'admin@example.com',
    })
  ),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServiceClientSafe: vi.fn(() => mocks.serviceClient),
}));

vi.mock('@/lib/stripe/server', () => ({
  createStripeClient: vi.fn(() => mocks.stripe),
}));

vi.mock('@/lib/email/resend', () => ({
  FROM_ADDRESS: 'ops@example.test',
  getResendClient: vi.fn(() => null),
}));

vi.mock('@/lib/email/templates', () => ({
  quoteFinalizedEmail: vi.fn(() => ({ subject: 'Quote finalized', html: '<p>ok</p>' })),
}));

vi.mock('@/lib/analytics/server', () => ({
  recordAnalyticsEvent: vi.fn(() => Promise.resolve()),
}));

function request(): NextRequest {
  return new Request('https://budsatwork.test/api/quotes/quote_test_123/checkout', {
    method: 'POST',
    headers: { origin: 'https://budsatwork.test' },
  }) as NextRequest;
}

async function postCheckout() {
  const { POST } = await import('@/app/api/quotes/[id]/checkout/route');
  return POST(request(), { params: Promise.resolve({ id: 'quote_test_123' }) });
}

describe('quote checkout route payment pricing', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.serviceClient.from.mockClear();
    mocks.serviceClient.rpc.mockClear();
    mocks.stripe.customers.create.mockClear();
    mocks.stripe.checkout.sessions.create.mockClear();
    mocks.state.fromCalls.length = 0;
    mocks.state.inserts.length = 0;
    mocks.state.updates.length = 0;
    mocks.state.quote = {
      ...mocks.state.quote,
      submitted_total: 60,
      reviewed_total: 60,
      total: 60,
      status: 'finalized',
      payment_status: 'not_requested',
      converted_order_id: null,
    };
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it('does not create a normal Stripe checkout for A$0.50', async () => {
    mocks.state.quote = {
      ...mocks.state.quote,
      submitted_total: 0.5,
      reviewed_total: 0.5,
      total: 0.5,
    };

    const response = await postCheckout();
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      code: 'stripe_minimum_not_met',
      amount_cents: 50,
      minimum_charge_cents: 1000,
      alternative_payment: 'payid_or_bank_transfer',
    });
    expect(mocks.state.fromCalls).toEqual(['quotes']);
    expect(mocks.state.inserts).toEqual([]);
    expect(mocks.stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('creates Stripe checkout at the A$10 minimum and includes fee metadata', async () => {
    mocks.state.quote = {
      ...mocks.state.quote,
      submitted_total: 10,
      reviewed_total: 10,
      total: 10,
    };

    const response = await postCheckout();
    const body = await response.json();

    expect(response.status).toBe(200);
    // Baseline contract maintenance: checkout already returns the stable
    // Buds payment page, not a hosted Stripe URL.
    expect(body.url).toBe('https://budsatwork.test/pay/quote_test_123');
    expect(mocks.stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
    expect(mocks.serviceClient.rpc).toHaveBeenCalledWith('create_or_get_pending_payment', expect.objectContaining({
      pending_provider: 'stripe', pending_order_id: 'order_test_123', pending_amount: 10,
      pending_currency: 'aud', pending_environment: 'production',
    }));
    expect(mocks.serviceClient.rpc).toHaveBeenCalledWith('attach_payment_provider_object', expect.objectContaining({
      mapping_payment_id: 'payment_test_123', mapping_object_type: 'checkout_session', mapping_object_id: 'cs_test_123',
    }));
    expect(mocks.stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({ unit_amount: 1000 }),
          }),
        ],
        metadata: expect.objectContaining({
          amount_cents: '1000',
          estimated_stripe_fee_cents: '47',
          estimated_net_cents: '953',
        }),
      }),
      { idempotencyKey: expect.stringMatching(/^quote_test_123-checkout-[a-f0-9]{16}$/) }
    );
  });

  it('uses a new Stripe idempotency key when checkout parameters change', async () => {
    mocks.state.quote = {
      ...mocks.state.quote,
      submitted_total: 20,
      reviewed_total: 20,
      total: 20,
    };

    await postCheckout();
    const firstOptions = mocks.stripe.checkout.sessions.create.mock.calls[0]?.[1];

    mocks.state.quote = {
      ...mocks.state.quote,
      submitted_total: 25,
      reviewed_total: 25,
      total: 25,
    };

    await postCheckout();
    const secondOptions = mocks.stripe.checkout.sessions.create.mock.calls[1]?.[1];

    expect(firstOptions?.idempotencyKey).toMatch(/^quote_test_123-checkout-[a-f0-9]{16}$/);
    expect(secondOptions?.idempotencyKey).toMatch(/^quote_test_123-checkout-[a-f0-9]{16}$/);
    expect(secondOptions?.idempotencyKey).not.toBe(firstOptions?.idempotencyKey);
  });

  it('converges an exact checkout retry on the same pending payment and session mapping', async () => {
    await postCheckout();
    await postCheckout();
    expect(mocks.serviceClient.rpc.mock.calls.filter(([name]) => name === 'create_or_get_pending_payment')).toHaveLength(2);
    expect(mocks.serviceClient.rpc.mock.calls.filter(([name]) => name === 'attach_payment_provider_object')).toHaveLength(2);
    expect(mocks.stripe.checkout.sessions.create.mock.calls[0]?.[1]).toEqual(mocks.stripe.checkout.sessions.create.mock.calls[1]?.[1]);
  });
});
