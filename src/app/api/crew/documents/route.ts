import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { syncEmployeeOnboardingState } from '@/lib/crew-onboarding';

const BUCKET = 'crew-documents';
const SIGNED_URL_TTL = 3600; // 1 hour

// GET /api/crew/documents
// Returns the employee's documents with server-generated signed URLs for
// Supabase Storage files. Legacy Google Drive links are passed through as-is.
export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'employee' && authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Employee access required' }, { status: 403 });
  }

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;

  const { data: employee } = await db
    .from('employees')
    .select('id')
    .eq('user_id', authUser.id)
    .single();

  if (!employee) return NextResponse.json({ documents: [] });

  const { data: documents, error } = await db
    .from('employee_documents')
    .select('id, doc_type, storage_path, file_url, file_name, file_size, mime_type, status, expires_at, created_at, updated_at')
    .eq('employee_id', employee.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Generate signed URLs for storage-backed files in parallel
  const docsWithUrls = await Promise.all(
    (documents || []).map(async (doc: Record<string, unknown>) => {
      if (!doc.storage_path) return { ...doc, signed_url: null };
      const { data: urlData } = await client.storage
        .from(BUCKET)
        .createSignedUrl(doc.storage_path as string, SIGNED_URL_TTL);
      return { ...doc, signed_url: urlData?.signedUrl || null };
    })
  );

  const snapshot = await syncEmployeeOnboardingState(db, employee.id);

  return NextResponse.json({ documents: docsWithUrls, onboarding: snapshot });
}
