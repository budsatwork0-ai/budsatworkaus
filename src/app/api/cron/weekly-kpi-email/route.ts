import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getResendClient, FROM_ADDRESS } from '@/lib/email/resend';
import { weeklyKpiEmail } from '@/lib/email/templates';
import { getAutomationSettings, getPeriodLabel } from '@/lib/automations';
import { getSiteSettingObject } from '@/lib/site-settings';

export const dynamic = 'force-dynamic';

type NotificationSettings = {
  emailWeeklySummary: boolean;
};

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  emailWeeklySummary: true,
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

  const automations = await getAutomationSettings();
  if (!automations.weeklyKpiEmail) {
    return NextResponse.json({ ok: true, skipped: 'disabled' });
  }

  const notifications = await getSiteSettingObject('notifications', DEFAULT_NOTIFICATIONS);
  if (!notifications.emailWeeklySummary) {
    return NextResponse.json({ ok: true, skipped: 'notifications_disabled' });
  }

  const resend = getResendClient();
  if (!resend) {
    return NextResponse.json({ error: 'Email client unavailable' }, { status: 503 });
  }

  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: quotes, error: quoteError }, { data: orders, error: orderError }, { data: admins, error: adminError }] = await Promise.all([
    (client as any)
      .from('quotes')
      .select('id, payment_status, created_at')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString()),
    (client as any)
      .from('orders')
      .select('id, final_price, completed_at')
      .eq('status', 'completed')
      .gte('completed_at', start.toISOString())
      .lte('completed_at', end.toISOString()),
    (client as any)
      .from('profiles')
      .select('email')
      .eq('role', 'admin')
      .not('email', 'is', null),
  ]);

  if (quoteError || orderError || adminError) {
    console.error('[cron/weekly-kpi-email] query failed:', quoteError?.message || orderError?.message || adminError?.message);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  const recipients = Array.from(new Set((admins ?? []).map((admin: { email: string | null }) => admin.email).filter(Boolean))) as string[];
  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, skipped: 'no_recipients' });
  }

  const quoteVolume = (quotes ?? []).length;
  const convertedQuotes = (quotes ?? []).filter((quote: { payment_status: string }) => quote.payment_status === 'paid').length;
  const conversionRate = quoteVolume > 0 ? Math.round((convertedQuotes / quoteVolume) * 100) : 0;
  const revenue = (orders ?? []).reduce((sum: number, order: { final_price: number | null }) => sum + Number(order.final_price || 0), 0);
  const jobsCompleted = (orders ?? []).length;

  const { subject, html } = weeklyKpiEmail({
    periodLabel: getPeriodLabel(start, end),
    quoteVolume,
    conversionRate,
    revenue,
    jobsCompleted,
  });

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: recipients,
    subject,
    html,
  });

  return NextResponse.json({
    ok: true,
    recipients,
    quoteVolume,
    conversionRate,
    revenue,
    jobsCompleted,
  });
}
