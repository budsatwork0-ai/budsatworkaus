import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { syncEmployeeOnboardingState } from '@/lib/crew-onboarding';
import { createServiceClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/crew/employees/:id/approve
// Admin-only: unlocks the crew portal once onboarding is complete.
export async function POST(_req: NextRequest, context: RouteContext) {
  const caller = await getAuthUser();
  if (!caller || caller.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await context.params;
  const client = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: employee } = await (client as any)
    .from('employees')
    .select('id, user_id, onboarding_complete, crew_access_approved, status')
    .eq('id', id)
    .single();

  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const snapshot = await syncEmployeeOnboardingState(client, employee.id);
  if (!snapshot?.readyForCrewApproval) {
    return NextResponse.json(
      { error: 'Employee has not completed all onboarding requirements yet.' },
      { status: 400 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (client as any)
    .from('employees')
    .update({
      crew_access_approved: true,
      status: 'active',
    })
    .eq('id', employee.id)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (updated.user_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any)
      .from('applicants')
      .update({
        stage: 'ready',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', updated.user_id);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client as any).from('audit_log').insert([{
    entity_type: 'employee',
    entity_id: updated.id,
    action: 'crew_access_approved',
    new_value: { crew_access_approved: true, status: 'active' },
    user_email: caller.email,
    details: `Crew access approved by ${caller.email}`,
    source: 'admin',
  }]).then(() => {}).catch(() => {});

  return NextResponse.json({ success: true, employee: updated });
}
