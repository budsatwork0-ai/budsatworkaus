// POST — admin-only. Logs a phone enquiry as a lead so it enters Bud OS.
// Used when admin manually records a call received.

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type PhoneBody = {
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  service_type?: string;
  notes?: string;
};

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: PhoneBody;
  try {
    body = (await req.json()) as PhoneBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name  = typeof body.customer_name  === 'string' ? body.customer_name.trim()  : null;
  const phone = typeof body.customer_phone === 'string' ? body.customer_phone.trim() : null;
  const email = typeof body.customer_email === 'string' ? body.customer_email.trim() : null;
  const service = typeof body.service_type === 'string' ? body.service_type.trim()   : null;
  const notes   = typeof body.notes        === 'string' ? body.notes.trim()          : null;

  if (!name || !phone) {
    return NextResponse.json(
      { error: 'customer_name and customer_phone are required' },
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
      customer_name:   name,
      customer_phone:  phone,
      customer_email:  email || null,
      service_type:    service || null,
      source:          'phone',
      response_status: 'in_conversation',
      reply_channel:   'phone',
    })
    .select('id')
    .single();

  if (leadErr || !lead?.id) {
    console.error('[api/leads/phone] insert failed:', leadErr?.message);
    return NextResponse.json({ error: 'Failed to record phone enquiry' }, { status: 500 });
  }

  if (notes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any).from('lead_conversations').insert({
      lead_id:      lead.id,
      direction:    'inbound',
      channel:      'phone',
      body:         notes,
      author_label: name,
      metadata:     { source: 'phone_log', logged_by: authUser.id },
    });
  }

  return NextResponse.json({ success: true, lead_id: lead.id });
}
