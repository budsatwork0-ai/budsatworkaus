import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { type MarketingCampaignKpis, type MarketingCampaignStatus } from '@/types/marketing-campaign';

const UPDATABLE = [
  'name',
  'goal',
  'related_arc_id',
  'target_audience',
  'channels',
  'linked_publishing_queue_items',
  'start_date',
  'end_date',
  'status',
  'kpis',
  'result_summary',
  'notes',
] as const;

const STATUSES = new Set<MarketingCampaignStatus>(['planning', 'active', 'completed', 'archived']);

type RouteParams = { params: Promise<{ id: string }> };

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanNullableText(value: unknown): string | null {
  const text = cleanText(value);
  return text ? text : null;
}

function cleanDate(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function cleanTextArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => cleanText(item)).filter(Boolean) : [];
}

function cleanQueueItemIds(value: unknown): string[] {
  return [...new Set(cleanTextArray(value))];
}

function cleanKpis(value: unknown): MarketingCampaignKpis {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as MarketingCampaignKpis;
}

async function requireAdmin() {
  const authUser = await getAuthUser();
  if (!authUser) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (authUser.role !== 'admin') return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  return { authUser };
}

async function attachQueueItems(client: any, campaign: any) {
  const { data: links, error } = await client
    .from('marketing_campaign_queue_items')
    .select('campaign_id,queue_item_id,marketing_publishing_queue(*)')
    .eq('campaign_id', campaign.id);

  if (error) throw error;
  return {
    ...campaign,
    linked_publishing_queue_items: (links ?? []).map((link: any) => link.queue_item_id),
    queue_items: (links ?? []).map((link: any) => link.marketing_publishing_queue).filter(Boolean),
  };
}

async function replaceQueueLinks(client: any, campaignId: string, queueItemIds: string[]) {
  if (queueItemIds.length > 0) {
    const { data: queueItems, error: queueError } = await client
      .from('marketing_publishing_queue')
      .select('id')
      .in('id', queueItemIds);

    if (queueError) return queueError;
    if ((queueItems ?? []).length !== queueItemIds.length) {
      return new Error('One or more publishing queue items do not exist');
    }
  }

  const { error: deleteError } = await client
    .from('marketing_campaign_queue_items')
    .delete()
    .eq('campaign_id', campaignId);

  if (deleteError) return deleteError;
  if (queueItemIds.length === 0) return null;

  const { error: insertError } = await client
    .from('marketing_campaign_queue_items')
    .insert(queueItemIds.map((queueItemId) => ({ campaign_id: campaignId, queue_item_id: queueItemId })));

  return insertError ?? null;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { data, error } = await (client as any)
    .from('marketing_campaigns')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Marketing campaign not found' }, { status: 404 });
    console.error('[api/marketing-campaigns/[id]] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch marketing campaign' }, { status: 500 });
  }

  try {
    return NextResponse.json(await attachQueueItems(client as any, data));
  } catch (linkError) {
    console.error('[api/marketing-campaigns/[id]] GET links:', linkError);
    return NextResponse.json({ error: 'Failed to fetch campaign queue links' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  let queueItemIds: string[] | null = null;

  for (const key of UPDATABLE) {
    if (!(key in body)) continue;
    if (key === 'related_arc_id') update[key] = cleanNullableText(body[key]);
    else if (key === 'start_date' || key === 'end_date') update[key] = cleanDate(body[key]);
    else if (key === 'channels') update[key] = cleanTextArray(body[key]);
    else if (key === 'linked_publishing_queue_items') queueItemIds = cleanQueueItemIds(body[key]);
    else if (key === 'kpis') update[key] = cleanKpis(body[key]);
    else update[key] = cleanText(body[key]);
  }

  if (typeof update.status === 'string' && !STATUSES.has(update.status as MarketingCampaignStatus)) {
    return NextResponse.json({ error: 'Valid status is required' }, { status: 400 });
  }

  if (Object.keys(update).length === 0 && queueItemIds === null) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  let campaign: any;
  if (Object.keys(update).length > 0) {
    const { data, error } = await (client as any)
      .from('marketing_campaigns')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') return NextResponse.json({ error: 'Marketing campaign not found' }, { status: 404 });
      console.error('[api/marketing-campaigns/[id]] PUT:', error.message);
      return NextResponse.json({ error: 'Failed to update marketing campaign' }, { status: 500 });
    }
    campaign = data;
  } else {
    const { data, error } = await (client as any)
      .from('marketing_campaigns')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return NextResponse.json({ error: 'Marketing campaign not found' }, { status: 404 });
      return NextResponse.json({ error: 'Failed to fetch marketing campaign' }, { status: 500 });
    }
    campaign = data;
  }

  if (queueItemIds !== null) {
    const linkError = await replaceQueueLinks(client as any, id, queueItemIds);
    if (linkError) {
      console.error('[api/marketing-campaigns/[id]] PUT links:', linkError.message);
      return NextResponse.json({ error: linkError.message }, { status: 400 });
    }
  }

  return NextResponse.json(await attachQueueItems(client as any, campaign));
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { error } = await (client as any)
    .from('marketing_campaigns')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[api/marketing-campaigns/[id]] DELETE:', error.message);
    return NextResponse.json({ error: 'Failed to delete marketing campaign' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
