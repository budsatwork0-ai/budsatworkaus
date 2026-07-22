import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const mocks = vi.hoisted(() => ({
  create: vi.fn(), getById: vi.fn(), updateQuote: vi.fn(),
}));
vi.mock('@/lib/orders/repository', () => ({ createOrderRepository: vi.fn(() => ({ create: mocks.create, getById: mocks.getById })) }));
vi.mock('@/lib/quotes/repository', () => ({ createQuoteRepository: vi.fn(() => ({ update: mocks.updateQuote })) }));

import { ensureOrderForPayableQuote } from '@/lib/payments/quote-conversion';
import type { QuoteRow } from '@/lib/quotes/repository';

const quote = (patch: Partial<QuoteRow> = {}) => ({
  id: 'quote-1', customer_id: 'customer-1', customer_name: 'Taylor', customer_email: 'taylor@example.test',
  customer_phone: null, service_type: 'cleaning', context: 'home', scope: 'standard', frequency: 'none',
  analytics_session_id: null, reviewed_total: 100, submitted_total: 100, total: 100, notes: null,
  status: 'finalized', payment_status: 'not_requested', converted_order_id: null, environment: 'production',
  ...patch,
} as QuoteRow);
const order = (environment = 'production', patch: Record<string, unknown> = {}) => ({ id: 'order-1', quote_id: 'quote-1',
  status: 'pending', environment, ...patch });

function client(winner = order()) {
  const chain = { select: () => chain, eq: () => chain, single: async () => ({ data: winner, error: null }) };
  return { from: vi.fn(() => chain) } as unknown as SupabaseClient<Database>;
}

describe('ensureOrderForPayableQuote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({ data: order(), error: null });
    mocks.getById.mockResolvedValue({ data: order(), error: null });
    mocks.updateQuote.mockResolvedValue({ data: quote({ converted_order_id: 'order-1' }), error: null });
  });

  it.each(['production', 'sandbox'] as const)('creates one compatible %s order and persists the link', async (environment) => {
    mocks.create.mockResolvedValue({ data: order(environment), error: null });
    const result = await ensureOrderForPayableQuote(client(), quote({ environment }));
    expect(result.environment).toBe(environment);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.updateQuote).toHaveBeenCalledWith('quote-1', { converted_order_id: 'order-1' });
  });

  it('reuses an existing compatible order, including an already-paid order', async () => {
    mocks.getById.mockResolvedValue({ data: order('production', { status: 'completed' }), error: null });
    const result = await ensureOrderForPayableQuote(client(), quote({ converted_order_id: 'order-1', payment_status: 'paid' }));
    expect(result.status).toBe('completed');
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.updateQuote).not.toHaveBeenCalled();
  });

  it('rejects cancelled, expired, paid-without-order, and invalid-workspace quotes', async () => {
    await expect(ensureOrderForPayableQuote(client(), quote({ status: 'cancelled' }))).rejects.toThrow('not eligible');
    await expect(ensureOrderForPayableQuote(client(), quote({ status: 'expired' }))).rejects.toThrow('not eligible');
    await expect(ensureOrderForPayableQuote(client(), quote({ payment_status: 'paid' }))).rejects.toThrow('no durable converted order');
    await expect(ensureOrderForPayableQuote(client(), quote({ environment: 'unknown' }))).rejects.toThrow('invalid payment workspace');
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('rejects an existing order linked to another quote or workspace', async () => {
    mocks.getById.mockResolvedValueOnce({ data: order('production', { quote_id: 'quote-2' }), error: null });
    await expect(ensureOrderForPayableQuote(client(), quote({ converted_order_id: 'order-1' }))).rejects.toThrow('does not belong');
    mocks.getById.mockResolvedValueOnce({ data: order('sandbox'), error: null });
    await expect(ensureOrderForPayableQuote(client(), quote({ converted_order_id: 'order-1' }))).rejects.toThrow(/workspace/i);
  });

  it('reloads the unique-index winner so duplicate and concurrent attempts converge', async () => {
    mocks.create.mockResolvedValue({ data: null, error: 'duplicate key value violates unique constraint' });
    const db = client(order());
    const [first, second] = await Promise.all([
      ensureOrderForPayableQuote(db, quote()), ensureOrderForPayableQuote(db, quote()),
    ]);
    expect(first.id).toBe('order-1'); expect(second.id).toBe('order-1');
    expect(mocks.updateQuote).toHaveBeenCalledTimes(2);
  });
});
