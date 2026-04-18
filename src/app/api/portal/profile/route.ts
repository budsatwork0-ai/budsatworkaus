import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

// GET /api/portal/profile — fetch the current customer's contact profile
export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('customers')
    .select('full_name, email, phone, region, company_name, abn, default_address')
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data ?? null });
}

// PUT /api/portal/profile — update the current customer's contact profile
export async function PUT(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Email is not editable by customers — strip it from any incoming payload.
  const allowed = ['full_name', 'phone', 'region', 'company_name', 'abn', 'default_address'];
  const updates: Record<string, string> = {};
  for (const key of allowed) {
    if (key in body && typeof body[key] === 'string') {
      updates[key] = (body[key] as string).trim();
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: custError } = await (client as any)
    .from('customers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('user_id', authUser.id);

  if (custError) {
    return NextResponse.json({ error: custError.message }, { status: 500 });
  }

  // Keep profiles.full_name in sync if name was updated.
  if (updates.full_name) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any)
      .from('profiles')
      .update({ full_name: updates.full_name, updated_at: new Date().toISOString() })
      .eq('id', authUser.id);
  }

  return NextResponse.json({ ok: true });
}
