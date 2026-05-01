import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { syncEmployeeOnboardingState } from '@/lib/crew-onboarding';

const BUCKET = 'crew-documents';

// DELETE /api/crew/documents/[id]
// Crew member removes one of their own documents.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'employee' && authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Employee access required' }, { status: 403 });
  }

  const { id } = await params;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;

  const { data: employee } = await db
    .from('employees')
    .select('id')
    .eq('user_id', authUser.id)
    .single();

  if (!employee) return NextResponse.json({ error: 'Employee profile not found' }, { status: 404 });

  const { data: doc } = await db
    .from('employee_documents')
    .select('id, employee_id, storage_path')
    .eq('id', id)
    .single();

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  // Employees can only delete their own documents
  if (authUser.role !== 'admin' && doc.employee_id !== employee.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Remove storage object first
  if (doc.storage_path) {
    await client.storage.from(BUCKET).remove([doc.storage_path]);
  }

  const { error } = await db.from('employee_documents').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await syncEmployeeOnboardingState(db, employee.id);

  return NextResponse.json({ ok: true });
}
