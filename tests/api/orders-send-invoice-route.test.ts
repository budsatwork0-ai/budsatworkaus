import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAuthUser = vi.fn();
const createServiceClientSafe = vi.fn();
const createStripeClientSafe = vi.fn();

vi.mock('@/lib/auth', () => ({ getAuthUser }));
vi.mock('@/lib/supabase/server', () => ({ createServiceClientSafe }));
vi.mock('@/lib/stripe/server', () => ({ createStripeClientSafe }));

const ADMIN = { id: 'admin-1', role: 'admin' };

type Row = Record<string, unknown>;

function makeDb(order: Row | null) {
  const updates: Array<{ table: string; patch: Row }> = [];
  const db = {
    updates,
    from: vi.fn((table: string) => {
      const filters: Row = {};
      const nulls: string[] = [];
      let patch: Row | null = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {
        select: () => chain,
        eq: (c: string, v: unknown) => { filters[c] = v; return chain; },
        is: (c: string) => { nulls.push(c); return chain; },
        update: (p: Row) => { patch = p; updates.push({ table, patch: p }); return chain; },
        maybeSingle: async () => {
          if (table !== 'orders' || !order) return { data: null, error: null };
          if (patch) {
            if (nulls.some((c) => order[c] != null)) return { data: null, error: null };
            Object.assign(order, patch);
          }
          return { data: order, error: null };
        },
        then: (resolve: (v: unknown) => unknown) => {
          if (table === 'orders' && order && patch && !nulls.some((c) => order[c] != null)) Object.assign(order, patch);
          return Promise.resolve({ data: null, error: null }).then(resolve);
        },
      };
      return chain;
    }),
  };
  return db;
}

function makeStripe() {
  return {
    customers: {
      list: vi.fn(async () => ({ data: [] })),
      create: vi.fn(async () => ({ id: 'cus_test' })),
    },
    invoices: {
      create: vi.fn(async () => ({ id: 'in_test' })),
      finalizeInvoice: vi.fn(async () => ({ id: 'in_test' })),
      sendInvoice: vi.fn(async () => ({ id: 'in_test', status: 'open', hosted_invoice_url: 'https://invoice.stripe.test/i', number: 'INV-0001' })),
    },
    invoiceItems: { create: vi.fn(async () => ({ id: 'ii_test' })) },
  };
}

const baseOrder = (): Row => ({
  id: 'order-1',
  customer_id: null,
  customer_name: 'Sam Customer',
  customer_email: 'sam@example.test',
  service_type: 'windows',
  scope: null,
  final_price: 150,
  scheduled_date: '2026-10-30',
  stripe_invoice_id: null,
  stripe_invoice_status: null,
  is_test: false,
});

async function post(id = 'order-1') {
  const { POST } = await import('@/app/api/orders/[id]/send-invoice/route');
  const res = await POST(new Request('https://x.test', { method: 'POST' }) as never, { params: Promise.resolve({ id }) });
  return { status: res.status, body: await res.json() };
}

describe('POST /api/orders/[id]/send-invoice', () => {
  beforeEach(() => {
    vi.resetModules();
    getAuthUser.mockResolvedValue(ADMIN);
  });

  it('creates, finalizes and sends an AUD send_invoice invoice and saves it on the job', async () => {
    const order = baseOrder();
    const stripe = makeStripe();
    createServiceClientSafe.mockReturnValue(makeDb(order));
    createStripeClientSafe.mockReturnValue(stripe);

    const { status, body } = await post();

    expect(status).toBe(200);
    expect(stripe.invoices.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_test', currency: 'aud', collection_method: 'send_invoice', days_until_due: 7, metadata: expect.objectContaining({ order_id: 'order-1' }) }),
      expect.anything(),
    );
    expect(stripe.invoiceItems.create).toHaveBeenCalledWith(
      expect.objectContaining({ invoice: 'in_test', amount: 15000, currency: 'aud' }),
      expect.anything(),
    );
    expect(stripe.invoices.sendInvoice).toHaveBeenCalledWith('in_test');
    expect(body.stripe_invoice_url).toBe('https://invoice.stripe.test/i');
    expect(order.stripe_invoice_id).toBe('in_test');
    expect(order.stripe_invoice_status).toBe('open');
  });

  it('requires a customer email', async () => {
    const stripe = makeStripe();
    createServiceClientSafe.mockReturnValue(makeDb({ ...baseOrder(), customer_email: '' }));
    createStripeClientSafe.mockReturnValue(stripe);
    const { status } = await post();
    expect(status).toBe(400);
    expect(stripe.invoices.create).not.toHaveBeenCalled();
  });

  it('refuses to send a second invoice', async () => {
    const stripe = makeStripe();
    createServiceClientSafe.mockReturnValue(makeDb({ ...baseOrder(), stripe_invoice_id: 'in_old', stripe_invoice_status: 'open' }));
    createStripeClientSafe.mockReturnValue(stripe);
    const { status } = await post();
    expect(status).toBe(409);
    expect(stripe.invoices.create).not.toHaveBeenCalled();
  });

  it('refuses sandbox/test jobs and non-admins', async () => {
    const stripe = makeStripe();
    createStripeClientSafe.mockReturnValue(stripe);
    createServiceClientSafe.mockReturnValue(makeDb({ ...baseOrder(), is_test: true }));
    expect((await post()).status).toBe(400);
    getAuthUser.mockResolvedValue({ id: 'e', role: 'employee' });
    expect((await post()).status).toBe(403);
    expect(stripe.invoices.create).not.toHaveBeenCalled();
  });

  it('releases the claim when Stripe fails', async () => {
    const order = baseOrder();
    const stripe = makeStripe();
    stripe.invoices.finalizeInvoice.mockRejectedValueOnce(new Error('boom'));
    createServiceClientSafe.mockReturnValue(makeDb(order));
    createStripeClientSafe.mockReturnValue(stripe);
    const { status } = await post();
    expect(status).toBe(502);
    expect(order.stripe_invoice_status).toBeNull();
  });
});
