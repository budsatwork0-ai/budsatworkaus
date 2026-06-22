import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import {
  campaignFactoryRunUpdateSchema,
  requireAdmin,
} from '@/lib/artifacts/server';

type RouteParams = { params: Promise<{ id: string }> };

async function loadRun(client: any, id: string) {
  const { data: run, error } = await client
    .from('campaign_factory_runs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return { error };

  const { data: links, error: linkError } = await client
    .from('campaign_factory_run_artifacts')
    .select('role,artifact_id,artifacts(*)')
    .eq('run_id', id);

  if (linkError) return { error: linkError };

  return {
    run: {
      ...run,
      artifacts: (links ?? []).map((link: any) => ({
        role: link.role,
        artifact: link.artifacts,
      })),
    },
  };
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const result = await loadRun(client as any, id);
  if (result.error) {
    if (result.error.code === 'PGRST116') return NextResponse.json({ error: 'Campaign Factory run not found' }, { status: 404 });
    console.error('[api/campaign-factory/runs/[id]] GET:', result.error.message);
    return NextResponse.json({ error: 'Failed to fetch Campaign Factory run' }, { status: 500 });
  }

  return NextResponse.json(result.run);
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  let parsed: ReturnType<typeof campaignFactoryRunUpdateSchema.parse>;
  try {
    parsed = campaignFactoryRunUpdateSchema.parse(await req.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid request body' }, { status: 400 });
  }

  if (Object.keys(parsed).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await (client as any)
    .from('campaign_factory_runs')
    .update(parsed)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Campaign Factory run not found' }, { status: 404 });
    console.error('[api/campaign-factory/runs/[id]] PUT:', error.message);
    return NextResponse.json({ error: 'Failed to update Campaign Factory run' }, { status: 500 });
  }

  return NextResponse.json(data);
}
