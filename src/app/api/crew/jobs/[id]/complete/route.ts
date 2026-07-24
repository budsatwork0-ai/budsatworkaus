import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { createCrewRepository } from '@/lib/crew/repository';

// POST /api/crew/jobs/[id]/complete - Submit job completion
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  // Resolve the minimal owned assignment and authorize its parent order
  // before parsing completion input or performing any write.
  const repository = createCrewRepository({ client });
  const { data: context } = await repository.getOwnedAssignmentContext(id, employee.id);
  const assignment = context?.assignment;

  if (!assignment) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  }

  if (assignment.status !== 'in_progress') {
    return NextResponse.json(
      { error: `Job must be in progress to complete. Current status: ${assignment.status}` },
      { status: 400 }
    );
  }

  let body: { checklist_responses?: unknown[]; notes?: string; photos?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Create completion record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: completion, error: completionError } = await (client as any)
    .from('job_completions')
    .insert([
      {
        assignment_id: id,
        checklist_responses: body.checklist_responses || [],
        notes: body.notes || null,
        photos: body.photos || [],
        completed_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (completionError) {
    return NextResponse.json({ error: completionError.message }, { status: 400 });
  }

  // Update assignment status to completed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client as any)
    .from('job_assignments')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', id);

  // Update order status to completed
  if (assignment.order_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any)
      .from('orders')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', assignment.order_id);
  }

  return NextResponse.json({ completion }, { status: 201 });
}
