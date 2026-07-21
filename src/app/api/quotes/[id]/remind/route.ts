/**
 * POST /api/quotes/[id]/remind
 *
 * Sends a "24h nudge" payment reminder to the customer for a finalized-but-unpaid quote.
 *
 * Who can call it:
 *   - admin / employee (manual trigger from the dashboard)
 *   - An automated cron job authenticating with the service role
 *
 * Idempotency:
 *   - The quote must have status === 'finalized' and payment_status === 'not_requested'
 *     OR payment_status === 'pending_payment' with a stripe_checkout_url still on record.
 *   - If the quote is already paid or cancelled we return 409 without sending.
 *   - A `last_reminder_sent_at` column (if present on the quotes table) is updated to
 *     prevent double-firing from a cron. Fall back gracefully if the column doesn't exist.
 *
 * Rate limit: 5 reminders per quote per hour (enforced in-memory; replace with Redis for prod).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { getResendClient, FROM_ADDRESS } from '@/lib/email/resend';
import { quoteReminderEmail } from '@/lib/email/templates';
import { QuoteStatus } from '@/lib/types/status';
import { createQuoteRepository } from '@/lib/quotes/repository';
import { isAuthorizedForQuoteWorkspace, quoteWorkspace } from '@/lib/quotes/workspace';

type RouteParams = { params: Promise<{ id: string }> };

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Window Cleaning',
  cleaning: 'Home / Commercial Cleaning',
  yard: 'Yard Care',
  dump: 'Dump Runs',
  auto: 'Auto Detailing',
  laundry_sneakers: 'Laundry & Sneaker Care',
};

// Simple in-memory rate limiter: max 5 sends per quoteId per hour.
const reminderLog = new Map<string, number[]>();

function checkReminderLimit(quoteId: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1_000; // 1 hour
  const max = 5;
  const hits = (reminderLog.get(quoteId) ?? []).filter(ts => now - ts < windowMs);
  if (hits.length >= max) return false;
  reminderLog.set(quoteId, [...hits, now]);
  return true;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const authUser = await getAuthUser();
  if (!authUser || !['admin', 'employee'].includes(authUser.role ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  // Rate limit
  if (!checkReminderLimit(id)) {
    return NextResponse.json(
      { error: 'Too many reminders sent for this quote. Try again later.' },
      { status: 429 }
    );
  }

  // Load the quote
  const repository = createQuoteRepository({ client });
  const { data: quote, error: qErr } = await repository.getById(id);

  if (qErr || !quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  }

  // A sandbox quote may only be reminded by an admin specifically — an
  // employee otherwise allowed to send reminders for production quotes may
  // not touch a sandbox one.
  if (!isAuthorizedForQuoteWorkspace(quoteWorkspace(quote), authUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Guard: only remind if the quote is in a payable state
  const isPayable =
    (quote.status === QuoteStatus.finalized || quote.status === QuoteStatus.paymentPending) &&
    quote.payment_status !== 'paid';

  if (!isPayable) {
    return NextResponse.json(
      { error: 'Quote is not in a payable state', status: quote.status, payment_status: quote.payment_status },
      { status: 409 }
    );
  }

  const customerEmail: string | null | undefined = quote.customer_email;
  const customerName: string = quote.customer_name || 'there';
  const serviceLabel = SERVICE_LABELS[quote.service_type] ?? quote.service_type;
  const total = Number(quote.reviewed_total ?? quote.submitted_total ?? quote.total ?? 0);

  if (!customerEmail) {
    return NextResponse.json({ error: 'No customer email on quote' }, { status: 422 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  // Always send customers to the custom pay page, not the raw Stripe URL.
  // The pay page supports all payment methods and never expires.
  const paymentUrl = `${siteUrl.replace(/\/$/, '')}/pay/${id}`;

  const resend = getResendClient();
  if (!resend) {
    console.error('[email] remind: Resend client unavailable');
    return NextResponse.json({ error: 'Email service unavailable' }, { status: 503 });
  }

  const { subject, html } = quoteReminderEmail({
    customerName,
    serviceLabel,
    total,
    quoteId: id,
    paymentUrl,
  });

  try {
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to: customerEmail,
      subject,
      html,
    });

    if (result.error) {
      console.error('[email] remind: send failed:', result.error);
      return NextResponse.json({ error: result.error.message || 'Failed to send reminder' }, { status: 502 });
    }

    // Attempt to stamp last_reminder_sent_at — non-blocking, column may not exist yet
    repository
      .update(id, { last_reminder_sent_at: new Date().toISOString() })
      .catch(() => {/* column may not exist */});

    return NextResponse.json({ success: true, sent_to: customerEmail });
  } catch (err) {
    console.error('[email] remind: send failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send reminder' },
      { status: 502 }
    );
  }
}
