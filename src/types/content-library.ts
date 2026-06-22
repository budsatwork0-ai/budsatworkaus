export type ContentLibraryItem = {
  id: string;
  item_type: string;
  source_table: string;
  source_id: string;
  title: string;
  summary: string;
  campaign_id: string | null;
  artifact_id: string | null;
  platform: string | null;
  status: string;
  tags: string[];
  performance: Record<string, unknown>;
  searchable_text: string;
  created_at: string;
  updated_at: string;
};

export type ContentLibraryVersionSummary = {
  latest_version_id: string | null;
  latest_version_number: number | null;
  latest_version_created_at: string | null;
  version_count: number;
};

export type ContentLibraryCampaignHistoryItem = {
  run_id: string;
  run_title: string;
  goal: string;
  status: string;
  current_step: string;
  role: string;
  approved_at: string | null;
  created_at: string;
};

export type ContentLibraryItemWithMemory = ContentLibraryItem & {
  version_visibility: ContentLibraryVersionSummary | null;
  campaign_history: ContentLibraryCampaignHistoryItem[];
};
