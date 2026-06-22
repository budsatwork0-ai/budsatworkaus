export const ARTIFACT_TYPES = [
  'campaign',
  'research',
  'strategy',
  'story',
  'learning',
  'executive',
  'quote',
  'landing_page',
  'marketing',
  'dashboard',
  'storyboard',
] as const;

export type ArtifactType = typeof ARTIFACT_TYPES[number];

export const ARTIFACT_STATUSES = ['draft', 'in_review', 'approved', 'rejected', 'archived'] as const;
export type ArtifactStatus = typeof ARTIFACT_STATUSES[number];

export const ARTIFACT_BLOCK_TYPES = [
  'hero',
  'summary',
  'scorecard',
  'insight_list',
  'recommendation_list',
  'channel_plan',
  'timeline',
  'asset_list',
  'metric_grid',
  'decision_panel',
] as const;

export type ArtifactBlockType = typeof ARTIFACT_BLOCK_TYPES[number];

export type ArtifactRenderPolicy = {
  mode: 'structured';
  allowHtml: false;
  allowExternalAssets: false;
};

export type ArtifactBlockBase<TType extends ArtifactBlockType, TData extends Record<string, unknown>> = {
  id: string;
  type: TType;
  title?: string;
  data: TData;
};

export type ArtifactBlock = ArtifactBlockBase<ArtifactBlockType, Record<string, unknown>>;

export type ArtifactContent = {
  schemaVersion: 'artifact.v1';
  artifactType: ArtifactType;
  blocks: ArtifactBlock[];
};

export type Artifact = {
  id: string;
  type: ArtifactType;
  title: string;
  summary: string;
  status: ArtifactStatus;
  score: number | null;
  metadata: Record<string, unknown>;
  source_context: Record<string, unknown>;
  latest_version_id: string | null;
  approved_version_id: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ArtifactVersion = {
  id: string;
  artifact_id: string;
  version_number: number;
  schema_version: 'artifact.v1';
  title: string;
  summary: string;
  content: ArtifactContent;
  plain_text: string | null;
  renderer: 'structured_react';
  render_policy: ArtifactRenderPolicy;
  generation_input: Record<string, unknown>;
  generation_model: string | null;
  checksum: string;
  created_by: string | null;
  created_at: string;
};

export type ArtifactWithVersions = Artifact & {
  latest_version: ArtifactVersion | null;
  versions: ArtifactVersion[];
};

export const DEFAULT_ARTIFACT_RENDER_POLICY: ArtifactRenderPolicy = {
  mode: 'structured',
  allowHtml: false,
  allowExternalAssets: false,
};

export function isArtifactType(value: string): value is ArtifactType {
  return (ARTIFACT_TYPES as readonly string[]).includes(value);
}

export function isArtifactStatus(value: string): value is ArtifactStatus {
  return (ARTIFACT_STATUSES as readonly string[]).includes(value);
}
