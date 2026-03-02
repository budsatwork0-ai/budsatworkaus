import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import type { UserRole } from '@/types/roles';
import { resolveUserRole } from '@/types/roles';

const VALID_ROLES: Array<UserRole | 'worker'> = ['admin', 'employee', 'worker', 'customer'];

// PATCH /api/users/role - Set a user's role (admin only)
export async function PATCH(req: NextRequest) {
  const caller = await getAuthUser();
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { userId: string; role: UserRole | 'worker' };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Check caller is admin.
  // Dev self-switch (for testing role UX) requires BOTH NODE_ENV=development
  // AND the explicit ALLOW_DEV_ROLE_SWITCH=true env flag, so a misconfigured
  // production deploy with NODE_ENV=development can't be exploited.
  const isDevSelfSwitch =
    process.env.NODE_ENV === 'development' &&
    process.env.ALLOW_DEV_ROLE_SWITCH === 'true' &&
    body.userId === caller.id;
  if (caller.role !== 'admin' && !isDevSelfSwitch) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  if (!body.userId || typeof body.userId !== 'string') {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }
  if (!VALID_ROLES.includes(body.role)) {
    return NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 });
  }

  const normalizedRole = resolveUserRole(body.role);

  try {
    const client = createServiceClient();

    // Update profiles table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any).from('profiles').update({ role: normalizedRole }).eq('id', body.userId);

    // Update auth.users app_metadata so JWT reflects the new role
    await client.auth.admin.updateUserById(body.userId, {
      app_metadata: { role: normalizedRole },
    });

    // Audit log — fire and forget
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).from('audit_log').insert([{
      entity_type: 'user',
      entity_id: body.userId,
      action: 'role_changed',
      new_value: { role: normalizedRole },
      user_email: caller.email,
      details: `Role changed to ${normalizedRole} by ${caller.email}`,
      source: 'admin',
    }]).then(() => {}).catch(() => {});

    return NextResponse.json({ success: true, userId: body.userId, role: normalizedRole });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update user role';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
