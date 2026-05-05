import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { createStripeClient } from '@/lib/stripe/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

type Params = { params: Promise<{ id: string }> };

// POST /api/ndis/organisations/[id]/subscribe
// Creates a Stripe Checkout session for the NDIS organisation subscription.
// Requires NDIS_SUBSCRIPTION_PRICE_ID env var (set to a recurring Stripe Price ID).
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const priceId = process.env.NDIS_SUBSCRIPTION_PRICE_ID;
  if (!priceId) {
    return NextResponse.json(
      { error: 'NDIS_SUBSCRIPTION_PRICE_ID is not configured. Create a recurring Stripe Price and set this env var.' },
      { status: 500 }
    );
  }

  const { id } = await params;
  const client = createServiceClientSafe() as AnyClient;
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { data: org, error: orgError } = await client
    .from('ndis_organisations')
    .select('*')
    .eq('id', id)
    .single();

  if (orgError || !org) {
    return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
  }

  if (org.subscription_status === 'active') {
    return NextResponse.json({ error: 'Subscription is already active' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || '';

  const stripe = createStripeClient();

  // Reuse existing Stripe customer or create one
  let stripeCustomerId: string = org.stripe_customer_id;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      name: org.name,
      email: org.contact_email,
      phone: org.contact_phone ?? undefined,
      metadata: { ndis_org_id: org.id },
    });
    stripeCustomerId = customer.id;
    await client
      .from('ndis_organisations')
      .update({ stripe_customer_id: stripeCustomerId })
      .eq('id', org.id);
  }

  const successUrl = body.success_url || `${origin}/dashboard/ndis?subscribed=${org.id}`;
  const cancelUrl  = body.cancel_url  || `${origin}/dashboard/ndis`;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { ndis_org_id: org.id },
    subscription_data: {
      metadata: { ndis_org_id: org.id },
    },
  });

  return NextResponse.json({ url: session.url });
}

// DELETE /api/ndis/organisations/[id]/subscribe — cancel the subscription
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;
  const client = createServiceClientSafe() as AnyClient;
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { data: org } = await client
    .from('ndis_organisations')
    .select('stripe_subscription_id')
    .eq('id', id)
    .single();

  if (!org?.stripe_subscription_id) {
    return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
  }

  const stripe = createStripeClient();
  await stripe.subscriptions.cancel(org.stripe_subscription_id);

  await client
    .from('ndis_organisations')
    .update({ subscription_status: 'cancelled', stripe_subscription_id: null })
    .eq('id', id);

  return NextResponse.json({ success: true });
}
