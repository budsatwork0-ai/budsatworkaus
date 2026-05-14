import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

type Params = { params: Promise<{ orderId: string }> };

async function requireAdmin(authUser: { id: string } | null, client: ReturnType<typeof createServiceClientSafe>) {
  if (!authUser) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (client as any)
    .from('profiles')
    .select('role')
    .eq('id', authUser.id)
    .maybeSingle();
  return data?.role === 'admin';
}

// POST /api/ndis/jobs/[orderId]/publish
// Body: { employee_ids: string[], override_reason?: string }
// Publishes the job to selected participants, creating job_publications
// and corresponding job_assignments so the existing crew portal works.
export async function POST(req: NextRequest, { params }: Params) {
  const { orderId } = await params;
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  if (!await requireAdmin(authUser, client)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.employee_ids || !Array.isArray(body.employee_ids) || body.employee_ids.length === 0) {
    return NextResponse.json({ error: 'employee_ids is required and must be non-empty' }, { status: 400 });
  }

  const { employee_ids, override_reason } = body as {
    employee_ids: string[];
    override_reason?: string;
  };

  // Verify order exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (client as any)
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  // Upsert job_publications for each selected participant
  const pubRows = employee_ids.map((empId: string) => ({
    order_id: orderId,
    employee_id: empId,
    published_by: authUser.id,
    status: 'published',
    override_reason: override_reason ?? null,
    published_at: new Date().toISOString(),
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: pubError } = await (client as any)
    .from('job_publications')
    .upsert(pubRows, { onConflict: 'order_id,employee_id' });

  if (pubError) return NextResponse.json({ error: pubError.message }, { status: 500 });

  // Also create job_assignments (status=available) so existing Find Jobs works seamlessly.
  // Use upsert with ignoreDuplicates so we don't override an existing accepted assignment.
  const assignRows = employee_ids.map((empId: string) => ({
    order_id: orderId,
    employee_id: empId,
    status: 'available',
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client as any)
    .from('job_assignments')
    .upsert(assignRows, { onConflict: 'order_id,employee_id', ignoreDuplicates: true });

  // Update order status to reflect it has been published to participants
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client as any)
    .from('orders')
    .update({ status: 'confirmed' })
    .eq('id', orderId)
    .eq('status', 'pending');

  // Mark job_requirements as matching done
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client as any)
    .from('job_requirements')
    .update({ ndis_matching_enabled: true })
    .eq('order_id', orderId);

  return NextResponse.json({
    success: true,
    published_count: employee_ids.length,
    order_id: orderId,
  });
}

// DELETE /api/ndis/jobs/[orderId]/publish
// Body: { employee_id: string } — withdraw publication from a participant
export async function DELETE(req: NextRequest, { params }: Params) {
  const { orderId } = await params;
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  if (!await requireAdmin(authUser, client)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.employee_id) {
    return NextResponse.json({ error: 'employee_id is required' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client as any)
    .from('job_publications')
    .update({ status: 'withdrawn' })
    .eq('order_id', orderId)
    .eq('employee_id', body.employee_id);

  // Remove the corresponding job_assignment if still available
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client as any)
    .from('job_assignments')
    .delete()
    .eq('order_id', orderId)
    .eq('employee_id', body.employee_id)
    .eq('status', 'available');

  return NextResponse.json({ success: true });
}
