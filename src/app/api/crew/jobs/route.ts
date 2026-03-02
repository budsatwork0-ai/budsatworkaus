import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

// GET /api/crew/jobs - List available jobs for current employee
export async function GET(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  // Get employee record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: employee } = await (client as any)
    .from('employees')
    .select('id')
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (!employee) {
    return NextResponse.json({ error: 'Employee profile not found' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const serviceType = searchParams.get('service_type');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  // Get available assignments for this employee with order details
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (client as any)
    .from('job_assignments')
    .select('*, orders(*)', { count: 'exact' })
    .eq('employee_id', employee.id)
    .eq('status', 'available')
    .order('created_at', { ascending: false });

  if (limit > 0) {
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Apply order-level filters client-side (since we're joining)
  let assignments = data || [];
  if (serviceType && serviceType !== 'all') {
    assignments = assignments.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (a: any) => a.orders?.service_type === serviceType
    );
  }
  if (dateFrom) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assignments = assignments.filter((a: any) => a.orders?.scheduled_date >= dateFrom);
  }
  if (dateTo) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assignments = assignments.filter((a: any) => a.orders?.scheduled_date <= dateTo);
  }

  return NextResponse.json({ assignments, total: count });
}
