import { NextResponse } from 'next/server';
import { createAuthServerClient } from '@/lib/supabase/server-client';
import { getAuthUser } from '@/lib/auth';
import { isGoogleDriveUrl, syncEmployeeOnboardingState } from '@/lib/crew-onboarding';

const VALID_DOC_TYPES = [
  'wwcc',
  'police_check',
  'first_aid',
  'drivers_license',
  'abn',
  'insurance',
  'ndis_screening',
  'other',
];

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authUser.role !== 'employee' && authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Employee access required' }, { status: 403 });
  }

  const supabase = await createAuthServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: employee } = await db
    .from('employees')
    .select('id')
    .eq('user_id', authUser.id)
    .single();

  if (!employee) {
    return NextResponse.json({ documents: [] });
  }

  const { data: documents, error: docError } = await db
    .from('employee_documents')
    .select('*')
    .eq('employee_id', employee.id)
    .order('created_at', { ascending: false });

  if (docError) {
    return NextResponse.json({ error: docError.message }, { status: 500 });
  }

  const snapshot = await syncEmployeeOnboardingState(db, employee.id);

  return NextResponse.json({
    documents: documents || [],
    onboarding: snapshot,
  });
}

export async function POST(request: Request) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authUser.role !== 'employee' && authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Employee access required' }, { status: 403 });
  }

  let body: { doc_type?: string; file_url?: string; file_name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.doc_type || !VALID_DOC_TYPES.includes(body.doc_type)) {
    return NextResponse.json({ error: 'Invalid doc_type' }, { status: 400 });
  }
  if (!body.file_url || body.file_url.trim().length === 0) {
    return NextResponse.json({ error: 'file_url is required' }, { status: 400 });
  }
  if (!isGoogleDriveUrl(body.file_url)) {
    return NextResponse.json({ error: 'Please provide a Google Drive share link.' }, { status: 400 });
  }

  const supabase = await createAuthServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: employee } = await db
    .from('employees')
    .select('id')
    .eq('user_id', authUser.id)
    .single();

  if (!employee) {
    return NextResponse.json({ error: 'Employee profile not found' }, { status: 404 });
  }

  const { data: existing } = await db
    .from('employee_documents')
    .select('id')
    .eq('employee_id', employee.id)
    .eq('doc_type', body.doc_type)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = {
    employee_id: employee.id,
    doc_type: body.doc_type,
    file_url: body.file_url.trim(),
    file_name: body.file_name || null,
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    notes: null,
  };

  const query = existing
    ? db.from('employee_documents').update(payload).eq('id', existing.id)
    : db.from('employee_documents').insert(payload);

  const { data: document, error } = await query.select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const snapshot = await syncEmployeeOnboardingState(db, employee.id);

  return NextResponse.json({ document, onboarding: snapshot }, { status: existing ? 200 : 201 });
}
