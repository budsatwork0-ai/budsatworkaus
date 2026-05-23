// -----------------------------------------------------------------------------
// /api/webhooks/messenger — Facebook Messenger raw webhook adapter
// -----------------------------------------------------------------------------
// Sits between Facebook's webhook delivery and the normalized ingest route.
// Responsibilities:
//   GET  — Facebook verification handshake (delegates to ingest route logic).
//   POST — Verify Meta HMAC signature, extract message events, enrich sender
//          PSID via Graph API, and re-POST normalized payloads to
//          /api/leads/messenger.
//
// Why this exists separately from /api/leads/messenger:
//   - Keeps the ingest route testable with curl and free of FB-specific quirks.
//   - Isolates HMAC verification, Graph API calls, and payload shape changes.
//   - Allows /api/leads/messenger to be called by other trusted adapters
//     (Instagram, SMS) without bundling FB concerns.
//
// HMAC: Meta signs every POST with X-Hub-Signature-256: sha256=<hex>.
//   We verify against MESSENGER_APP_SECRET before touching the payload.
//   Return 401 on bad sig so FB stops re-delivering invalid requests.
//
// Graph API enrichment: first-touch only — we call GET /v20.0/<psid>?fields=
//   first_name,last_name on the sender's PSID to get a real name. Subsequent
//   messages from the same PSID hit the idempotency path in the ingest route
//   and skip the Graph API call (their lead row already exists).
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { createServiceClientSafe } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ---------- config -----------------------------------------------------------

const GRAPH_API_BASE = 'https://graph.facebook.com/v20.0';
const GRAPH_FIELDS = 'first_name,last_name';

// ---------- HMAC verification ------------------------------------------------

function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.MESSENGER_APP_SECRET;
  if (!appSecret) {
    if (process.env.NODE_ENV === 'production') return false;
    return true;
  }
  if (!signatureHeader) return false;
  const prefix = 'sha256=';
  if (!signatureHeader.startsWith(prefix)) return false;

  const provided = Buffer.from(signatureHeader.slice(prefix.length), 'hex');
  const expected = Buffer.from(
    createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex'),
    'hex'
  );
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

// ---------- Graph API enrichment ---------------------------------------------

type GraphProfile = {
  first_name?: string;
  last_name?: string;
};

async function fetchSenderProfile(psid: string): Promise<GraphProfile> {
  const token = process.env.MESSENGER_PAGE_ACCESS_TOKEN;
  if (!token) return {};
  try {
    const res = await fetch(
      `${GRAPH_API_BASE}/${psid}?fields=${GRAPH_FIELDS}&access_token=${token}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return {};
    return (await res.json()) as GraphProfile;
  } catch {
    return {};
  }
}

// ---------- Direct DB ingest (no self-fetch) ---------------------------------

async function ingestEvent(event: {
  external_id: string;
  sender_psid: string;
  customer_name: string | null;
  message_body: string;
  page_id: string | null;
  timestamp: number | null;
}): Promise<void> {
  const client = createServiceClientSafe();
  if (!client) {
    console.error('[messenger adapter] DB client unavailable');
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;

  const existing = await db
    .from('leads')
    .select('id')
    .eq('source', 'messenger')
    .eq('external_ref', event.external_id)
    .maybeSingle();

  if (existing?.data?.id) {
    await db.from('lead_conversations').insert({
      lead_id: existing.data.id,
      direction: 'inbound',
      channel: 'messenger',
      body: event.message_body,
      external_id: event.external_id,
      author_label: event.customer_name ?? 'Customer',
      metadata: { sender_psid: event.sender_psid, page_id: event.page_id, timestamp: event.timestamp },
    });
    return;
  }

  const { data: lead, error } = await db
    .from('leads')
    .insert({
      customer_name: event.customer_name,
      source: 'messenger',
      external_ref: event.external_id,
      response_status: 'awaiting_response',
    })
    .select('id')
    .single();

  if (error || !lead?.id) {
    console.error('[messenger adapter] insert failed:', error?.message);
    return;
  }

  await db.from('lead_conversations').insert({
    lead_id: lead.id,
    direction: 'inbound',
    channel: 'messenger',
    body: event.message_body,
    external_id: event.external_id,
    author_label: event.customer_name ?? 'Customer',
    metadata: { sender_psid: event.sender_psid, page_id: event.page_id, timestamp: event.timestamp },
  });
}

// ---------- GET: verification handshake -------------------------------------
// Facebook sends GET when you first register the webhook URL in the
// Developer Console. We mirror the same logic as the ingest route so you
// can point FB at either URL and it'll work.

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token && token === process.env.MESSENGER_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? '', { status: 200 });
  }
  return NextResponse.json({ error: 'verification_failed' }, { status: 403 });
}

// ---------- POST: raw FB payload --------------------------------------------

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!verifyMetaSignature(rawBody, req.headers.get('x-hub-signature-256'))) {
    return new NextResponse('bad signature', { status: 401 });
  }

  let fbPayload: {
    object?: string;
    entry?: Array<{
      id?: string;
      messaging?: Array<{
        sender?: { id?: string };
        message?: { mid?: string; text?: string };
        timestamp?: number;
      }>;
    }>;
  };

  try {
    fbPayload = JSON.parse(rawBody);
  } catch {
    return new NextResponse('invalid json', { status: 400 });
  }

  // FB sends object='page' for Messenger events. Ignore everything else
  // (Instagram webhooks share the same app and send object='instagram').
  if (fbPayload.object !== 'page') {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const ingests: Promise<void>[] = [];

  for (const entry of fbPayload.entry ?? []) {
    for (const ev of entry.messaging ?? []) {
      const text = ev.message?.text;
      if (!text) continue;

      const psid = ev.sender?.id;
      if (!psid) continue;

      const mid = ev.message?.mid ?? `${psid}_${ev.timestamp ?? Date.now()}`;

      const profile = await fetchSenderProfile(psid);
      const customerName = [profile.first_name, profile.last_name]
        .filter(Boolean)
        .join(' ')
        .trim() || null;

      ingests.push(
        ingestEvent({
          external_id: mid,
          sender_psid: psid,
          customer_name: customerName,
          message_body: text,
          page_id: entry.id ?? null,
          timestamp: ev.timestamp ?? null,
        })
      );
    }
  }

  await Promise.all(ingests);
  return NextResponse.json({ ok: true });
}
