/**
 * GET /api/cron/remind-quotes
 *
 * Vercel Cron job — runs hourly. Scans for finalized-but-unpaid quotes that
 * were created or finalized more than 24h ago and have not yet received a
 * reminder, then fires the 24h nudge email for each one.
 *
 * Secured by CRON_SECRET env var (set in Vercel project settings and vercel.json).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getResendClient, FROM_ADDRESS } from '@/lib/email/resend';
import { quoteReminderEmail } from '@/lib/email/templates';

export const dynamic = 'force-dynamic';

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Window Cleaning',
  cleaning: 'Home / Commercial Cleaning',
  yard: 'Yard Care',
  dump: 'Dump Runs',
  auto: 'Auto Detailing',
  laundry_sneakers: 'Laundry & Sneaker Care',
};

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://budsatwork.com';

  // Quotes that are finalized, unpaid, older than 24h, and not yet reminded.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: quotes, error } = await (client as any)
    .from('quotes')
    .select('id, customer_name, customer_email, service_type, reviewed_total, submitted_total, total, stripe_checkout_url, last_reminder_sent_at, created_at')
    .in('status', ['finalized', 'payment_pending'])
    .neq('payment_status', 'paid')
    .lt('created_at', cutoff)
    .is('last_reminder_sent_at', null)
    .limit(50);

  if (error) {
    console.error('[cron/remind-quotes] query failed:', error.message);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  const resend = getResendClient();
  if (!resend) {
    return NextResponse.json({ error: 'Email client unavailable' }, { status: 503 });
  }

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const quote of quotes ?? []) {
    if (!quote.customer_email) { skipped++; continue; }

    const customerName: string = quote.customer_name || 'there';
    const serviceLabel = SERVICE_LABELS[quote.service_type] ?? quote.service_type;
    const total = Number(quote.reviewed_total ?? quote.submitted_total ?? quote.total ?? 0);
    const paymentUrl =
      quote.stripe_checkout_url ||
      `${siteUrl.replace(/\/$/, '')}/portal/payments`;

    const { html, subject } = quoteReminderEmail({
      customerName,
      serviceLabel,
      total,
      quoteId: quote.id,
      paymentUrl,
    });

    try {
      await resend.emails.send({
        from: FROM_ADDRESS,
        to: quote.customer_email,
        subject,
        html,
      });

      // Mark reminder sent to prevent double-fire.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (client as any)
        .from('quotes')
        .update({ last_reminder_sent_at: new Date().toISOString() })
        .eq('id', quote.id);

      sent++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[cron/remind-quotes] failed for quote ${quote.id}:`, msg);
      errors.push(quote.id);
    }
  }

  return NextResponse.json({
    ok: true,
    sent,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
  });
}
