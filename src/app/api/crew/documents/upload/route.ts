import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { syncEmployeeOnboardingState } from '@/lib/crew-onboarding';

const BUCKET = 'crew-documents';
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXT = /\.(pdf|jpg|jpeg|png|webp)$/i;

const VALID_DOC_TYPES = [
  'wwcc', 'police_check', 'first_aid', 'cpr_certificate', 'ndis_orientation',
  'ndis_screening',
  'drivers_license', 'vehicle_registration', 'vehicle_insurance',
  'abn', 'insurance', 'public_liability', 'resume', 'references', 'other',
];

// POST /api/crew/documents/upload
// Accepts multipart/form-data: file (File), doc_type (string)
// Uploads to Supabase Storage and creates/updates employee_documents row.
export async function POST(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'employee' && authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Employee access required' }, { status: 403 });
  }

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Storage unavailable' }, { status: 503 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const docType = (formData.get('doc_type') as string | null)?.trim();

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!docType || !VALID_DOC_TYPES.includes(docType)) {
    return NextResponse.json({ error: 'Invalid doc_type' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File must be under 10 MB' }, { status: 400 });
  }
  if (!ALLOWED_MIME.includes(file.type) && !ALLOWED_EXT.test(file.name)) {
    return NextResponse.json({ error: 'Only PDF, JPG, PNG or WebP files are accepted' }, { status: 400 });
  }

  const { data: employee } = await db
    .from('employees')
    .select('id')
    .eq('user_id', authUser.id)
    .single();

  if (!employee) return NextResponse.json({ error: 'Employee profile not found' }, { status: 404 });

  // Check for an existing Storage-backed document to delete
  const { data: existing } = await db
    .from('employee_documents')
    .select('id, storage_path')
    .eq('employee_id', employee.id)
    .eq('doc_type', docType)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Build a clean storage path
  const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const storagePath = `${employee.id}/${docType}/${Date.now()}-${safeName}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await client.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
  }

  // Delete old storage object if replacing
  if (existing?.storage_path) {
    await client.storage.from(BUCKET).remove([existing.storage_path]);
  }

  const payload = {
    employee_id: employee.id,
    doc_type: docType,
    storage_path: storagePath,
    file_url: null,
    file_name: file.name,
    file_size: file.size,
    mime_type: file.type || `image/${ext}`,
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    notes: null,
    updated_at: new Date().toISOString(),
  };

  const query = existing
    ? db.from('employee_documents').update(payload).eq('id', existing.id)
    : db.from('employee_documents').insert(payload);

  const { data: document, error: dbError } = await query.select().single();
  if (dbError) {
    // Roll back the storage upload on DB failure
    await client.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // Generate a short-lived signed URL for the client to preview immediately
  const { data: urlData } = await client.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600);

  const snapshot = await syncEmployeeOnboardingState(db, employee.id);

  return NextResponse.json(
    { document: { ...document, signed_url: urlData?.signedUrl || null }, onboarding: snapshot },
    { status: existing ? 200 : 201 }
  );
}
