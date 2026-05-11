import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

const DOCUSIGN_ACCOUNT_ID = process.env.DOCUSIGN_ACCOUNT_ID ?? 'e8720755-0a53-4518-b3ce-dcde9e06f7e3';
const DOCUSIGN_BASE_URI = process.env.DOCUSIGN_BASE_URI ?? 'https://au.docusign.net';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'https://budsatwork.com';

interface SendContractBody {
  employee_id: string;
  contract_type: 'pay_amendment' | 'employment_type_change' | 'role_change' | 'general_amendment';
  new_rate?: number;
  prev_rate?: number;
  new_employment_type?: string;
  prev_employment_type?: string;
  new_role?: string;
  prev_role?: string;
  effective_date?: string;
  notes?: string;
}

// POST /api/admin/docusign/send-contract
export async function POST(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const accessToken = process.env.DOCUSIGN_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json(
      { error: 'DocuSign not configured. Set DOCUSIGN_ACCESS_TOKEN in environment variables.' },
      { status: 503 }
    );
  }

  let body: SendContractBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { employee_id, contract_type } = body;
  if (!employee_id || !contract_type) {
    return NextResponse.json({ error: 'employee_id and contract_type are required' }, { status: 400 });
  }

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;

  // Fetch employee details
  const { data: employee, error: empError } = await db
    .from('employees')
    .select('id, full_name, email, hourly_rate, employment_type, default_role')
    .eq('id', employee_id)
    .maybeSingle();

  if (empError || !employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  if (!employee.email) {
    return NextResponse.json({ error: 'Employee has no email address on file' }, { status: 400 });
  }

  // Create the contract record
  const contractPayload = {
    employee_id,
    employee_name: employee.full_name,
    employee_email: employee.email,
    contract_type,
    prev_rate: body.prev_rate ?? employee.hourly_rate ?? null,
    new_rate: body.new_rate ?? null,
    prev_employment_type: body.prev_employment_type ?? employee.employment_type ?? null,
    new_employment_type: body.new_employment_type ?? null,
    prev_role: body.prev_role ?? employee.default_role ?? null,
    new_role: body.new_role ?? null,
    effective_date: body.effective_date ?? null,
    notes: body.notes ?? null,
    status: 'pending',
    created_by: authUser.email ?? authUser.id,
  };

  const { data: contract, error: insertError } = await db
    .from('employment_contracts')
    .insert(contractPayload)
    .select()
    .single();

  if (insertError || !contract) {
    return NextResponse.json({ error: insertError?.message ?? 'Failed to create contract' }, { status: 500 });
  }

  // Build the document URL DocuSign will fetch
  const documentUrl = `${APP_URL}/api/contracts/${contract.id}/document`;

  const contractTitles: Record<string, string> = {
    pay_amendment: 'Pay Rate Amendment',
    employment_type_change: 'Change of Employment Type',
    role_change: 'Change of Role',
    general_amendment: 'Employment Amendment',
  };
  const contractTitle = contractTitles[contract_type] ?? 'Employment Amendment';

  // Call DocuSign REST API
  const envelopeBody = {
    emailSubject: `Buds At Work — Please sign: ${contractTitle}`,
    emailBlurb: `Hi ${employee.full_name}, please review and sign the attached employment amendment from Buds At Work.`,
    status: 'sent',
    documents: [
      {
        documentId: '1',
        name: contractTitle,
        fileExtension: 'html',
        remoteUrl: documentUrl,
      },
    ],
    recipients: {
      signers: [
        {
          email: employee.email,
          name: employee.full_name,
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
        expireAfter: '30',
        expireWarn: '5',
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

  // Update contract record with envelope result
  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (envelopeId) {
    updatePayload.docusign_envelope_id = envelopeId;
    updatePayload.status = 'sent';
    updatePayload.sent_at = new Date().toISOString();
  }

  await db
    .from('employment_contracts')
    .update(updatePayload)
    .eq('id', contract.id);

  if (docusignError) {
    return NextResponse.json(
      { error: docusignError, contract_id: contract.id, hint: 'Contract saved but DocuSign delivery failed.' },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    contract_id: contract.id,
    envelope_id: envelopeId,
  });
}
