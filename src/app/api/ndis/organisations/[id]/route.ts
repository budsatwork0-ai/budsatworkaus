import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

type Params = { params: Promise<{ id: string }> };

// PATCH /api/ndis/organisations/[id] — update org details
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;
  const client = createServiceClientSafe() as AnyClient;
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const allowed = ['name', 'abn', 'contact_name', 'contact_email', 'contact_phone', 'website', 'notes'];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) patch[k] = body[k];
  }

  const { data: org, error } = await client
    .from('ndis_organisations')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ organisation: org });
}

// DELETE /api/ndis/organisations/[id] — remove org + cascade participants
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;
  const client = createServiceClientSafe() as AnyClient;
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { error } = await client.from('ndis_organisations').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
