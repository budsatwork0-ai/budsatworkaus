import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { type PublishingPlatform, type PublishingQueueStatus } from '@/types/publishing-queue';

const PLATFORMS = new Set<PublishingPlatform>(['tiktok', 'instagram', 'facebook', 'youtube', 'linkedin', 'website']);
const STATUSES = new Set<PublishingQueueStatus>(['draft', 'ready', 'published', 'archived']);

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

function ensureConsentForStatus(status: unknown, consentVerified: unknown) {
  if ((status === 'ready' || status === 'published') && consentVerified !== true) {
    return 'Consent must be verified before an item can be Ready or Published';
  }
  return null;
}

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { data, error } = await (client as any)
    .from('marketing_publishing_queue')
    .select('*')
    .order('target_publish_at', { ascending: true, nullsFirst: false })
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[api/publishing-queue] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch publishing queue' }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
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

  const productionCardId = cleanText(body.production_card_id);
  const title = cleanText(body.title);
  const platform = cleanText(body.platform) as PublishingPlatform;
  const status = (cleanText(body.status) || 'draft') as PublishingQueueStatus;
  const consentVerified = body.consent_verified === true;

  if (!productionCardId) return NextResponse.json({ error: 'production_card_id is required' }, { status: 400 });
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });
  if (!PLATFORMS.has(platform)) return NextResponse.json({ error: 'Valid platform is required' }, { status: 400 });
  if (!STATUSES.has(status)) return NextResponse.json({ error: 'Valid status is required' }, { status: 400 });

  const consentError = ensureConsentForStatus(status, consentVerified);
  if (consentError) return NextResponse.json({ error: consentError }, { status: 400 });

  const productionError = await validateProductionCard(client as any, productionCardId);
  if (productionError) return NextResponse.json({ error: productionError }, { status: 400 });

  const insert = {
    title,
    production_card_id:  productionCardId,
    platform,
    format:              cleanText(body.format),
    related_arc_id:      cleanNullableText(body.related_arc_id),
    related_characters:  Array.isArray(body.related_characters) ? body.related_characters : [],
    target_publish_at:   cleanDateTime(body.target_publish_at),
    status,
    caption_placeholder: cleanText(body.caption_placeholder),
    consent_verified:    consentVerified,
    notes:               cleanText(body.notes),
    published_at:        status === 'published' ? (cleanDateTime(body.published_at) ?? new Date().toISOString()) : null,
  };

  const { data, error } = await (client as any)
    .from('marketing_publishing_queue')
    .insert(insert)
    .select()
    .single();

  if (error) {
    console.error('[api/publishing-queue] POST:', error.message);
    return NextResponse.json({ error: 'Failed to create publishing queue item' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
