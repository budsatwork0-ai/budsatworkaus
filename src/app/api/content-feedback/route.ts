import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/artifacts/server';

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

  // Build what_worked / what_failed as arrays of LearningPoint objects
  function toPointArray(raw: unknown): Array<{ title: string; detail: string; evidence: string; signalType: string }> {
    if (!raw || typeof raw !== 'string') return [];
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ title: line, detail: line, evidence: '', signalType: 'manual' }));
  }

  const reach = typeof body.reach === 'number' ? body.reach : 0;
  const comments = typeof body.comments === 'number' ? body.comments : 0;
  const conversions = typeof body.conversions === 'number' ? body.conversions : 0;
  const lesson = typeof body.lesson === 'string' ? body.lesson.trim() : '';
  const approveImmediately = body.approve_immediately === true;
  const campaignTitle = typeof body.campaign_title === 'string' && body.campaign_title.trim()
    ? body.campaign_title.trim()
    : 'Manual';

  const insert = {
    goal:            lesson || campaignTitle,
    campaign_title:  campaignTitle,
    what_worked:     toPointArray(body.what_worked),
    what_failed:     toPointArray(body.what_failed),
    status:          approveImmediately ? 'approved' : 'draft',
    outcome_score: {
      reach,
      comments,
      conversions,
      score: reach + comments * 2 + conversions * 5,
      goal: lesson,
      primaryMetric: 'reach',
      primaryValue: reach,
      result: reach > 0 || conversions > 0 ? 'met' : 'missed',
      reason: lesson,
    },
    confidence:        0.7,
    confidence_reason: lesson || 'Manually logged',
    source_artifact_ids:    [],
    source_library_item_ids: [],
    supporting_evidence:    [],
    recommended_future_actions: [],
    results: {},
  };

  const { data, error } = await (client as any)
    .from('content_learning_records')
    .insert(insert)
    .select()
    .single();

  if (error) {
    console.error('[api/content-feedback] POST:', error.message);
    return NextResponse.json({ error: 'Failed to create learning record' }, { status: 500 });
  }

  return NextResponse.json({ learning_record: data }, { status: 201 });
}

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
