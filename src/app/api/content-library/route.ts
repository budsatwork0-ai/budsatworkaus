import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/artifacts/server';
import {
  type ContentLibraryCampaignHistoryItem,
  type ContentLibraryItem,
  type ContentLibraryItemWithMemory,
  type ContentLibraryLearningSummary,
  type ContentLibraryVersionSummary,
} from '@/types/content-library';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const itemType = searchParams.get('item_type');
  const status = searchParams.get('status');
  const campaignId = searchParams.get('campaign_id');
  const artifactId = searchParams.get('artifact_id');
  const platform = searchParams.get('platform');
  const queryText = searchParams.get('q')?.trim();

  let query = (client as any)
    .from('content_library_items')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(100);

  if (itemType) query = query.eq('item_type', itemType);
  if (status) query = query.eq('status', status);
  if (campaignId) query = query.eq('campaign_id', campaignId);
  if (artifactId) query = query.eq('artifact_id', artifactId);
  if (platform) query = query.eq('platform', platform);
  if (queryText) query = query.ilike('searchable_text', `%${queryText}%`);

  const { data, error } = await query;
  if (error) {
    console.error('[api/content-library] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch content library items' }, { status: 500 });
  }

  const items = data ?? [];
  const artifactIds = items.map((item: ContentLibraryItem) => item.artifact_id).filter(Boolean) as string[];
  const [versionSummaries, campaignHistory] = await Promise.all([
    loadVersionSummaries(client as any, artifactIds),
    loadCampaignHistory(client as any, artifactIds),
  ]);
  const learningRecords = await loadLearningRecords(client as any, artifactIds);

  if ('error' in versionSummaries) return versionSummaries.error;
  if ('error' in campaignHistory) return campaignHistory.error;
  if ('error' in learningRecords) return learningRecords.error;

  const enriched: ContentLibraryItemWithMemory[] = items.map((item: ContentLibraryItem) => ({
    ...item,
    version_visibility: item.artifact_id ? versionSummaries.byArtifactId.get(item.artifact_id) ?? null : null,
    campaign_history: item.artifact_id ? campaignHistory.byArtifactId.get(item.artifact_id) ?? [] : [],
    learning_records: item.artifact_id ? learningRecords.byArtifactId.get(item.artifact_id) ?? [] : [],
  }));

  return NextResponse.json({ items: enriched });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

  const summary = typeof body.summary === 'string' ? body.summary.slice(0, 150) : '';
  const tags = Array.isArray(body.tags) ? (body.tags as string[]).filter((t) => typeof t === 'string') : [];
  const searchableText = [title, summary, ...tags].filter(Boolean).join(' ');

  const insert = {
    title,
    summary,
    item_type:      typeof body.item_type === 'string' ? body.item_type : 'artifact',
    source_table:   'content_package',
    source_id:      crypto.randomUUID(),
    platform:       typeof body.platform === 'string' ? body.platform : null,
    status:         typeof body.status === 'string' ? body.status : 'draft',
    tags,
    performance:    {},
    searchable_text: searchableText,
  };

  const { data, error } = await (client as any)
    .from('content_library_items')
    .insert(insert)
    .select()
    .single();

  if (error) {
    console.error('[api/content-library] POST:', error.message);
    return NextResponse.json({ error: 'Failed to save to library' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

async function loadLearningRecords(client: any, artifactIds: string[]) {
  const byArtifactId = new Map<string, ContentLibraryLearningSummary[]>();
  if (artifactIds.length === 0) return { byArtifactId };

  const { data, error } = await client
    .from('content_learning_records')
    .select('id,learning_artifact_id,goal,campaign_title,outcome_score,what_worked,what_failed,status,source_artifact_ids')
    .overlaps('source_artifact_ids', artifactIds)
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[api/content-library] learnings:', error.message);
    return { error: NextResponse.json({ error: 'Failed to fetch content learnings' }, { status: 500 }) };
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

  return { byArtifactId };
}

async function loadVersionSummaries(client: any, artifactIds: string[]) {
  const byArtifactId = new Map<string, ContentLibraryVersionSummary>();
  if (artifactIds.length === 0) return { byArtifactId };

  const { data: versions, error } = await client
    .from('artifact_versions')
    .select('id,artifact_id,version_number,created_at')
    .in('artifact_id', artifactIds)
    .order('version_number', { ascending: false });

  if (error) {
    console.error('[api/content-library] versions:', error.message);
    return { error: NextResponse.json({ error: 'Failed to fetch artifact version history' }, { status: 500 }) };
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

  return { byArtifactId };
}

async function loadCampaignHistory(client: any, artifactIds: string[]) {
  const byArtifactId = new Map<string, ContentLibraryCampaignHistoryItem[]>();
  if (artifactIds.length === 0) return { byArtifactId };

  const { data: links, error: linkError } = await client
    .from('campaign_factory_run_artifacts')
    .select('run_id,artifact_id,role,created_at')
    .in('artifact_id', artifactIds);

  if (linkError) {
    console.error('[api/content-library] run links:', linkError.message);
    return { error: NextResponse.json({ error: 'Failed to fetch campaign history links' }, { status: 500 }) };
  }

  const runIds = [...new Set((links ?? []).map((link: any) => link.run_id).filter(Boolean))];
  if (runIds.length === 0) return { byArtifactId };

  const { data: runs, error: runError } = await client
    .from('campaign_factory_runs')
    .select('id,title,goal,status,current_step,approved_at,created_at')
    .in('id', runIds);

  if (runError) {
    console.error('[api/content-library] runs:', runError.message);
    return { error: NextResponse.json({ error: 'Failed to fetch campaign history' }, { status: 500 }) };
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

  return { byArtifactId };
}
