import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { createPaymentRepository, type RefundStatus } from '@/lib/payments/repository';

type Workspace = 'production' | 'sandbox';
interface PaymentState { id: string; amount: number; currency: string; environment: Workspace; payment_provider: 'stripe'; status: string; payment_reference: string; provider_event_id: string; }
interface RefundInput { refund_payment_id: string; refund_expected_environment: Workspace; refund_provider: 'stripe'; refund_provider_reference: string; refund_provider_event_reference: string | null; refund_amount: number; refund_currency: string; refund_status: RefundStatus; refund_reason: string | null; refund_provider_created_at: string | null; }
interface RefundState { id: string; payment_id: string; environment: Workspace; provider: 'stripe'; provider_refund_reference: string; provider_event_reference: string | null; amount: number; currency: string; status: RefundStatus; reason: string | null; provider_created_at: string | null; created_at: string; updated_at: string; }

function makeAtomicRefundClient(payment: PaymentState) {
  const refunds = new Map<string, RefundState>();
  const events = new Map<string, string>();
  let sequence = 0;
  let lock = Promise.resolve();
  const rpc = async (_name: string, input: RefundInput) => {
    const previous = lock;
    let release = () => {};
    lock = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      if (input.refund_payment_id !== payment.id) throw new Error('Payment mapping not found');
      if (input.refund_expected_environment !== payment.environment) throw new Error('Payment workspace mismatch');
      if (input.refund_provider !== payment.payment_provider) throw new Error('Refund provider mismatch');
      if (input.refund_currency.toLowerCase() !== payment.currency) throw new Error('Refund currency mismatch');
      let row = refunds.get(input.refund_provider_reference);
      if (row) {
        if (row.payment_id !== payment.id || row.amount !== input.refund_amount || row.currency !== input.refund_currency) throw new Error('Refund replay conflicts with durable record');
        if (row.status === 'pending' && input.refund_status !== 'pending') row.status = input.refund_status;
      } else {
        row = { id: `refund-${++sequence}`, payment_id: payment.id, environment: payment.environment, provider: 'stripe', provider_refund_reference: input.refund_provider_reference, provider_event_reference: input.refund_provider_event_reference, amount: input.refund_amount, currency: input.refund_currency, status: input.refund_status, reason: input.refund_reason, provider_created_at: input.refund_provider_created_at, created_at: 'now', updated_at: 'now' };
        refunds.set(input.refund_provider_reference, row);
      }
      if (input.refund_provider_event_reference) events.set(input.refund_provider_event_reference, input.refund_provider_reference);
      const total = [...refunds.values()].filter((refund) => refund.status === 'succeeded').reduce((sum, refund) => sum + refund.amount, 0);
      if (total > payment.amount) {
        if (row.id === `refund-${sequence}`) refunds.delete(input.refund_provider_reference);
        throw new Error('Cumulative successful refunds exceed captured payment amount');
      }
      payment.status = total === payment.amount ? 'refunded' : total > 0 ? 'partial_refund' : payment.status;
      return { data: { ...row }, error: null };
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : 'refund failed' } };
    } finally { release(); }
  };
  return { client: { rpc } as unknown as SupabaseClient<Database>, payment, refunds };
}

const refund = (overrides: Partial<Parameters<ReturnType<typeof createPaymentRepository>['recordRefund']>[0]> = {}) => ({
  paymentId: 'payment-1', provider: 'stripe' as const, providerRefundReference: 're_1',
  providerEventReference: 'evt_1', amount: 40, currency: 'AUD', status: 'succeeded' as const,
  ...overrides,
});

describe('payment refund repository', () => {
  const setup = (environment: Workspace = 'production') => {
    const payment = { id: 'payment-1', amount: 100, currency: 'aud', environment, payment_provider: 'stripe' as const, status: 'completed', payment_reference: 'pi_original', provider_event_id: 'evt_capture' };
    const state = makeAtomicRefundClient(payment);
    return { ...state, repository: createPaymentRepository(state.client, environment) };
  };

  it('converges duplicate and concurrent delivery on one refund', async () => {
    const { repository, refunds, payment } = setup();
    const [first, second] = await Promise.all([repository.recordRefund(refund()), repository.recordRefund(refund())]);
    expect(first.id).toBe(second.id);
    expect(refunds.size).toBe(1);
    expect(payment.status).toBe('partial_refund');
  });

  it('supports multiple partial refunds and transitions only at the captured total', async () => {
    const { repository, payment } = setup();
    await repository.recordRefund(refund());
    expect(payment.status).toBe('partial_refund');
    await repository.recordRefund(refund({ providerRefundReference: 're_2', providerEventReference: 'evt_2', amount: 60 }));
    expect(payment.status).toBe('refunded');
    expect(payment.payment_reference).toBe('pi_original');
    expect(payment.provider_event_id).toBe('evt_capture');
  });

  it('handles an out-of-order pending event without downgrading success', async () => {
    const { repository, payment, refunds } = setup();
    await repository.recordRefund(refund());
    await repository.recordRefund(refund({ providerEventReference: 'evt_older', status: 'pending' }));
    expect(payment.status).toBe('partial_refund');
    expect(refunds.size).toBe(1);
  });

  it('advances a pending refund when its successful outcome arrives later', async () => {
    const { repository, payment } = setup();
    await repository.recordRefund(refund({ status: 'pending' }));
    expect(payment.status).toBe('completed');
    await repository.recordRefund(refund({ providerEventReference: 'evt_later', status: 'succeeded' }));
    expect(payment.status).toBe('partial_refund');
  });

  it('rejects currency mismatch and cumulative over-refunds atomically', async () => {
    const { repository, refunds } = setup();
    await expect(repository.recordRefund(refund({ currency: 'USD' }))).rejects.toThrow('Refund currency mismatch');
    await repository.recordRefund(refund({ amount: 70 }));
    await expect(repository.recordRefund(refund({ providerRefundReference: 're_2', providerEventReference: 'evt_2', amount: 40 }))).rejects.toThrow('Cumulative successful refunds exceed captured payment amount');
    expect(refunds.size).toBe(1);
  });

  it('fails closed across production and sandbox workspaces', async () => {
    const state = setup('sandbox');
    const productionRepository = createPaymentRepository(state.client, 'production');
    await expect(productionRepository.recordRefund(refund())).rejects.toThrow('Payment workspace mismatch');
    await state.repository.recordRefund(refund());
    expect(state.refunds.get('re_1')?.environment).toBe('sandbox');
  });

  it('allows one charge-level provider event to contain multiple refunds', async () => {
    const { repository } = setup();
    await repository.recordRefund(refund());
    await expect(repository.recordRefund(refund({ providerRefundReference: 're_2', amount: 10 }))).resolves.toMatchObject({ provider_refund_reference: 're_2' });
  });
});
