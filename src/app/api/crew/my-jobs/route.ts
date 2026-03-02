import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

// GET /api/crew/my-jobs - List employee's accepted/in-progress jobs
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
  const date = searchParams.get('date');
  const status = searchParams.get('status');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (client as any)
    .from('job_assignments')
    .select('*, orders(*)')
    .eq('employee_id', employee.id)
    .in('status', status ? [status] : ['accepted', 'in_progress', 'completed'])
    .order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let assignments = data || [];

  // Filter by scheduled date if provided
  if (date) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assignments = assignments.filter((a: any) => a.orders?.scheduled_date === date);
  }

  return NextResponse.json({ assignments });
}
