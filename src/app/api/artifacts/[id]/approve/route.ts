import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import {
  artifactApproveSchema,
  buildArtifactLibraryItem,
  requireAdmin,
  upsertArtifactLibraryItem,
} from '@/lib/artifacts/server';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  let parsed: ReturnType<typeof artifactApproveSchema.parse>;
  try {
    parsed = artifactApproveSchema.parse(await req.json());
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
    console.error('[api/artifacts/[id]/approve] artifact:', artifactError.message);
    return NextResponse.json({ error: 'Failed to fetch artifact' }, { status: 500 });
  }

  const versionId = parsed.version_id ?? artifact.latest_version_id;
  if (!versionId) return NextResponse.json({ error: 'Artifact has no version to approve' }, { status: 400 });

  const { data: version, error: versionError } = await (client as any)
    .from('artifact_versions')
    .select('id')
    .eq('id', versionId)
    .eq('artifact_id', id)
    .single();

  if (versionError || !version) {
    return NextResponse.json({ error: 'Artifact version not found' }, { status: 404 });
  }

  const metadata = {
    ...(artifact.metadata ?? {}),
    approval_note: parsed.approval_note ?? (artifact.metadata ?? {}).approval_note,
  };

  const { data: updatedArtifact, error } = await (client as any)
    .from('artifacts')
    .update({
      status: 'approved',
      approved_version_id: versionId,
      approved_by: auth.authUser.id,
      approved_at: new Date().toISOString(),
      metadata,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[api/artifacts/[id]/approve] update:', error.message);
    return NextResponse.json({ error: 'Failed to approve artifact' }, { status: 500 });
  }

  const { error: libraryError } = await upsertArtifactLibraryItem(
    client as any,
    buildArtifactLibraryItem({
      artifactId: updatedArtifact.id,
      type: updatedArtifact.type,
      title: updatedArtifact.title,
      summary: updatedArtifact.summary,
      status: updatedArtifact.status,
    }),
  );

  if (libraryError) {
    console.error('[api/artifacts/[id]/approve] library:', libraryError.message);
  }

  return NextResponse.json(updatedArtifact);
}
