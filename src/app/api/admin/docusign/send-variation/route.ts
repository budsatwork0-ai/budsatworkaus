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

interface SendVariationBody {
  order_id: string;
  variation_description: string;
  additional_cost: number;
  reason?: string;
}

// POST /api/admin/docusign/send-variation
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

  let body: SendVariationBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { order_id, variation_description, additional_cost, reason } = body;
  if (!order_id || !variation_description || additional_cost == null) {
    return NextResponse.json(
      { error: 'order_id, variation_description, and additional_cost are required' },
      { status: 400 }
    );
  }

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;

  const { data: order, error: orderError } = await db
    .from('orders')
    .select('id, customer_name, customer_email, service_type, final_price')
    .eq('id', order_id)
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  if (!order.customer_email) {
    return NextResponse.json({ error: 'Order has no customer email on file' }, { status: 400 });
  }

  const newTotal = Number(order.final_price) + Number(additional_cost);

  const { data: variation, error: insertError } = await db
    .from('job_variations')
    .insert({
      order_id,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      original_service: order.service_type,
      original_price: order.final_price,
      variation_description,
      additional_cost,
      new_total: newTotal,
      reason: reason || null,
      status: 'pending',
      created_by: authUser.email ?? authUser.id,
    })
    .select()
    .single();

  if (insertError || !variation) {
    return NextResponse.json({ error: insertError?.message ?? 'Failed to create variation' }, { status: 500 });
  }

  const documentUrl = `${APP_URL}/api/variations/${variation.id}/document`;

  const envelopeBody = {
    emailSubject: `Buds At Work — Please approve: Job Variation Order`,
    emailBlurb: `Hi ${order.customer_name}, we need your sign-off on a variation to your recent Buds At Work booking before we proceed. Please review and sign the attached variation order.`,
    status: 'sent',
    documents: [
      {
        documentId: '1',
        name: 'Job Variation Order',
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
        reminderDelay: '1',
        reminderFrequency: '1',
      },
      expirations: {
        expireEnabled: 'true',
        expireAfter: '7',
        expireWarn: '2',
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
  await db.from('job_variations').update(updatePayload).eq('id', variation.id);

  if (docusignError) {
    return NextResponse.json(
      { error: docusignError, variation_id: variation.id, hint: 'Variation saved but DocuSign delivery failed.' },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, variation_id: variation.id, envelope_id: envelopeId });
}
