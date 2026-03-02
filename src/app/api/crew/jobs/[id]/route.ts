import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

// GET /api/crew/jobs/[id] - Get single job assignment detail
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('job_assignments')
    .select('*, orders(*)')
    .eq('id', id)
    .eq('employee_id', employee.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  // Also get checklist template for this service type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: checklist } = await (client as any)
    .from('checklist_templates')
    .select('*')
    .eq('service_type', data.orders?.service_type)
    .eq('is_default', true)
    .maybeSingle();

  // Check if there's already a completion record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: completion } = await (client as any)
    .from('job_completions')
    .select('*')
    .eq('assignment_id', id)
    .maybeSingle();

  return NextResponse.json({ assignment: data, checklist, completion });
}

// PATCH /api/crew/jobs/[id] - Update assignment status (accept, decline, start)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
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

  let body: { status: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Get current assignment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: current } = await (client as any)
    .from('job_assignments')
    .select('*')
    .eq('id', id)
    .eq('employee_id', employee.id)
    .single();

  if (!current) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  }

  // Validate state transitions
  const validTransitions: Record<string, string[]> = {
    available: ['accepted', 'declined'],
    accepted: ['in_progress'],
    in_progress: ['completed'],
  };

  const allowed = validTransitions[current.status];
  if (!allowed || !allowed.includes(body.status)) {
    return NextResponse.json(
      { error: `Cannot transition from '${current.status}' to '${body.status}'` },
      { status: 400 }
    );
  }

  // Build update object with timestamps
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = { status: body.status };
  if (body.notes) updates.notes = body.notes;

  if (body.status === 'accepted') {
    updates.accepted_at = new Date().toISOString();
  } else if (body.status === 'in_progress') {
    updates.started_at = new Date().toISOString();
  } else if (body.status === 'completed') {
    updates.completed_at = new Date().toISOString();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('job_assignments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // If accepted, update order status to scheduled (if currently confirmed)
  if (body.status === 'accepted' && current.order_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any)
      .from('orders')
      .update({ status: 'scheduled' })
      .eq('id', current.order_id)
      .in('status', ['confirmed', 'pending']);
  }

  // If starting, update order to in_progress
  if (body.status === 'in_progress' && current.order_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any)
      .from('orders')
      .update({ status: 'in_progress' })
      .eq('id', current.order_id);
  }

  return NextResponse.json({ assignment: data });
}
