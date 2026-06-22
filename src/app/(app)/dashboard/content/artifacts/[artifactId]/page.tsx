import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { ArtifactRenderer } from '@/components/artifacts/ArtifactRenderer';
import { WorkbenchHeader } from '../../../components/Workbench';
import { type ArtifactContent } from '@/types/artifact';

type PageProps = {
  params: Promise<{ artifactId: string }>;
};

export default async function ArtifactDetailPage({ params }: PageProps) {
  const { artifactId } = await params;
  const authUser = await getAuthUser();
  if (!authUser || authUser.role !== 'admin') notFound();

  const client = createServiceClientSafe();
  if (!client) notFound();

  const { data: artifact, error } = await (client as any)
    .from('artifacts')
    .select('*')
    .eq('id', artifactId)
    .single();

  if (error || !artifact) notFound();

  const { data: versions } = await (client as any)
    .from('artifact_versions')
    .select('*')
    .eq('artifact_id', artifactId)
    .order('version_number', { ascending: false });

  const latestVersion = artifact.latest_version_id
    ? (versions ?? []).find((version: any) => version.id === artifact.latest_version_id)
    : (versions ?? [])[0];

  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Artifact Engine"
        title={artifact.title}
        description={artifact.summary || 'Structured React-rendered artifact preview.'}
        actions={
          <Link
            href="/dashboard/content"
            className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
          >
            Content Home
          </Link>
        }
      />

      <div className="grid gap-3 md:grid-cols-4">
        <MetaCard label="Type" value={artifact.type} />
        <MetaCard label="Status" value={artifact.status} />
        <MetaCard label="Score" value={artifact.score === null ? '—' : String(artifact.score)} />
        <MetaCard label="Versions" value={String((versions ?? []).length)} />
      </div>

      {latestVersion ? (
        <ArtifactRenderer
          content={latestVersion.content as ArtifactContent}
          version={{
            version_number: latestVersion.version_number,
            created_at: latestVersion.created_at,
            checksum: latestVersion.checksum,
          }}
        />
      ) : (
        <div className="rounded-2xl border border-black/5 bg-white p-6 text-sm text-slate-500">
          This artifact does not have a version yet.
        </div>
      )}
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white/90 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
