import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { createStripeClientSafe } from '@/lib/stripe/server';
import { getAuthUser } from '@/lib/auth';
import { orderWorkspace } from '@/lib/orders/workspace';
import { LIVE_WORKSPACE } from '@/lib/workspace/types';

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Window Cleaning',
  cleaning: 'Home / Commercial Cleaning',
  yard: 'Yard Care',
  dump: 'Rubbish & Dump Run',
  auto: 'Car Detailing',
  laundry_sneakers: 'Laundry & Sneaker Care',
};

const INVOICE_DAYS_UNTIL_DUE = 7;

/** Invoice statuses that block sending another invoice for the same job. */
const ACTIVE_INVOICE_STATUSES = new Set(['sending', 'open', 'paid', 'overdue', 'payment_failed']);

// POST /api/orders/[id]/send-invoice — admin only.
// Creates a Stripe invoice (send_invoice, AUD) for the job and has Stripe email it.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: orderId } = await params;
  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  const stripe = createStripeClientSafe();
  if (!stripe) return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;
  const { data: order } = await db.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  if (orderWorkspace(order) !== LIVE_WORKSPACE || order.is_test) {
    return NextResponse.json({ error: 'Invoices can only be sent for live jobs' }, { status: 400 });
  }
  const email = typeof order.customer_email === 'string' ? order.customer_email.trim() : '';
  if (!email) return NextResponse.json({ error: 'Add a customer email before sending an invoice' }, { status: 400 });
  const amountCents = Math.round(Number(order.final_price || 0) * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: 'Job has no price to invoice' }, { status: 400 });
  }
  if (order.stripe_invoice_id || ACTIVE_INVOICE_STATUSES.has(order.stripe_invoice_status)) {
    return NextResponse.json(
      { error: 'An invoice has already been sent for this job', invoice_url: order.stripe_invoice_url ?? null },
      { status: 409 },
    );
  }

  // Claim the job so two clicks can't send two invoices.
  const { data: claimed } = await db
    .from('orders')
    .update({ stripe_invoice_status: 'sending' })
    .eq('id', orderId)
    .is('stripe_invoice_id', null)
    .select('id')
    .maybeSingle();
  if (!claimed) return NextResponse.json({ error: 'An invoice is already being sent for this job' }, { status: 409 });

  try {
    // Find or create the Stripe customer.
    let stripeCustomerId: string | null = null;
    if (order.customer_id) {
      const { data: customerRow } = await db
        .from('customers').select('id, stripe_customer_id').eq('id', order.customer_id).maybeSingle();
      stripeCustomerId = customerRow?.stripe_customer_id ?? null;
    }
    if (!stripeCustomerId) {
      const existing = await stripe.customers.list({ email, limit: 1 });
      stripeCustomerId = existing.data[0]?.id ?? null;
    }
    if (!stripeCustomerId) {
      const created = await stripe.customers.create(
        { email, name: order.customer_name || undefined, phone: order.customer_phone || undefined },
        { idempotencyKey: `order-${orderId}-customer` },
      );
      stripeCustomerId = created.id;
    }
    if (order.customer_id) {
      await db.from('customers').update({ stripe_customer_id: stripeCustomerId })
        .eq('id', order.customer_id).is('stripe_customer_id', null);
    }

    const serviceLabel = SERVICE_LABELS[order.service_type] || order.service_type || 'Service';
    const description = [serviceLabel, order.scope].filter(Boolean).join(' — ')
      + (order.scheduled_date ? ` (${order.scheduled_date})` : '');
    const metadata = { order_id: orderId, source: 'buds_send_invoice' };

    const draft = await stripe.invoices.create(
      {
        customer: stripeCustomerId,
        currency: 'aud',
        collection_method: 'send_invoice',
        days_until_due: INVOICE_DAYS_UNTIL_DUE,
        pending_invoice_items_behavior: 'exclude',
        metadata,
      },
      { idempotencyKey: `order-${orderId}-invoice` },
    );
    await stripe.invoiceItems.create(
      { customer: stripeCustomerId, invoice: draft.id, amount: amountCents, currency: 'aud', description, metadata },
      { idempotencyKey: `order-${orderId}-invoice-item` },
    );
    const finalized = await stripe.invoices.finalizeInvoice(draft.id!);
    const sent = await stripe.invoices.sendInvoice(finalized.id!);

    const patch = {
      stripe_invoice_id: sent.id,
      stripe_invoice_status: sent.status ?? 'open',
      stripe_invoice_url: sent.hosted_invoice_url ?? null,
      stripe_invoice_number: sent.number ?? null,
      stripe_invoice_sent_at: new Date().toISOString(),
    };
    await db.from('orders').update(patch).eq('id', orderId);
    return NextResponse.json({ ok: true, ...patch });
  } catch (err) {
    console.error('[send-invoice] Stripe error:', err);
    await db.from('orders').update({ stripe_invoice_status: null }).eq('id', orderId).is('stripe_invoice_id', null);
    const message = err instanceof Error ? err.message : 'Stripe error';
    return NextResponse.json({ error: `Could not send invoice: ${message}` }, { status: 502 });
  }
}
