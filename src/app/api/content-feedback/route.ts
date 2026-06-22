import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/artifacts/server';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const goal = searchParams.get('goal');
  const status = searchParams.get('status');
  const campaignFactoryRunId = searchParams.get('campaign_factory_run_id');
  const campaignId = searchParams.get('campaign_id');
  const q = searchParams.get('q')?.trim();

  let query = (client as any)
    .from('content_learning_records')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(100);

  if (goal) query = query.eq('goal', goal);
  if (status) query = query.eq('status', status);
  if (campaignFactoryRunId) query = query.eq('campaign_factory_run_id', campaignFactoryRunId);
  if (campaignId) query = query.eq('campaign_id', campaignId);
  if (q) query = query.ilike('campaign_title', `%${q}%`);

  const { data, error } = await query;
  if (error) {
    console.error('[api/content-feedback] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch learning records' }, { status: 500 });
  }

  return NextResponse.json({ learning_records: data ?? [] });
}
