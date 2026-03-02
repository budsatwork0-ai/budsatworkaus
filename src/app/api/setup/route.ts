import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// POST /api/setup - Create the very first admin account.
// Protected by: only works when zero admin profiles exist.
export async function POST(req: NextRequest) {
  let body: { full_name: string; email: string; password: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { full_name, email, password } = body;
  if (!full_name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: 'full_name, email, and password are required' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const client = createServiceClient();

  // Guard: only proceed if no admin account exists yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (client as any)
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: 'An admin account already exists. Sign in at /account instead.' },
      { status: 409 }
    );
  }

  // Create the auth user with email confirmed immediately
  const { data: userData, error: createError } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
    app_metadata: { role: 'admin' },
  });

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  const userId = userData.user.id;

  // Ensure profile row has admin role
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client as any).from('profiles').upsert({ id: userId, full_name, email, role: 'admin' });

  // Create employees record so they appear in crew management
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client as any).from('employees').insert({
    user_id: userId,
    full_name,
    email,
    status: 'active',
  }).catch(() => {});

  return NextResponse.json({ success: true });
}

// GET /api/setup - Check whether setup has already been completed
export async function GET() {
  const client = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (client as any)
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1);

  return NextResponse.json({ setupComplete: !!(data && data.length > 0) });
}
