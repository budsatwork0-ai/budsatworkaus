import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { WorkbenchHeader } from '../../components/Workbench';
import {
  type ContentLibraryCampaignHistoryItem,
  type ContentLibraryItem,
  type ContentLibraryItemWithMemory,
  type ContentLibraryLearningSummary,
  type ContentLibraryVersionSummary,
} from '@/types/content-library';
import { ContentLibraryClient } from './ContentLibraryClient';

export default async function ContentLibraryPage() {
  const authUser = await getAuthUser();
  const client = authUser?.role === 'admin' ? createServiceClientSafe() : null;
  const items = client ? await loadContentLibraryItems(client as any) : [];

  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Content"
        title="Content Library"
        description="Search, preserve, and reuse generated artifacts, campaign history, versions, performance metadata, and organisational memory."
      />
      <ContentLibraryClient initialItems={items} />
    </div>
  );
}

async function loadContentLibraryItems(client: any): Promise<ContentLibraryItemWithMemory[]> {
  const { data: items, error } = await client
    .from('content_library_items')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[content/library] items:', error.message);
    return [];
  }

  const artifactIds = (items ?? []).map((item: ContentLibraryItem) => item.artifact_id).filter(Boolean) as string[];
  const [versionSummaries, campaignHistory] = await Promise.all([
    loadVersionSummaries(client, artifactIds),
    loadCampaignHistory(client, artifactIds),
  ]);
  const learningRecords = await loadLearningRecords(client, artifactIds);

  return (items ?? []).map((item: ContentLibraryItem) => ({
    ...item,
    version_visibility: item.artifact_id ? versionSummaries.get(item.artifact_id) ?? null : null,
    campaign_history: item.artifact_id ? campaignHistory.get(item.artifact_id) ?? [] : [],
    learning_records: item.artifact_id ? learningRecords.get(item.artifact_id) ?? [] : [],
  }));
}

async function loadVersionSummaries(client: any, artifactIds: string[]) {
  const byArtifactId = new Map<string, ContentLibraryVersionSummary>();
  if (artifactIds.length === 0) return byArtifactId;

  const { data: versions, error } = await client
    .from('artifact_versions')
    .select('id,artifact_id,version_number,created_at')
    .in('artifact_id', artifactIds)
    .order('version_number', { ascending: false });

  if (error) {
    console.error('[content/library] versions:', error.message);
    return byArtifactId;
  }

  for (const version of versions ?? []) {
    const current = byArtifactId.get(version.artifact_id);
    if (!current) {
      byArtifactId.set(version.artifact_id, {
        latest_version_id: version.id,
        latest_version_number: version.version_number,
        latest_version_created_at: version.created_at,
        version_count: 1,
      });
    } else {
      current.version_count += 1;
      if ((version.version_number ?? 0) > (current.latest_version_number ?? 0)) {
        current.latest_version_id = version.id;
        current.latest_version_number = version.version_number;
        current.latest_version_created_at = version.created_at;
      }
    }
  }

  return byArtifactId;
}

async function loadCampaignHistory(client: any, artifactIds: string[]) {
  const byArtifactId = new Map<string, ContentLibraryCampaignHistoryItem[]>();
  if (artifactIds.length === 0) return byArtifactId;

  const { data: links, error: linkError } = await client
    .from('campaign_factory_run_artifacts')
    .select('run_id,artifact_id,role,created_at')
    .in('artifact_id', artifactIds);

  if (linkError) {
    console.error('[content/library] run links:', linkError.message);
    return byArtifactId;
  }

  const runIds = [...new Set((links ?? []).map((link: any) => link.run_id).filter(Boolean))];
  if (runIds.length === 0) return byArtifactId;

  const { data: runs, error: runError } = await client
    .from('campaign_factory_runs')
    .select('id,title,goal,status,current_step,approved_at,created_at')
    .in('id', runIds);

  if (runError) {
    console.error('[content/library] runs:', runError.message);
    return byArtifactId;
  }

  const runsById = new Map<string, any>((runs ?? []).map((run: any) => [run.id, run]));
  for (const link of links ?? []) {
    const run = runsById.get(link.run_id);
    if (!run) continue;
    const history: ContentLibraryCampaignHistoryItem = {
      run_id: run.id,
      run_title: run.title || run.goal,
      goal: run.goal,
      status: run.status,
      current_step: run.current_step,
      role: link.role,
      approved_at: run.approved_at,
      created_at: run.created_at,
    };
    byArtifactId.set(link.artifact_id, [...(byArtifactId.get(link.artifact_id) ?? []), history]);
  }

  return byArtifactId;
}

async function loadLearningRecords(client: any, artifactIds: string[]) {
  const byArtifactId = new Map<string, ContentLibraryLearningSummary[]>();
  if (artifactIds.length === 0) return byArtifactId;

  const { data, error } = await client
    .from('content_learning_records')
    .select('id,learning_artifact_id,goal,campaign_title,outcome_score,what_worked,what_failed,status,source_artifact_ids')
    .overlaps('source_artifact_ids', artifactIds)
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[content/library] learnings:', error.message);
    return byArtifactId;
  }

  for (const record of data ?? []) {
    const summary: ContentLibraryLearningSummary = {
      id: record.id,
      learning_artifact_id: record.learning_artifact_id,
      goal: record.goal,
      campaign_title: record.campaign_title,
      outcome_score: record.outcome_score ?? {},
      what_worked: record.what_worked ?? [],
      what_failed: record.what_failed ?? [],
      status: record.status,
    };
    for (const artifactId of record.source_artifact_ids ?? []) {
      byArtifactId.set(artifactId, [...(byArtifactId.get(artifactId) ?? []), summary]);
    }
  }

  return byArtifactId;
}
