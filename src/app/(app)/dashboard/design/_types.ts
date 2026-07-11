export type DesignAudit = {
  id: string;
  audit_date: string;
  overall_score: number;
  score_label: string;
  area_scores: Record<string, number>;
  executive_summary: string | null;
  violation_count: number;
  p0_count: number;
  p1_count: number;
  quick_wins: string[] | null;
};

export type DesignViolation = {
  id: string;
  audit_id: string | null;
  violation_id: string;
  area: string;
  title: string;
  severity: string;
  priority: string;
  component: string | null;
  violation_type: string;
  description: string | null;
  proposed_fix: string | null;
  affected_files: string[] | null;
  effort: string | null;
  backlinks: string[] | null;
  status: string;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
};

export type TokenOverrides = {
  brand?: Partial<Record<string, string>>;
  glass?: string;
  glassSoft?: string;
};
