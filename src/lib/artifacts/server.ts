import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser } from '@/lib/auth';
import {
  ARTIFACT_BLOCK_TYPES,
  ARTIFACT_STATUSES,
  ARTIFACT_TYPES,
  DEFAULT_ARTIFACT_RENDER_POLICY,
  type ArtifactContent,
  type ArtifactStatus,
  type ArtifactType,
} from '@/types/artifact';
import { CAMPAIGN_FACTORY_RUN_STATUSES, type CampaignFactoryRunStatus } from '@/types/campaign-factory';

export const artifactContentSchema = z.object({
  schemaVersion: z.literal('artifact.v1'),
  artifactType: z.enum(ARTIFACT_TYPES),
  blocks: z.array(z.object({
    id: z.string().min(1),
    type: z.enum(ARTIFACT_BLOCK_TYPES),
    title: z.string().optional(),
    data: z.record(z.string(), z.unknown()),
  })).min(1),
});

export const jsonObjectSchema = z.record(z.string(), z.unknown());

export const artifactCreateSchema = z.object({
  type: z.enum(ARTIFACT_TYPES),
  title: z.string().trim().min(1),
  summary: z.string().trim().optional().default(''),
  status: z.enum(ARTIFACT_STATUSES).optional().default('draft'),
  score: z.number().min(0).max(100).nullable().optional().default(null),
  metadata: jsonObjectSchema.optional().default({}),
  source_context: jsonObjectSchema.optional().default({}),
  content: artifactContentSchema,
  plain_text: z.string().optional().nullable().default(null),
  generation_input: jsonObjectSchema.optional().default({}),
  generation_model: z.string().trim().optional().nullable().default(null),
  campaign_factory_run_id: z.string().uuid().optional().nullable(),
  campaign_factory_role: z.enum(['primary', 'supporting', 'approved_output']).optional().default('primary'),
  tags: z.array(z.string().trim().min(1)).optional().default([]),
});

export const artifactVersionCreateSchema = z.object({
  title: z.string().trim().min(1),
  summary: z.string().trim().optional().default(''),
  content: artifactContentSchema,
  plain_text: z.string().optional().nullable().default(null),
  generation_input: jsonObjectSchema.optional().default({}),
  generation_model: z.string().trim().optional().nullable().default(null),
  tags: z.array(z.string().trim().min(1)).optional().default([]),
});

export const artifactUpdateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  summary: z.string().trim().optional(),
  status: z.enum(ARTIFACT_STATUSES).optional(),
  score: z.number().min(0).max(100).nullable().optional(),
  metadata: jsonObjectSchema.optional(),
  source_context: jsonObjectSchema.optional(),
});

export const artifactApproveSchema = z.object({
  version_id: z.string().uuid().optional(),
  approval_note: z.string().trim().optional(),
});

export const campaignFactoryRunCreateSchema = z.object({
  goal: z.string().trim().min(1),
  title: z.string().trim().optional().default(''),
  status: z.enum(CAMPAIGN_FACTORY_RUN_STATUSES).optional().default('draft'),
  current_step: z.string().trim().optional().default('goal'),
  selected_story_opportunity_id: z.string().uuid().optional().nullable().default(null),
  campaign_id: z.string().uuid().optional().nullable().default(null),
  signals: jsonObjectSchema.optional().default({}),
  research_summary: jsonObjectSchema.optional().default({}),
  strategy: jsonObjectSchema.optional().default({}),
  approval_state: jsonObjectSchema.optional().default({}),
});

export const campaignFactoryRunUpdateSchema = z.object({
  goal: z.string().trim().min(1).optional(),
  title: z.string().trim().optional(),
  status: z.enum(CAMPAIGN_FACTORY_RUN_STATUSES).optional(),
  current_step: z.string().trim().optional(),
  selected_story_opportunity_id: z.string().uuid().nullable().optional(),
  campaign_id: z.string().uuid().nullable().optional(),
  signals: jsonObjectSchema.optional(),
  research_summary: jsonObjectSchema.optional(),
  strategy: jsonObjectSchema.optional(),
  approval_state: jsonObjectSchema.optional(),
});

export const campaignFactoryRunApproveSchema = z.object({
  approval_state: jsonObjectSchema.optional().default({}),
  status: z.enum(['approved', 'rejected']).optional().default('approved'),
});

export async function requireAdmin() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (authUser.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }
  return { authUser };
}

export function checksumForContent(value: unknown) {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

export function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = sortJson((value as Record<string, unknown>)[key]);
      return acc;
    }, {});
}

export function buildVersionInsert(input: {
  artifactId: string;
  versionNumber: number;
  title: string;
  summary: string;
  content: ArtifactContent;
  plainText: string | null;
  generationInput: Record<string, unknown>;
  generationModel: string | null;
  createdBy: string | null;
}) {
  return {
    artifact_id: input.artifactId,
    version_number: input.versionNumber,
    schema_version: input.content.schemaVersion,
    title: input.title,
    summary: input.summary,
    content: input.content,
    plain_text: input.plainText,
    renderer: 'structured_react',
    render_policy: DEFAULT_ARTIFACT_RENDER_POLICY,
    generation_input: input.generationInput,
    generation_model: input.generationModel,
    checksum: checksumForContent(input.content),
    created_by: input.createdBy,
  };
}

export function buildArtifactLibraryItem(input: {
  artifactId: string;
  type: ArtifactType;
  title: string;
  summary: string;
  status: ArtifactStatus;
  tags?: string[];
  campaignId?: string | null;
}) {
  const tags = [...new Set([input.type, ...(input.tags ?? [])].map((tag) => tag.trim()).filter(Boolean))];
  return {
    item_type: 'artifact',
    source_table: 'artifacts',
    source_id: input.artifactId,
    title: input.title,
    summary: input.summary,
    campaign_id: input.campaignId ?? null,
    artifact_id: input.artifactId,
    platform: null,
    status: input.status,
    tags,
    performance: {},
    searchable_text: [input.title, input.summary, input.type, ...tags].filter(Boolean).join(' '),
  };
}

export async function upsertArtifactLibraryItem(client: any, item: ReturnType<typeof buildArtifactLibraryItem>) {
  return client
    .from('content_library_items')
    .upsert(item, { onConflict: 'source_table,source_id' });
}

export async function createStructuredArtifact(input: {
  client: any;
  type: ArtifactType;
  title: string;
  summary: string;
  status?: ArtifactStatus;
  score?: number | null;
  metadata?: Record<string, unknown>;
  sourceContext?: Record<string, unknown>;
  content: ArtifactContent;
  plainText?: string | null;
  generationInput?: Record<string, unknown>;
  generationModel?: string | null;
  createdBy: string | null;
  campaignFactoryRunId?: string | null;
  campaignFactoryRole?: 'primary' | 'supporting' | 'approved_output';
  tags?: string[];
}) {
  const status = input.status ?? 'draft';
  const { data: artifact, error } = await input.client
    .from('artifacts')
    .insert({
      type: input.type,
      title: input.title,
      summary: input.summary,
      status,
      score: input.score ?? null,
      metadata: input.metadata ?? {},
      source_context: input.sourceContext ?? {},
      created_by: input.createdBy,
    })
    .select()
    .single();

  if (error) return { error };

  const { data: version, error: versionError } = await input.client
    .from('artifact_versions')
    .insert(buildVersionInsert({
      artifactId: artifact.id,
      versionNumber: 1,
      title: input.title,
      summary: input.summary,
      content: input.content,
      plainText: input.plainText ?? null,
      generationInput: input.generationInput ?? {},
      generationModel: input.generationModel ?? null,
      createdBy: input.createdBy,
    }))
    .select()
    .single();

  if (versionError) {
    await input.client.from('artifacts').delete().eq('id', artifact.id);
    return { error: versionError };
  }

  const { data: updatedArtifact, error: updateError } = await input.client
    .from('artifacts')
    .update({ latest_version_id: version.id })
    .eq('id', artifact.id)
    .select()
    .single();

  if (updateError) {
    await input.client.from('artifacts').delete().eq('id', artifact.id);
    return { error: updateError };
  }

  if (input.campaignFactoryRunId) {
    const { error: linkError } = await input.client
      .from('campaign_factory_run_artifacts')
      .insert({
        run_id: input.campaignFactoryRunId,
        artifact_id: artifact.id,
        role: input.campaignFactoryRole ?? 'supporting',
      });

    if (linkError) {
      await input.client.from('artifacts').delete().eq('id', artifact.id);
      return { error: linkError };
    }
  }

  const { error: libraryError } = await upsertArtifactLibraryItem(
    input.client,
    buildArtifactLibraryItem({
      artifactId: artifact.id,
      type: input.type,
      title: input.title,
      summary: input.summary,
      status,
      tags: input.tags,
    }),
  );

  if (libraryError) {
    console.error('[createStructuredArtifact] library index:', libraryError.message);
  }

  return { artifact: { ...updatedArtifact, latest_version: version } };
}

export function parseStatus(value: string | null): ArtifactStatus | null {
  return value && (ARTIFACT_STATUSES as readonly string[]).includes(value) ? value as ArtifactStatus : null;
}

export function parseType(value: string | null): ArtifactType | null {
  return value && (ARTIFACT_TYPES as readonly string[]).includes(value) ? value as ArtifactType : null;
}

export function parseRunStatus(value: string | null): CampaignFactoryRunStatus | null {
  return value && (CAMPAIGN_FACTORY_RUN_STATUSES as readonly string[]).includes(value)
    ? value as CampaignFactoryRunStatus
    : null;
}
