import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron/auth';
import { createStripeClient } from '@/lib/stripe/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getResendClient, FROM_ADDRESS } from '@/lib/email/resend';
import { quoteDiscountOfferEmail } from '@/lib/email/templates';
import {
  clampPercent,
  getAutomationConfig,
  getAutomationSettings,
  SERVICE_LABELS,
} from '@/lib/automations';

export const dynamic = 'force-dynamic';

type ReengagementQuote = {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  service_type: string;
  reviewed_total: number | null;
  submitted_total: number | null;
  total: number | null;
  notes: string | null;
  converted_order_id: string | null;
  stripe_checkout_session_id: string | null;
  last_discount_offer_sent_at: string | null;
  finalized_at: string | null;
  payment_requested_at: string | null;
  created_at: string;
};

function appendDiscountNote(notes: string | null, originalTotal: number, discountedTotal: number, discountPercent: number) {
  const stamp = new Date().toISOString();
  const line = `[automation:${stamp}] Applied ${discountPercent}% re-engagement discount (${originalTotal.toFixed(2)} -> ${discountedTotal.toFixed(2)}).`;
  return notes ? `${notes}\n${line}` : line;
}

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const automations = await getAutomationSettings();
  if (!automations.quote48hDiscount) {
    return NextResponse.json({ ok: true, skipped: 'disabled' });
  }

  const config = await getAutomationConfig();
  const discountPercent = clampPercent(config.quoteReengagementDiscountPercent);
  const cutoffMs = Date.now() - 48 * 60 * 60 * 1000;
  const portalPaymentsUrl = `${(process.env.NEXT_PUBLIC_SITE_URL || 'https://budsatwork.com').replace(/\/$/, '')}/portal/payments`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: quotes, error } = await (client as any)
    .from('quotes')
    .select('id, customer_name, customer_email, service_type, reviewed_total, submitted_total, total, notes, converted_order_id, stripe_checkout_session_id, last_discount_offer_sent_at, finalized_at, payment_requested_at, created_at')
    .in('status', ['finalized', 'payment_pending'])
    .neq('payment_status', 'paid')
    .is('last_discount_offer_sent_at', null)
    .limit(50);

  if (error) {
    console.error('[cron/reengage-quotes] query failed:', error.message);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  const resend = getResendClient();
  if (!resend) {
    return NextResponse.json({ error: 'Email client unavailable' }, { status: 503 });
  }

  let stripe = null;
  try {
    stripe = createStripeClient();
  } catch {
    stripe = null;
  }

  let discounted = 0;
  let skipped = 0;
  const errors: string[] = [];

  const eligibleQuotes = ((quotes ?? []) as ReengagementQuote[]).filter((quote) => {
    const relevantAt = quote.finalized_at || quote.payment_requested_at || quote.created_at;
    return new Date(relevantAt).getTime() <= cutoffMs;
  });

  for (const quote of eligibleQuotes) {
    if (!quote.customer_email) {
      skipped++;
      continue;
    }

    const originalTotal = Number(quote.reviewed_total ?? quote.submitted_total ?? quote.total ?? 0);
    if (!Number.isFinite(originalTotal) || originalTotal <= 0) {
      skipped++;
      continue;
    }

    const discountedTotal = Number((originalTotal * (1 - discountPercent / 100)).toFixed(2));

    try {
      if (stripe && quote.stripe_checkout_session_id) {
        await stripe.checkout.sessions.expire(quote.stripe_checkout_session_id).catch(() => undefined);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (client as any)
        .from('quotes')
        .update({
          reviewed_total: discountedTotal,
          last_discount_offer_sent_at: new Date().toISOString(),
          stripe_checkout_session_id: null,
          stripe_checkout_url: null,
          notes: appendDiscountNote(quote.notes, originalTotal, discountedTotal, discountPercent),
          updated_at: new Date().toISOString(),
        })
        .eq('id', quote.id);

      if (quote.converted_order_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (client as any)
          .from('orders')
          .update({
            final_price: discountedTotal,
            discount_percent: discountPercent,
            stripe_checkout_session_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', quote.converted_order_id);
      }

      const { subject, html } = quoteDiscountOfferEmail({
        customerName: quote.customer_name || 'there',
        serviceLabel: SERVICE_LABELS[quote.service_type] ?? quote.service_type,
        originalTotal,
        discountedTotal,
        discountPercent,
        quoteId: quote.id,
        paymentUrl: portalPaymentsUrl,
      });

      await resend.emails.send({
        from: FROM_ADDRESS,
        to: quote.customer_email,
        subject,
        html,
      });

      discounted++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[cron/reengage-quotes] failed for quote ${quote.id}:`, message);
      errors.push(quote.id);
    }
  }

  return NextResponse.json({
    ok: true,
    discounted,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
  });
}
