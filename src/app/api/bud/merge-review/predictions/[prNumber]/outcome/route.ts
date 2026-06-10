/**
 * POST /api/bud/merge-review/predictions/[prNumber]/outcome
 *
 * Submits a post-merge reality check for a prediction.
 *
 * Flow:
 * 1. Auto-check: fetches current PR status from GitHub
 * 2. Merge manual outcome answers with auto-check signals
 * 3. Calls LLM to generate learning notes (what reviewer got right/wrong)
 * 4. Computes accuracy verdict + score
 * 5. Updates prediction record and reviewer_calibration table
 *
 * Admin/owner only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth';
import { getPRStatus } from '@/lib/bud/github-executor';
import { clampCalibration, computeUpdatedStreak } from '@/lib/bud/reviewer-safety';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_MODEL = process.env.AGENT_DEFAULT_MODEL ?? 'claude-sonnet-4-6';

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ── Accuracy computation ──────────────────────────────────────────────────────

type AccuracyVerdict = 'correct' | 'partially_correct' | 'wrong' | 'unknown';

function computeAccuracy(
  recommendation: string,
  recommendationScore: number,
  productionHealthy: boolean | null,
  errorsIncreased: boolean | null,
  rollbackNeeded: boolean | null,
  workflowAffected: boolean | null,
  improvementHappened: boolean | null,
): { verdict: AccuracyVerdict; score: number } {
  if (productionHealthy === null && rollbackNeeded === null) {
    return { verdict: 'unknown', score: 50 };
  }

  const wasApproved = ['approve'].includes(recommendation);
  const wasRejectedOrHeld = ['reject', 'hold'].includes(recommendation);
  const hadIssues = rollbackNeeded === true || (errorsIncreased === true && workflowAffected === true);
  const wentWell = productionHealthy !== false && rollbackNeeded !== true && errorsIncreased !== true;

  if (wasApproved && wentWell) {
    const improvementBonus = improvementHappened === true ? 10 : 0;
    return { verdict: 'correct', score: Math.min(100, 85 + improvementBonus) };
  }

  if (wasApproved && hadIssues) {
    if (rollbackNeeded) return { verdict: 'wrong', score: 15 };
    return { verdict: 'partially_correct', score: 45 };
  }

  if (wasRejectedOrHeld && hadIssues) {
    return { verdict: 'correct', score: 90 };
  }

  if (wasRejectedOrHeld && wentWell) {
    // We said hold/reject but it would have been fine
    return { verdict: 'partially_correct', score: 55 };
  }

  // needs_manual_review with no issues = partially correct (was too cautious)
  if (!wasApproved && !wasRejectedOrHeld && wentWell) {
    return { verdict: 'partially_correct', score: 65 };
  }

  return { verdict: 'unknown', score: 50 };
}

// ── Calibration update ────────────────────────────────────────────────────────

async function updateCalibration(
  db: ReturnType<typeof supabase>,
  systemArea: string,
  verdict: AccuracyVerdict,
  accuracyScore: number,
  evidenceConfidence: string,
  hadIssues: boolean,
) {
  const { data: existing } = await db
    .from('reviewer_calibration')
    .select('*')
    .eq('system_area', systemArea)
    .single();

  if (!existing) return;

  const total = (existing.total_predictions as number) + 1;
  const correct = (existing.correct_predictions as number) + (verdict === 'correct' ? 1 : verdict === 'partially_correct' ? 0.5 : 0);
  const newRate = Math.round((correct / total) * 100 * 100) / 100;

  // Adjust score_adjustment: nudge ±2 per outcome.
  // Clamped to safety bounds (max +10, min -20).
  let rawScoreAdj = existing.score_adjustment as number;
  if (verdict === 'correct')           rawScoreAdj += 2;
  if (verdict === 'wrong')             rawScoreAdj -= 5;
  if (verdict === 'partially_correct') rawScoreAdj -= 1;

  // Adjust penalty multiplier.
  // Clamped to safety bounds (min 1.0, max 2.5).
  let rawPenaltyMult = existing.penalty_multiplier as number;
  if (hadIssues && ['weak', 'insufficient'].includes(evidenceConfidence)) {
    rawPenaltyMult = Number((rawPenaltyMult + 0.15).toFixed(2));
  } else if (verdict === 'correct' && ['strong', 'partial'].includes(evidenceConfidence)) {
    rawPenaltyMult = Number((rawPenaltyMult - 0.05).toFixed(2));
  }

  // Enforce safety bounds on both values
  const { scoreAdjustment: scoreAdj, penaltyMultiplier: penaltyMult } = clampCalibration(rawScoreAdj, rawPenaltyMult);

  // Update wrong prediction streak and heightened caution flag
  const currentStreak = Number(existing.wrong_recommendation_streak ?? 0);
  const { newStreak, heightenedCaution } = computeUpdatedStreak(currentStreak, verdict);

  const cautionSuffix = heightenedCaution ? ' ⚠️ Heightened caution active.' : '';
  const note =
    verdict === 'correct'
      ? `Correct prediction ${total}x. Accuracy ${newRate}%.${cautionSuffix}`
      : verdict === 'wrong'
      ? `Wrong prediction. Accuracy ${newRate}%. Applying caution to ${systemArea} scores.${cautionSuffix}`
      : `Partial hit. Accuracy ${newRate}%.${cautionSuffix}`;

  await db
    .from('reviewer_calibration')
    .update({
      score_adjustment:              scoreAdj,
      penalty_multiplier:            penaltyMult,
      total_predictions:             total,
      correct_predictions:           Math.round(correct),
      accuracy_rate:                 newRate,
      last_updated:                  new Date().toISOString(),
      calibration_note:              note,
      wrong_recommendation_streak:   newStreak,
      heightened_caution:            heightenedCaution,
    })
    .eq('system_area', systemArea);
}

// ── LLM learning note generation ─────────────────────────────────────────────

interface LearningNotes {
  whatGotRight: string;
  whatMissed: string;
  calibrationNote: string;
}

async function generateLearningNotes(
  prediction: Record<string, unknown>,
  productionHealthy: boolean | null,
  errorsIncreased: boolean | null,
  rollbackNeeded: boolean | null,
  workflowAffected: boolean | null,
  improvementHappened: boolean | null,
  outcomeNotes: string,
  verdict: AccuracyVerdict,
): Promise<LearningNotes> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      whatGotRight: 'Unable to generate — ANTHROPIC_API_KEY not configured.',
      whatMissed: '',
      calibrationNote: '',
    };
  }

  const prompt = `You are auditing the accuracy of an AI code reviewer that made a prediction about a GitHub pull request.

## Original Prediction
PR: ${String(prediction.plain_title)} (${String(prediction.system_area).replace(/_/g, ' ')})
Risk level predicted: ${String(prediction.risk_level)}
Recommendation: ${String(prediction.recommendation)}
Recommendation score: ${String(prediction.recommendation_score)}/100
Evidence confidence: ${String(prediction.evidence_confidence)}
Expected outcome: ${String(prediction.expected_outcome ?? 'N/A')}
Worst case prediction: ${String(prediction.expected_worst_case ?? 'N/A')}

## What Actually Happened
Production stayed healthy: ${productionHealthy === null ? 'not confirmed' : productionHealthy ? 'yes' : 'no'}
Errors increased after deploy: ${errorsIncreased === null ? 'not confirmed' : errorsIncreased ? 'yes' : 'no'}
Workflow was affected: ${workflowAffected === null ? 'not confirmed' : workflowAffected ? 'yes' : 'no'}
Rollback was needed: ${rollbackNeeded === null ? 'not confirmed' : rollbackNeeded ? 'YES' : 'no'}
Expected improvement happened: ${improvementHappened === null ? 'not confirmed' : improvementHappened ? 'yes' : 'no'}
${outcomeNotes ? `Additional notes: ${outcomeNotes}` : ''}

## Accuracy Verdict
${verdict}

Respond with ONLY a valid JSON object. No markdown, no code fences, no text outside the JSON:
{
  "whatGotRight": "One sentence: what did the reviewer correctly identify about this PR?",
  "whatMissed": "One sentence: what did the reviewer miss or get wrong? Say 'Nothing significant' if verdict was correct.",
  "calibrationNote": "One sentence: what should the reviewer do differently for future ${String(prediction.system_area).replace(/_/g, ' ')} PRs with ${String(prediction.evidence_confidence)} evidence?"
}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`LLM ${res.status}`);

    const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const raw = json.content?.find((c) => c.type === 'text')?.text ?? '';
    const stripped = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

    return JSON.parse(stripped) as LearningNotes;
  } catch {
    return {
      whatGotRight: verdict === 'correct' ? 'Prediction was accurate.' : 'Risk level identification was reasonable.',
      whatMissed: verdict === 'wrong' ? 'The actual production impact was not correctly anticipated.' : 'Nothing significant.',
      calibrationNote: `Continue monitoring ${String(prediction.system_area).replace(/_/g, ' ')} changes with ${String(prediction.evidence_confidence)} evidence.`,
    };
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ prNumber: string }> },
) {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { prNumber: prNumberStr } = await params;
  const prNumber = parseInt(prNumberStr, 10);
  if (isNaN(prNumber)) {
    return NextResponse.json({ error: 'invalid prNumber' }, { status: 400 });
  }

  const body = (await req.json()) as {
    productionHealthy?: boolean | null;
    errorsIncreased?: boolean | null;
    workflowAffected?: boolean | null;
    rollbackNeeded?: boolean | null;
    improvementHappened?: boolean | null;
    outcomeNotes?: string;
  };

  const db = supabase();

  // Fetch the prediction record
  const { data: prediction, error: fetchErr } = await db
    .from('pr_review_predictions')
    .select('*')
    .eq('pr_number', prNumber)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (fetchErr || !prediction) {
    return NextResponse.json({ error: 'Prediction not found for this PR' }, { status: 404 });
  }

  // Auto-check: GitHub merged status
  let mergedAt: string | null = null;
  let checkStatus: string = 'confirmed';
  try {
    const prStatus = await getPRStatus(prNumber);
    if (prStatus === 'merged') {
      mergedAt = new Date().toISOString();
      checkStatus = 'confirmed';
    } else if (prStatus === 'open') {
      checkStatus = 'merged_unchecked';
    } else {
      checkStatus = 'not_merged';
    }
  } catch {
    // GitHub not configured — proceed with manual data only
  }

  const productionHealthy   = body.productionHealthy   ?? null;
  const errorsIncreased     = body.errorsIncreased     ?? null;
  const workflowAffected    = body.workflowAffected    ?? null;
  const rollbackNeeded      = body.rollbackNeeded      ?? null;
  const improvementHappened = body.improvementHappened ?? null;
  const outcomeNotes        = body.outcomeNotes        ?? '';

  // Compute accuracy
  const { verdict, score: accuracyScore } = computeAccuracy(
    String(prediction.recommendation),
    Number(prediction.recommendation_score),
    productionHealthy,
    errorsIncreased,
    rollbackNeeded,
    workflowAffected,
    improvementHappened,
  );

  // Generate learning notes
  const learningNotes = await generateLearningNotes(
    prediction as Record<string, unknown>,
    productionHealthy,
    errorsIncreased,
    rollbackNeeded,
    workflowAffected,
    improvementHappened,
    outcomeNotes,
    verdict,
  );

  // Update prediction record
  const { error: updateErr } = await db
    .from('pr_review_predictions')
    .update({
      check_status:          checkStatus,
      merged_at:             mergedAt,
      deployment_succeeded:  productionHealthy !== false,
      production_healthy:    productionHealthy,
      errors_increased:      errorsIncreased,
      workflow_affected:     workflowAffected,
      rollback_needed:       rollbackNeeded,
      improvement_happened:  improvementHappened,
      outcome_notes:         outcomeNotes || null,
      accuracy_verdict:      verdict,
      accuracy_score:        accuracyScore,
      learning_notes:        learningNotes,
      checked_at:            new Date().toISOString(),
    })
    .eq('id', prediction.id as string);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Update calibration
  const hadIssues = rollbackNeeded === true || (errorsIncreased === true && workflowAffected === true);
  await updateCalibration(
    db,
    String(prediction.system_area),
    verdict,
    accuracyScore,
    String(prediction.evidence_confidence),
    hadIssues,
  );

  return NextResponse.json({
    verdict,
    accuracyScore,
    learningNotes,
    checkStatus,
    mergedAt,
  });
}
