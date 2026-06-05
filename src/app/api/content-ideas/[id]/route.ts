import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

const UPDATABLE = [
  'title',
  'opportunity_id',
  'related_arc_id',
  'related_characters',
  'platform_fit',
  'format',
  'hook',
  'content_angle',
  'status',
  'priority',
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

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { data, error } = await (client as any)
    .from('content_ideas')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Content idea not found' }, { status: 404 });
    console.error('[api/content-ideas/[id]] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch content idea' }, { status: 500 });
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
    if (key === 'opportunity_id' || key === 'related_arc_id') update[key] = cleanNullableText(body[key]);
    else if (key === 'related_characters') update[key] = Array.isArray(body[key]) ? body[key] : [];
    else if (key === 'priority') update[key] = typeof body[key] === 'number' ? body[key] : 0;
    else update[key] = cleanText(body[key]);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await (client as any)
    .from('content_ideas')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Content idea not found' }, { status: 404 });
    console.error('[api/content-ideas/[id]] PUT:', error.message);
    return NextResponse.json({ error: 'Failed to update content idea' }, { status: 500 });
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
    .from('content_ideas')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[api/content-ideas/[id]] DELETE:', error.message);
    return NextResponse.json({ error: 'Failed to delete content idea' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
