import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import {
  artifactCreateSchema,
  buildArtifactLibraryItem,
  buildVersionInsert,
  parseStatus,
  parseType,
  requireAdmin,
  upsertArtifactLibraryItem,
} from '@/lib/artifacts/server';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const type = parseType(searchParams.get('type'));
  const status = parseStatus(searchParams.get('status'));
  const runId = searchParams.get('campaign_factory_run_id');

  let artifactIds: string[] | null = null;
  if (runId) {
    const { data: links, error: linkError } = await (client as any)
      .from('campaign_factory_run_artifacts')
      .select('artifact_id')
      .eq('run_id', runId);

    if (linkError) {
      console.error('[api/artifacts] GET run links:', linkError.message);
      return NextResponse.json({ error: 'Failed to fetch run artifacts' }, { status: 500 });
    }
    artifactIds = (links ?? []).map((link: any) => link.artifact_id);
    if ((artifactIds ?? []).length === 0) return NextResponse.json({ artifacts: [] });
  }

  let query = (client as any)
    .from('artifacts')
    .select('*')
    .order('updated_at', { ascending: false });

  if (type) query = query.eq('type', type);
  if (status) query = query.eq('status', status);
  if (artifactIds) query = query.in('id', artifactIds);

  const { data: artifacts, error } = await query;
  if (error) {
    console.error('[api/artifacts] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch artifacts' }, { status: 500 });
  }

  const latestIds = (artifacts ?? []).map((artifact: any) => artifact.latest_version_id).filter(Boolean);
  const versionsById = new Map<string, any>();
  if (latestIds.length > 0) {
    const { data: versions, error: versionError } = await (client as any)
      .from('artifact_versions')
      .select('*')
      .in('id', latestIds);

    if (versionError) {
      console.error('[api/artifacts] GET versions:', versionError.message);
      return NextResponse.json({ error: 'Failed to fetch artifact versions' }, { status: 500 });
    }
    for (const version of versions ?? []) versionsById.set(version.id, version);
  }

  return NextResponse.json({
    artifacts: (artifacts ?? []).map((artifact: any) => ({
      ...artifact,
      latest_version: artifact.latest_version_id ? versionsById.get(artifact.latest_version_id) ?? null : null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  let parsed: ReturnType<typeof artifactCreateSchema.parse>;
  try {
    parsed = artifactCreateSchema.parse(await req.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid request body' }, { status: 400 });
  }

  const { data: artifact, error } = await (client as any)
    .from('artifacts')
    .insert({
      type: parsed.type,
      title: parsed.title,
      summary: parsed.summary,
      status: parsed.status,
      score: parsed.score,
      metadata: parsed.metadata,
      source_context: parsed.source_context,
      created_by: auth.authUser.id,
    })
    .select()
    .single();

  if (error) {
    console.error('[api/artifacts] POST artifact:', error.message);
    return NextResponse.json({ error: 'Failed to create artifact' }, { status: 500 });
  }

  const versionInsert = buildVersionInsert({
    artifactId: artifact.id,
    versionNumber: 1,
    title: parsed.title,
    summary: parsed.summary,
    content: parsed.content,
    plainText: parsed.plain_text,
    generationInput: parsed.generation_input,
    generationModel: parsed.generation_model,
    createdBy: auth.authUser.id,
  });

  const { data: version, error: versionError } = await (client as any)
    .from('artifact_versions')
    .insert(versionInsert)
    .select()
    .single();

  if (versionError) {
    console.error('[api/artifacts] POST version:', versionError.message);
    await (client as any).from('artifacts').delete().eq('id', artifact.id);
    return NextResponse.json({ error: 'Failed to create artifact version' }, { status: 500 });
  }

  const { data: updatedArtifact, error: updateError } = await (client as any)
    .from('artifacts')
    .update({ latest_version_id: version.id })
    .eq('id', artifact.id)
    .select()
    .single();

  if (updateError) {
    console.error('[api/artifacts] POST latest version:', updateError.message);
    await (client as any).from('artifacts').delete().eq('id', artifact.id);
    return NextResponse.json({ error: 'Failed to attach artifact version' }, { status: 500 });
  }

  if (parsed.campaign_factory_run_id) {
    const { error: linkError } = await (client as any)
      .from('campaign_factory_run_artifacts')
      .insert({
        run_id: parsed.campaign_factory_run_id,
        artifact_id: artifact.id,
        role: parsed.campaign_factory_role,
      });

    if (linkError) {
      console.error('[api/artifacts] POST run link:', linkError.message);
      await (client as any).from('artifacts').delete().eq('id', artifact.id);
      return NextResponse.json({ error: 'Failed to link artifact to Campaign Factory run' }, { status: 400 });
    }
  }

  const { error: libraryError } = await upsertArtifactLibraryItem(
    client as any,
    buildArtifactLibraryItem({
      artifactId: artifact.id,
      type: parsed.type,
      title: parsed.title,
      summary: parsed.summary,
      status: parsed.status,
      tags: parsed.tags,
    }),
  );

  if (libraryError) {
    console.error('[api/artifacts] POST library:', libraryError.message);
  }

  return NextResponse.json({ ...updatedArtifact, latest_version: version }, { status: 201 });
}
