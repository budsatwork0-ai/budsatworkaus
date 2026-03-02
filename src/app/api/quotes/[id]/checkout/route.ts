import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { createStripeClient } from '@/lib/stripe/server';

type RouteParams = { params: Promise<{ id: string }> };

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Window Cleaning',
  cleaning: 'Home/Commercial Cleaning',
  yard: 'Yard Care',
  dump: 'Dump Runs',
  auto: 'Auto Detailing',
  laundry_sneakers: 'Laundry & Sneaker Care',
};

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
    quote.status === 'approved' || quote.status === 'adjusted' ? 'finalized' : quote.status;

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

  const stripe = createStripeClient();
  const serviceLabel = SERVICE_LABELS[quote.service_type] || quote.service_type;
  const contextLabel = quote.context === 'commercial' ? 'Commercial' : 'Residential';
  const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || '';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    currency: 'aud',
    customer_email: quote.customer_email || undefined,
    line_items: [
      {
        price_data: {
          currency: 'aud',
          unit_amount: Math.round(amount * 100),
          product_data: {
            name: `${contextLabel} ${serviceLabel}`,
            description: `Buds at Work quote #${quote.id.slice(0, 8).toUpperCase()}`,
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
      customer_name: quote.customer_name,
    },
    success_url: `${origin}/services/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/services/checkout/cancel?order_id=${orderId}`,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client as any)
    .from('orders')
    .update({ stripe_checkout_session_id: session.id })
    .eq('id', orderId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client as any)
    .from('quotes')
    .update({
      status: 'payment_pending',
      payment_status: 'pending_payment',
      payment_requested_at: new Date().toISOString(),
      stripe_checkout_session_id: session.id,
      converted_order_id: orderId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quote.id);

  return NextResponse.json({
    url: session.url,
    session_id: session.id,
    order_id: orderId,
  });
}
