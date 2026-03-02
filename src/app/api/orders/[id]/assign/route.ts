import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

// POST /api/orders/[id]/assign - Assign order to employee(s)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authUser.role === 'customer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: orderId } = await params;

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  let body: { employee_ids: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.employee_ids) || body.employee_ids.length === 0) {
    return NextResponse.json({ error: 'employee_ids must be a non-empty array' }, { status: 400 });
  }

  // Verify order exists
  const { data: order } = await client
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .single();

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Create job_assignment records for each employee
  const assignments = body.employee_ids.map((employeeId) => ({
    order_id: orderId,
    employee_id: employeeId,
    status: 'available',
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('job_assignments')
    .insert(assignments)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ assignments: data }, { status: 201 });
}
