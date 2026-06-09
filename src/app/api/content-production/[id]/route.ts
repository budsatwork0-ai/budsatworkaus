import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { logPipelineEvent } from '@/lib/growth/pipeline-events';

const PUBLISHING_PLATFORMS = new Set([
  'tiktok', 'instagram', 'facebook', 'youtube', 'linkedin', 'website',
]);

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

  // ── Post-update: auto-create Publishing Queue item when ready_to_publish ──────
  // Idempotency: checks for an existing queue item for this card before inserting.
  // Only creates if card platform is a valid publishing platform.
  // Wrapped in try/catch — status update never fails due to queue creation errors.
  if (update.status === 'ready_to_publish' && data) {
    createQueueItemIfAbsent(client as any, data).catch((err) =>
      console.error('[api/content-production/[id]] PUT queue creation error (non-fatal):', err),
    );
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

// ── Publishing Queue creation helper ──────────────────────────────────────────

async function createQueueItemIfAbsent(client: any, card: any): Promise<void> {
  // Validate platform is publishable.
  const platform: string = card.platform ?? '';
  if (!PUBLISHING_PLATFORMS.has(platform)) {
    console.warn(
      `[content-production/[id]] Skipping queue creation — platform '${platform}' is not a valid publishing platform`,
    );
    return;
  }

  // Idempotency: if any queue item already exists for this card, skip.
  const { data: existing } = await client
    .from('marketing_publishing_queue')
    .select('id')
    .eq('production_card_id', card.id)
    .limit(1)
    .maybeSingle();

  if (existing) return;

  // Auto-created item starts as draft with consent unverified.
  // Jackson must review consent and move to 'ready' before publishing.
  const { data: queueItem, error: queueErr } = await client
    .from('marketing_publishing_queue')
    .insert({
      title:              card.title,
      production_card_id: card.id,
      platform,
      format:             card.format ?? '',
      related_arc_id:     card.related_arc_id ?? null,
      related_characters: Array.isArray(card.related_characters) ? card.related_characters : [],
      status:             'draft',
      caption_placeholder: '',
      consent_verified:   false,
      auto_created:       true,
      notes:              'Auto-created when production card moved to Ready to Publish. Verify consent before publishing.',
    })
    .select('id')
    .single();

  if (queueErr) {
    console.error('[content-production/[id]] queue item insert error:', queueErr.message);
    return;
  }

  await logPipelineEvent(client, {
    event_type:  'queue_item_created',
    source_type: 'production_card',
    source_id:   card.id,
    result_type: 'publishing_queue_item',
    result_id:   queueItem.id,
    metadata:    { platform, auto_created: true, card_title: card.title },
  });
}
