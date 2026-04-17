import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { buildEmployeeOnboardingSnapshot } from '@/lib/crew-onboarding';

// GET /api/crew/onboarding - Get all onboarding sections with completion status
export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authUser.role !== 'employee' && authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Employee access required' }, { status: 403 });
  }

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  // Get employee
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: employee } = await (client as any)
    .from('employees')
    .select('id, ndis_worker, onboarding_complete, crew_access_approved, status')
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (!employee) {
    return NextResponse.json({ error: 'Employee profile not found' }, { status: 404 });
  }

  // Get all onboarding sections
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sections } = await (client as any)
    .from('employee_onboarding')
    .select('section, completed')
    .eq('employee_id', employee.id);

  // Get document count
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: docs } = await (client as any)
    .from('employee_documents')
    .select('id, doc_type, file_url, file_name, status, created_at, expires_at')
    .eq('employee_id', employee.id)
    .order('created_at', { ascending: false });

  const snapshot = buildEmployeeOnboardingSnapshot({
    employee,
    sections: sections || [],
    documents: docs || [],
  });

  return NextResponse.json({
    ...snapshot,
    documents: docs || [],
  });
}
