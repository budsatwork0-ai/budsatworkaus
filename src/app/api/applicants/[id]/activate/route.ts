import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/applicants/:id/activate
// Admin-only: invites an employee account from an approved applicant
// and seeds onboarding draft responses.
export async function POST(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const caller = await getAuthUser();
  if (!caller || caller.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const client = createServiceClient();
  let setup: {
    default_role?: string | null;
    employment_type?: string | null;
    hourly_rate?: number | null;
    roster_active?: boolean | null;
  } = {};

  try {
    setup = await _req.json();
  } catch {
    setup = {};
  }

  // 1. Fetch the applicant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: applicant, error: fetchErr } = await (client as any)
    .from('applicants')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !applicant) {
    return NextResponse.json({ error: 'Applicant not found' }, { status: 404 });
  }

  if (applicant.user_id) {
    return NextResponse.json({ error: 'Applicant already activated' }, { status: 409 });
  }

  // 2. Invite auth user (invite email with secure set-password link)
  const inviteRedirect = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
    : undefined;
  const { data: authData, error: authErr } = await client.auth.admin.inviteUserByEmail(
    applicant.email,
    {
      data: { full_name: applicant.full_name },
      redirectTo: inviteRedirect,
    }
  );

  if (authErr) {
    return NextResponse.json(
      { error: `Failed to invite auth user: ${authErr.message}` },
      { status: 500 },
    );
  }

  if (!authData.user?.id) {
    return NextResponse.json({ error: 'Invite failed: no user id returned' }, { status: 500 });
  }

  const userId = authData.user.id;

  // 3. Ensure auth metadata + profile are tagged as employee
  await client.auth.admin.updateUserById(userId, {
    app_metadata: { role: 'employee' },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client as any).from('profiles').upsert({
    id: userId,
    full_name: applicant.full_name,
    email: applicant.email,
    role: 'employee',
  });

  // 4. Create employee record with data from the application (onboarding not complete)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: employee, error: empErr } = await (client as any)
    .from('employees')
    .insert({
      user_id: userId,
      full_name: applicant.full_name,
      email: applicant.email,
      phone: applicant.phone || null,
      suburb: applicant.suburb || null,
      availability: applicant.availability || [],
      services: applicant.services || [],
      ndis_worker: applicant.ndis_participant || false,
      onboarding_complete: false,
      crew_access_approved: false,
      default_role: typeof setup.default_role === 'string' && setup.default_role.trim() ? setup.default_role.trim() : null,
      employment_type: typeof setup.employment_type === 'string' && setup.employment_type.trim() ? setup.employment_type.trim() : 'casual',
      hourly_rate: typeof setup.hourly_rate === 'number' && Number.isFinite(setup.hourly_rate) ? setup.hourly_rate : 25,
      roster_active: setup.roster_active ?? true,
      status: 'inactive',
    })
    .select()
    .single();

  if (empErr) {
    return NextResponse.json(
      { error: `Failed to create employee: ${empErr.message}` },
      { status: 500 },
    );
  }

  // 5. Pre-populate onboarding sections as draft responses
  const sections: Array<{ section: string; responses: Record<string, unknown> }> = [
    {
      section: 'personal',
      responses: {
        full_name: applicant.full_name,
        phone: applicant.phone || '',
        suburb: applicant.suburb || '',
      },
    },
    {
      section: 'availability',
      responses: {
        availability: applicant.availability || [],
      },
    },
    {
      section: 'services',
      responses: {
        services: applicant.services || [],
        years_experience: applicant.years_experience ?? '',
        abn: applicant.abn || '',
      },
    },
    {
      section: 'emergency',
      responses: {},
    },
    {
      section: 'documents',
      responses: {},
    },
  ];
  if (applicant.ndis_participant) {
    sections.push({
      section: 'ndis',
      responses: {
        ndis_number: applicant.ndis_number || '',
        ndis_funding_type: applicant.ndis_funding_type || '',
      },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client as any).from('employee_onboarding').upsert(
    sections.map(({ section, responses }) => ({
      employee_id: employee.id,
      section: section as string,
      completed: false,
      responses,
    })),
    { onConflict: 'employee_id,section' }
  );

  // 6. Link applicant to the invited user and move pipeline to induct
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client as any)
    .from('applicants')
    .update({
      user_id: userId,
      stage: 'induct',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  return NextResponse.json({
    success: true,
    userId,
    employeeId: employee.id,
    email: applicant.email,
    message: `Invite sent to ${applicant.email}. Employee must complete onboarding before activation.`,
  });
}
