/**
 * POST /api/orders/[id]/remind-day-before
 *
 * Sends the day-before service reminder email to the customer.
 *
 * Call this the evening before a confirmed booking — either:
 *   a) Manually from the Dashboard → Dispatch tab ("Send reminder" button), or
 *   b) Automatically via a cron job that filters orders where
 *      scheduled_date = tomorrow AND day_before_reminder_sent = false.
 *
 * Who can call it: admin / employee only. Sandbox orders additionally
 * require admin specifically, and never trigger a real email send — see the
 * sandbox branch below.
 *
 * Idempotency: A `day_before_reminder_sent` boolean column on the orders table
 * prevents double-firing. Falls back gracefully if the column doesn't exist yet.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { getResendClient, FROM_ADDRESS } from '@/lib/email/resend';
import { dayBeforeReminderEmail } from '@/lib/email/templates';
import { orderWorkspace } from '@/lib/orders/workspace';
import { LIVE_WORKSPACE } from '@/lib/workspace/server';

type RouteParams = { params: Promise<{ id: string }> };

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Window Cleaning',
  cleaning: 'Home / Commercial Cleaning',
  yard: 'Yard Care',
  dump: 'Dump Runs',
  auto: 'Auto Detailing',
  laundry_sneakers: 'Laundry & Sneaker Care',
};

/** Extract "Address: ..." from freeform order notes (if stored there). */
function extractAddress(notes: string | null): string {
  if (!notes) return 'See your client portal';
  const match = notes.match(/Address:\s*(.+?)(?:\n|$)/i);
  return match?.[1]?.trim() ?? 'See your client portal';
}

/** Format a scheduled_time window like "09:00" → "9:00 AM" */
function fmtTime(raw: string | null): string {
  if (!raw) return 'Your confirmed time window';
  return raw;
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

  // Load order with crew assignment join
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order, error: oErr } = await (client as any)
    .from('orders')
    .select(`
      *,
      job_assignments (
        employees ( first_name, last_name )
      )
    `)
    .eq('id', id)
    .single();

  if (oErr || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Sandbox orders may only be reminded by an admin specifically — an
  // employee otherwise allowed to send reminders for production orders may
  // not touch a sandbox one.
  const workspace = orderWorkspace(order);
  if (workspace !== LIVE_WORKSPACE && authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Only send for confirmed / scheduled orders
  if (!['confirmed', 'scheduled'].includes(order.status)) {
    return NextResponse.json(
      { error: 'Order is not in a confirmed or scheduled state', status: order.status },
      { status: 409 }
    );
  }

  // Idempotency: don't double-fire if already sent
  if (order.day_before_reminder_sent === true) {
    return NextResponse.json({ message: 'Reminder already sent for this order', skipped: true });
  }

  const customerEmail: string | undefined = order.customer_email;
  const customerName: string = order.customer_name || 'there';

  if (!customerEmail) {
    return NextResponse.json({ error: 'No customer email on order' }, { status: 422 });
  }

  // Sandbox: never send a real reminder email — there is no real customer
  // behind the record. Return a clear, testable blocked response instead of
  // building any fake email adapter/simulation.
  if (workspace !== LIVE_WORKSPACE) {
    return NextResponse.json({ success: true, blocked: true, reason: 'sandbox' });
  }

  const serviceLabel = SERVICE_LABELS[order.service_type] ?? order.service_type;

  // Determine crew first name (first assigned crew member)
  const firstAssignment = order.job_assignments?.[0];
  const crewFirstName: string =
    firstAssignment?.employees?.first_name ?? 'One of our team members';

  // Build human-readable date
  const scheduledDate: string = order.scheduled_date
    ? new Date(order.scheduled_date).toLocaleDateString('en-AU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Your scheduled date';

  const scheduledTime: string = fmtTime(order.scheduled_time);
  const serviceAddress: string = extractAddress(order.notes);

  const resend = getResendClient();
  if (!resend) {
    console.error('[email] remind-day-before: Resend client unavailable');
    return NextResponse.json({ error: 'Email service unavailable' }, { status: 503 });
  }

  const { subject, html } = dayBeforeReminderEmail({
    customerName,
    serviceLabel,
    scheduledDate,
    scheduledTime,
    crewFirstName,
    serviceAddress,
    orderId: id,
  });

  resend.emails
    .send({ from: FROM_ADDRESS, to: customerEmail, subject, html })
    .then(() => {
      // Mark reminder sent — non-blocking
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any)
        .from('orders')
        .update({ day_before_reminder_sent: true })
        .eq('id', id)
        .then(() => {/* ignore */})
        .catch(() => {/* column may not exist yet */});
    })
    .catch((err: unknown) => {
      console.error('[email] remind-day-before: send failed for order', id, err);
    });

  return NextResponse.json({ success: true, sent_to: customerEmail });
}
