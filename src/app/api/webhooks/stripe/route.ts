import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createStripeClient } from '@/lib/stripe/server';
import type Stripe from 'stripe';
import { getResendClient, FROM_ADDRESS } from '@/lib/email/resend';
import { bookingConfirmedEmail, checkoutExpiredEmail } from '@/lib/email/templates';
import { recordAnalyticsEvent } from '@/lib/analytics/server';

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Window Cleaning',
  cleaning: 'Home/Commercial Cleaning',
  yard: 'Yard Care',
  dump: 'Dump Runs',
  auto: 'Auto Detailing',
  laundry_sneakers: 'Laundry & Sneaker Care',
};

export const dynamic = 'force-dynamic';

// Fire-and-forget audit log insert
async function logAudit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  entityType: string,
  entityId: string,
  action: string,
  newValue: Record<string, unknown>
) {
  try {
    await client.from('audit_log').insert([{
      entity_type: entityType,
      entity_id: entityId,
      action,
      new_value: newValue,
      source: 'webhook',
    }]);
  } catch {
    // Don't block webhook processing if audit log fails
  }
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const stripe = createStripeClient();
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const client = createServiceClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.order_id;
        const quoteId = session.metadata?.quote_id;

        if (!orderId && !quoteId) {
          console.warn('checkout.session.completed without order_id/quote_id in metadata');
          break;
        }

        let resolvedOrderId = orderId;
        let currentQuoteStatus: string | null = null;
        let analyticsSessionId: string | null = null;
        let quoteScope: string | null = null;
        let quoteContext: string | null = null;
        let quoteServiceType: string | null = null;

        if (!resolvedOrderId && quoteId) {
          // Resolve order from quote fallback when metadata is quote-only.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: quoteOrder } = await (client as any)
            .from('quotes')
            .select('converted_order_id, status, analytics_session_id, scope, context, service_type')
            .eq('id', quoteId)
            .maybeSingle();
          resolvedOrderId = quoteOrder?.converted_order_id || undefined;
          currentQuoteStatus = quoteOrder?.status || null;
          analyticsSessionId = quoteOrder?.analytics_session_id || null;
          quoteScope = quoteOrder?.scope || null;
          quoteContext = quoteOrder?.context || null;
          quoteServiceType = quoteOrder?.service_type || null;
        } else if (quoteId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: quoteSnapshot } = await (client as any)
            .from('quotes')
            .select('status, analytics_session_id, scope, context, service_type')
            .eq('id', quoteId)
            .maybeSingle();
          currentQuoteStatus = quoteSnapshot?.status || null;
          analyticsSessionId = quoteSnapshot?.analytics_session_id || null;
          quoteScope = quoteSnapshot?.scope || null;
          quoteContext = quoteSnapshot?.context || null;
          quoteServiceType = quoteSnapshot?.service_type || null;
        }

        if (currentQuoteStatus === 'cancelled') {
          console.warn('[webhook] Ignoring payment for a cancelled quote:', quoteId);
          if (quoteId) {
            logAudit(client, 'quote', quoteId, 'payment_received_after_cancellation', {
              stripe_session_id: session.id,
              payment_intent: session.payment_intent,
            });
          }
          break;
        }

        if (!resolvedOrderId) {
          console.warn('checkout.session.completed could not resolve an order id');
          break;
        }

        // Idempotency check — skip if order already confirmed to handle duplicate webhooks
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: currentOrder } = await (client as any)
          .from('orders')
          .select('status')
          .eq('id', resolvedOrderId)
          .maybeSingle();
        if (currentOrder?.status === 'confirmed') {
          console.log('[webhook] Order already confirmed, skipping duplicate processing:', resolvedOrderId);
          break;
        }

        // Update order with payment intent ID and confirm status
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (client as any)
          .from('orders')
          .update({
            stripe_payment_intent_id: session.payment_intent as string,
            status: 'confirmed',
          })
          .eq('id', resolvedOrderId);

        // Insert payment record
        const paymentAmount = (session.amount_total || 0) / 100;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: paymentRecord } = await (client as any)
          .from('payments')
          .insert([{
            order_id: resolvedOrderId,
            amount: paymentAmount,
            payment_method: 'card',
            payment_reference: session.payment_intent as string,
            status: 'completed',
            paid_at: new Date().toISOString(),
            notes: `Stripe Checkout: ${session.id}`,
          }])
          .select('id')
          .single();

        // Audit log
        logAudit(client, 'order', resolvedOrderId, 'payment_received', {
          amount: paymentAmount,
          stripe_session_id: session.id,
          payment_intent: session.payment_intent,
        });

        if (quoteId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (client as any)
            .from('quotes')
            .update({
              status: 'paid',
              payment_status: 'paid',
              paid_at: new Date().toISOString(),
              stripe_payment_intent_id: session.payment_intent as string,
              converted_order_id: resolvedOrderId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', quoteId);

          logAudit(client, 'quote', quoteId, 'payment_received', {
            order_id: resolvedOrderId,
            amount: paymentAmount,
            stripe_session_id: session.id,
            payment_intent: session.payment_intent,
          });
        }

        void recordAnalyticsEvent({
          sessionId: analyticsSessionId,
          eventName: 'payment_completed',
          page: '/services/checkout/success',
          source: 'server',
          quoteId: quoteId ?? null,
          orderId: resolvedOrderId,
          paymentId: paymentRecord?.id ?? null,
          eventValue: paymentAmount,
          eventData: {
            service: session.metadata?.service_type ?? quoteServiceType,
            context: session.metadata?.context ?? quoteContext,
            scope: quoteScope,
            stripe_session_id: session.id,
            payment_intent: typeof session.payment_intent === 'string' ? session.payment_intent : null,
          },
        });

        // Store the Stripe Customer ID on the customers row so future checkouts reuse it.
        // This handles the case where checkout was created without a prior customer row.
        const stripeCustomerId = typeof session.customer === 'string' ? session.customer : null;
        const paymentEmail = session.customer_email || session.customer_details?.email;
        if (stripeCustomerId && paymentEmail) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (client as any)
            .from('customers')
            .update({ stripe_customer_id: stripeCustomerId })
            .eq('email', paymentEmail)
            .is('stripe_customer_id', null) // only write if not already set
            .then(() => {})
            .catch((e: unknown) => console.warn('[webhook] Failed to persist stripe_customer_id:', e));
        }

        // Send booking confirmed email — fire and forget
        const customerEmail = paymentEmail;
        if (customerEmail) {
          const resend = getResendClient();
          if (resend) {
            const serviceType = session.metadata?.service_type ?? '';
            const customerName = session.metadata?.customer_name ?? 'there';
            const { subject, html } = bookingConfirmedEmail({
              customerName,
              serviceLabel: SERVICE_LABELS[serviceType] ?? serviceType,
              total: paymentAmount,
              orderId: resolvedOrderId,
            });
            resend.emails.send({ from: FROM_ADDRESS, to: customerEmail, subject, html }).catch((err) => {
              console.error('[email] booking_confirmed send failed:', err);
            });
          }
        }

        break;
      }

      case 'checkout.session.expired': {
        // Reset quote back to finalized so the customer can retry payment
        const expiredSession = event.data.object as Stripe.Checkout.Session;
        const expiredQuoteId = expiredSession.metadata?.quote_id;
        if (expiredQuoteId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: expiredQuote } = await (client as any)
            .from('quotes')
            .update({
              status: 'finalized',
              payment_status: 'not_requested',
              stripe_checkout_url: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', expiredQuoteId)
            .eq('status', 'payment_pending')
            .select('customer_email, customer_name, service_type, submitted_total, total, analytics_session_id, context, scope, converted_order_id')
            .maybeSingle();

          logAudit(client, 'quote', expiredQuoteId, 'checkout_expired', {
            stripe_session_id: expiredSession.id,
          });

          void recordAnalyticsEvent({
            sessionId: expiredQuote?.analytics_session_id ?? null,
            eventName: 'checkout_expired',
            page: '/services/checkout/cancel',
            source: 'server',
            quoteId: expiredQuoteId,
            orderId: expiredQuote?.converted_order_id ?? null,
            eventData: {
              service: expiredQuote?.service_type ?? null,
              context: expiredQuote?.context ?? null,
              scope: expiredQuote?.scope ?? null,
              stripe_session_id: expiredSession.id,
            },
          });

          // Notify customer their payment link expired and invite them to re-request
          if (expiredQuote?.customer_email) {
            const resend = getResendClient();
            if (resend) {
              const expiredTotal = Number(expiredQuote.submitted_total ?? expiredQuote.total ?? 0);
              const expiredServiceType = expiredQuote.service_type ?? '';
              const { subject, html } = checkoutExpiredEmail({
                customerName: expiredQuote.customer_name ?? 'there',
                serviceLabel: SERVICE_LABELS[expiredServiceType] ?? expiredServiceType,
                total: expiredTotal,
                quoteId: expiredQuoteId,
              });
              resend.emails.send({
                from: FROM_ADDRESS,
                to: expiredQuote.customer_email,
                subject,
                html,
              }).catch((err) => {
                console.error('[email] checkout_expired notification failed:', err);
              });
            }
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const failedPi = event.data.object as Stripe.PaymentIntent;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: failedOrder } = await (client as any)
          .from('orders')
          .select('id, quote_id, analytics_session_id, service_type, context, scope')
          .eq('stripe_payment_intent_id', failedPi.id)
          .maybeSingle();

        if (failedOrder) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (client as any)
            .from('orders')
            .update({ status: 'failed' })
            .eq('id', failedOrder.id);

          if (failedOrder.quote_id) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (client as any)
              .from('quotes')
              .update({
                status: 'finalized',
                payment_status: 'not_requested',
                stripe_checkout_url: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', failedOrder.quote_id);
          }

          logAudit(client, 'order', failedOrder.id, 'payment_failed', {
            payment_intent_id: failedPi.id,
            failure_message: failedPi.last_payment_error?.message,
          });

          void recordAnalyticsEvent({
            sessionId: failedOrder.analytics_session_id ?? null,
            eventName: 'payment_failed',
            page: '/services/checkout/cancel',
            source: 'server',
            quoteId: failedOrder.quote_id ?? null,
            orderId: failedOrder.id,
            eventValue: failedPi.amount ? failedPi.amount / 100 : null,
            eventData: {
              service: failedOrder.service_type,
              context: failedOrder.context,
              scope: failedOrder.scope,
              payment_intent: failedPi.id,
              failure_message: failedPi.last_payment_error?.message ?? null,
            },
          });
        }
        break;
      }

      case 'payment_intent.succeeded': {
        // Backup handler — only insert payment if not already recorded via checkout.session.completed
        const pi = event.data.object as Stripe.PaymentIntent;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existingOrder } = await (client as any)
          .from('orders')
          .select('id')
          .eq('stripe_payment_intent_id', pi.id)
          .maybeSingle();

        if (existingOrder) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: existingPayment } = await (client as any)
            .from('payments')
            .select('id')
            .eq('payment_reference', pi.id)
            .eq('status', 'completed')
            .maybeSingle();

          if (!existingPayment) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (client as any)
              .from('payments')
              .insert([{
                order_id: existingOrder.id,
                amount: pi.amount / 100,
                payment_method: 'card',
                payment_reference: pi.id,
                status: 'completed',
                paid_at: new Date().toISOString(),
                notes: `Stripe PaymentIntent: ${pi.id}`,
              }]);
          }
        }

        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent as string;

        if (!paymentIntentId) break;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: refundOrder } = await (client as any)
          .from('orders')
          .select('id, quote_id, analytics_session_id, service_type, context, scope')
          .eq('stripe_payment_intent_id', paymentIntentId)
          .maybeSingle();

        if (refundOrder) {
          const refundAmount = (charge.amount_refunded || 0) / 100;
          const isFullRefund = charge.amount_refunded === charge.amount;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (client as any)
            .from('payments')
            .insert([{
              order_id: refundOrder.id,
              amount: refundAmount,
              payment_method: 'card',
              payment_reference: paymentIntentId,
              status: isFullRefund ? 'refunded' : 'partial_refund',
              paid_at: new Date().toISOString(),
              notes: `Stripe refund: ${charge.id}`,
            }]);

          if (isFullRefund) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (client as any)
              .from('orders')
              .update({ status: 'cancelled' })
              .eq('id', refundOrder.id);
          }

          // Audit log
          logAudit(client, 'order', refundOrder.id, isFullRefund ? 'refunded' : 'partial_refund', {
            refund_amount: refundAmount,
            charge_id: charge.id,
            payment_intent_id: paymentIntentId,
          });

          void recordAnalyticsEvent({
            sessionId: refundOrder.analytics_session_id ?? null,
            eventName: isFullRefund ? 'payment_refunded' : 'payment_partially_refunded',
            source: 'server',
            quoteId: refundOrder.quote_id ?? null,
            orderId: refundOrder.id,
            eventValue: refundAmount,
            eventData: {
              service: refundOrder.service_type,
              context: refundOrder.context,
              scope: refundOrder.scope,
              charge_id: charge.id,
              payment_intent: paymentIntentId,
            },
          });
        }

        break;
      }

      case 'payout.created': {
        // Stripe has initiated a payout to the NAB business account
        const payout = event.data.object as Stripe.Payout;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (client as any)
          .from('payouts')
          .upsert([{
            stripe_payout_id: payout.id,
            amount: payout.amount / 100,
            currency: payout.currency,
            status: 'pending',
            arrival_date: payout.arrival_date
              ? new Date(payout.arrival_date * 1000).toISOString()
              : null,
            description: payout.description ?? null,
          }], { onConflict: 'stripe_payout_id' });

        logAudit(client, 'payout', payout.id, 'payout_initiated', {
          amount: payout.amount / 100,
          currency: payout.currency,
          arrival_date: payout.arrival_date,
        });
        break;
      }

      case 'payout.paid': {
        // Funds have landed in the NAB account
        const paidPayout = event.data.object as Stripe.Payout;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (client as any)
          .from('payouts')
          .upsert([{
            stripe_payout_id: paidPayout.id,
            amount: paidPayout.amount / 100,
            currency: paidPayout.currency,
            status: 'paid',
            arrival_date: paidPayout.arrival_date
              ? new Date(paidPayout.arrival_date * 1000).toISOString()
              : null,
            description: paidPayout.description ?? null,
          }], { onConflict: 'stripe_payout_id' });

        logAudit(client, 'payout', paidPayout.id, 'payout_completed', {
          amount: paidPayout.amount / 100,
          currency: paidPayout.currency,
        });
        break;
      }

      case 'payout.failed': {
        // Payout to NAB failed — funds stay in Stripe balance
        const failedPayout = event.data.object as Stripe.Payout;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (client as any)
          .from('payouts')
          .upsert([{
            stripe_payout_id: failedPayout.id,
            amount: failedPayout.amount / 100,
            currency: failedPayout.currency,
            status: 'failed',
            arrival_date: failedPayout.arrival_date
              ? new Date(failedPayout.arrival_date * 1000).toISOString()
              : null,
            description: failedPayout.description ?? null,
            failure_code: failedPayout.failure_code ?? null,
            failure_message: failedPayout.failure_message ?? null,
          }], { onConflict: 'stripe_payout_id' });

        logAudit(client, 'payout', failedPayout.id, 'payout_failed', {
          amount: failedPayout.amount / 100,
          failure_code: failedPayout.failure_code,
          failure_message: failedPayout.failure_message,
        });
        break;
      }

      case 'payout.canceled': {
        const canceledPayout = event.data.object as Stripe.Payout;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (client as any)
          .from('payouts')
          .upsert([{
            stripe_payout_id: canceledPayout.id,
            amount: canceledPayout.amount / 100,
            currency: canceledPayout.currency,
            status: 'canceled',
            arrival_date: canceledPayout.arrival_date
              ? new Date(canceledPayout.arrival_date * 1000).toISOString()
              : null,
            description: canceledPayout.description ?? null,
          }], { onConflict: 'stripe_payout_id' });

        logAudit(client, 'payout', canceledPayout.id, 'payout_canceled', {
          amount: canceledPayout.amount / 100,
          currency: canceledPayout.currency,
        });
        break;
      }

      case 'payout.updated': {
        const updatedPayout = event.data.object as Stripe.Payout;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (client as any)
          .from('payouts')
          .upsert([{
            stripe_payout_id: updatedPayout.id,
            amount: updatedPayout.amount / 100,
            currency: updatedPayout.currency,
            status: updatedPayout.status,
            arrival_date: updatedPayout.arrival_date
              ? new Date(updatedPayout.arrival_date * 1000).toISOString()
              : null,
            description: updatedPayout.description ?? null,
            failure_code: updatedPayout.failure_code ?? null,
            failure_message: updatedPayout.failure_message ?? null,
          }], { onConflict: 'stripe_payout_id' });

        logAudit(client, 'payout', updatedPayout.id, 'payout_updated', {
          amount: updatedPayout.amount / 100,
          status: updatedPayout.status,
        });
        break;
      }

      case 'payout.reconciliation_completed': {
        // Stripe has finished reconciling an automatic payout — balance transactions are now queryable
        const reconPayout = event.data.object as Stripe.Payout;
        logAudit(client, 'payout', reconPayout.id, 'payout_reconciliation_completed', {
          amount: reconPayout.amount / 100,
          currency: reconPayout.currency,
          arrival_date: reconPayout.arrival_date,
        });
        break;
      }

      case 'charge.dispute.created': {
        // A customer has disputed a charge — Stripe will debit the NAB account
        const dispute = event.data.object as Stripe.Dispute;
        logAudit(client, 'dispute', dispute.id, 'dispute_created', {
          amount: dispute.amount / 100,
          currency: dispute.currency,
          charge_id: dispute.charge,
          reason: dispute.reason,
          status: dispute.status,
        });
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
