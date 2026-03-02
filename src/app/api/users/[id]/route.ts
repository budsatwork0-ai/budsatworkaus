import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/users/:id - Suspend or reactivate a staff account (admin only)
// Body: { action: 'suspend' | 'activate' }
export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const caller = await getAuthUser();
  if (!caller || caller.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body: { action: 'suspend' | 'activate' };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!['suspend', 'activate'].includes(body.action)) {
    return NextResponse.json({ error: 'action must be suspend or activate' }, { status: 400 });
  }

  const client = createServiceClient();
  const isSuspend = body.action === 'suspend';

  // Ban / unban in Supabase Auth
  const { error: authErr } = await client.auth.admin.updateUserById(id, {
    ban_duration: isSuspend ? '87600h' : 'none',
  });

  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 500 });
  }

  // Mirror status in employees table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client as any)
    .from('employees')
    .update({ status: isSuspend ? 'suspended' : 'active' })
    .eq('user_id', id);

  // Audit log
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).from('audit_log').insert([{
    entity_type: 'user',
    entity_id: id,
    action: isSuspend ? 'account_suspended' : 'account_activated',
    new_value: { status: isSuspend ? 'suspended' : 'active' },
    user_email: caller.email,
    details: `Account ${isSuspend ? 'suspended' : 'reactivated'} by ${caller.email}`,
    source: 'admin',
  }]).then(() => {}).catch(() => {});

  return NextResponse.json({ success: true, action: body.action });
}
