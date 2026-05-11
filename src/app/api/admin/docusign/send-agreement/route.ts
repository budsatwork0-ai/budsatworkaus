import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

const DOCUSIGN_ACCOUNT_ID = process.env.DOCUSIGN_ACCOUNT_ID ?? 'e8720755-0a53-4518-b3ce-dcde9e06f7e3';
const DOCUSIGN_BASE_URI = process.env.DOCUSIGN_BASE_URI ?? 'https://au.docusign.net';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL
  ? process.env.NEXT_PUBLIC_APP_URL
  : process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'https://budsatwork.com';

interface SendAgreementBody {
  order_id: string;
  filming_consent_ops: boolean;
  filming_consent_marketing: boolean;
}

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Window Cleaning',
  cleaning: 'Home / Commercial Cleaning',
  yard: 'Yard Care',
  dump: 'Rubbish & Dump Run',
  auto: 'Car Detailing',
  laundry_sneakers: 'Laundry & Sneaker Care',
};

// POST /api/admin/docusign/send-agreement
export async function POST(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const accessToken = process.env.DOCUSIGN_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json(
      { error: 'DocuSign not configured. Set DOCUSIGN_ACCESS_TOKEN.' },
      { status: 503 }
    );
  }

  let body: SendAgreementBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { order_id, filming_consent_ops, filming_consent_marketing } = body;
  if (!order_id) {
    return NextResponse.json({ error: 'order_id is required' }, { status: 400 });
  }

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;

  const { data: order, error: orderError } = await db
    .from('orders')
    .select('id, quote_id, customer_name, customer_email, customer_phone, service_type, context, final_price, scheduled_date, notes')
    .eq('id', order_id)
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  if (!order.customer_email) {
    return NextResponse.json({ error: 'Order has no customer email on file' }, { status: 400 });
  }

  // Try to get the service address from the linked quote
  let serviceAddress: string | null = null;
  if (order.quote_id) {
    const { data: quote } = await db
      .from('quotes')
      .select('service_address')
      .eq('id', order.quote_id)
      .maybeSingle();
    serviceAddress = quote?.service_address ?? null;
  }

  const { data: agreement, error: insertError } = await db
    .from('client_agreements')
    .insert({
      order_id,
      quote_id: order.quote_id ?? null,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      customer_phone: order.customer_phone ?? null,
      service_type: order.service_type,
      service_context: order.context,
      service_address: serviceAddress,
      scheduled_date: order.scheduled_date ?? null,
      agreed_price: order.final_price,
      filming_consent_ops: Boolean(filming_consent_ops),
      filming_consent_marketing: Boolean(filming_consent_marketing),
      is_ndis: order.context === 'ndis',
      status: 'pending',
      created_by: authUser.email ?? authUser.id,
    })
    .select()
    .single();

  if (insertError || !agreement) {
    return NextResponse.json({ error: insertError?.message ?? 'Failed to create agreement' }, { status: 500 });
  }

  const documentUrl = `${APP_URL}/api/agreements/${agreement.id}/document`;
  const serviceLabel = SERVICE_LABELS[order.service_type] ?? order.service_type;

  const envelopeBody = {
    emailSubject: `Buds At Work — Service Agreement: ${serviceLabel}`,
    emailBlurb: `Hi ${order.customer_name}, please review and sign your Buds At Work Service Agreement before we begin. This covers your booking details, payment terms, and important consent information.`,
    status: 'sent',
    documents: [
      {
        documentId: '1',
        name: 'Buds At Work Service Agreement',
        fileExtension: 'html',
        remoteUrl: documentUrl,
      },
    ],
    recipients: {
      signers: [
        {
          email: order.customer_email,
          name: order.customer_name,
          recipientId: '1',
          routingOrder: '1',
          tabs: {
            signHereTabs: [
              {
                documentId: '1',
                recipientId: '1',
                anchorString: '[[SIGN_HERE]]',
                anchorUnits: 'pixels',
                anchorXOffset: '0',
                anchorYOffset: '-10',
              },
            ],
            dateSignedTabs: [
              {
                documentId: '1',
                recipientId: '1',
                anchorString: '[[SIGN_HERE]]',
                anchorUnits: 'pixels',
                anchorXOffset: '80',
                anchorYOffset: '14',
              },
            ],
          },
        },
      ],
      carbonCopies: [
        {
          email: 'admin@budsatwork.com',
          name: 'Buds At Work Admin',
          recipientId: '2',
          routingOrder: '2',
        },
      ],
    },
    notification: {
      reminders: {
        reminderEnabled: 'true',
        reminderDelay: '3',
        reminderFrequency: '3',
      },
      expirations: {
        expireEnabled: 'true',
        expireAfter: '14',
        expireWarn: '3',
      },
    },
  };

  let envelopeId: string | null = null;
  let docusignError: string | null = null;

  try {
    const dsRes = await fetch(
      `${DOCUSIGN_BASE_URI}/restapi/v2.1/accounts/${DOCUSIGN_ACCOUNT_ID}/envelopes`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(envelopeBody),
      }
    );
    const dsData = await dsRes.json().catch(() => ({}));
    if (!dsRes.ok) {
      docusignError = (dsData as { message?: string }).message ?? `DocuSign error ${dsRes.status}`;
    } else {
      envelopeId = (dsData as { envelopeId?: string }).envelopeId ?? null;
    }
  } catch (err) {
    docusignError = err instanceof Error ? err.message : 'DocuSign request failed';
  }

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (envelopeId) {
    updatePayload.docusign_envelope_id = envelopeId;
    updatePayload.status = 'sent';
    updatePayload.sent_at = new Date().toISOString();
  }
  await db.from('client_agreements').update(updatePayload).eq('id', agreement.id);

  if (docusignError) {
    return NextResponse.json(
      { error: docusignError, agreement_id: agreement.id, hint: 'Agreement saved but DocuSign delivery failed.' },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, agreement_id: agreement.id, envelope_id: envelopeId });
}
