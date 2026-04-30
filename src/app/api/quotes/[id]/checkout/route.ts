import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { createStripeClient } from '@/lib/stripe/server';
import { getResendClient, FROM_ADDRESS } from '@/lib/email/resend';
import { quoteFinalizedEmail } from '@/lib/email/templates';
import { recordAnalyticsEvent } from '@/lib/analytics/server';
import {
  centsToDollars,
  calculateStripeFeeEstimate,
  dollarsToCents,
  getStripeCheckoutPolicy,
} from '@/lib/payments/pricing';
import type Stripe from 'stripe';

type RouteParams = { params: Promise<{ id: string }> };

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Window Cleaning',
  cleaning: 'Home/Commercial Cleaning',
  yard: 'Yard Care',
  dump: 'Dump Runs',
  auto: 'Auto Detailing',
  laundry_sneakers: 'Laundry & Sneaker Care',
};

function createCheckoutIdempotencyKey(payload: {
  amountCents: number;
  context: string | null;
  customerEmail: string | null;
  orderId: string | null;
  origin: string;
  quoteId: string;
  serviceType: string;
  stripeCustomerId?: string;
}) {
  const hash = createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
    .slice(0, 16);

  return `${payload.quoteId}-checkout-${hash}`;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: quote, error: quoteError } = await (client as any)
    .from('quotes')
    .select('*')
    .eq('id', id)
    .single();

  if (quoteError || !quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  }

  const canAccess =
    authUser.role === 'admin' ||
    authUser.role === 'employee' ||
    (authUser.role === 'customer' &&
      (quote.customer_id === authUser.id ||
        (!!quote.customer_email &&
          !!authUser.email &&
          quote.customer_email.toLowerCase() === authUser.email.toLowerCase())));

  if (!canAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const quoteStatus =
    quote.status === 'approved'
      ? 'finalized'
      : quote.status === 'adjusted'
        ? 'in_review'
        : quote.status;

  if (quoteStatus === 'cancelled' || quoteStatus === 'denied') {
    return NextResponse.json(
      { error: 'Cancelled or denied quotes cannot request payment' },
      { status: 400 }
    );
  }

  if (!['finalized', 'payment_pending'].includes(quoteStatus)) {
    return NextResponse.json(
      { error: 'Quote must be finalized before requesting payment' },
      { status: 400 }
    );
  }

  if (quoteStatus === 'paid' || quote.payment_status === 'paid') {
    return NextResponse.json({ error: 'Quote is already paid' }, { status: 400 });
  }

  const amount = Number(quote.reviewed_total ?? quote.submitted_total ?? quote.total);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Invalid finalized amount' }, { status: 400 });
  }

  const amountCents = dollarsToCents(amount);
  const checkoutPolicy = getStripeCheckoutPolicy(amountCents);
  if (!checkoutPolicy.allowed) {
    return NextResponse.json(
      {
        error: checkoutPolicy.message,
        code: 'stripe_minimum_not_met',
        amount_cents: checkoutPolicy.amountCents,
        amount: centsToDollars(checkoutPolicy.amountCents),
        minimum_charge_cents: checkoutPolicy.minimumChargeCents,
        minimum_charge: centsToDollars(checkoutPolicy.minimumChargeCents),
        alternative_payment: 'payid_or_bank_transfer',
      },
      { status: 400 }
    );
  }

  const feeEstimate = calculateStripeFeeEstimate(amountCents);

  const orderPayload = {
    quote_id: quote.id,
    customer_id: quote.customer_id,
    customer_name: quote.customer_name,
    customer_email: quote.customer_email,
    customer_phone: quote.customer_phone,
    service_type: quote.service_type,
    context: quote.context,
    scope: quote.scope,
    frequency: quote.frequency,
    analytics_session_id: quote.analytics_session_id ?? null,
    base_price: Number(quote.submitted_total ?? quote.total ?? amount),
    discount_percent: 0,
    final_price: amount,
    status: 'pending',
    notes: quote.notes,
  };

  let orderId = quote.converted_order_id as string | null;

  if (orderId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: orderUpdateError } = await (client as any)
      .from('orders')
      .update(orderPayload)
      .eq('id', orderId);
    if (orderUpdateError) {
      return NextResponse.json({ error: orderUpdateError.message }, { status: 500 });
    }
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: order, error: orderError } = await (client as any)
      .from('orders')
      .insert([orderPayload])
      .select('id')
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: orderError?.message || 'Failed to create order' }, { status: 500 });
    }
    orderId = order.id;
  }

  let stripe;
  try {
    stripe = createStripeClient();
  } catch (error) {
    console.error('[checkout] Stripe client init failed:', error);
    return NextResponse.json(
      { error: 'Stripe is not configured on this environment' },
      { status: 503 }
    );
  }
  const serviceLabel = SERVICE_LABELS[quote.service_type] || quote.service_type;
  const contextLabel = quote.context === 'commercial' ? 'Commercial' : 'Residential';
  // Always trust the configured site URL first. The request `Origin` header is
  // attacker-controlled — using it for Stripe success/cancel redirects let an
  // attacker steer post-payment users to an arbitrary domain (and the URL
  // ends up serialised into Stripe receipts). Only fall back to the request
  // origin when no env var is set (local dev).
  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get('origin') || '';

  // Resolve or create a Stripe Customer so returning customers see their saved cards.
  // Falls back to customer_email only if the DB lookup fails or no customer row exists.
  let stripeCustomerId: string | undefined;
  if (quote.customer_email) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: customerRow } = await (client as any)
        .from('customers')
        .select('id, stripe_customer_id')
        .eq('email', quote.customer_email)
        .maybeSingle();

      if (customerRow?.stripe_customer_id) {
        stripeCustomerId = customerRow.stripe_customer_id;
      } else if (customerRow?.id) {
        // No Stripe Customer yet — create one and persist the ID for future checkouts.
        const stripeCustomer = await stripe.customers.create({
          email: quote.customer_email,
          name: quote.customer_name || undefined,
          metadata: { supabase_customer_id: customerRow.id },
        });
        stripeCustomerId = stripeCustomer.id;
        // Persist in background — don't block the checkout session creation.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (client as any)
          .from('customers')
          .update({ stripe_customer_id: stripeCustomerId })
          .eq('id', customerRow.id)
          .then(() => {})
          .catch((e: unknown) => console.warn('[checkout] Failed to save stripe_customer_id:', e));
      }
    } catch (e) {
      console.warn('[checkout] Stripe customer lookup/create failed, falling back to email:', e);
    }
  }

  let session: Stripe.Checkout.Session;
  const idempotencyKey = createCheckoutIdempotencyKey({
    amountCents,
    context: quote.context ?? null,
    customerEmail: quote.customer_email ?? null,
    orderId,
    origin,
    quoteId: quote.id,
    serviceType: quote.service_type,
    stripeCustomerId,
  });

  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      currency: 'aud',
      // Use Stripe Customer when available (enables saved cards for returning customers),
      // otherwise fall back to customer_email so Stripe can prefill the form.
      ...(stripeCustomerId
        ? { customer: stripeCustomerId }
        : { customer_email: quote.customer_email || undefined }),
      line_items: [
        {
          price_data: {
            currency: 'aud',
            unit_amount: amountCents,
            product_data: {
              name: `${contextLabel} ${serviceLabel}`,
              description: `Buds At Work quote #${quote.id.slice(0, 8).toUpperCase()}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        order_id: orderId,
        quote_id: quote.id,
        service_type: quote.service_type,
        context: quote.context,
        amount_cents: String(amountCents),
        estimated_stripe_fee_cents: String(feeEstimate.feeCents),
        estimated_net_cents: String(feeEstimate.netCents),
        customer_name: (quote.customer_name ?? '').slice(0, 255),
        customer_email: (quote.customer_email ?? '').slice(0, 255),
      },
      payment_intent_data: {
        metadata: {
          order_id: orderId,
          quote_id: quote.id,
          service_type: quote.service_type,
          context: quote.context,
          amount_cents: String(amountCents),
          estimated_stripe_fee_cents: String(feeEstimate.feeCents),
          estimated_net_cents: String(feeEstimate.netCents),
        },
      },
      success_url: `${origin}/services/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/services/checkout/cancel?order_id=${orderId}`,
    },
    // Include material checkout inputs so exact retries dedupe, while changed
    // quote/payment details do not collide with Stripe's prior request cache.
    { idempotencyKey });
  } catch (stripeErr) {
    console.error('[checkout] Stripe session creation failed:', stripeErr);
    const message =
      stripeErr instanceof Error && stripeErr.message
        ? stripeErr.message
        : 'Failed to create payment session';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: orderUpdateErr } = await (client as any)
    .from('orders')
    .update({ stripe_checkout_session_id: session.id })
    .eq('id', orderId);
  if (orderUpdateErr) {
    console.error('[checkout] Failed to update order with session id:', orderUpdateErr.message);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: quoteUpdateErr } = await (client as any)
    .from('quotes')
    .update({
      status: 'payment_pending',
      payment_status: 'pending_payment',
      payment_requested_at: new Date().toISOString(),
      stripe_checkout_session_id: session.id,
      stripe_checkout_url: session.url ?? null,
      converted_order_id: orderId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quote.id);
  if (quoteUpdateErr) {
    console.error('[checkout] Failed to update quote status:', quoteUpdateErr.message);
  }

  void recordAnalyticsEvent({
    sessionId: quote.analytics_session_id ?? null,
    eventName: 'checkout_started',
    page: authUser.role === 'customer' ? '/portal/quotes' : '/dashboard/quotes',
    source: 'server',
    quoteId: quote.id,
    orderId,
    eventValue: amount,
    eventData: {
      service: quote.service_type,
      context: quote.context,
      scope: quote.scope,
      payment_status: 'pending_payment',
    },
  });

  let emailSent = false;
  let emailError: string | null = null;
  let emailId: string | null = null;

  // Send "quote finalized" email and report provider errors back to the caller.
  if (quote.customer_email && session.url) {
    const resend = getResendClient();
    if (resend) {
      const { subject, html } = quoteFinalizedEmail({
        customerName: quote.customer_name,
        serviceLabel: SERVICE_LABELS[quote.service_type] || quote.service_type,
        total: amount,
        quoteId: quote.id,
        paymentUrl: session.url,
      });
      try {
        const result = await resend.emails.send({
          from: FROM_ADDRESS,
          to: quote.customer_email,
          subject,
          html,
        });
        if (result.error) {
          emailError = result.error.message;
          console.error('[email] quote_finalized send failed:', result.error);
        } else {
          emailSent = true;
          emailId = result.data?.id ?? null;
          console.log('[email] quote_finalized sent:', {
            quote_id: quote.id,
            to: quote.customer_email,
            resend_email_id: emailId,
          });
        }
      } catch (err) {
        emailError = err instanceof Error ? err.message : 'Failed to send email';
        console.error('[email] quote_finalized send failed:', err);
      }
    } else {
      emailError = 'Email service unavailable';
      console.error('[email] quote_finalized send failed: Resend client unavailable');
    }
  }

  return NextResponse.json({
    url: session.url,
    session_id: session.id,
    order_id: orderId,
    email_sent: emailSent,
    email_error: emailError,
    email_to: quote.customer_email ?? null,
    email_id: emailId,
  });
}
