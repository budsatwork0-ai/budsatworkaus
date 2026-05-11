import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getResendClient, FROM_ADDRESS } from '@/lib/email/resend';
import { bookingConfirmedEmail } from '@/lib/email/templates';

const PAYPAL_BASE = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Window Cleaning',
  cleaning: 'Home / Commercial Cleaning',
  yard: 'Yard Care',
  dump: 'Rubbish & Dump Run',
  auto: 'Car Detailing',
  laundry_sneakers: 'Laundry & Sneaker Care',
};

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

// POST /api/paypal/capture-order/[orderId]
// Public — captures an approved PayPal order and marks the quote as paid.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  let body: { quote_id: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { quote_id } = body;
  if (!quote_id) return NextResponse.json({ error: 'quote_id required' }, { status: 400 });

  let token: string;
  try {
    token = await getPayPalToken();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'PayPal auth failed' },
      { status: 503 }
    );
  }

  // Capture the PayPal order
  const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `baw-capture-${orderId}`,
    },
  });

  const captureData = await captureRes.json() as {
    status?: string;
    id?: string;
    purchase_units?: Array<{ payments?: { captures?: Array<{ id: string; amount: { value: string } }> } }>;
    message?: string;
  };

  if (!captureRes.ok || captureData.status !== 'COMPLETED') {
    return NextResponse.json(
      { error: captureData.message ?? `PayPal capture failed: ${captureRes.status}` },
      { status: 502 }
    );
  }

  const captureId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? orderId;
  const capturedAmount = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value;
  const now = new Date().toISOString();

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;

  // Fetch the quote
  const { data: quote } = await db
    .from('quotes')
    .select('*')
    .eq('id', quote_id)
    .maybeSingle();

  if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });

  // Mark quote as paid
  await db.from('quotes').update({
    payment_status: 'paid',
    paid_at: now,
    status: 'paid',
    updated_at: now,
  }).eq('id', quote_id);

  // Update the linked order if it exists
  let orderId2 = quote.converted_order_id as string | null;
  if (!orderId2) {
    // Create order record if not already present
    const { data: newOrder } = await db.from('orders').insert({
      quote_id: quote.id,
      customer_id: quote.customer_id,
      customer_name: quote.customer_name,
      customer_email: quote.customer_email,
      customer_phone: quote.customer_phone,
      service_type: quote.service_type,
      context: quote.context,
      scope: quote.scope,
      frequency: quote.frequency,
      base_price: Number(quote.submitted_total ?? quote.total),
      discount_percent: 0,
      final_price: Number(quote.reviewed_total ?? quote.submitted_total ?? quote.total),
      status: 'confirmed',
      notes: quote.notes,
    }).select('id').single();
    orderId2 = newOrder?.id ?? null;

    if (orderId2) {
      await db.from('quotes').update({ converted_order_id: orderId2 }).eq('id', quote_id);
    }
  } else {
    await db.from('orders').update({ status: 'confirmed', updated_at: now }).eq('id', orderId2);
  }

  // Audit log
  await db.from('audit_log').insert({
    entity_type: 'quote',
    entity_id: quote_id,
    action: 'paid_paypal',
    new_value: {
      paypal_order_id: orderId,
      paypal_capture_id: captureId,
      amount: capturedAmount,
      order_id: orderId2,
    },
    source: 'paypal_capture',
  }).catch(() => {});

  // Send booking-confirmed email if possible
  if (quote.customer_email) {
    const resend = getResendClient();
    if (resend) {
      const serviceLabel = SERVICE_LABELS[quote.service_type] ?? quote.service_type;
      try {
        const { subject, html } = bookingConfirmedEmail({
          customerName: quote.customer_name ?? 'there',
          serviceLabel,
          total: Number(quote.reviewed_total ?? quote.submitted_total ?? quote.total ?? 0),
          orderId: orderId2 ?? quote_id,
        });
        await resend.emails.send({ from: FROM_ADDRESS, to: quote.customer_email, subject, html });
      } catch {
        // Non-blocking
      }
    }
  }

  return NextResponse.json({
    success: true,
    paypal_order_id: orderId,
    paypal_capture_id: captureId,
    order_id: orderId2,
  });
}
