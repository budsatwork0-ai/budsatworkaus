import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import type { ApplicantInsert } from '@/types/database';
import { getAuthUser } from '@/lib/auth';

// GET /api/applicants - List applicants with optional filters
export async function GET(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authUser.role !== 'admin' && authUser.role !== 'employee') {
    return NextResponse.json({ error: 'Admin or employee access required' }, { status: 403 });
  }

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const stage = searchParams.get('stage');
  const role = searchParams.get('role');
  const search = searchParams.get('search');
  const limit = parseInt(searchParams.get('limit') || '200', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  // Note: cast to 'any' until `supabase gen types` is re-run after migration 005
  let query = (client as any)
    .from('applicants')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (stage && stage !== 'all') {
    query = query.eq('stage', stage);
  }
  if (role && role !== 'all') {
    query = query.eq('role', role);
  }
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,suburb.ilike.%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ applicants: data, total: count });
}

// POST /api/applicants - Create a new applicant from the Get Involved form
export async function POST(req: NextRequest) {
  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  let body: ApplicantInsert;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.full_name?.trim()) {
    return NextResponse.json({ error: 'full_name is required' }, { status: 400 });
  }
  if (!body.email?.trim()) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }
  if (!body.role?.trim()) {
    return NextResponse.json({ error: 'role is required' }, { status: 400 });
  }

  const validRoles = ['Casual crew', 'Support worker', 'Quality partner', 'Innovation partner'];
  if (!validRoles.includes(body.role)) {
    return NextResponse.json({ error: `role must be one of: ${validRoles.join(', ')}` }, { status: 400 });
  }

  const { data, error } = await (client as any)
    .from('applicants')
    .insert({
      ...body,
      stage: 'intake',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ applicant: data }, { status: 201 });
}
