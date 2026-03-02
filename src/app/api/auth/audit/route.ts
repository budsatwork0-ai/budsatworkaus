import { NextRequest, NextResponse } from 'next/server';
import { createAuthServerClient } from '@/lib/supabase/server-client';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { resolveUserRole } from '@/types/roles';

// POST /api/auth/audit
// Called client-side after a successful sign-in to write an auth event
// to the audit log. The session cookie is already set by the time this
// endpoint is hit, so we can verify the caller is authenticated.
export async function POST(req: NextRequest) {
  const supabase = await createAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action === 'sign_out' ? 'sign_out' : 'sign_in';

  const role = resolveUserRole(user.app_metadata?.role);
  const client = createServiceClientSafe();
  if (!client) {
    console.error('[audit] Service client unavailable — auth event not logged for', user.email);
    return NextResponse.json({ ok: false, error: 'Audit service unavailable' }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (client as any).from('audit_log').insert([{
    entity_type: 'auth',
    entity_id: user.id,
    action,
    new_value: { role, method: body.method ?? 'password' },
    source: 'auth',
    user_email: user.email,
  }]);

  if (insertError) {
    console.error('[audit] Failed to write auth event for', user.email, insertError.message);
    return NextResponse.json({ ok: false, error: 'Audit log failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
