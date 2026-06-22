import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import {
  artifactUpdateSchema,
  buildArtifactLibraryItem,
  requireAdmin,
  upsertArtifactLibraryItem,
} from '@/lib/artifacts/server';
import { type ArtifactStatus, type ArtifactType } from '@/types/artifact';

type RouteParams = { params: Promise<{ id: string }> };

async function loadArtifactWithVersions(client: any, id: string) {
  const { data: artifact, error } = await client
    .from('artifacts')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return { error };

  const { data: versions, error: versionsError } = await client
    .from('artifact_versions')
    .select('*')
    .eq('artifact_id', id)
    .order('version_number', { ascending: false });

  if (versionsError) return { error: versionsError };

  const latest = artifact.latest_version_id
    ? (versions ?? []).find((version: any) => version.id === artifact.latest_version_id) ?? null
    : null;

  return {
    artifact: {
      ...artifact,
      latest_version: latest,
      versions: versions ?? [],
    },
  };
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const result = await loadArtifactWithVersions(client as any, id);
  if (result.error) {
    if (result.error.code === 'PGRST116') return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    console.error('[api/artifacts/[id]] GET:', result.error.message);
    return NextResponse.json({ error: 'Failed to fetch artifact' }, { status: 500 });
  }

  return NextResponse.json(result.artifact);
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  let parsed: ReturnType<typeof artifactUpdateSchema.parse>;
  try {
    parsed = artifactUpdateSchema.parse(await req.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid request body' }, { status: 400 });
  }

  if (Object.keys(parsed).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data: artifact, error } = await (client as any)
    .from('artifacts')
    .update(parsed)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    console.error('[api/artifacts/[id]] PUT:', error.message);
    return NextResponse.json({ error: 'Failed to update artifact' }, { status: 500 });
  }

  const { error: libraryError } = await upsertArtifactLibraryItem(
    client as any,
    buildArtifactLibraryItem({
      artifactId: artifact.id,
      type: artifact.type as ArtifactType,
      title: artifact.title,
      summary: artifact.summary,
      status: artifact.status as ArtifactStatus,
    }),
  );

  if (libraryError) {
    console.error('[api/artifacts/[id]] PUT library:', libraryError.message);
  }

  return NextResponse.json(artifact);
}
