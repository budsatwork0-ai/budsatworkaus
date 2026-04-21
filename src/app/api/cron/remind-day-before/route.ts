import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getResendClient, FROM_ADDRESS } from '@/lib/email/resend';
import { dayBeforeReminderEmail } from '@/lib/email/templates';
import {
  formatDateInTimeZone,
  getAutomationSettings,
  getRelativeDateString,
  SERVICE_LABELS,
} from '@/lib/automations';

export const dynamic = 'force-dynamic';

type ScheduledOrder = {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  service_type: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  status: string;
  notes: string | null;
  day_before_reminder_sent: boolean;
  job_assignments?: Array<{
    employees?: {
      first_name?: string | null;
      last_name?: string | null;
    } | null;
  }>;
};

function extractAddress(notes: string | null): string {
  if (!notes) return 'See your client portal';
  const match = notes.match(/Address:\s*(.+?)(?:\n|$)/i);
  return match?.[1]?.trim() ?? 'See your client portal';
}

function formatScheduledDate(date: string | null): string {
  if (!date) return 'Your scheduled date';
  return formatDateInTimeZone(`${date}T12:00:00+10:00`, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

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

  const automations = await getAutomationSettings();
  if (!automations.dayBeforeReminder) {
    return NextResponse.json({ ok: true, skipped: 'disabled' });
  }

  const tomorrow = getRelativeDateString(1);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orders, error } = await (client as any)
    .from('orders')
    .select(`
      id,
      customer_name,
      customer_email,
      service_type,
      scheduled_date,
      scheduled_time,
      status,
      notes,
      day_before_reminder_sent,
      job_assignments (
        employees ( first_name, last_name )
      )
    `)
    .in('status', ['confirmed', 'scheduled'])
    .eq('scheduled_date', tomorrow)
    .eq('day_before_reminder_sent', false)
    .limit(100);

  if (error) {
    console.error('[cron/remind-day-before] query failed:', error.message);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  const resend = getResendClient();
  if (!resend) {
    return NextResponse.json({ error: 'Email client unavailable' }, { status: 503 });
  }

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const order of (orders ?? []) as ScheduledOrder[]) {
    if (!order.customer_email) {
      skipped++;
      continue;
    }

    const firstAssignment = order.job_assignments?.[0];
    const crewFirstName = firstAssignment?.employees?.first_name ?? 'One of our team members';

    const { subject, html } = dayBeforeReminderEmail({
      customerName: order.customer_name || 'there',
      serviceLabel: SERVICE_LABELS[order.service_type] ?? order.service_type,
      scheduledDate: formatScheduledDate(order.scheduled_date),
      scheduledTime: order.scheduled_time || 'Your confirmed time window',
      crewFirstName,
      serviceAddress: extractAddress(order.notes),
      orderId: order.id,
    });

    try {
      await resend.emails.send({
        from: FROM_ADDRESS,
        to: order.customer_email,
        subject,
        html,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (client as any)
        .from('orders')
        .update({ day_before_reminder_sent: true, updated_at: new Date().toISOString() })
        .eq('id', order.id);

      sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[cron/remind-day-before] failed for order ${order.id}:`, message);
      errors.push(order.id);
    }
  }

  return NextResponse.json({
    ok: true,
    target_date: tomorrow,
    sent,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
  });
}
