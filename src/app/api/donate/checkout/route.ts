import { NextRequest, NextResponse } from 'next/server';
import { createStripeClient } from '@/lib/stripe/server';

const MIN_CENTS = 500;     // $5 AUD
const MAX_CENTS = 500_000; // $5,000 AUD

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { amountCents } = (body ?? {}) as { amountCents?: unknown };

  if (typeof amountCents !== 'number' || !Number.isInteger(amountCents)) {
    return NextResponse.json({ error: 'amountCents must be an integer' }, { status: 400 });
  }

  if (amountCents < MIN_CENTS || amountCents > MAX_CENTS) {
    return NextResponse.json(
      { error: `Amount must be between $${MIN_CENTS / 100} and $${MAX_CENTS / 100} AUD` },
      { status: 400 }
    );
  }

  let stripe;
  try {
    stripe = createStripeClient();
  } catch {
    return NextResponse.json({ error: 'Payment service unavailable' }, { status: 503 });
  }

  // Always trust the configured site URL — the Origin header is attacker-controlled.
  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get('origin') || '';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      currency: 'aud',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'aud',
            unit_amount: amountCents,
            product_data: {
              name: 'Employment Pathway Contribution',
              description:
                'Buds At Work — helping create real paid employment for people with disabilities.',
            },
          },
          quantity: 1,
        },
      ],
      // No order_id/quote_id — the webhook handler will break early on these sessions.
      metadata: { type: 'donation' },
      payment_intent_data: { metadata: { type: 'donation' } },
      success_url: `${origin}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/get-involved`,
    });

    if (!session.url) {
      return NextResponse.json({ error: 'Stripe did not return a checkout URL' }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create payment session';
    console.error('[donate/checkout] Stripe session creation failed:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
