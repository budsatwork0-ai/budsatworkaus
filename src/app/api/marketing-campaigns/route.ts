import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { type MarketingCampaignKpis, type MarketingCampaignStatus } from '@/types/marketing-campaign';

const STATUSES = new Set<MarketingCampaignStatus>(['planning', 'active', 'completed', 'archived']);

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

async function attachQueueItems(client: any, campaigns: any[]) {
  if (campaigns.length === 0) return [];
  const campaignIds = campaigns.map((campaign) => campaign.id);
  const { data: links, error } = await client
    .from('marketing_campaign_queue_items')
    .select('campaign_id,queue_item_id,marketing_publishing_queue(*)')
    .in('campaign_id', campaignIds);

  if (error) throw error;

  const linksByCampaign = new Map<string, any[]>();
  for (const link of links ?? []) {
    linksByCampaign.set(link.campaign_id, [...(linksByCampaign.get(link.campaign_id) ?? []), link]);
  }

  return campaigns.map((campaign) => {
    const campaignLinks = linksByCampaign.get(campaign.id) ?? [];
    return {
      ...campaign,
      linked_publishing_queue_items: campaignLinks.map((link) => link.queue_item_id),
      queue_items: campaignLinks.map((link) => link.marketing_publishing_queue).filter(Boolean),
    };
  });
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

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { data, error } = await (client as any)
    .from('marketing_campaigns')
    .select('*')
    .order('start_date', { ascending: true, nullsFirst: false })
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[api/marketing-campaigns] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch marketing campaigns' }, { status: 500 });
  }

  try {
    const campaigns = await attachQueueItems(client as any, data ?? []);
    return NextResponse.json({ campaigns });
  } catch (linkError) {
    console.error('[api/marketing-campaigns] GET links:', linkError);
    return NextResponse.json({ error: 'Failed to fetch campaign queue links' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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

  const name = cleanText(body.name);
  const status = (cleanText(body.status) || 'planning') as MarketingCampaignStatus;
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (!STATUSES.has(status)) return NextResponse.json({ error: 'Valid status is required' }, { status: 400 });

  const queueItemIds = cleanQueueItemIds(body.linked_publishing_queue_items);
  const insert = {
    name,
    goal:            cleanText(body.goal),
    related_arc_id:  cleanNullableText(body.related_arc_id),
    target_audience: cleanText(body.target_audience),
    channels:        cleanTextArray(body.channels),
    start_date:      cleanDate(body.start_date),
    end_date:        cleanDate(body.end_date),
    status,
    kpis:            cleanKpis(body.kpis),
    result_summary:  cleanText(body.result_summary),
    notes:           cleanText(body.notes),
  };

  const { data, error } = await (client as any)
    .from('marketing_campaigns')
    .insert(insert)
    .select()
    .single();

  if (error) {
    console.error('[api/marketing-campaigns] POST:', error.message);
    return NextResponse.json({ error: 'Failed to create marketing campaign' }, { status: 500 });
  }

  const linkError = await replaceQueueLinks(client as any, data.id, queueItemIds);
  if (linkError) {
    console.error('[api/marketing-campaigns] POST links:', linkError.message);
    await (client as any).from('marketing_campaigns').delete().eq('id', data.id);
    return NextResponse.json({ error: linkError.message }, { status: 400 });
  }

  const [campaign] = await attachQueueItems(client as any, [data]);
  return NextResponse.json(campaign, { status: 201 });
}
