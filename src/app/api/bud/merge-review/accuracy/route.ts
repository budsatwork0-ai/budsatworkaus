/**
 * GET /api/bud/merge-review/accuracy
 *
 * Returns aggregated accuracy stats, recent learning lessons, pending outcome
 * checks, and per-area calibration state for the Reviewer Accuracy panel.
 *
 * Admin/owner only.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export interface CalibrationEntry {
  system_area: string;
  score_adjustment: number;
  penalty_multiplier: number;
  total_predictions: number;
  correct_predictions: number;
  accuracy_rate: number | null;
  calibration_note: string | null;
}

export interface PendingCheck {
  id: string;
  pr_number: number;
  plain_title: string;
  system_area: string;
  risk_level: string;
  recommendation: string;
  recommendation_score: number;
  evidence_confidence: string;
  created_at: string;
}

export interface RecentLesson {
  pr_number: number;
  plain_title: string;
  system_area: string;
  accuracy_verdict: string;
  accuracy_score: number;
  learning_notes: {
    whatGotRight: string;
    whatMissed: string;
    calibrationNote: string;
  };
  checked_at: string;
}

export interface AccuracyStats {
  totalPredictions: number;
  approvedPRs: number;
  successfulApprovals: number;
  problematicApprovals: number;
  outcomeChecked: number;
  pendingOutcomeChecks: number;
  averageAccuracyScore: number | null;
  correctCount: number;
  partiallyCorrectCount: number;
  wrongCount: number;
  unknownCount: number;
}

export interface AccuracyResponse {
  stats: AccuracyStats;
  pendingChecks: PendingCheck[];
  recentLessons: RecentLesson[];
  calibration: CalibrationEntry[];
}

export async function GET() {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = supabase();

  // Run all queries in parallel
  const [predictionsRes, calibrationRes] = await Promise.all([
    db
      .from('pr_review_predictions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100),
    db
      .from('reviewer_calibration')
      .select('*')
      .order('system_area', { ascending: true }),
  ]);

  if (predictionsRes.error) {
    return NextResponse.json({ error: predictionsRes.error.message }, { status: 500 });
  }

  const predictions = predictionsRes.data ?? [];
  const calibration = (calibrationRes.data ?? []) as CalibrationEntry[];

  // Aggregate stats
  const totalPredictions = predictions.length;
  const approvedPRs = predictions.filter(
    (p) => p.recommendation === 'approve',
  ).length;
  const outcomeChecked = predictions.filter(
    (p) => p.check_status === 'confirmed',
  ).length;
  const pendingOutcomeChecks = predictions.filter(
    (p) => p.check_status === 'pending' || p.check_status === 'merged_unchecked',
  ).length;

  const confirmed = predictions.filter((p) => p.check_status === 'confirmed');

  const successfulApprovals = confirmed.filter(
    (p) => p.recommendation === 'approve' && p.production_healthy !== false && p.rollback_needed !== true,
  ).length;
  const problematicApprovals = confirmed.filter(
    (p) => p.recommendation === 'approve' && (p.production_healthy === false || p.rollback_needed === true),
  ).length;

  const accuracyScores = confirmed
    .map((p) => p.accuracy_score as number | null)
    .filter((s): s is number => s !== null);
  const averageAccuracyScore = accuracyScores.length > 0
    ? Math.round(accuracyScores.reduce((a, b) => a + b, 0) / accuracyScores.length)
    : null;

  const correctCount         = confirmed.filter((p) => p.accuracy_verdict === 'correct').length;
  const partiallyCorrectCount = confirmed.filter((p) => p.accuracy_verdict === 'partially_correct').length;
  const wrongCount           = confirmed.filter((p) => p.accuracy_verdict === 'wrong').length;
  const unknownCount         = confirmed.filter((p) => p.accuracy_verdict === 'unknown').length;

  // Pending checks (oldest first, up to 10)
  const pendingChecks: PendingCheck[] = predictions
    .filter((p) => p.check_status === 'pending' || p.check_status === 'merged_unchecked')
    .slice(0, 10)
    .map((p) => ({
      id:                   String(p.id),
      pr_number:            Number(p.pr_number),
      plain_title:          String(p.plain_title),
      system_area:          String(p.system_area),
      risk_level:           String(p.risk_level),
      recommendation:       String(p.recommendation),
      recommendation_score: Number(p.recommendation_score),
      evidence_confidence:  String(p.evidence_confidence),
      created_at:           String(p.created_at),
    }));

  // Recent lessons (last 5 confirmed with learning notes)
  const recentLessons: RecentLesson[] = confirmed
    .filter((p) => p.learning_notes !== null)
    .slice(0, 5)
    .map((p) => ({
      pr_number:       Number(p.pr_number),
      plain_title:     String(p.plain_title),
      system_area:     String(p.system_area),
      accuracy_verdict: String(p.accuracy_verdict),
      accuracy_score:  Number(p.accuracy_score ?? 50),
      learning_notes:  p.learning_notes as RecentLesson['learning_notes'],
      checked_at:      String(p.checked_at),
    }));

  const response: AccuracyResponse = {
    stats: {
      totalPredictions,
      approvedPRs,
      successfulApprovals,
      problematicApprovals,
      outcomeChecked,
      pendingOutcomeChecks,
      averageAccuracyScore,
      correctCount,
      partiallyCorrectCount,
      wrongCount,
      unknownCount,
    },
    pendingChecks,
    recentLessons,
    calibration,
  };

  return NextResponse.json(response);
}
