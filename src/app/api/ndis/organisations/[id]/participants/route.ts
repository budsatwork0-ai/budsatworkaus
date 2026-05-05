import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

type Params = { params: Promise<{ id: string }> };

// GET /api/ndis/organisations/[id]/participants
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;
  const client = createServiceClientSafe() as AnyClient;
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { data, error } = await client
    .from('ndis_participants')
    .select('*')
    .eq('organisation_id', id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ participants: data || [] });
}

// POST /api/ndis/organisations/[id]/participants — add participant to org
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;
  const client = createServiceClientSafe() as AnyClient;
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const { full_name, email, phone, ndis_number, date_of_birth, notes } = body;

  if (!full_name || !email) {
    return NextResponse.json({ error: 'full_name and email are required' }, { status: 400 });
  }

  const { data, error } = await client
    .from('ndis_participants')
    .insert([{ organisation_id: id, full_name, email, phone, ndis_number, date_of_birth, notes }])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A participant with this email already exists in this organisation' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ participant: data }, { status: 201 });
}
