import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { createStripeClient } from '@/lib/stripe/server';

// Simple in-memory rate limiter (resets per server process restart)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// Fire-and-forget audit log insert
async function logAudit(
  client: ReturnType<typeof createServiceClientSafe>,
  entityId: string,
  action: string,
  newValue: Record<string, unknown>
) {
  if (!client) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any).from('audit_log').insert([{
      entity_type: 'order',
      entity_id: entityId,
      action,
      new_value: newValue,
      source: 'checkout',
    }]);
  } catch {
    // Don't block checkout if audit log fails
  }
}

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Window Cleaning',
  cleaning: 'Home/Commercial Cleaning',
  yard: 'Yard Care',
  dump: 'Dump Runs',
  auto: 'Auto Detailing',
  laundry_sneakers: 'Laundry & Sneaker Care',
};

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.' }, { status: 429 });
  }

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  let body: {
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    service_type: string;
    context: string;
    scope?: string;
    frequency?: string;
    base_price: number;
    discount_percent?: number;
    final_price: number;
    notes?: string;
    region?: string;
    company_name?: string;
    abn?: string;
    is_business_expense?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.customer_name || !body.customer_email || !body.service_type || !body.context) {
    return NextResponse.json(
      { error: 'Missing required fields: customer_name, customer_email, service_type, context' },
      { status: 400 }
    );
  }

  if (!body.final_price || body.final_price <= 0) {
    return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
  }

  try {
    // 1. Create order in database with status 'pending'
    const orderData = {
      customer_name: body.customer_name,
      customer_email: body.customer_email || null,
      customer_phone: body.customer_phone || null,
      service_type: body.service_type,
      context: body.context,
      scope: body.scope || null,
      frequency: body.frequency || 'none',
      base_price: body.base_price,
      discount_percent: body.discount_percent || 0,
      final_price: body.final_price,
      status: 'pending',
      notes: body.notes || null,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: order, error: orderError } = await (client as any)
      .from('orders')
      .insert([orderData])
      .select()
      .single();

    if (orderError || !order) {
      console.error('Order creation error:', orderError);
      return NextResponse.json(
        { error: orderError?.message || 'Failed to create order' },
        { status: 400 }
      );
    }

    // 2. Create Stripe Checkout Session
    const stripe = createStripeClient();

    const serviceLabel = SERVICE_LABELS[body.service_type] || body.service_type;
    const contextLabel = body.context === 'commercial' ? 'Commercial' : 'Residential';
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || '';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      currency: 'aud',
      customer_email: body.customer_email,
      line_items: [
        {
          price_data: {
            currency: 'aud',
            unit_amount: Math.round(body.final_price * 100), // Stripe uses cents
            product_data: {
              name: `${contextLabel} ${serviceLabel}`,
              description: `Buds at Work – ${contextLabel} ${serviceLabel}${body.scope ? ` (${body.scope})` : ''}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        order_id: order.id,
        service_type: body.service_type,
        context: body.context,
        customer_name: body.customer_name,
      },
      success_url: `${origin}/services/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/services/checkout/cancel?order_id=${order.id}`,
    });

    // 3. Store Stripe session ID on the order
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any)
      .from('orders')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', order.id);

    // 4. Audit log (fire-and-forget)
    logAudit(client, order.id, 'created', {
      service_type: body.service_type,
      final_price: body.final_price,
      customer_email: body.customer_email,
      stripe_session_id: session.id,
    });

    // 5. Return session URL for client-side redirect
    return NextResponse.json({
      url: session.url,
      order_id: order.id,
      session_id: session.id,
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
