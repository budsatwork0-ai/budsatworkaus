import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { createPaymentRepository } from '@/lib/payments/repository';

function makeClient(paymentEnvironment: 'production' | 'sandbox' = 'production') {
  const mappings = new Map<string, { id: string; payment_id: string; environment: 'production' | 'sandbox'; provider: 'stripe'; object_type: string; object_id: string }>();
  const payments = new Map<string, Record<string, unknown>>();
  let lock = Promise.resolve();
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const previous = lock;
    let release = () => {};
    lock = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      if (name === 'create_or_get_pending_payment') {
        const key = `${args.pending_provider}:${args.pending_order_id}`;
        const existing = payments.get(key);
        if (existing) return { data: existing, error: null };
        if (args.pending_environment !== paymentEnvironment) return { data: null, error: { message: 'Payment workspace mismatch' } };
        const row = { id: 'payment-1', order_id: args.pending_order_id, customer_id: args.pending_customer_id, amount: args.pending_amount, currency: args.pending_currency, payment_method: 'card', payment_provider: 'stripe', payment_reference: null, provider_event_id: null, status: 'pending', environment: paymentEnvironment, subscription_id: null, paid_at: null, notes: null };
        payments.set(key, row); return { data: row, error: null };
      }
      if (name === 'attach_payment_provider_object') {
        if (args.mapping_expected_environment !== paymentEnvironment) return { data: null, error: { message: 'Payment workspace mismatch' } };
        const key = `${args.mapping_provider}:${args.mapping_object_type}:${args.mapping_object_id}`;
        const existing = mappings.get(key);
        if (existing && existing.payment_id !== args.mapping_payment_id) return { data: null, error: { message: 'Provider object mapping conflicts with durable payment' } };
        const row = existing ?? { id: `mapping-${mappings.size + 1}`, payment_id: String(args.mapping_payment_id), environment: paymentEnvironment, provider: 'stripe' as const, object_type: String(args.mapping_object_type), object_id: String(args.mapping_object_id) };
        mappings.set(key, row); return { data: row, error: null };
      }
      return { data: null, error: { message: 'unexpected rpc' } };
    } finally { release(); }
  };
  return { client: { rpc } as unknown as SupabaseClient<Database>, mappings, payments };
}

describe('payment provider object repository', () => {
  it('atomically converges pending-payment and Checkout Session retries', async () => {
    const state = makeClient();
    const repository = createPaymentRepository(state.client, 'production');
    const pending = { provider: 'stripe' as const, amount: 100, currency: 'aud', orderId: 'order-1', customerId: 'customer-1' };
    const [first, second] = await Promise.all([repository.findOrCreatePending(pending), repository.findOrCreatePending(pending)]);
    expect(first.id).toBe(second.id);
    const [mapping1, mapping2] = await Promise.all([
      repository.attachProviderObject(first.id, 'stripe', 'checkout_session', 'cs_1'),
      repository.attachProviderObject(second.id, 'stripe', 'checkout_session', 'cs_1'),
    ]);
    expect(mapping1.id).toBe(mapping2.id);
    expect(state.mappings.size).toBe(1);
  });

  it('rejects provider-object reassignment and cross-workspace association', async () => {
    const state = makeClient();
    const repository = createPaymentRepository(state.client, 'production');
    await repository.attachProviderObject('payment-1', 'stripe', 'payment_intent', 'pi_1');
    await expect(repository.attachProviderObject('payment-2', 'stripe', 'payment_intent', 'pi_1')).rejects.toThrow('conflicts');
    const sandboxRepository = createPaymentRepository(state.client, 'sandbox');
    await expect(sandboxRepository.attachProviderObject('payment-1', 'stripe', 'checkout_session', 'cs_1')).rejects.toThrow('workspace');
  });
});
