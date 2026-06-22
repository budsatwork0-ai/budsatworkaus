import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import {
  campaignFactoryRunCreateSchema,
  parseRunStatus,
  requireAdmin,
} from '@/lib/artifacts/server';

async function attachArtifacts(client: any, runs: any[]) {
  if (runs.length === 0) return [];
  const runIds = runs.map((run) => run.id);
  const { data: links, error } = await client
    .from('campaign_factory_run_artifacts')
    .select('run_id,role,artifact_id,artifacts(*)')
    .in('run_id', runIds);

  if (error) throw error;

  const byRun = new Map<string, any[]>();
  for (const link of links ?? []) {
    byRun.set(link.run_id, [...(byRun.get(link.run_id) ?? []), link]);
  }

  return runs.map((run) => ({
    ...run,
    artifacts: (byRun.get(run.id) ?? []).map((link) => ({
      role: link.role,
      artifact: link.artifacts,
    })),
  }));
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const status = parseRunStatus(searchParams.get('status'));

  let query = (client as any)
    .from('campaign_factory_runs')
    .select('*')
    .order('updated_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    console.error('[api/campaign-factory/runs] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch Campaign Factory runs' }, { status: 500 });
  }

  try {
    return NextResponse.json({ runs: await attachArtifacts(client as any, data ?? []) });
  } catch (linkError) {
    console.error('[api/campaign-factory/runs] links:', linkError);
    return NextResponse.json({ error: 'Failed to fetch run artifacts' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  let parsed: ReturnType<typeof campaignFactoryRunCreateSchema.parse>;
  try {
    parsed = campaignFactoryRunCreateSchema.parse(await req.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid request body' }, { status: 400 });
  }

  const { data, error } = await (client as any)
    .from('campaign_factory_runs')
    .insert({
      ...parsed,
      created_by: auth.authUser.id,
    })
    .select()
    .single();

  if (error) {
    console.error('[api/campaign-factory/runs] POST:', error.message);
    return NextResponse.json({ error: 'Failed to create Campaign Factory run' }, { status: 500 });
  }

  return NextResponse.json({ ...data, artifacts: [] }, { status: 201 });
}
