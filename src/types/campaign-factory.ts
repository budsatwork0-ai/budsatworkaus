export const CAMPAIGN_FACTORY_RUN_STATUSES = [
  'draft',
  'collecting_signals',
  'researching',
  'strategizing',
  'artifact_review',
  'approved',
  'rejected',
  'archived',
] as const;

export type CampaignFactoryRunStatus = typeof CAMPAIGN_FACTORY_RUN_STATUSES[number];

export type CampaignFactoryRun = {
  id: string;
  goal: string;
  title: string;
  status: CampaignFactoryRunStatus;
  current_step: string;
  selected_story_opportunity_id: string | null;
  campaign_id: string | null;
  signals: Record<string, unknown>;
  research_summary: Record<string, unknown>;
  strategy: Record<string, unknown>;
  approval_state: Record<string, unknown>;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignFactoryRunArtifactRole = 'primary' | 'supporting' | 'approved_output';

export type CampaignFactoryRunArtifact = {
  run_id: string;
  artifact_id: string;
  role: CampaignFactoryRunArtifactRole;
  created_at: string;
};

export function isCampaignFactoryRunStatus(value: string): value is CampaignFactoryRunStatus {
  return (CAMPAIGN_FACTORY_RUN_STATUSES as readonly string[]).includes(value);
}
