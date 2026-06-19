import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { createStripeClientSafe } from '@/lib/stripe/server';
import { getAuthUser } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const stripe = createStripeClientSafe();
  if (!stripe) return NextResponse.json({ error: 'Payment service unavailable' }, { status: 503 });

  const { id: fundraisingItemId } = await params;

  let body: { stripe_session_id?: string; stripe_payment_intent_id?: string } = {};
  try { body = await req.json(); } catch { /* empty body OK */ }

  const { stripe_session_id, stripe_payment_intent_id } = body;
  if (!stripe_session_id && !stripe_payment_intent_id) {
    return NextResponse.json({ error: 'Provide stripe_session_id or stripe_payment_intent_id' }, { status: 400 });
  }

  // Verify item exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: item, error: itemError } = await (client as any)
    .from('fundraising_items')
    .select('id, title')
    .eq('id', fundraisingItemId)
    .single();
  if (itemError || !item) {
    return NextResponse.json({ error: 'Fundraising item not found' }, { status: 404 });
  }

  try {
    let grossAmountCents = 0;
    let stripeFee = 0;
    let netAmountCents = 0;
    let currency = 'aud';
    let paymentReference = '';
    let payerEmail: string | null = null;
    let payerName: string | null = null;

    if (stripe_session_id) {
      const session = await stripe.checkout.sessions.retrieve(stripe_session_id, {
        expand: ['payment_intent.latest_charge.balance_transaction'],
      });

      if (session.payment_status !== 'paid') {
        return NextResponse.json(
          { error: `Session payment_status is "${session.payment_status}" — only paid sessions can be backfilled` },
          { status: 400 }
        );
      }

      grossAmountCents = session.amount_total ?? 0;
      currency = session.currency ?? 'aud';
      payerEmail = session.customer_email ?? session.customer_details?.email ?? null;
      payerName = session.customer_details?.name ?? null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pi = session.payment_intent as any;
      const balanceTx = pi?.latest_charge?.balance_transaction;
      if (balanceTx && typeof balanceTx === 'object') {
        stripeFee = balanceTx.fee ?? 0;
        netAmountCents = balanceTx.net ?? grossAmountCents - stripeFee;
      } else {
        netAmountCents = grossAmountCents;
      }

      paymentReference = (typeof pi?.id === 'string' ? pi.id : null) ?? stripe_session_id;
    } else if (stripe_payment_intent_id) {
      const pi = await stripe.paymentIntents.retrieve(stripe_payment_intent_id, {
        expand: ['latest_charge.balance_transaction'],
      });

      if (pi.status !== 'succeeded') {
        return NextResponse.json(
          { error: `PaymentIntent status is "${pi.status}" — only succeeded payments can be backfilled` },
          { status: 400 }
        );
      }

      grossAmountCents = pi.amount ?? 0;
      currency = pi.currency ?? 'aud';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const balanceTx = (pi as any).latest_charge?.balance_transaction;
      if (balanceTx && typeof balanceTx === 'object') {
        stripeFee = balanceTx.fee ?? 0;
        netAmountCents = balanceTx.net ?? grossAmountCents - stripeFee;
      } else {
        netAmountCents = grossAmountCents;
      }
      paymentReference = stripe_payment_intent_id;
    }

    const gross = Math.max(0, Math.round(grossAmountCents));
    const fee   = Math.max(0, Math.round(stripeFee));
    const net   = Math.max(0, Math.round(netAmountCents));
    const ref   = paymentReference || stripe_session_id || stripe_payment_intent_id || '';

    const record = {
      fundraising_item_id: fundraisingItemId,
      amount_cents:        gross,
      gross_amount_cents:  gross,
      stripe_fee_cents:    fee,
      net_amount_cents:    net,
      currency:            currency.toLowerCase(),
      payment_provider:    'stripe',
      payment_reference:   ref,
      stripe_event_id:     null,
      payer_name:          payerName,
      payer_email:         payerEmail,
      status:              'paid',
      paid_at:             new Date().toISOString(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (client as any)
      .from('fundraising_contributions')
      .insert([record]);

    if (insertError) {
      if (insertError.code === '23505') {
        // Already exists — update the fee breakdown in case it was missing
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (client as any)
          .from('fundraising_contributions')
          .update({ gross_amount_cents: gross, stripe_fee_cents: fee, net_amount_cents: net, status: 'paid', paid_at: record.paid_at })
          .eq('payment_provider', 'stripe')
          .eq('payment_reference', ref);
      } else {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    try { revalidateTag('fundraising'); } catch { /* non-critical */ }

    return NextResponse.json({
      success: true,
      contribution: { gross_amount_cents: gross, stripe_fee_cents: fee, net_amount_cents: net, currency, payment_reference: ref },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe lookup failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
