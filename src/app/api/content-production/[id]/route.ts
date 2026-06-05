import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

const UPDATABLE = [
  'script_id',
  'title',
  'platform',
  'format',
  'related_arc_id',
  'related_characters',
  'deadline',
  'status',
  'notes',
] as const;

type RouteParams = { params: Promise<{ id: string }> };

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanNullableText(value: unknown): string | null {
  const text = cleanText(value);
  return text ? text : null;
}

async function requireApprovedScript(client: any, scriptId: string): Promise<boolean> {
  const { data, error } = await client
    .from('content_scripts')
    .select('id,status')
    .eq('id', scriptId)
    .single();
  return !error && data?.status === 'approved';
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { data, error } = await (client as any)
    .from('content_production_cards')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Production card not found' }, { status: 404 });
    console.error('[api/content-production/[id]] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch production card' }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  for (const key of UPDATABLE) {
    if (!(key in body)) continue;
    if (key === 'related_arc_id' || key === 'deadline') update[key] = cleanNullableText(body[key]);
    else if (key === 'related_characters') update[key] = Array.isArray(body[key]) ? body[key] : [];
    else update[key] = cleanText(body[key]);
  }

  if (typeof update.script_id === 'string' && !await requireApprovedScript(client as any, update.script_id)) {
    return NextResponse.json({ error: 'Only approved scripts can be linked to production cards' }, { status: 400 });
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await (client as any)
    .from('content_production_cards')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Production card not found' }, { status: 404 });
    console.error('[api/content-production/[id]] PUT:', error.message);
    return NextResponse.json({ error: 'Failed to update production card' }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { error } = await (client as any)
    .from('content_production_cards')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[api/content-production/[id]] DELETE:', error.message);
    return NextResponse.json({ error: 'Failed to delete production card' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
