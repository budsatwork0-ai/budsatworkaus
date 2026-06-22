// -----------------------------------------------------------------------------
// /api/leads/contact — Contact form lead ingest
// -----------------------------------------------------------------------------
// Replaces formsubmit.co: creates a leads row + lead_conversations row so
// every contact form submission enters Bud OS and is visible in the leads
// workspace. Fires a Resend admin notification to maintain the email alert
// the admin previously received from formsubmit.co.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getResendClient, FROM_ADDRESS } from '@/lib/email/resend';

export const dynamic = 'force-dynamic';

type ContactBody = {
  name?: string;
  email?: string;
  phone?: string;
  service?: string;
  message?: string;
  // Honeypot — must be empty
  _honey?: string;
};

export async function POST(req: NextRequest) {
  let body: ContactBody;
  try {
    body = (await req.json()) as ContactBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Honeypot check — bots fill this, humans don't.
  if (body._honey) {
    return NextResponse.json({ success: true });
  }

  const name    = typeof body.name    === 'string' ? body.name.trim()    : null;
  const email   = typeof body.email   === 'string' ? body.email.trim()   : null;
  const phone   = typeof body.phone   === 'string' ? body.phone.trim()   : null;
  const service = typeof body.service === 'string' ? body.service.trim() : null;
  const message = typeof body.message === 'string' ? body.message.trim() : null;

  if (!name || !email || !message) {
    return NextResponse.json(
      { error: 'name, email, and message are required' },
      { status: 400 },
    );
  }

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lead, error: leadErr } = await (client as any)
    .from('leads')
    .insert({
      customer_name:  name,
      customer_email: email,
      customer_phone: phone || null,
      service_type:   service || null,
      source:         'website',
      response_status: 'awaiting_response',
      reply_channel:  'email',
    })
    .select('id')
    .single();

  if (leadErr || !lead?.id) {
    console.error('[api/leads/contact] insert failed:', leadErr?.message);
    return NextResponse.json({ error: 'Failed to record enquiry' }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client as any).from('lead_conversations').insert({
    lead_id:      lead.id,
    direction:    'inbound',
    channel:      'website',
    body:         message,
    author_label: name,
    metadata: {
      service,
      email,
      phone: phone || null,
      source: 'contact_form',
    },
  });

  // Admin notification — mirrors what formsubmit.co was sending.
  void sendAdminNotification({ name, email, phone, service, message });

  return NextResponse.json({ success: true, lead_id: lead.id });
}

async function sendAdminNotification(p: {
  name: string;
  email: string;
  phone: string | null;
  service: string | null;
  message: string;
}) {
  const resend = getResendClient();
  if (!resend) return;

  const serviceLabel = p.service
    ? p.service.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'General enquiry';

  await resend.emails.send({
    from:    FROM_ADDRESS,
    to:      'admin@budsatwork.com',
    subject: `New contact form submission — ${p.name}`,
    html: `
      <p><strong>Name:</strong> ${p.name}</p>
      <p><strong>Email:</strong> <a href="mailto:${p.email}">${p.email}</a></p>
      ${p.phone ? `<p><strong>Phone:</strong> ${p.phone}</p>` : ''}
      <p><strong>Service:</strong> ${serviceLabel}</p>
      <hr />
      <p>${p.message.replace(/\n/g, '<br />')}</p>
      <hr />
      <p style="color:#666;font-size:12px;">
        This enquiry has been recorded in
        <a href="https://budsatwork.com/dashboard/insights/leads">Bud OS Leads</a>.
      </p>
    `.trim(),
  }).catch((err: unknown) => {
    console.error('[api/leads/contact] notification email failed:', err);
  });
}
