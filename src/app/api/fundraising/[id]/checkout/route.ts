import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { createStripeClientSafe } from '@/lib/stripe/server';
import { calculateFundraisingTotals } from '@/lib/fundraising/totals';

const MIN_AMOUNT_CENTS = 500;    // $5 AUD
const MAX_AMOUNT_CENTS = 500_000; // $5,000 AUD

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const stripe = createStripeClientSafe();
  if (!stripe) return NextResponse.json({ error: 'Payment service unavailable' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as {
    amountCents?: unknown;
    payerEmail?: unknown;
  };

  // Validate amountCents if provided
  if (body.amountCents !== undefined && body.amountCents !== null) {
    if (
      typeof body.amountCents !== 'number' ||
      !Number.isInteger(body.amountCents) ||
      body.amountCents < MIN_AMOUNT_CENTS ||
      body.amountCents > MAX_AMOUNT_CENTS
    ) {
      return NextResponse.json(
        { error: `Amount must be a whole number of cents between ${MIN_AMOUNT_CENTS} ($${MIN_AMOUNT_CENTS / 100}) and ${MAX_AMOUNT_CENTS} ($${MAX_AMOUNT_CENTS / 100}) AUD` },
        { status: 400 }
      );
    }
  }

  const requestedAmountCents = typeof body.amountCents === 'number' ? body.amountCents : null;

  const payerEmail =
    typeof body.payerEmail === 'string' && body.payerEmail.includes('@')
      ? body.payerEmail
      : undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: item, error } = await (client as any)
    .from('fundraising_items')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !item) {
    return NextResponse.json({ error: error?.message ?? 'Fundraising item not found' }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: contributions } = await (client as any)
    .from('fundraising_contributions')
    .select('fundraising_item_id, amount_cents, status')
    .eq('fundraising_item_id', id);

  const totals = calculateFundraisingTotals(item, contributions ?? []);

  if (totals.is_funded) {
    return NextResponse.json(
      { error: 'This item has already reached its funding goal' },
      { status: 400 }
    );
  }

  // Use caller-provided amount or fall back to remaining goal (minimum $5)
  const amountCents = requestedAmountCents
    ?? Math.max(MIN_AMOUNT_CENTS, totals.remaining_amount_cents || item.goal_amount_cents || MIN_AMOUNT_CENTS);

  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get('origin') || '';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      currency: 'aud',
      ...(payerEmail ? { customer_email: payerEmail } : {}),
      line_items: [
        {
          price_data: {
            currency: 'aud',
            unit_amount: amountCents,
            product_data: {
              name: item.title,
              description: item.short_reason ?? 'Buds At Work fundraising contribution',
              images: item.image_url ? [item.image_url] : undefined,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        fundraising_item_id: item.id,
        fundraising_item_slug: item.slug,
        payment_type: 'fundraiser',
        source: 'get_involved',
      },
      payment_intent_data: {
        metadata: {
          fundraising_item_id: item.id,
          fundraising_item_slug: item.slug,
          payment_type: 'fundraiser',
          source: 'get_involved',
        },
      },
      success_url: `${origin}/donate/success?session_id={CHECKOUT_SESSION_ID}&item_id=${item.id}`,
      cancel_url: `${origin}/get-involved#wishlist`,
    });

    if (!session.url) {
      return NextResponse.json({ error: 'Stripe did not return a checkout URL' }, { status: 500 });
    }

    // Persist the generated URL on the item so admin can copy it from the dashboard
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any)
      .from('fundraising_items')
      .update({ payment_url: session.url })
      .eq('id', id);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create checkout session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
