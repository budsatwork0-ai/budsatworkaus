import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { createStripeClientSafe } from '@/lib/stripe/server';
import { calculateFundraisingTotals } from '@/lib/fundraising/totals';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const stripe = createStripeClientSafe();
  if (!stripe) return NextResponse.json({ error: 'Payment service unavailable' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { amountCents?: unknown };

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
  const { data: contributions, error: contributionsError } = await (client as any)
    .from('fundraising_contributions')
    .select('fundraising_item_id, amount_cents, status')
    .eq('fundraising_item_id', id);

  if (contributionsError) {
    return NextResponse.json({ error: contributionsError.message }, { status: 500 });
  }

  const totals = calculateFundraisingTotals(item, contributions ?? []);
  const requestedAmount = Number(body.amountCents);
  const amountCents = Number.isInteger(requestedAmount) && requestedAmount > 0
    ? requestedAmount
    : Math.max(500, totals.remaining_amount_cents || item.goal_amount_cents || 500);

  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get('origin') || '';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      currency: 'aud',
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
        source: 'get_involved',
      },
      payment_intent_data: {
        metadata: {
          fundraising_item_id: item.id,
          fundraising_item_slug: item.slug,
          source: 'get_involved',
        },
      },
      success_url: `${origin}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/get-involved#wishlist`,
    });

    if (!session.url) {
      return NextResponse.json({ error: 'Stripe did not return a checkout URL' }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any)
      .from('fundraising_items')
      .update({ payment_url: session.url })
      .eq('id', id);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create checkout session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
