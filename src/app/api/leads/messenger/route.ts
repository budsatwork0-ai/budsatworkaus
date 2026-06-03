// -----------------------------------------------------------------------------
// /api/leads/messenger — Messenger lead ingest
// -----------------------------------------------------------------------------
// Two responsibilities:
//   1. GET  — Facebook webhook verification handshake (hub.challenge echo).
//   2. POST — Receive a normalized Messenger event payload, write a row into
//             `leads` (source='messenger'), and append the first message to
//             `lead_conversations`.
//
// The shape of the payload is intentionally a thin normalization, not the raw
// Messenger entry blob. A downstream worker (or a thin adapter) should massage
// the Facebook webhook payload into this normalized shape before posting here.
// That keeps this endpoint testable with curl and decouples it from FB schema
// churn. The raw-webhook adapter can live in lib/integrations/messenger/ once
// the FB Page is connected.
//
// Idempotency: every event carries `external_id` (FB message_id or thread id).
// The 071_leads_external_ref migration enforces uniqueness on
// (source, external_ref); a duplicate POST is a no-op that returns the
// existing lead.
//
// Auth: a shared-secret header (`x-messenger-secret`) gates writes. In
// production this is the same secret used to sign the webhook adapter; in
// dev it can be set via env. A separate FB signature check belongs in the
// adapter — this endpoint trusts its caller.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { coerceLeadSource } from '@/lib/leads/source';
import { deriveReplyChannel } from '@/lib/leads/reply-channel';

export const dynamic = 'force-dynamic';

// ---------- types ------------------------------------------------------------

type MessengerIngestBody = {
  external_id?: string;              // FB message id / thread id — REQUIRED for idempotency
  sender_psid?: string;              // FB Page-Scoped Sender id, becomes the persistent contact key
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  service_type?: string | null;
  suburb?: string | null;
  service_address?: string | null;
  // First inbound message body, if any. When provided we also write a
  // lead_conversations row so the response-time clock starts ticking.
  message_body?: string | null;
  // Channel override — defaults to 'messenger'. Allows the same route to
  // serve Instagram DMs since the shape is identical.
  source?: 'messenger' | 'instagram';
  // Free-form metadata stashed on the conversation row (FB page id, ad id, etc.)
  metadata?: Record<string, unknown>;
};

// ---------- helpers ----------------------------------------------------------

function unauthorized(reason: string) {
  return NextResponse.json({ error: 'Unauthorized', reason }, { status: 401 });
}

function checkSharedSecret(req: NextRequest): boolean {
  const expected = process.env.MESSENGER_INGEST_SECRET;
  // In dev we allow the route to run without a secret so curl works locally.
  // Production deployments MUST set MESSENGER_INGEST_SECRET — see vercel.json.
  if (!expected) return process.env.NODE_ENV !== 'production';
  const provided = req.headers.get('x-messenger-secret');
  return Boolean(provided && provided === expected);
}

// ---------- GET: webhook verification ---------------------------------------

export async function GET(req: NextRequest) {
  // Facebook Messenger webhook setup: GET handshake with hub.mode/verify_token/challenge.
  // Returns the challenge plain when the verify_token matches.
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token && token === process.env.MESSENGER_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? '', { status: 200 });
  }
  return NextResponse.json({ error: 'verification_failed' }, { status: 403 });
}

// ---------- POST: ingest ----------------------------------------------------

export async function POST(req: NextRequest) {
  if (!checkSharedSecret(req)) return unauthorized('bad-secret');

  let body: MessengerIngestBody;
  try {
    body = (await req.json()) as MessengerIngestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.external_id || typeof body.external_id !== 'string') {
    return NextResponse.json(
      { error: 'external_id is required for idempotency' },
      { status: 400 }
    );
  }

  // 'messenger' is the default; allow 'instagram' since the payload is
  // structurally identical. Anything else is rejected to avoid muddying the
  // funnel-by-channel chart.
  const source = coerceLeadSource(body.source) ?? 'messenger';
  if (source !== 'messenger' && source !== 'instagram') {
    return NextResponse.json({ error: 'source must be messenger or instagram' }, { status: 400 });
  }

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  // Idempotency check — if a lead with (source, external_ref) already exists
  // we return it without writing again. This handles FB re-delivery cleanly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = await (client as any)
    .from('leads')
    .select('id')
    .eq('source', source)
    .eq('external_ref', body.external_id)
    .maybeSingle();

  if (existing?.data?.id) {
    // Patch PSID if it was null at initial ingest — ensures Customer Reply can
    // draft a send_messenger reply even if the first ingest missed the PSID.
    // Conditional (.is null) so re-delivery is a safe no-op.
    if (source === 'messenger' && body.sender_psid) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (client as any).from('leads')
        .update({ messenger_psid: body.sender_psid })
        .eq('id', existing.data.id)
        .is('messenger_psid', null);
    }
    // Optional: still record the message if message_body is present + new.
    if (body.message_body) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (client as any).from('lead_conversations').insert({
        lead_id: existing.data.id,
        direction: 'inbound',
        channel: source,
        body: body.message_body,
        external_id: body.external_id,
        external_sender_id: body.sender_psid ?? null,
        author_label: body.customer_name ?? 'Customer',
        metadata: {
          ...(body.metadata ?? {}),
          sender_psid: body.sender_psid ?? null,
        },
      });
    }
    return NextResponse.json({ lead_id: existing.data.id, deduped: true });
  }

  const replyChannel = deriveReplyChannel(source, body.customer_email, body.customer_phone);

  // Insert the new lead.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lead, error: insertErr } = await (client as any)
    .from('leads')
    .insert({
      customer_name: body.customer_name ?? null,
      customer_email: body.customer_email ?? null,
      customer_phone: body.customer_phone ?? null,
      service_type: body.service_type ?? null,
      suburb: body.suburb ?? null,
      service_address: body.service_address ?? null,
      source,
      external_ref: body.external_id,
      response_status: 'awaiting_response',
      reply_channel: replyChannel,
      ...(source === 'messenger' ? { messenger_psid: body.sender_psid ?? null } : {}),
      ...(source === 'instagram' ? { instagram_user_id: body.sender_psid ?? null } : {}),
    })
    .select('id')
    .single();

  if (insertErr || !lead?.id) {
    console.error('[messenger ingest] insert failed:', insertErr?.message);
    return NextResponse.json({ error: 'Failed to record lead' }, { status: 500 });
  }

  // Record the first inbound message, if any. The Response Performance panel
  // uses this row's created_at to compute first-response time.
  if (body.message_body) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any).from('lead_conversations').insert({
      lead_id: lead.id,
      direction: 'inbound',
      channel: source,
      body: body.message_body,
      external_id: body.external_id,
      external_sender_id: body.sender_psid ?? null,
      author_label: body.customer_name ?? 'Customer',
      metadata: {
        ...(body.metadata ?? {}),
        sender_psid: body.sender_psid ?? null,
      },
    });
  }

  return NextResponse.json({ lead_id: lead.id, deduped: false });
}
