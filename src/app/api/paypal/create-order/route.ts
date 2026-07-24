import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { createQuoteRepository } from '@/lib/quotes/repository';
import { quoteWorkspace } from '@/lib/quotes/workspace';
import { withWorkspaceContext } from '@/lib/workspace/server';
import { requireProductionPaymentWorkspace } from '@/lib/payments/workspace';
import { ensureOrderForPayableQuote } from '@/lib/payments/quote-conversion';
import { createPaymentRepository } from '@/lib/payments/repository';
import { QuoteStatus } from '@/lib/types/status';

const PAYPAL_BASE = process.env.PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
async function token() {
  const id = process.env.PAYPAL_CLIENT_ID, secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error('PayPal credentials not configured');
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

export async function POST(req: NextRequest) {
  let quoteId: string;
  try { quoteId = (await req.json() as { quote_id: string }).quote_id; } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!quoteId) return NextResponse.json({ error: 'quote_id required' }, { status: 400 });
  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  const quoteResult = await createQuoteRepository({ client }).getById(quoteId);
  const quote = quoteResult.data;
  const eligible = quote && ['approved', QuoteStatus.finalized, QuoteStatus.paymentPending].includes(quote.status) && quote.payment_status !== 'paid';
  if (!eligible || !quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  const workspace = quoteWorkspace(quote);
  try { requireProductionPaymentWorkspace(workspace); } catch { return NextResponse.json({ error: 'Quote not found' }, { status: 404 }); }
  const amount = Number(quote.reviewed_total ?? quote.submitted_total ?? quote.total);
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Invalid quote amount' }, { status: 400 });

  return withWorkspaceContext(workspace, async () => {
    try {
      const order = await ensureOrderForPayableQuote(client, quote);
      const payments = createPaymentRepository(client, workspace);
      // A mapping without a provider order ID represents an interrupted first attempt.
      // The unique order-per-quote index still ensures this never duplicates the order.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingResult = await (client as any).from('payments').select('*').eq('payment_provider', 'paypal').eq('order_id', order.id).eq('status', 'pending').maybeSingle();
      const existing = existingResult.data;
      if (existing?.provider_event_id && Number(existing.amount) === amount && existing.currency?.toLowerCase() === 'aud') {
        return NextResponse.json({ order_id: existing.provider_event_id });
      }
      const pending = existing ?? await payments.createPending({ provider: 'paypal', amount, currency: 'aud', orderId: order.id, customerId: quote.customer_id });
      const accessToken = await token();
      const response = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': `baw-${pending.id}` },
        body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ reference_id: quote.id, custom_id: order.id, amount: { currency_code: 'AUD', value: amount.toFixed(2) } }] }),
      });
      const data = await response.json() as { id?: string; message?: string };
      if (!response.ok || !data.id) return NextResponse.json({ error: data.message ?? `PayPal order creation failed: ${response.status}` }, { status: 502 });
      await payments.setProviderEventId(pending.id, data.id);
      return NextResponse.json({ order_id: data.id });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'PayPal order creation failed' }, { status: 500 });
    }
  });
}
