import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { PaymentRepository, PaymentRow } from '@/lib/payments/repository';
import { createPaymentRepository, discoverPaymentByProviderObject } from '@/lib/payments/repository';

export async function resolveStripePaymentIntent(
  stripe: Stripe,
  repository: PaymentRepository,
  paymentIntentId: string,
): Promise<PaymentRow | null> {
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (intent.id !== paymentIntentId) throw new Error('Stripe PaymentIntent lookup mismatch');
  const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntentId, limit: 2 });
  if (sessions.data.length !== 1) return null;
  const session = sessions.data[0];
  const resolved = await repository.resolveByProviderObject('stripe', 'checkout_session', session.id);
  if (!resolved) return null;
  if (session.payment_intent && (typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id) !== intent.id) {
    throw new Error('Checkout Session PaymentIntent mismatch');
  }
  if (intent.amount !== Math.round(Number(resolved.payment.amount) * 100)) throw new Error('Stripe PaymentIntent amount mismatch');
  if (intent.currency.toLowerCase() !== resolved.payment.currency.toLowerCase()) throw new Error('Stripe PaymentIntent currency mismatch');
  await repository.attachProviderObject(resolved.payment.id, 'stripe', 'payment_intent', intent.id);
  return resolved.payment;
}

export async function discoverStripePaymentIntent(
  client: SupabaseClient<Database>, stripe: Stripe, paymentIntentId: string,
): Promise<PaymentRow | null> {
  const existing = await discoverPaymentByProviderObject(client, 'stripe', 'payment_intent', paymentIntentId);
  if (existing) return existing.payment;
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntentId, limit: 2 });
  if (sessions.data.length !== 1) return null;
  const session = sessions.data[0];
  const discovered = await discoverPaymentByProviderObject(client, 'stripe', 'checkout_session', session.id);
  if (!discovered) return null;
  const repository = createPaymentRepository(client, discovered.payment.environment);
  await resolveStripePaymentIntent(stripe, repository, intent.id);
  return discovered.payment;
}
