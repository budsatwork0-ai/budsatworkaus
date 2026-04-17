import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

// GET /api/users - List all users with their roles (admin only)
export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const client = createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profiles, error } = await (client as any)
      .from('profiles')
      .select('id, full_name, email, role, avatar_url, created_at')
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const teamMembers = (profiles || []).map((p: any) => ({
      id: p.id,
      name: p.full_name || p.email || 'Unknown',
      email: p.email || '',
      role: p.role || 'customer',
      active: true,
      imageUrl: p.avatar_url,
    }));

    return NextResponse.json({ users: teamMembers });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch users';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/users - Invite a new staff account (admin only)
export async function POST(req: NextRequest) {
  const caller = await getAuthUser();
  if (!caller || caller.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body: { full_name: string; email: string; role: 'employee' | 'admin' };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { full_name, email, role } = body;

  if (!full_name || !email || !role) {
    return NextResponse.json({ error: 'full_name, email, and role are required' }, { status: 400 });
  }
  if (!['employee', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'role must be employee or admin' }, { status: 400 });
  }

  const client = createServiceClient();

  // Determine redirect URL for the invite email
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const redirectTo = `${siteUrl}/auth/callback?redirect=${encodeURIComponent('/account/update-password?type=invite')}`;

  // Send invite email — the user sets their own password via the link
  const { data: userData, error: createError } = await client.auth.admin.inviteUserByEmail(email, {
    data: { full_name },
    redirectTo,
  });

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  const userId = userData.user.id;

  // Tag role in app_metadata so JWT reflects it on first sign-in
  await client.auth.admin.updateUserById(userId, { app_metadata: { role } });

  // Ensure profile has correct role (trigger may default to 'customer')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client as any).from('profiles').update({ role, full_name }).eq('id', userId);

  // Create employees record so they appear in crew management
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: employee, error: empError } = await (client as any).from('employees').insert({
    user_id: userId,
    full_name,
    email,
    status: 'inactive',
    onboarding_complete: false,
    crew_access_approved: false,
  }).select().single();

  if (empError && !empError.message.includes('duplicate')) {
    console.error('Failed to create employees record:', empError.message);
  }

  // Seed empty onboarding sections so the crew portal prompts them on first login
  if (employee?.id) {
    const sections = ['personal', 'availability', 'services', 'emergency', 'documents'];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any).from('employee_onboarding').upsert(
      sections.map((section) => ({
        employee_id: employee.id,
        section,
        completed: false,
        responses: {},
      })),
      { onConflict: 'employee_id,section' }
    );
  }

  // Audit log — fire and forget
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).from('audit_log').insert([{
    entity_type: 'user',
    entity_id: userId,
    action: 'staff_account_created',
    new_value: { role, email },
    user_email: caller.email,
    details: `Staff account created for ${email} with role ${role} by ${caller.email}`,
    source: 'admin',
  }]).then(() => {}).catch(() => {});

  return NextResponse.json({ success: true, invited: true, userId, email, role });
}
