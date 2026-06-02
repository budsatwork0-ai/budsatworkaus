import { createClient } from '@supabase/supabase-js';
import { DesignDashboardClient } from './DesignDashboardClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

async function loadData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const [auditsRes, violationsRes, settingsRes] = await Promise.all([
    supabase
      .from('design_audits')
      .select('id, audit_date, overall_score, score_label, area_scores, executive_summary, violation_count, p0_count, p1_count, quick_wins')
      .order('audit_date', { ascending: false })
      .limit(5),
    supabase
      .from('design_violations')
      .select('id, audit_id, violation_id, area, title, severity, priority, component, violation_type, description, proposed_fix, affected_files, effort, backlinks, status, resolved_at, resolution_note, created_at')
      .order('priority', { ascending: true })
      .limit(200),
    supabase
      .from('site_settings')
      .select('key, value')
      .eq('key', 'design_token_overrides')
      .maybeSingle(),
  ]);

  return {
    audits: (auditsRes.data ?? []) as DesignAudit[],
    violations: (violationsRes.data ?? []) as DesignViolation[],
    tokenOverrides: (settingsRes.data?.value ?? null) as TokenOverrides | null,
  };
}

export default async function DesignPage() {
  const data = await loadData();
  return <DesignDashboardClient {...data} />;
}
