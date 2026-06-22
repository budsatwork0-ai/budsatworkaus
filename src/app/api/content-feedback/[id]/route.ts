import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/artifacts/server';
import { createServiceClientSafe } from '@/lib/supabase/server';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { data: learningRecord, error } = await (client as any)
    .from('content_learning_records')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Learning record not found' }, { status: 404 });
    console.error('[api/content-feedback/[id]] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch learning record' }, { status: 500 });
  }

  const learningArtifact = learningRecord.learning_artifact_id
    ? await loadArtifact(client as any, learningRecord.learning_artifact_id)
    : null;

  return NextResponse.json({
    learning_record: learningRecord,
    learning_artifact: learningArtifact,
  });
}

async function loadArtifact(client: any, id: string) {
  const { data: artifact } = await client.from('artifacts').select('*').eq('id', id).single();
  if (!artifact) return null;
  const { data: versions } = await client
    .from('artifact_versions')
    .select('*')
    .eq('artifact_id', id)
    .order('version_number', { ascending: false });
  return {
    ...artifact,
    latest_version: artifact.latest_version_id
      ? (versions ?? []).find((version: any) => version.id === artifact.latest_version_id) ?? null
      : (versions ?? [])[0] ?? null,
    versions: versions ?? [],
  };
}
