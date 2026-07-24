import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { createPaymentRepository } from '@/lib/payments/repository';

describe('PayPal payment repository compatibility', () => {
  it('preserves the PayPal provider mapping while using a schema-valid payment method', async () => {
    let inserted: Record<string, unknown> | null = null;
    const chain = {
      insert(value: Record<string, unknown>) { inserted = value; return chain; },
      select() { return chain; },
      single: async () => ({ data: { id: 'payment-1', ...inserted }, error: null }),
    };
    const client = { from: () => chain } as unknown as SupabaseClient<Database>;
    const payment = await createPaymentRepository(client, 'production').createPending({
      provider: 'paypal', amount: 100, currency: 'AUD', orderId: 'order-1',
      customerId: 'customer-1', providerEventId: 'paypal-order-1',
    });
    expect(inserted).toMatchObject({ payment_provider: 'paypal', payment_method: 'other',
      provider_event_id: 'paypal-order-1', environment: 'production' });
    expect(payment.payment_provider).toBe('paypal');
  });
});
