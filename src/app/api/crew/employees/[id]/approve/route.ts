import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { syncEmployeeOnboardingState } from '@/lib/crew-onboarding';
import { createServiceClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/crew/employees/:id/approve
// Admin-only: unlocks the crew portal once onboarding is complete.
export async function POST(req: NextRequest, context: RouteContext) {
  const caller = await getAuthUser();
  if (!caller || caller.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await context.params;
  const client = createServiceClient();
  let setup: {
    default_role?: string | null;
    employment_type?: string | null;
    hourly_rate?: number | null;
    roster_active?: boolean | null;
  } = {};

  try {
    setup = await req.json();
  } catch {
    setup = {};
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: employee } = await (client as any)
    .from('employees')
    .select('id, user_id, onboarding_complete, crew_access_approved, roster_active, status')
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

  const nextStatus = setup.roster_active === false ? 'inactive' : 'active';
  const updatePayload: Record<string, unknown> = {
    crew_access_approved: true,
    status: nextStatus,
  };
  if (typeof setup.default_role === 'string' && setup.default_role.trim()) {
    updatePayload.default_role = setup.default_role.trim();
  }
  if (typeof setup.employment_type === 'string' && setup.employment_type.trim()) {
    updatePayload.employment_type = setup.employment_type.trim();
  }
  if (typeof setup.hourly_rate === 'number' && Number.isFinite(setup.hourly_rate)) {
    updatePayload.hourly_rate = setup.hourly_rate;
  }
  if (typeof setup.roster_active === 'boolean') {
    updatePayload.roster_active = setup.roster_active;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (client as any)
    .from('employees')
    .update(updatePayload)
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
    new_value: { crew_access_approved: true, status: nextStatus },
    user_email: caller.email,
    details: `Crew access approved by ${caller.email}`,
    source: 'admin',
  }]).then(() => {}).catch(() => {});

  return NextResponse.json({ success: true, employee: updated });
}
