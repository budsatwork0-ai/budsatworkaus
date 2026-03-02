import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/applicants/:id
export async function GET(_req: NextRequest, context: RouteContext) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authUser.role !== 'admin' && authUser.role !== 'employee') {
    return NextResponse.json({ error: 'Admin or employee access required' }, { status: 403 });
  }

  const { id } = await context.params;
  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  // Note: cast to 'any' until `supabase gen types` is re-run after migration 005
  const { data, error } = await (client as any)
    .from('applicants')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 });
  }

  return NextResponse.json({ applicant: data });
}

// PATCH /api/applicants/:id - Update stage, owner, notes, missing_docs, etc.
export async function PATCH(req: NextRequest, context: RouteContext) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authUser.role !== 'admin' && authUser.role !== 'employee') {
    return NextResponse.json({ error: 'Admin or employee access required' }, { status: 403 });
  }

  const { id } = await context.params;
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

  if (body.stage) {
    const validStages = ['intake', 'verify', 'paperwork', 'induct', 'ready'];
    if (!validStages.includes(body.stage as string)) {
      return NextResponse.json({ error: `stage must be one of: ${validStages.join(', ')}` }, { status: 400 });
    }
  }

  const { data, error } = await (client as any)
    .from('applicants')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 });
  }

  return NextResponse.json({ applicant: data });
}

// DELETE /api/applicants/:id
export async function DELETE(_req: NextRequest, context: RouteContext) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await context.params;
  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const { error } = await (client as any)
    .from('applicants')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
