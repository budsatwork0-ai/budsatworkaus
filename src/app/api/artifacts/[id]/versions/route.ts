import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import {
  artifactVersionCreateSchema,
  buildArtifactLibraryItem,
  buildVersionInsert,
  requireAdmin,
  upsertArtifactLibraryItem,
} from '@/lib/artifacts/server';
import { type ArtifactStatus, type ArtifactType } from '@/types/artifact';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  let parsed: ReturnType<typeof artifactVersionCreateSchema.parse>;
  try {
    parsed = artifactVersionCreateSchema.parse(await req.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid request body' }, { status: 400 });
  }

  const { data: artifact, error: artifactError } = await (client as any)
    .from('artifacts')
    .select('*')
    .eq('id', id)
    .single();

  if (artifactError) {
    if (artifactError.code === 'PGRST116') return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    console.error('[api/artifacts/[id]/versions] artifact:', artifactError.message);
    return NextResponse.json({ error: 'Failed to fetch artifact' }, { status: 500 });
  }

  const { data: versions, error: versionListError } = await (client as any)
    .from('artifact_versions')
    .select('version_number')
    .eq('artifact_id', id)
    .order('version_number', { ascending: false })
    .limit(1);

  if (versionListError) {
    console.error('[api/artifacts/[id]/versions] version list:', versionListError.message);
    return NextResponse.json({ error: 'Failed to inspect artifact versions' }, { status: 500 });
  }

  const nextVersion = ((versions ?? [])[0]?.version_number ?? 0) + 1;
  const { data: version, error } = await (client as any)
    .from('artifact_versions')
    .insert(buildVersionInsert({
      artifactId: id,
      versionNumber: nextVersion,
      title: parsed.title,
      summary: parsed.summary,
      content: parsed.content,
      plainText: parsed.plain_text,
      generationInput: parsed.generation_input,
      generationModel: parsed.generation_model,
      createdBy: auth.authUser.id,
    }))
    .select()
    .single();

  if (error) {
    console.error('[api/artifacts/[id]/versions] POST:', error.message);
    return NextResponse.json({ error: 'Failed to create artifact version' }, { status: 500 });
  }

  const { data: updatedArtifact, error: updateError } = await (client as any)
    .from('artifacts')
    .update({
      latest_version_id: version.id,
      title: parsed.title,
      summary: parsed.summary,
      status: artifact.status === 'approved' ? 'in_review' : artifact.status,
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    console.error('[api/artifacts/[id]/versions] update artifact:', updateError.message);
    return NextResponse.json({ error: 'Failed to attach artifact version' }, { status: 500 });
  }

  const { error: libraryError } = await upsertArtifactLibraryItem(
    client as any,
    buildArtifactLibraryItem({
      artifactId: id,
      type: updatedArtifact.type as ArtifactType,
      title: updatedArtifact.title,
      summary: updatedArtifact.summary,
      status: updatedArtifact.status as ArtifactStatus,
      tags: parsed.tags,
    }),
  );

  if (libraryError) {
    console.error('[api/artifacts/[id]/versions] library:', libraryError.message);
  }

  return NextResponse.json(version, { status: 201 });
}
