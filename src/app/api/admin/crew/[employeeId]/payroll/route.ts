import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

// GET /api/admin/crew/[employeeId]/payroll
// Admin-only: returns full payroll/sensitive details for a crew member.
// Includes TFN, bank details, super, and right-to-work data.
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

  const { data: payroll, error } = await db
    .from('employee_payroll_details')
    .select('*')
    .eq('employee_id', employeeId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ payroll: payroll || null });
}
