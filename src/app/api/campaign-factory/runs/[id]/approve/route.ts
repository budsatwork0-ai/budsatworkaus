import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import {
  campaignFactoryRunApproveSchema,
  requireAdmin,
} from '@/lib/artifacts/server';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  let parsed: ReturnType<typeof campaignFactoryRunApproveSchema.parse>;
  try {
    parsed = campaignFactoryRunApproveSchema.parse(await req.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid request body' }, { status: 400 });
  }

  const { data, error } = await (client as any)
    .from('campaign_factory_runs')
    .update({
      status: parsed.status,
      approval_state: parsed.approval_state,
      approved_by: auth.authUser.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Campaign Factory run not found' }, { status: 404 });
    console.error('[api/campaign-factory/runs/[id]/approve] POST:', error.message);
    return NextResponse.json({ error: 'Failed to approve Campaign Factory run' }, { status: 500 });
  }

  return NextResponse.json(data);
}
