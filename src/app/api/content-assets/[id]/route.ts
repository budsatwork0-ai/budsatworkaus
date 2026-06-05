import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

const UPDATABLE = [
  'title',
  'asset_type',
  'source_url',
  'production_card_id',
  'idea_id',
  'script_id',
  'consent_status',
  'related_characters',
  'related_customer',
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
    .from('content_assets')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Content asset not found' }, { status: 404 });
    console.error('[api/content-assets/[id]] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch content asset' }, { status: 500 });
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
    if (key === 'production_card_id' || key === 'idea_id' || key === 'script_id') update[key] = cleanNullableText(body[key]);
    else if (key === 'related_characters') update[key] = Array.isArray(body[key]) ? body[key] : [];
    else update[key] = cleanText(body[key]);
  }

  if (update.consent_status === 'denied') {
    if (update.production_card_id) {
      return NextResponse.json({ error: 'Denied-consent assets cannot be linked for production use' }, { status: 400 });
    }
    if (!('production_card_id' in update)) {
      const { data: existing } = await (client as any)
        .from('content_assets')
        .select('production_card_id')
        .eq('id', id)
        .single();
      if (existing?.production_card_id) {
        return NextResponse.json({ error: 'Clear production card link before marking consent denied' }, { status: 400 });
      }
    }
  }
  if (update.production_card_id && !('consent_status' in update)) {
    const { data: existing } = await (client as any)
      .from('content_assets')
      .select('consent_status')
      .eq('id', id)
      .single();
    if (existing?.consent_status === 'denied') {
      return NextResponse.json({ error: 'Denied-consent assets cannot be linked for production use' }, { status: 400 });
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await (client as any)
    .from('content_assets')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Content asset not found' }, { status: 404 });
    console.error('[api/content-assets/[id]] PUT:', error.message);
    return NextResponse.json({ error: 'Failed to update content asset' }, { status: 500 });
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
    .from('content_assets')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[api/content-assets/[id]] DELETE:', error.message);
    return NextResponse.json({ error: 'Failed to delete content asset' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
