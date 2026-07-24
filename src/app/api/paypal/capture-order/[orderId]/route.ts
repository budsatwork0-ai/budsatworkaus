import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { createPaymentRepository } from '@/lib/payments/repository';
import { requireProductionPaymentWorkspace } from '@/lib/payments/workspace';
import { withWorkspaceContext } from '@/lib/workspace/server';
import { getResendClient, FROM_ADDRESS } from '@/lib/email/resend';
import { bookingConfirmedEmail } from '@/lib/email/templates';

const PAYPAL_BASE = process.env.PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
async function token() {
  const id = process.env.PAYPAL_CLIENT_ID, secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error('PayPal credentials not configured');
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}
type ProviderOrder = { status?: string; purchase_units?: Array<{ reference_id?: string; custom_id?: string; amount?: { value?: string; currency_code?: string }; payments?: { captures?: Array<{ id: string; status?: string; amount?: { value?: string; currency_code?: string } }> } }> };
const hidden = () => NextResponse.json({ error: 'PayPal order not found' }, { status: 404 });

export async function POST(_req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId: paypalOrderId } = await params;
  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  // Discover the workspace from the durable mapping; caller metadata is never authoritative.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;
  const mappingResult = await db.from('payments').select('*').eq('payment_provider', 'paypal').eq('provider_event_id', paypalOrderId).maybeSingle();
  const mapping = mappingResult.data;
  if (!mapping || mapping.environment !== 'production' || !mapping.order_id) return hidden();
  try { requireProductionPaymentWorkspace(mapping.environment); } catch { return hidden(); }

  return withWorkspaceContext('production', async () => {
    const orderResult = await db.from('orders').select('*').eq('id', mapping.order_id).maybeSingle();
    const order = orderResult.data;
    if (!order || order.environment !== 'production' || !order.quote_id) return hidden();
    const quoteResult = await db.from('quotes').select('*').eq('id', order.quote_id).maybeSingle();
    const quote = quoteResult.data;
    if (!quote || quote.environment !== 'production' || quote.converted_order_id !== order.id) return hidden();
    if (mapping.customer_id && mapping.customer_id !== quote.customer_id) return hidden();
    const expected = Number(mapping.amount);
    if (!Number.isFinite(expected) || mapping.currency?.toLowerCase() !== 'aud') return NextResponse.json({ error: 'Invalid payment currency' }, { status: 409 });
    if (mapping.status === 'completed' && mapping.payment_reference) {
      return NextResponse.json({ success: true, paypal_order_id: paypalOrderId, paypal_capture_id: mapping.payment_reference, order_id: order.id });
    }
    let accessToken: string;
    try { accessToken = await token(); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'PayPal auth failed' }, { status: 503 }); }
    const inspect = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${paypalOrderId}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!inspect.ok) return hidden();
    let provider = await inspect.json() as ProviderOrder;
    const unit = provider.purchase_units?.[0];
    if (!unit) return NextResponse.json({ error: 'PayPal order has no purchase unit' }, { status: 409 });
    if (unit?.custom_id !== order.id || unit.reference_id !== quote.id) return NextResponse.json({ error: 'PayPal association mismatch' }, { status: 409 });
    if (unit.amount?.currency_code !== 'AUD') return NextResponse.json({ error: 'Invalid payment currency' }, { status: 409 });
    if (Number(unit.amount?.value) !== expected) return NextResponse.json({ error: 'Payment amount mismatch' }, { status: 409 });
    let capture = unit.payments?.captures?.find(c => c.status === 'COMPLETED');
    if (!capture) {
      const response = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${paypalOrderId}/capture`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': `baw-capture-${mapping.id}` } });
      provider = await response.json() as ProviderOrder;
      if (!response.ok || provider.status !== 'COMPLETED') return NextResponse.json({ error: 'PayPal capture failed' }, { status: 502 });
      capture = provider.purchase_units?.[0]?.payments?.captures?.[0];
    }
    if (!capture?.id || capture.amount?.currency_code !== 'AUD' || Number(capture.amount.value) !== expected) return NextResponse.json({ error: 'Captured payment does not match expected amount' }, { status: 409 });
    const now = new Date().toISOString();
    const payments = createPaymentRepository(client, 'production');
    await payments.markCompleted(mapping.id, capture.id, now);
    await db.from('orders').update({ status: 'confirmed', updated_at: now }).eq('id', order.id).eq('environment', 'production');
    await db.from('quotes').update({ payment_status: 'paid', paid_at: now, status: 'paid', updated_at: now }).eq('id', quote.id).eq('environment', 'production');
    if (quote.customer_email) {
      const resend = getResendClient();
      if (resend) {
        const email = bookingConfirmedEmail({ customerName: quote.customer_name ?? 'there', serviceLabel: quote.service_type, total: expected, orderId: order.id });
        await resend.emails.send({ from: FROM_ADDRESS, to: quote.customer_email, ...email }).catch(() => undefined);
      }
    }
    return NextResponse.json({ success: true, paypal_order_id: paypalOrderId, paypal_capture_id: capture.id, order_id: order.id });
  });
}
