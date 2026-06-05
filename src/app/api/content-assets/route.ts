import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanNullableText(value: unknown): string | null {
  const text = cleanText(value);
  return text ? text : null;
}

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { data, error } = await (client as any)
    .from('content_assets')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[api/content-assets] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch content assets' }, { status: 500 });
  }

  return NextResponse.json({ assets: data ?? [] });
}

export async function POST(req: NextRequest) {
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

  const title = cleanText(body.title);
  const consentStatus = cleanText(body.consent_status) || 'unknown';
  const productionCardId = cleanNullableText(body.production_card_id);
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });
  if (consentStatus === 'denied' && productionCardId) {
    return NextResponse.json({ error: 'Denied-consent assets cannot be linked for production use' }, { status: 400 });
  }

  const insert = {
    title,
    asset_type:         cleanText(body.asset_type) || 'other',
    source_url:         cleanText(body.source_url),
    production_card_id: productionCardId,
    idea_id:            cleanNullableText(body.idea_id),
    script_id:          cleanNullableText(body.script_id),
    consent_status:     consentStatus,
    related_characters: Array.isArray(body.related_characters) ? body.related_characters : [],
    related_customer:   cleanText(body.related_customer),
    notes:              cleanText(body.notes),
  };

  const { data, error } = await (client as any)
    .from('content_assets')
    .insert(insert)
    .select()
    .single();

  if (error) {
    console.error('[api/content-assets] POST:', error.message);
    return NextResponse.json({ error: 'Failed to create content asset' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
