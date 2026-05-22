/**
 * GET /api/pipeline/learnings?limit=12
 *
 * Returns the most recent improvement and repair learning records so the
 * Autonomous Improvement Pipeline dashboard can show what Bud learned and
 * what was actually implemented as a result of each run.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { PipelineLearningEntry } from '@/lib/pipeline/types';

export async function GET(req: NextRequest) {
  const limit = Math.min(parseInt(new URL(req.url).searchParams.get('limit') ?? '12', 10) || 12, 50);

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );

  const [improvementResult, repairResult, conventionResult] = await Promise.all([
    // Improvement learnings joined with execution for diff_summary / pr_url / confidence
    supabase
      .from('bud_improvement_learnings')
      .select(`
        id,
        outcome,
        improvement_pattern,
        signal_type,
        affected_area,
        created_at,
        bud_improvement_executions (
          diff_summary,
          pr_url,
          confidence,
          ci_conclusion,
          taste_pass
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit),

    // Repair learnings
    supabase
      .from('bud_repair_learnings')
      .select(`
        id,
        outcome,
        fix_pattern,
        root_cause_type,
        created_at,
        bud_repair_executions (
          diff_summary,
          pr_url,
          confidence,
          ci_conclusion
        )
      `)
      .order('created_at', { ascending: false })
      .limit(Math.floor(limit / 2)),

    // Convention learnings (dev-session captured rules)
    supabase
      .from('bud_convention_learnings')
      .select('id, title, rule, category, example_wrong, example_correct, created_at')
      .order('created_at', { ascending: false })
      .limit(Math.floor(limit / 3)),
  ]);

  type ImprovementRow = {
    id: string;
    outcome: string;
    improvement_pattern: string;
    signal_type: string | null;
    affected_area: string | null;
    created_at: string;
    bud_improvement_executions: {
      diff_summary: string | null;
      pr_url: string | null;
      confidence: number | null;
      ci_conclusion: string | null;
      taste_pass: boolean | null;
    } | null;
  };

  type RepairRow = {
    id: string;
    outcome: string;
    fix_pattern: string;
    root_cause_type: string | null;
    created_at: string;
    bud_repair_executions: {
      diff_summary: string | null;
      pr_url: string | null;
      confidence: number | null;
      ci_conclusion: string | null;
    } | null;
  };

  const improvements: PipelineLearningEntry[] = (improvementResult.data ?? []).map((r) => {
    const row = r as unknown as ImprovementRow;
    const exec = row.bud_improvement_executions;
    return {
      id: row.id,
      kind: 'improvement',
      outcome: row.outcome as PipelineLearningEntry['outcome'],
      pattern: row.improvement_pattern,
      signal_type: row.signal_type,
      affected_area: row.affected_area,
      diff_summary: exec?.diff_summary ?? null,
      pr_url: exec?.pr_url ?? null,
      confidence: exec?.confidence ?? null,
      ci_conclusion: exec?.ci_conclusion ?? null,
      taste_pass: exec?.taste_pass ?? null,
      created_at: row.created_at,
    };
  });

  const repairs: PipelineLearningEntry[] = (repairResult.data ?? []).map((r) => {
    const row = r as unknown as RepairRow;
    const exec = row.bud_repair_executions;
    return {
      id: row.id,
      kind: 'repair',
      outcome: row.outcome as PipelineLearningEntry['outcome'],
      pattern: row.fix_pattern,
      signal_type: row.root_cause_type,
      affected_area: null,
      diff_summary: exec?.diff_summary ?? null,
      pr_url: exec?.pr_url ?? null,
      confidence: exec?.confidence ?? null,
      ci_conclusion: exec?.ci_conclusion ?? null,
      taste_pass: null,
      created_at: row.created_at,
    };
  });

  type ConventionRow = {
    id: string;
    title: string;
    rule: string;
    category: string | null;
    example_wrong: string | null;
    example_correct: string | null;
    created_at: string;
  };

  const conventions: PipelineLearningEntry[] = (conventionResult.data ?? []).map((r) => {
    const row = r as unknown as ConventionRow;
    return {
      id: row.id,
      kind: 'convention',
      outcome: 'shipped',
      pattern: `${row.title}: ${row.rule}`,
      signal_type: row.category,
      affected_area: null,
      diff_summary: row.example_wrong ?? null,
      pr_url: null,
      confidence: null,
      ci_conclusion: row.example_correct ?? null,
      taste_pass: null,
      created_at: row.created_at,
    };
  });

  // Merge and sort by date descending
  const all = [...improvements, ...repairs, ...conventions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  ).slice(0, limit);

  return NextResponse.json({ learnings: all });
}
