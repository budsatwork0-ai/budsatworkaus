import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { type PublishingPlatform, type PublishingQueueStatus } from '@/types/publishing-queue';

const UPDATABLE = [
  'title',
  'production_card_id',
  'platform',
  'format',
  'related_arc_id',
  'related_characters',
  'target_publish_at',
  'status',
  'caption_placeholder',
  'consent_verified',
  'notes',
  'published_at',
] as const;

const PLATFORMS = new Set<PublishingPlatform>(['tiktok', 'instagram', 'facebook', 'youtube', 'linkedin', 'website']);
const STATUSES = new Set<PublishingQueueStatus>(['draft', 'ready', 'published', 'archived']);

type RouteParams = { params: Promise<{ id: string }> };

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanNullableText(value: unknown): string | null {
  const text = cleanText(value);
  return text ? text : null;
}

function cleanDateTime(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function validateProductionCard(client: any, productionCardId: string): Promise<string | null> {
  const { data: card, error: cardError } = await client
    .from('content_production_cards')
    .select('id,script_id,status')
    .eq('id', productionCardId)
    .single();

  if (cardError || !card) return 'Production card not found';
  if (card.status !== 'ready_to_publish') return 'Production card must be Ready to Publish';

  const { data: script, error: scriptError } = await client
    .from('content_scripts')
    .select('id,status')
    .eq('id', card.script_id)
    .single();

  if (scriptError || script?.status !== 'approved') return 'Production card must have an approved linked script';

  const { data: deniedAsset, error: assetError } = await client
    .from('content_assets')
    .select('id')
    .eq('production_card_id', productionCardId)
    .eq('consent_status', 'denied')
    .limit(1)
    .maybeSingle();

  if (assetError) return 'Could not verify linked asset consent';
  if (deniedAsset) return 'Production card has a denied-consent linked asset';

  return null;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { data, error } = await (client as any)
    .from('marketing_publishing_queue')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Publishing queue item not found' }, { status: 404 });
    console.error('[api/publishing-queue/[id]] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch publishing queue item' }, { status: 500 });
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

  const { data: existing, error: existingError } = await (client as any)
    .from('marketing_publishing_queue')
    .select('production_card_id,status,consent_verified,published_at')
    .eq('id', id)
    .single();

  if (existingError) {
    if (existingError.code === 'PGRST116') return NextResponse.json({ error: 'Publishing queue item not found' }, { status: 404 });
    return NextResponse.json({ error: 'Failed to fetch publishing queue item' }, { status: 500 });
  }

  const update: Record<string, unknown> = {};
  for (const key of UPDATABLE) {
    if (!(key in body)) continue;
    if (key === 'production_card_id' || key === 'related_arc_id') update[key] = cleanNullableText(body[key]);
    else if (key === 'target_publish_at' || key === 'published_at') update[key] = cleanDateTime(body[key]);
    else if (key === 'related_characters') update[key] = Array.isArray(body[key]) ? body[key] : [];
    else if (key === 'consent_verified') update[key] = body[key] === true;
    else update[key] = cleanText(body[key]);
  }

  if (typeof update.platform === 'string' && !PLATFORMS.has(update.platform as PublishingPlatform)) {
    return NextResponse.json({ error: 'Valid platform is required' }, { status: 400 });
  }
  if (typeof update.status === 'string' && !STATUSES.has(update.status as PublishingQueueStatus)) {
    return NextResponse.json({ error: 'Valid status is required' }, { status: 400 });
  }

  const nextStatus = (update.status ?? existing.status) as PublishingQueueStatus;
  const nextConsentVerified = (update.consent_verified ?? existing.consent_verified) as boolean;
  if ((nextStatus === 'ready' || nextStatus === 'published') && nextConsentVerified !== true) {
    return NextResponse.json({ error: 'Consent must be verified before an item can be Ready or Published' }, { status: 400 });
  }

  const productionCardId = update.production_card_id ?? existing.production_card_id;
  if (typeof productionCardId !== 'string' || !productionCardId) {
    return NextResponse.json({ error: 'production_card_id is required' }, { status: 400 });
  }

  if ('production_card_id' in update) {
    const productionError = await validateProductionCard(client as any, productionCardId);
    if (productionError) return NextResponse.json({ error: productionError }, { status: 400 });
  }

  if (nextStatus === 'published' && !update.published_at && !existing.published_at) {
    update.published_at = new Date().toISOString();
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await (client as any)
    .from('marketing_publishing_queue')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Publishing queue item not found' }, { status: 404 });
    console.error('[api/publishing-queue/[id]] PUT:', error.message);
    return NextResponse.json({ error: 'Failed to update publishing queue item' }, { status: 500 });
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
    .from('marketing_publishing_queue')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[api/publishing-queue/[id]] DELETE:', error.message);
    return NextResponse.json({ error: 'Failed to delete publishing queue item' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
