import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const quote = { id: 'quote-1', status: 'finalized', payment_status: 'not_requested',
    reviewed_total: 100, submitted_total: 100, total: 100, customer_id: 'customer-1',
    customer_name: 'Taylor', customer_email: 'taylor@example.test', service_type: 'cleaning',
    environment: 'production', converted_order_id: 'order-1' };
  const order = { id: 'order-1', quote_id: 'quote-1', customer_id: 'customer-1', environment: 'production' };
  const mapping = { id: 'payment-1', order_id: 'order-1', customer_id: 'customer-1', amount: 100,
    currency: 'aud', environment: 'production', payment_provider: 'paypal', provider_event_id: 'paypal-order-1',
    payment_reference: null as string | null, status: 'pending' };
  const repository = { createPending: vi.fn(), setProviderEventId: vi.fn(), markCompleted: vi.fn() };
  const emailSend = vi.fn(async () => ({ data: { id: 'email-1' }, error: null }));
  return { quote, order, mapping, repository, emailSend, ensureOrder: vi.fn(), getQuote: vi.fn() };
});

vi.mock('@/lib/quotes/repository', () => ({ createQuoteRepository: vi.fn(() => ({ getById: mocks.getQuote })) }));
vi.mock('@/lib/payments/quote-conversion', () => ({ ensureOrderForPayableQuote: mocks.ensureOrder }));
vi.mock('@/lib/payments/repository', async () => {
  const actual = await vi.importActual<typeof import('@/lib/payments/repository')>('@/lib/payments/repository');
  return { ...actual, createPaymentRepository: vi.fn(() => mocks.repository) };
});
vi.mock('@/lib/email/resend', () => ({ FROM_ADDRESS: 'ops@example.test', getResendClient: vi.fn(() => ({ emails: { send: mocks.emailSend } })) }));
vi.mock('@/lib/email/templates', () => ({ bookingConfirmedEmail: vi.fn(() => ({ subject: 'confirmed', html: 'ok' })) }));

function client() {
  const updates: Array<{ table: string; value: unknown; filters: Record<string, unknown> }> = [];
  const from = (table: string) => {
    const filters: Record<string, unknown> = {};
    let updateValue: unknown;
    const chain = {
      select: () => chain,
      update: (value: unknown) => { updateValue = value; return chain; },
      eq: (column: string, value: unknown) => { filters[column] = value; return chain; },
      maybeSingle: async () => {
        if (table === 'payments') return { data: filters.provider_event_id === mocks.mapping.provider_event_id || filters.order_id === mocks.mapping.order_id ? mocks.mapping : null, error: null };
        if (table === 'orders') return { data: filters.id === mocks.order.id ? mocks.order : null, error: null };
        if (table === 'quotes') return { data: filters.id === mocks.quote.id ? mocks.quote : null, error: null };
        return { data: null, error: null };
      },
      then: (resolve: (value: unknown) => unknown) => {
        if (updateValue) updates.push({ table, value: updateValue, filters: { ...filters } });
        return Promise.resolve({ data: null, error: null }).then(resolve);
      },
    };
    return chain;
  };
  return { db: { from }, updates };
}

const serviceClient = vi.hoisted(() => ({ current: null as ReturnType<typeof client> | null }));
vi.mock('@/lib/supabase/server', () => ({ createServiceClientSafe: vi.fn(() => serviceClient.current?.db ?? null) }));

function response(ok: boolean, body: unknown, status = ok ? 200 : 500) {
  return { ok, status, json: vi.fn(async () => body) } as unknown as Response;
}

describe('PayPal create and capture routes', () => {
  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks();
    Object.assign(mocks.quote, { status: 'finalized', payment_status: 'not_requested', environment: 'production' });
    Object.assign(mocks.mapping, { environment: 'production', status: 'pending', payment_reference: null, amount: 100, currency: 'aud', provider_event_id: 'paypal-order-1' });
    serviceClient.current = client();
    mocks.getQuote.mockResolvedValue({ data: mocks.quote, error: null });
    mocks.ensureOrder.mockResolvedValue(mocks.order);
    mocks.repository.createPending.mockResolvedValue({ ...mocks.mapping, provider_event_id: null });
    mocks.repository.setProviderEventId.mockResolvedValue(mocks.mapping);
    mocks.repository.markCompleted.mockImplementation(async (_id: string, reference: string) => {
      mocks.mapping.status = 'completed'; mocks.mapping.payment_reference = reference; return mocks.mapping;
    });
    process.env.PAYPAL_CLIENT_ID = 'client'; process.env.PAYPAL_CLIENT_SECRET = 'secret';
  });

  it('creates one production provider order with a stable payment-derived idempotency key', async () => {
    mocks.mapping.provider_event_id = '';
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(response(true, { access_token: 'token' }))
      .mockResolvedValueOnce(response(true, { id: 'paypal-order-1' })));
    const { POST } = await import('@/app/api/paypal/create-order/route');
    const res = await POST(new Request('https://app.test/api/paypal/create-order', { method: 'POST', body: JSON.stringify({ quote_id: 'quote-1' }) }) as never);
    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('/v2/checkout/orders'), expect.objectContaining({ headers: expect.objectContaining({ 'PayPal-Request-Id': 'baw-payment-1' }) }));
    expect(mocks.repository.setProviderEventId).toHaveBeenCalledWith('payment-1', 'paypal-order-1');
  });

  it('reuses a durable pending mapping and performs no duplicate provider request', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { POST } = await import('@/app/api/paypal/create-order/route');
    const res = await POST(new Request('https://app.test/api/paypal/create-order', { method: 'POST', body: JSON.stringify({ quote_id: 'quote-1' }) }) as never);
    await expect(res.json()).resolves.toEqual({ order_id: 'paypal-order-1' });
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.repository.createPending).not.toHaveBeenCalled();
  });

  it('hides sandbox and ineligible quotes without provider side effects', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { POST } = await import('@/app/api/paypal/create-order/route');
    mocks.quote.environment = 'sandbox';
    expect((await POST(new Request('https://app.test', { method: 'POST', body: JSON.stringify({ quote_id: 'quote-1' }) }) as never)).status).toBe(404);
    mocks.quote.environment = 'production'; mocks.quote.status = 'cancelled';
    expect((await POST(new Request('https://app.test', { method: 'POST', body: JSON.stringify({ quote_id: 'quote-1' }) }) as never)).status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('validates the durable mapping and provider order before one capture and one email', async () => {
    const providerUnit = { reference_id: 'quote-1', custom_id: 'order-1', amount: { value: '100.00', currency_code: 'AUD' } };
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(response(true, { access_token: 'token' }))
      .mockResolvedValueOnce(response(true, { status: 'APPROVED', purchase_units: [providerUnit] }))
      .mockResolvedValueOnce(response(true, { status: 'COMPLETED', purchase_units: [{ ...providerUnit, payments: { captures: [{ id: 'capture-1', status: 'COMPLETED', amount: providerUnit.amount }] } }] })));
    const { POST } = await import('@/app/api/paypal/capture-order/[orderId]/route');
    const res = await POST(new Request('https://app.test', { method: 'POST' }) as never, { params: Promise.resolve({ orderId: 'paypal-order-1' }) });
    expect(res.status).toBe(200);
    expect(mocks.repository.markCompleted).toHaveBeenCalledTimes(1);
    expect(serviceClient.current?.updates.filter((call) => call.table === 'orders')).toHaveLength(1);
    expect(serviceClient.current?.updates.filter((call) => call.table === 'quotes')).toHaveLength(1);
    expect(mocks.emailSend).toHaveBeenCalledTimes(1);
  });

  it('makes completed capture replay side-effect free', async () => {
    mocks.mapping.status = 'completed'; mocks.mapping.payment_reference = 'capture-1';
    vi.stubGlobal('fetch', vi.fn());
    const { POST } = await import('@/app/api/paypal/capture-order/[orderId]/route');
    const res = await POST(new Request('https://app.test', { method: 'POST' }) as never, { params: Promise.resolve({ orderId: 'paypal-order-1' }) });
    expect(res.status).toBe(200); expect(fetch).not.toHaveBeenCalled();
    expect(mocks.repository.markCompleted).not.toHaveBeenCalled(); expect(mocks.emailSend).not.toHaveBeenCalled();
  });

  it('rejects unknown, sandbox, association, amount, and currency mismatches before capture', async () => {
    const { POST } = await import('@/app/api/paypal/capture-order/[orderId]/route');
    vi.stubGlobal('fetch', vi.fn());
    expect((await POST(new Request('https://app.test', { method: 'POST' }) as never, { params: Promise.resolve({ orderId: 'unknown' }) })).status).toBe(404);
    mocks.mapping.environment = 'sandbox';
    expect((await POST(new Request('https://app.test', { method: 'POST' }) as never, { params: Promise.resolve({ orderId: 'paypal-order-1' }) })).status).toBe(404);
    mocks.mapping.environment = 'production';
    vi.mocked(fetch).mockResolvedValueOnce(response(true, { access_token: 'token' })).mockResolvedValueOnce(response(true, { purchase_units: [{ reference_id: 'forged', custom_id: 'order-1', amount: { value: '99.00', currency_code: 'USD' } }] }));
    expect((await POST(new Request('https://app.test', { method: 'POST' }) as never, { params: Promise.resolve({ orderId: 'paypal-order-1' }) })).status).toBe(409);
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('/capture'))).toBe(false);
  });
});
