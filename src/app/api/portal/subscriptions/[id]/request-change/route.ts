import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getResendClient, FROM_ADDRESS } from '@/lib/email/resend';

type RouteParams = { params: Promise<{ id: string }> };

const CHANGE_LABELS: Record<string, string> = {
  frequency: 'Change frequency',
  scope: 'Change scope / size',
  addon: 'Add or remove an add-on',
  pause: 'Pause or hold service',
  other: 'Something else',
};

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Window Cleaning',
  cleaning: 'Home Cleaning',
  yard: 'Yard Care',
  dump: 'Dump Run',
  auto: 'Auto Detailing',
  laundry_sneakers: 'Laundry & Sneakers',
};

export async function POST(req: NextRequest, { params }: RouteParams) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  let body: { change_type: string; message: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { change_type, message } = body;
  if (!change_type || !message?.trim()) {
    return NextResponse.json({ error: 'change_type and message are required' }, { status: 400 });
  }
  if (message.trim().length > 1000) {
    return NextResponse.json({ error: 'Message too long (max 1000 characters)' }, { status: 400 });
  }

  // Verify the subscription belongs to this customer.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sub } = await (client as any)
    .from('subscriptions')
    .select('id, service_type, frequency, status, customer_id, customer_name, customer_email')
    .eq('id', id)
    .maybeSingle();

  if (!sub) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });

  const isOwner =
    authUser.role === 'admin' ||
    authUser.role === 'employee' ||
    (sub.customer_email && authUser.email &&
      sub.customer_email.toLowerCase() === authUser.email.toLowerCase());

  if (!isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || 'hello@budsatwork.com';
  const resend = getResendClient();

  if (resend) {
    const changeLabel = CHANGE_LABELS[change_type] || change_type;
    const serviceLabel = SERVICE_LABELS[sub.service_type] || sub.service_type;
    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#0f3d2e">Subscription Change Request</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;width:140px">Customer</td><td style="font-size:14px">${sub.customer_name || 'Unknown'} &lt;${sub.customer_email || '—'}&gt;</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Service</td><td style="font-size:14px">${serviceLabel}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Frequency</td><td style="font-size:14px">${sub.frequency || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Status</td><td style="font-size:14px">${sub.status}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Request type</td><td style="font-size:14px;font-weight:600">${changeLabel}</td></tr>
        </table>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;font-size:14px;white-space:pre-wrap">${message.trim().replace(/</g, '&lt;')}</div>
        <p style="font-size:12px;color:#9ca3af;margin-top:24px">Subscription ID: ${id}</p>
      </div>
    `;
    try {
      await resend.emails.send({
        from: FROM_ADDRESS,
        to: adminEmail,
        replyTo: sub.customer_email || undefined,
        subject: `Subscription change request — ${serviceLabel} (${changeLabel})`,
        html,
      });
    } catch (e) {
      console.error('[request-change] Email send failed:', e);
      // Don't surface email errors to the customer — the request is still logged below.
    }
  }

  // Log the request to the audit table so admin can track it without relying solely on email.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any).from('audit_log').insert({
      entity_type: 'subscription',
      entity_id: id,
      action: 'change_requested',
      actor_id: authUser.id,
      metadata: { change_type, message: message.trim() },
    });
  } catch {
    // Audit log failure is non-fatal.
  }

  return NextResponse.json({ ok: true });
}
