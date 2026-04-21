import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

// GET /api/site-settings - Get all site settings
export async function GET() {
  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('site_settings')
    .select('key, value, updated_at')
    .order('key');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Convert array to object for easier consumption
  const settings: Record<string, unknown> = {};
  for (const row of data || []) {
    settings[row.key] = row.value;
  }

  return NextResponse.json({ settings, raw: data });
}

// POST /api/site-settings - Update site settings (admin only)
export async function POST(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
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

  const incomingSettings =
    body && typeof body === 'object' && body.settings && typeof body.settings === 'object'
      ? body.settings
      : body && typeof body === 'object' && 'key' in body
        ? { [String((body as Record<string, unknown>).key)]: (body as Record<string, unknown>).value }
        : null;

  if (!incomingSettings || Array.isArray(incomingSettings)) {
    return NextResponse.json({ error: 'Missing settings payload' }, { status: 400 });
  }

  // Upsert each setting
  const updates = Object.entries(incomingSettings).map(([key, value]) => ({
    key,
    value,
    updated_at: new Date().toISOString(),
    updated_by: authUser.email || authUser.id,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client as any)
    .from('site_settings')
    .upsert(updates, { onConflict: 'key' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
