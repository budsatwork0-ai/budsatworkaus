import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { buildEmployeeOnboardingSnapshot } from '@/lib/crew-onboarding';

const BUCKET = 'crew-documents';
const SIGNED_URL_TTL = 86400; // 24 hours for admin viewing

// GET /api/admin/crew/[employeeId]/documents
// Admin-only: returns all documents for an employee with signed URLs.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  const authUser = await getAuthUser();
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { employeeId } = await params;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;

  const [employeeRes, docsRes, sectionsRes] = await Promise.all([
    db.from('employees')
      .select('id, full_name, email, ndis_worker, crew_access_approved, onboarding_complete, roster_active, status')
      .eq('id', employeeId)
      .single(),
    db.from('employee_documents')
      .select('id, doc_type, storage_path, file_url, file_name, file_size, mime_type, status, expires_at, notes, reviewed_by, reviewed_at, created_at, updated_at')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false }),
    db.from('employee_onboarding')
      .select('section, completed')
      .eq('employee_id', employeeId),
  ]);

  if (!employeeRes.data) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const documents: any[] = docsRes.data || [];

  // Generate signed URLs for storage-backed files
  const docsWithUrls = await Promise.all(
    documents.map(async (doc) => {
      if (!doc.storage_path) return { ...doc, signed_url: null };
      const { data: urlData } = await client.storage
        .from(BUCKET)
        .createSignedUrl(doc.storage_path as string, SIGNED_URL_TTL);
      return { ...doc, signed_url: urlData?.signedUrl || null };
    })
  );

  const snapshot = buildEmployeeOnboardingSnapshot({
    employee: employeeRes.data,
    sections: sectionsRes.data || [],
    documents,
  });

  return NextResponse.json({
    employee: employeeRes.data,
    documents: docsWithUrls,
    onboarding: snapshot,
  });
}
