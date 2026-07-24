import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { assertWorkspaceCompatibility, type Workspace } from '@/lib/workspace/server';

export type PaymentProvider = 'manual' | 'stripe' | 'paypal';
export type ProviderObjectType = 'checkout_session' | 'payment_intent' | 'charge' | 'paypal_order' | 'paypal_capture';
export interface PaymentRow {
  id: string; order_id: string | null; customer_id: string | null; subscription_id: string | null;
  amount: number; currency: string; payment_method: string; payment_provider: PaymentProvider;
  payment_reference: string | null; provider_event_id: string | null; status: string;
  environment: Workspace; paid_at: string | null; notes: string | null;
}

export type RefundStatus = 'pending' | 'succeeded' | 'failed' | 'cancelled';
export interface PaymentRefundRow {
  id: string; payment_id: string; environment: Workspace; provider: PaymentProvider;
  provider_refund_reference: string; provider_event_reference: string | null;
  amount: number; currency: string; status: RefundStatus; reason: string | null;
  provider_created_at: string | null; created_at: string; updated_at: string;
}
export interface PaymentProviderObjectRow {
  id: string; payment_id: string; environment: Workspace; provider: PaymentProvider;
  object_type: ProviderObjectType; object_id: string; created_at: string; updated_at: string;
}
export type PaymentEventStatus = 'pending' | 'processed' | 'failed' | 'quarantined';
export interface PaymentEventRow {
  id: string; payment_id: string | null; environment: Workspace | null; provider: PaymentProvider;
  provider_event_id: string; event_type: string; provider_object_type: string | null;
  provider_object_id: string | null; status: PaymentEventStatus; failure_reason: string | null;
  first_seen_at: string; processed_at: string | null; updated_at: string;
}
export interface PaymentEventClaim { event: PaymentEventRow; claimed: boolean; }
export interface OperationalPaymentResult {
  changed: boolean; payment_id: string; order_id: string; quote_id: string | null;
  customer_id?: string | null; customer_email?: string | null; customer_name?: string | null;
  service_type?: string | null; analytics_session_id?: string | null; context?: string | null; scope?: string | null;
}

export interface PaymentRepository {
  getByReference(provider: PaymentProvider, reference: string): Promise<PaymentRow | null>;
  getByProviderEventId(provider: PaymentProvider, eventId: string): Promise<PaymentRow | null>;
  resolvePendingPayPal(orderId: string): Promise<PaymentRow | null>;
  createPending(input: { provider: PaymentProvider; amount: number; currency: string; orderId: string; customerId: string | null; providerEventId?: string | null }): Promise<PaymentRow>;
  findOrCreatePending(input: { provider: PaymentProvider; amount: number; currency: string; orderId: string; customerId: string | null }): Promise<PaymentRow>;
  attachProviderObject(paymentId: string, provider: PaymentProvider, objectType: ProviderObjectType, objectId: string): Promise<PaymentProviderObjectRow>;
  resolveByProviderObject(provider: PaymentProvider, objectType: ProviderObjectType, objectId: string): Promise<{ payment: PaymentRow; mapping: PaymentProviderObjectRow } | null>;
  claimEvent(input: { provider: PaymentProvider; eventId: string; eventType: string; objectType?: string | null; objectId?: string | null }): Promise<PaymentEventClaim>;
  finishEvent(id: string, status: Exclude<PaymentEventStatus, 'pending'>, paymentId?: string | null, reason?: string | null): Promise<PaymentEventRow>;
  transitionOperational(kind: 'succeeded' | 'failed', paymentId: string, reference: string, amount: number, currency: string): Promise<OperationalPaymentResult>;
  expireOperationalCheckout(paymentId: string, sessionId: string): Promise<OperationalPaymentResult>;
  applyRefundParentState(paymentId: string): Promise<{ changed: boolean; order_id: string; status: string }>;
  attachStripeCustomer(paymentId: string, stripeCustomerId: string): Promise<boolean>;
  setProviderEventId(id: string, eventId: string): Promise<PaymentRow>;
  markCompleted(id: string, reference: string, paidAt?: string): Promise<PaymentRow>;
  recordRefund(input: {
    paymentId: string; provider: PaymentProvider; providerRefundReference: string;
    providerEventReference?: string | null; amount: number; currency: string;
    status: RefundStatus; reason?: string | null; providerCreatedAt?: string | null;
  }): Promise<PaymentRefundRow>;
  associateParents(id: string, orderId: string, customerId: string | null): Promise<PaymentRow>;
}

export function createPaymentRepository(client: SupabaseClient<Database>, workspace: Workspace): PaymentRepository {
  // Generated PostgREST overloads in this project do not yet carry its internal version marker.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;
  const one = async (query: PromiseLike<{ data: PaymentRow | null; error: { message: string } | null }>) => {
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  };
  const checked = (row: PaymentRow | null) => {
    if (row) assertWorkspaceCompatibility(workspace, row.environment);
    return row;
  };
  return {
    async getByReference(provider, reference) {
      return checked(await one(db.from('payments').select('*').eq('payment_provider', provider).eq('payment_reference', reference).maybeSingle()));
    },
    async getByProviderEventId(provider, eventId) {
      return checked(await one(db.from('payments').select('*').eq('payment_provider', provider).eq('provider_event_id', eventId).maybeSingle()));
    },
    async resolvePendingPayPal(orderId) {
      const row = await one(db.from('payments').select('*').eq('payment_provider', 'paypal').eq('provider_event_id', orderId).eq('status', 'pending').maybeSingle());
      return checked(row);
    },
    async createPending(input) {
      const row = await one(db.from('payments').insert({
        order_id: input.orderId, customer_id: input.customerId, amount: input.amount,
        currency: input.currency.toLowerCase(), payment_method: input.provider === 'stripe' ? 'card' : 'other',
        payment_provider: input.provider, provider_event_id: input.providerEventId ?? null,
        status: 'pending', environment: workspace,
      }).select('*').single());
      if (!row) throw new Error('Failed to create pending payment');
      return checked(row)!;
    },
    async findOrCreatePending(input) {
      const { data, error } = await db.rpc('create_or_get_pending_payment', {
        pending_provider: input.provider, pending_order_id: input.orderId,
        pending_customer_id: input.customerId, pending_amount: input.amount,
        pending_currency: input.currency.toLowerCase(), pending_environment: workspace,
      });
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Failed to create pending payment');
      return checked(data)!;
    },
    async attachProviderObject(paymentId, provider, objectType, objectId) {
      const { data, error } = await db.rpc('attach_payment_provider_object', {
        mapping_payment_id: paymentId, mapping_expected_environment: workspace,
        mapping_provider: provider, mapping_object_type: objectType, mapping_object_id: objectId,
      });
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Failed to attach provider object');
      assertWorkspaceCompatibility(workspace, data.environment);
      return data as PaymentProviderObjectRow;
    },
    async resolveByProviderObject(provider, objectType, objectId) {
      const { data, error } = await db.from('payment_provider_objects').select('*, payment:payments(*)')
        .eq('provider', provider).eq('object_type', objectType).eq('object_id', objectId).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const payment = data.payment as PaymentRow | null;
      if (!payment || payment.id !== data.payment_id) throw new Error('Provider object has no durable payment');
      assertWorkspaceCompatibility(workspace, data.environment);
      assertWorkspaceCompatibility(workspace, payment.environment);
      return { payment, mapping: data as PaymentProviderObjectRow };
    },
    async claimEvent(input) {
      const { data, error } = await db.rpc('claim_payment_event', {
        event_provider: input.provider, event_provider_id: input.eventId,
        event_type_value: input.eventType, event_object_type: input.objectType ?? null,
        event_object_id: input.objectId ?? null,
      });
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Failed to claim payment event');
      return data as PaymentEventClaim;
    },
    async finishEvent(id, status, paymentId = null, reason = null) {
      const { data, error } = await db.rpc('finish_payment_event', {
        event_row_id: id, event_status: status, resolved_payment_id: paymentId,
        event_failure_reason: reason,
      });
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Failed to finish payment event');
      if (data.environment) assertWorkspaceCompatibility(workspace, data.environment);
      return data as PaymentEventRow;
    },
    async transitionOperational(kind, paymentId, reference, amount, currency) {
      const { data, error } = await db.rpc('transition_operational_payment', {
        transition_payment_id: paymentId, transition_expected_environment: workspace,
        transition_kind: kind, transition_reference: reference,
        transition_amount: amount, transition_currency: currency.toLowerCase(),
      });
      if (error) throw new Error(error.message);
      return data as OperationalPaymentResult;
    },
    async expireOperationalCheckout(paymentId, sessionId) {
      const { data, error } = await db.rpc('expire_operational_checkout', {
        expire_payment_id: paymentId, expire_expected_environment: workspace,
        expire_session_id: sessionId,
      });
      if (error) throw new Error(error.message);
      return data as OperationalPaymentResult;
    },
    async applyRefundParentState(paymentId) {
      const { data, error } = await db.rpc('apply_refund_parent_state', {
        refund_payment_id: paymentId, refund_expected_environment: workspace,
      });
      if (error) throw new Error(error.message);
      return data as { changed: boolean; order_id: string; status: string };
    },
    async attachStripeCustomer(paymentId, stripeCustomerId) {
      const { data, error } = await db.rpc('attach_payment_stripe_customer', {
        customer_payment_id: paymentId, customer_expected_environment: workspace,
        stripe_customer_id: stripeCustomerId,
      });
      if (error) throw new Error(error.message);
      return data === true;
    },
    async setProviderEventId(id, eventId) {
      const row = await one(db.from('payments').update({ provider_event_id: eventId }).eq('id', id).eq('environment', workspace).select('*').single());
      if (!row) throw new Error('Payment mapping not found'); return checked(row)!;
    },
    async markCompleted(id, reference, paidAt = new Date().toISOString()) {
      const row = await one(db.from('payments').update({ status: 'completed', payment_reference: reference, paid_at: paidAt }).eq('id', id).eq('environment', workspace).select('*').single());
      if (!row) throw new Error('Payment mapping not found'); return checked(row)!;
    },
    async recordRefund(input) {
      const { data, error } = await db.rpc('record_payment_refund', {
        refund_payment_id: input.paymentId,
        refund_expected_environment: workspace,
        refund_provider: input.provider,
        refund_provider_reference: input.providerRefundReference,
        refund_provider_event_reference: input.providerEventReference ?? null,
        refund_amount: input.amount,
        refund_currency: input.currency.toLowerCase(),
        refund_status: input.status,
        refund_reason: input.reason ?? null,
        refund_provider_created_at: input.providerCreatedAt ?? null,
      });
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Failed to record refund');
      assertWorkspaceCompatibility(workspace, data.environment);
      return data as PaymentRefundRow;
    },
    async associateParents(id, orderId, customerId) {
      const row = await one(db.from('payments').update({ order_id: orderId, customer_id: customerId }).eq('id', id).eq('environment', workspace).select('*').single());
      if (!row) throw new Error('Payment mapping not found'); return checked(row)!;
    },
  };
}

export async function discoverPaymentByProviderObject(
  client: SupabaseClient<Database>, provider: PaymentProvider,
  objectType: ProviderObjectType, objectId: string,
): Promise<{ payment: PaymentRow; mapping: PaymentProviderObjectRow } | null> {
  // Discovery is intentionally unscoped; the durable mapping discovers the workspace.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any).from('payment_provider_objects')
    .select('*, payment:payments(*)').eq('provider', provider)
    .eq('object_type', objectType).eq('object_id', objectId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const payment = data.payment as PaymentRow | null;
  if (!payment || payment.id !== data.payment_id || payment.environment !== data.environment
      || payment.payment_provider !== provider) {
    throw new Error('Provider object ownership mismatch');
  }
  return { payment, mapping: data as PaymentProviderObjectRow };
}
