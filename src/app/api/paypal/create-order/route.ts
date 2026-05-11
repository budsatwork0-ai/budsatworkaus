import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';

const PAYPAL_BASE = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

async function getPayPalToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error('PayPal credentials not configured');

  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

// POST /api/paypal/create-order
// Public — creates a PayPal order for the given quote. Returns the PayPal order ID.
export async function POST(req: NextRequest) {
  let body: { quote_id: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { quote_id } = body;
  if (!quote_id) return NextResponse.json({ error: 'quote_id required' }, { status: 400 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: quote, error } = await (client as any)
    .from('quotes')
    .select('id, customer_name, service_type, status, payment_status, reviewed_total, submitted_total, total, converted_order_id')
    .eq('id', quote_id)
    .maybeSingle();

  if (error || !quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });

  if (quote.payment_status === 'paid') {
    return NextResponse.json({ error: 'Quote is already paid' }, { status: 400 });
  }

  const amount = Number(quote.reviewed_total ?? quote.submitted_total ?? quote.total ?? 0);
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'Invalid quote amount' }, { status: 400 });
  }

  const SERVICE_LABELS: Record<string, string> = {
    windows: 'Window Cleaning',
    cleaning: 'Cleaning',
    yard: 'Yard Care',
    dump: 'Dump Run',
    auto: 'Car Detailing',
    laundry_sneakers: 'Laundry',
  };
  const description = `Buds At Work — ${SERVICE_LABELS[quote.service_type] ?? quote.service_type}`;

  let token: string;
  try {
    token = await getPayPalToken();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'PayPal auth failed' },
      { status: 503 }
    );
  }

  const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `baw-${quote_id}-${Date.now()}`,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: quote_id,
          description,
          custom_id: quote.converted_order_id ?? quote_id,
          amount: {
            currency_code: 'AUD',
            value: amount.toFixed(2),
          },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: 'Buds At Work',
            locale: 'en-AU',
            landing_page: 'NO_PREFERENCE',
            user_action: 'PAY_NOW',
          },
        },
      },
    }),
  });

  const orderData = await orderRes.json() as { id?: string; message?: string };
  if (!orderRes.ok) {
    return NextResponse.json(
      { error: orderData.message ?? `PayPal order creation failed: ${orderRes.status}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ order_id: orderData.id });
}
