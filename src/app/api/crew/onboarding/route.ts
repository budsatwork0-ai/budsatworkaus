import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

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
    .select('id, ndis_worker, onboarding_complete')
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (!employee) {
    return NextResponse.json({ error: 'Employee profile not found' }, { status: 404 });
  }

  // Get all onboarding sections
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sections } = await (client as any)
    .from('employee_onboarding')
    .select('*')
    .eq('employee_id', employee.id);

  // Get document count
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: docs } = await (client as any)
    .from('employee_documents')
    .select('id, doc_type, status')
    .eq('employee_id', employee.id);

  // Build section status map
  const allSections = ['personal', 'emergency', 'availability', 'services', 'documents'];
  if (employee.ndis_worker) allSections.push('ndis');

  const sectionMap = new Map(
    (sections || []).map((s: { section: string; completed: boolean; responses: unknown }) => [
      s.section,
      { completed: s.completed, responses: s.responses },
    ])
  );

  const result = allSections.map((section) => ({
    section,
    completed: sectionMap.has(section) ? (sectionMap.get(section) as { completed: boolean }).completed : false,
  }));

  const completedCount = result.filter((s) => s.completed).length;
  const totalCount = result.length;

  return NextResponse.json({
    sections: result,
    documents: docs || [],
    progress: { completed: completedCount, total: totalCount },
    ndisWorker: employee.ndis_worker,
    onboardingComplete: employee.onboarding_complete,
  });
}
