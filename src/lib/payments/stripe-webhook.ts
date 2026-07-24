import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { createPaymentRepository, discoverPaymentByProviderObject, type PaymentRow, type ProviderObjectType } from './repository';
import { discoverStripePaymentIntent } from './stripe-correlation';
import { withWorkspaceContext } from '@/lib/workspace/server';
import { getResendClient, FROM_ADDRESS } from '@/lib/email/resend';
import { bookingConfirmedEmail, adminPaymentReceivedEmail } from '@/lib/email/templates';
import { recordAnalyticsEvent } from '@/lib/analytics/server';

const TYPES = new Set([
  'checkout.session.completed', 'checkout.session.expired',
  'payment_intent.succeeded', 'payment_intent.payment_failed',
  'charge.refunded', 'charge.dispute.created',
]);
const ADMIN_EMAIL = 'admin@budsatwork.com';

function completionSideEffects(result: Awaited<ReturnType<ReturnType<typeof createPaymentRepository>['transitionOperational']>>, amount: number) {
  if (!result.changed) return;
  void recordAnalyticsEvent({ sessionId: result.analytics_session_id ?? null, eventName: 'payment_completed',
    page: '/services/checkout/success', source: 'server', quoteId: result.quote_id,
    orderId: result.order_id, paymentId: result.payment_id, eventValue: amount,
    eventData: { service: result.service_type ?? null, context: result.context ?? null, scope: result.scope ?? null } });
  const resend = getResendClient();
  if (!resend) return;
  const serviceLabel = result.service_type ?? 'Service';
  if (result.customer_email) {
    const email = bookingConfirmedEmail({ customerName: result.customer_name ?? 'there', serviceLabel,
      total: amount, orderId: result.order_id });
    resend.emails.send({ from: FROM_ADDRESS, to: result.customer_email, ...email }).catch(() => undefined);
  }
  const admin = adminPaymentReceivedEmail({ customerName: result.customer_name ?? 'there',
    customerEmail: result.customer_email ?? null, serviceLabel, amount, orderId: result.order_id,
    quoteId: result.quote_id, dashboardUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://budsatwork.com'}/dashboard/orders` });
  resend.emails.send({ from: FROM_ADDRESS, to: ADMIN_EMAIL, ...admin }).catch(() => undefined);
}

function id(value: string | { id: string } | null | undefined) {
  return typeof value === 'string' ? value : value?.id ?? null;
}

function permanent(error: unknown) {
  return error instanceof Error && /(mismatch|conflict|currency|amount|workspace|provider|cancelled|exceed|unknown|current durable)/i.test(error.message);
}

async function paymentForCharge(client: SupabaseClient<Database>, stripe: Stripe, charge: Stripe.Charge) {
  const mapped = await discoverPaymentByProviderObject(client, 'stripe', 'charge', charge.id);
  if (mapped) return mapped.payment;
  const paymentIntentId = id(charge.payment_intent);
  if (!paymentIntentId) return null;
  const payment = await discoverStripePaymentIntent(client, stripe, paymentIntentId);
  if (!payment) return null;
  const repository = createPaymentRepository(client, payment.environment);
  await repository.attachProviderObject(payment.id, 'stripe', 'charge', charge.id);
  return payment;
}

export async function handleOperationalStripeEvent(
  client: SupabaseClient<Database>, stripe: Stripe, event: Stripe.Event,
): Promise<boolean> {
  if (!TYPES.has(event.type)) return false;
  // Fundraising remains on its inherited, structurally separate path.
  const metadata = (event.data.object as { metadata?: Record<string, string> }).metadata;
  if (metadata?.fundraising_item_id) return false;

  let payment: PaymentRow | null = null;
  let objectType: ProviderObjectType;
  let objectId: string;
  if (event.type.startsWith('checkout.session.')) {
    const session = event.data.object as Stripe.Checkout.Session;
    objectType = 'checkout_session'; objectId = session.id;
    if (!objectId) return true;
    payment = (await discoverPaymentByProviderObject(client, 'stripe', objectType, objectId))?.payment ?? null;
  } else if (event.type.startsWith('payment_intent.')) {
    const intent = event.data.object as Stripe.PaymentIntent;
    objectType = 'payment_intent'; objectId = intent.id;
    if (!objectId) return true;
    payment = await discoverStripePaymentIntent(client, stripe, intent.id);
  } else if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge;
    objectType = 'charge'; objectId = charge.id;
    if (!objectId) return true;
    payment = await paymentForCharge(client, stripe, charge);
  } else {
    const dispute = event.data.object as Stripe.Dispute;
    objectType = 'charge'; objectId = id(dispute.charge) ?? '';
    const charge = objectId ? await stripe.charges.retrieve(objectId) : null;
    payment = charge ? await paymentForCharge(client, stripe, charge) : null;
  }
  if (!payment || !objectId) return true;

  const repository = createPaymentRepository(client, payment.environment);
  const claim = await repository.claimEvent({ provider: 'stripe', eventId: event.id,
    eventType: event.type, objectType, objectId });
  if (!claim.claimed) return true;

  try {
    if (typeof event.livemode === 'boolean' && event.livemode !== (payment.environment === 'production')) {
      throw new Error('Stripe livemode workspace mismatch');
    }
    await withWorkspaceContext(payment.environment, async () => {
      if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed') {
        const intent = event.data.object as Stripe.PaymentIntent;
        const result = await repository.transitionOperational(event.type.endsWith('succeeded') ? 'succeeded' : 'failed',
          payment!.id, intent.id, intent.amount / 100, intent.currency);
        if (event.type.endsWith('succeeded') && payment!.environment === 'production') completionSideEffects(result, intent.amount / 100);
      } else if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentIntentId = id(session.payment_intent);
        if (!paymentIntentId || session.payment_status !== 'paid' || session.amount_total == null || !session.currency) {
          throw new Error('Checkout Session is missing a completed payment identity');
        }
        const intentPayment = await discoverStripePaymentIntent(client, stripe, paymentIntentId);
        if (!intentPayment || intentPayment.id !== payment!.id) throw new Error('Checkout Session PaymentIntent mapping mismatch');
        const result = await repository.transitionOperational('succeeded', payment!.id,
          paymentIntentId, session.amount_total / 100, session.currency);
        if (payment!.environment === 'production') completionSideEffects(result, session.amount_total / 100);
        const stripeCustomerId = id(session.customer);
        if (stripeCustomerId && result.customer_id) {
          await repository.attachStripeCustomer(payment!.id, stripeCustomerId);
        }
      } else if (event.type === 'checkout.session.expired') {
        await repository.expireOperationalCheckout(payment!.id, objectId);
      } else if (event.type === 'charge.refunded') {
        const charge = event.data.object as Stripe.Charge;
        for await (const refund of stripe.refunds.list({ charge: charge.id, limit: 100 })) {
          const refundPaymentIntent = id(refund.payment_intent);
          if (refundPaymentIntent) {
            const refundOwner = await discoverPaymentByProviderObject(client, 'stripe', 'payment_intent', refundPaymentIntent);
            if (!refundOwner || refundOwner.payment.id !== payment!.id) throw new Error('Refund PaymentIntent mapping mismatch');
          }
          const refundStatus = refund.status === 'canceled' ? 'cancelled' : refund.status;
          if (!refundStatus || !['pending', 'succeeded', 'failed', 'cancelled'].includes(refundStatus)) {
            throw new Error('Unknown Stripe refund status');
          }
          await repository.recordRefund({ paymentId: payment!.id, provider: 'stripe',
            providerRefundReference: refund.id, providerEventReference: event.id,
            amount: refund.amount / 100, currency: refund.currency,
            status: refundStatus as 'pending' | 'succeeded' | 'failed' | 'cancelled',
            reason: refund.reason ?? null,
            providerCreatedAt: new Date(refund.created * 1000).toISOString() });
        }
        await repository.applyRefundParentState(payment!.id);
      } else if (event.type === 'charge.dispute.created') {
        const dispute = event.data.object as Stripe.Dispute;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (client as any).from('audit_log').insert([{ entity_type: 'dispute', entity_id: dispute.id,
          action: 'dispute_created', new_value: { amount: dispute.amount / 100,
            currency: dispute.currency, charge_id: dispute.charge, payment_intent: dispute.payment_intent,
            reason: dispute.reason, status: dispute.status,
            evidence_due_by: dispute.evidence_details?.due_by ?? null, livemode: dispute.livemode }, source: 'webhook' }]);
      }
    });
    await repository.finishEvent(claim.event.id, 'processed', payment.id);
    return true;
  } catch (error) {
    if (permanent(error)) {
      await repository.finishEvent(claim.event.id, 'quarantined', payment.id,
        error instanceof Error ? error.message : 'Permanent payment invariant failure');
      return true;
    }
    await repository.finishEvent(claim.event.id, 'failed', payment.id,
      error instanceof Error ? error.message : 'Payment processing failed');
    throw error;
  }
}
