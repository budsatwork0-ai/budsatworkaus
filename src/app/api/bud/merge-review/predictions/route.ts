/**
 * POST /api/bud/merge-review/predictions  — save a pre-merge prediction
 * GET  /api/bud/merge-review/predictions  — list predictions by status
 *
 * Called automatically after the Agent Reviewer generates a report.
 * Upserts by pr_number so re-running the reviewer replaces a pending prediction.
 *
 * Admin/owner only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth';
import type { MergeReviewItem } from '../route';
import type { AgentReviewerReport } from '../analyze/route';
import type { EvidencePack } from '../evidence/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ── Types shared across the learning loop ────────────────────────────────────

export interface PredictionRecord {
  id: string;
  pr_number: number;
  branch: string;
  plain_title: string;
  system_area: string;
  risk_level: string;
  recommendation: string;
  recommendation_score: number;
  evidence_confidence: string;
  evidence_confidence_score: number;
  evidence_penalty: number;
  predicted_outcome: string;
  expected_best_case: string | null;
  expected_outcome: string | null;
  expected_worst_case: string | null;
  business_impact: Record<string, number> | null;
  check_status: 'pending' | 'merged_unchecked' | 'confirmed' | 'skipped' | 'not_merged';
  merged_at: string | null;
  deployment_succeeded: boolean | null;
  production_healthy: boolean | null;
  errors_increased: boolean | null;
  workflow_affected: boolean | null;
  rollback_needed: boolean | null;
  improvement_happened: boolean | null;
  outcome_notes: string | null;
  accuracy_verdict: 'correct' | 'partially_correct' | 'wrong' | 'unknown' | null;
  accuracy_score: number | null;
  learning_notes: {
    whatGotRight: string;
    whatMissed: string;
    calibrationNote: string;
  } | null;
  checked_at: string | null;
  created_at: string;
}

// ── POST — save prediction ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as {
    item?: MergeReviewItem;
    report?: AgentReviewerReport;
    evidence?: EvidencePack;
  };

  if (!body.item || !body.report) {
    return NextResponse.json({ error: 'item and report required' }, { status: 400 });
  }

  const { item, report, evidence } = body;

  const db = supabase();

  // Delete any existing pending prediction for this PR so the latest report wins
  await db
    .from('pr_review_predictions')
    .delete()
    .eq('pr_number', item.prNumber)
    .eq('check_status', 'pending');

  const { data, error } = await db
    .from('pr_review_predictions')
    .insert({
      pr_number:                item.prNumber,
      branch:                   item.branch,
      plain_title:              item.plainTitle,
      system_area:              item.systemArea,
      risk_level:               item.riskLevel,
      recommendation:           item.recommendation,
      recommendation_score:     report.recommendationQualityScore,
      evidence_confidence:      evidence?.confidence.level ?? 'unknown',
      evidence_confidence_score: evidence?.confidence.score ?? 0,
      evidence_penalty:         evidence?.confidence.scorePenalty ?? 0,
      predicted_outcome:        report.approvalExplanation,
      expected_best_case:       report.simulatedOutcome.bestCase,
      expected_outcome:         report.simulatedOutcome.expectedCase,
      expected_worst_case:      report.simulatedOutcome.worstCase,
      business_impact: {
        revenue:      report.businessImpact.revenue,
        customer:     report.businessImpact.customer,
        operational:  report.businessImpact.operational,
        agentQuality: report.businessImpact.agentQuality,
        reliability:  report.businessImpact.reliability,
      },
      check_status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, saved: true });
}

// ── GET — list predictions ────────────────────────────────────────────────────

export async function GET() {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = supabase();

  const { data, error } = await db
    .from('pr_review_predictions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ predictions: data as PredictionRecord[] });
}
