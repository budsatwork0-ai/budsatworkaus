import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { createStripeClient } from '@/lib/stripe/server';
import type Stripe from 'stripe';
import { handleOperationalStripeEvent } from '@/lib/payments/stripe-webhook';

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

async function upsertFundraisingContribution(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  eventId: string,
  payload: {
    fundraisingItemId?: string | null;
    amountCents: number;
    grossAmountCents?: number | null;
    stripeFee?: number | null;
    netAmountCents?: number | null;
    currency?: string | null;
    paymentReference?: string | null;
    payerName?: string | null;
    payerEmail?: string | null;
    status: 'pending' | 'paid' | 'failed' | 'refunded';
    paidAt?: string | null;
  }
): Promise<boolean> {
  if (!payload.fundraisingItemId || !payload.paymentReference) return false;

  const gross = Math.max(0, Math.round(payload.grossAmountCents ?? payload.amountCents));
  const fee   = Math.max(0, Math.round(payload.stripeFee ?? 0));
  const net   = Math.max(0, Math.round(payload.netAmountCents ?? gross - fee));

  const record = {
    fundraising_item_id: payload.fundraisingItemId,
    amount_cents:        gross,
    gross_amount_cents:  gross,
    stripe_fee_cents:    fee,
    net_amount_cents:    net,
    currency: (payload.currency ?? 'aud').toLowerCase(),
    payment_provider: 'stripe',
    payment_reference: payload.paymentReference,
    stripe_event_id: eventId,
    payer_name: payload.payerName ?? null,
    payer_email: payload.payerEmail ?? null,
    status: payload.status,
    paid_at: payload.paidAt ?? null,
  };

  const { error: insertError } = await client
    .from('fundraising_contributions')
    .insert([record]);

  if (!insertError) return true;

  // Unique violation (23505) — record already exists, update status/metadata only
  if (insertError.code === '23505') {
    const { error: updateError } = await client
      .from('fundraising_contributions')
      .update({
        status:             record.status,
        paid_at:            record.paid_at,
        stripe_event_id:    eventId,
        payer_name:         record.payer_name,
        payer_email:        record.payer_email,
        gross_amount_cents: record.gross_amount_cents,
        stripe_fee_cents:   record.stripe_fee_cents,
        net_amount_cents:   record.net_amount_cents,
      })
      .eq('payment_provider', 'stripe')
      .eq('payment_reference', payload.paymentReference);

    if (updateError) {
      console.error('[webhook] fundraising contribution update failed:', updateError.message, updateError.code);
      return false;
    }
    return true;
  }

  console.error('[webhook] fundraising contribution insert failed:', insertError.message, insertError.code);
  return false;
}

async function markFundraisingContributionRefunded(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  paymentReference: string,
  eventId: string
) {
  await client
    .from('fundraising_contributions')
    .update({
      status: 'refunded',
      stripe_event_id: eventId,
    })
    .eq('payment_provider', 'stripe')
    .eq('payment_reference', paymentReference);
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
    let inheritedFundraisingRefund = false;
    if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
      if (paymentIntentId) {
        // Preserve legacy fundraising refunds that were keyed by PaymentIntent
        // before operational payment-provider mappings existed.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (client as any).from('fundraising_contributions').select('id')
          .eq('payment_provider', 'stripe').eq('payment_reference', paymentIntentId).maybeSingle();
        inheritedFundraisingRefund = !!data;
      }
    }
    if (!inheritedFundraisingRefund && await handleOperationalStripeEvent(client, stripe, event)) {
      return NextResponse.json({ received: true });
    }
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const fundraisingItemId = session.metadata?.fundraising_item_id;
        if (fundraisingItemId) {
          // Only record when Stripe has confirmed the funds — async methods (bank transfer)
          // fire checkout.session.completed before payment clears; those arrive later via
          // checkout.session.async_payment_succeeded, which we don't yet handle. Skip them here
          // to avoid recording an unpaid contribution as paid.
          if (session.payment_status !== 'paid') {
            console.warn('[webhook] fundraising checkout.session.completed with payment_status:', session.payment_status, '— skipping until payment clears');
            break;
          }

          const grossAmountCents = session.amount_total ?? 0;
          let stripeFee = 0;
          let netAmountCents = grossAmountCents;
          const piId = typeof session.payment_intent === 'string' ? session.payment_intent : null;
          if (piId) {
            try {
              const expandedPi = await stripe.paymentIntents.retrieve(piId, {
                expand: ['latest_charge.balance_transaction'],
              });
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const balanceTx = (expandedPi as any).latest_charge?.balance_transaction;
              if (balanceTx && typeof balanceTx === 'object') {
                stripeFee     = balanceTx.fee  ?? 0;
                netAmountCents = balanceTx.net  ?? grossAmountCents - stripeFee;
              }
            } catch (e) {
              console.warn('[webhook] fundraising: could not retrieve balance transaction for fee calc:', e);
            }
          }

          const recorded = await upsertFundraisingContribution(client, event.id, {
            fundraisingItemId,
            amountCents:      grossAmountCents,
            grossAmountCents,
            stripeFee,
            netAmountCents,
            currency: session.currency,
            paymentReference: piId ?? session.id,
            payerName: session.customer_details?.name ?? null,
            payerEmail: session.customer_email ?? session.customer_details?.email ?? null,
            status: 'paid',
            paidAt: new Date().toISOString(),
          });

          if (recorded) {
            try { revalidateTag('fundraising'); } catch {}
          }

          logAudit(client, 'fundraising_item', fundraisingItemId, 'contribution_paid', {
            stripe_session_id: session.id,
            payment_intent: session.payment_intent,
            amount_cents: session.amount_total ?? 0,
            recorded,
          });
          break;
        }

        // Non-fundraising checkout.session.completed events are handled by
        // handleOperationalStripeEvent() above, before this switch is reached.
        break;
      }

      case 'payment_intent.payment_failed': {
        const failedPi = event.data.object as Stripe.PaymentIntent;
        const fundraisingItemId = failedPi.metadata?.fundraising_item_id;
        if (fundraisingItemId) {
          await upsertFundraisingContribution(client, event.id, {
            fundraisingItemId,
            amountCents: failedPi.amount,
            currency: failedPi.currency,
            paymentReference: failedPi.id,
            status: 'failed',
            paidAt: null,
          });
          break;
        }

        // Non-fundraising payment_intent.payment_failed events are handled by
        // handleOperationalStripeEvent() above, before this switch is reached.
        break;
      }

      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const fundraisingItemId = pi.metadata?.fundraising_item_id;
        if (fundraisingItemId) {
          const grossPi = pi.amount_received || pi.amount;
          let feePi = 0;
          let netPi = grossPi;
          try {
            const expandedPi = await stripe.paymentIntents.retrieve(pi.id, {
              expand: ['latest_charge.balance_transaction'],
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const balanceTx = (expandedPi as any).latest_charge?.balance_transaction;
            if (balanceTx && typeof balanceTx === 'object') {
              feePi = balanceTx.fee ?? 0;
              netPi = balanceTx.net ?? grossPi - feePi;
            }
          } catch (e) {
            console.warn('[webhook] fundraising pi.succeeded: could not retrieve balance transaction:', e);
          }

          const recorded = await upsertFundraisingContribution(client, event.id, {
            fundraisingItemId,
            amountCents:      grossPi,
            grossAmountCents: grossPi,
            stripeFee:        feePi,
            netAmountCents:   netPi,
            currency: pi.currency,
            paymentReference: pi.id,
            status: 'paid',
            paidAt: new Date().toISOString(),
          });
          if (recorded) {
            try { revalidateTag('fundraising'); } catch {}
          }
          break;
        }

        // Non-fundraising payment_intent.succeeded events are handled by
        // handleOperationalStripeEvent() above, before this switch is reached.
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent as string;

        if (!paymentIntentId) break;

        if (charge.metadata?.fundraising_item_id || charge.payment_intent) {
          await markFundraisingContributionRefunded(client, paymentIntentId, event.id);
        }

        // Non-fundraising charge.refunded events are handled by
        // handleOperationalStripeEvent() above, before this switch is reached.
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

      // ── NDIS organisation subscriptions ──────────────────────────────────────

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const ndisOrgId = sub.metadata?.ndis_org_id;
        if (!ndisOrgId) break;

        const subStatus = sub.status; // active | trialing | past_due | canceled | incomplete | etc.
        const mappedStatus =
          subStatus === 'active'    ? 'active' :
          subStatus === 'trialing'  ? 'trialing' :
          subStatus === 'past_due'  ? 'past_due' :
          subStatus === 'canceled'  ? 'cancelled' : 'inactive';

        // current_period_end moved to SubscriptionItem in Stripe API v2025+
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const periodEnd = (sub as any).current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? null;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (client as any)
          .from('ndis_organisations')
          .update({
            stripe_subscription_id: sub.id,
            subscription_status: mappedStatus,
            current_period_end: periodEnd
              ? new Date(periodEnd * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', ndisOrgId);

        logAudit(client, 'ndis_organisation', ndisOrgId, `subscription_${event.type.split('.')[2]}`, {
          stripe_subscription_id: sub.id,
          status: mappedStatus,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const deletedSub = event.data.object as Stripe.Subscription;
        const ndisOrgId = deletedSub.metadata?.ndis_org_id;
        if (!ndisOrgId) break;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (client as any)
          .from('ndis_organisations')
          .update({
            subscription_status: 'cancelled',
            stripe_subscription_id: null,
            current_period_end: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', ndisOrgId);

        logAudit(client, 'ndis_organisation', ndisOrgId, 'subscription_cancelled', {
          stripe_subscription_id: deletedSub.id,
        });
        break;
      }

      // charge.dispute.created is handled by handleOperationalStripeEvent() above,
      // before this switch is reached (it writes the same audit_log entry).

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
