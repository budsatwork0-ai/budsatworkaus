/**
 * Reviewer Safety Guardrails
 *
 * Hard limits that prevent the reviewer from becoming overconfident or
 * automatically approving risky changes without enough evidence.
 *
 * Six rules enforced here:
 * 1. requiresHumanDecision — always true; human must confirm every approval
 * 2. Confidence cap — evidence level sets a hard ceiling on the recommendation score
 * 3. High-risk area protection — auth/payments/quotes/migrations require extra evidence
 * 4. Calibration bounds — score adjustments cannot drift beyond safe limits
 * 5. Bad-outcome lock — repeated wrong predictions trigger heightened caution
 * 6. Audit transparency — every score change is explained
 */

export type ConfidenceLevel = 'strong' | 'partial' | 'weak' | 'insufficient';

// ── Rule 2: Confidence caps ───────────────────────────────────────────────────
// A reviewer that has seen little evidence should never claim high certainty.

export const CONFIDENCE_CAPS: Record<ConfidenceLevel, number> = {
  strong:       95,
  partial:      85,
  weak:         70,
  insufficient: 60,
};

// ── Rule 4: Calibration bounds ────────────────────────────────────────────────
// Positive boost capped at +10 (cannot earn unlimited trust through good runs).
// Negative adjustment floors at -20 (one bad area cannot make scores zero).
// Penalty multiplier must stay ≥ 1.0 so calibration never reduces caution.
// Penalty multiplier capped at 2.5 so calibration cannot make scores collapse.

export const CALIBRATION_BOUNDS = {
  maxScoreAdjustment:  10,
  minScoreAdjustment: -20,
  maxPenaltyMultiplier: 2.5,
  minPenaltyMultiplier: 1.0,
} as const;

// ── Rule 3: High-risk area rules ──────────────────────────────────────────────

export interface HighRiskAreaRule {
  area: string;
  displayName: string;
  requiresManualTesting: boolean;
  requiresRollbackPlan: boolean;
  requiresStrongerEvidence: boolean;
  extraPenaltyIfTestsMissing: number;
}

export const HIGH_RISK_AREA_RULES: HighRiskAreaRule[] = [
  { area: 'auth',       displayName: 'Auth / Sessions',        requiresManualTesting: true,  requiresRollbackPlan: true,  requiresStrongerEvidence: true,  extraPenaltyIfTestsMissing: 20 },
  { area: 'payments',   displayName: 'Payments / Stripe',      requiresManualTesting: true,  requiresRollbackPlan: true,  requiresStrongerEvidence: true,  extraPenaltyIfTestsMissing: 20 },
  { area: 'orders',     displayName: 'Orders',                 requiresManualTesting: true,  requiresRollbackPlan: false, requiresStrongerEvidence: true,  extraPenaltyIfTestsMissing: 15 },
  { area: 'quotes',     displayName: 'Quote Funnel / Pricing', requiresManualTesting: true,  requiresRollbackPlan: true,  requiresStrongerEvidence: true,  extraPenaltyIfTestsMissing: 20 },
  { area: 'database',   displayName: 'Database Migrations',    requiresManualTesting: false, requiresRollbackPlan: true,  requiresStrongerEvidence: true,  extraPenaltyIfTestsMissing: 25 },
  { area: 'permissions',displayName: 'Permissions / RLS',      requiresManualTesting: true,  requiresRollbackPlan: true,  requiresStrongerEvidence: true,  extraPenaltyIfTestsMissing: 20 },
  { area: 'cron',       displayName: 'Cron Jobs',              requiresManualTesting: false, requiresRollbackPlan: false, requiresStrongerEvidence: true,  extraPenaltyIfTestsMissing: 10 },
  { area: 'env_vars',   displayName: 'Environment Variables',  requiresManualTesting: false, requiresRollbackPlan: true,  requiresStrongerEvidence: false, extraPenaltyIfTestsMissing: 15 },
];

export interface CodeRiskFlags {
  touchesAuth: boolean;
  touchesPayments: boolean;
  touchesQuotes: boolean;
  hasMigration: boolean;
  touchesCustomerFlow: boolean;
  touchesAgentSystem: boolean;
  highRiskAreasTouched: string[];
}

export function detectTriggeredAreas(codeRisk: CodeRiskFlags): string[] {
  const triggered = new Set<string>();
  if (codeRisk.touchesAuth)     triggered.add('auth');
  if (codeRisk.touchesPayments) triggered.add('payments');
  if (codeRisk.touchesQuotes)   triggered.add('quotes');
  if (codeRisk.hasMigration)    triggered.add('database');
  const areasLower = codeRisk.highRiskAreasTouched.map((a) => a.toLowerCase());
  if (areasLower.some((a) => /order/.test(a)))           triggered.add('orders');
  if (areasLower.some((a) => /permission|rls/.test(a)))  triggered.add('permissions');
  if (areasLower.some((a) => /cron/.test(a)))            triggered.add('cron');
  if (areasLower.some((a) => /env|secret/.test(a)))      triggered.add('env_vars');
  return Array.from(triggered);
}

// ── Rule 5: Heightened caution ────────────────────────────────────────────────
// Triggered when an area accumulates ≥ 2 consecutive wrong predictions.
// Recovery happens one step at a time — a single correct prediction reduces
// the streak by 1 rather than clearing it immediately.

export const HEIGHTENED_CAUTION_THRESHOLD   = 2;
export const HEIGHTENED_CAUTION_SCORE_REDUCTION = 15;

// ── Rule 6: Audit types ───────────────────────────────────────────────────────

export type ScoreAdjustmentType =
  | 'evidence_penalty'
  | 'calibration_adjustment'
  | 'high_risk_penalty'
  | 'confidence_cap'
  | 'missing_manual_testing'
  | 'missing_rollback_plan'
  | 'heightened_caution';

export interface ScoreAdjustment {
  type: ScoreAdjustmentType;
  amount: number;   // negative = reduction
  reason: string;
}

export interface HighRiskFlag {
  area: string;
  displayName: string;
  requirement: 'manual_testing' | 'rollback_plan' | 'stronger_evidence';
  satisfied: boolean;
  message: string;
}

export interface SafetyResult {
  requiresHumanDecision: true;
  originalScore: number;
  finalScore: number;
  confidenceLevel: ConfidenceLevel;
  confidenceCap: number;
  capApplied: boolean;
  adjustments: ScoreAdjustment[];
  highRiskFlags: HighRiskFlag[];
  heightenedCautionActive: boolean;
  heightenedCautionArea: string | null;
  approveImmediatelyBlocked: boolean;
  auditSummary: string;
}

export interface GuardrailInput {
  rawScore: number;
  evidencePenalty: number;        // already baked into rawScore — recorded for audit only
  confidenceLevel: ConfidenceLevel;
  calibrationAdjustment: number;  // NOT yet applied — applyGuardrails applies it
  manuallyTested: boolean;
  rollbackPlanPresent: boolean;
  codeRisk: CodeRiskFlags;
  heightenedCautionActive: boolean;
  heightenedCautionArea: string | null;
}

// ── Main guardrail function ───────────────────────────────────────────────────

export function applyGuardrails(input: GuardrailInput): SafetyResult {
  const {
    rawScore,
    evidencePenalty,
    confidenceLevel,
    calibrationAdjustment,
    manuallyTested,
    rollbackPlanPresent,
    codeRisk,
    heightenedCautionActive,
    heightenedCautionArea,
  } = input;

  const adjustments: ScoreAdjustment[] = [];
  let score = rawScore;

  // 1. Evidence penalty — already in rawScore, recorded for audit transparency
  if (evidencePenalty > 0) {
    adjustments.push({
      type: 'evidence_penalty',
      amount: -evidencePenalty,
      reason: `Evidence quality is ${confidenceLevel} — ${evidencePenalty} point penalty already applied`,
    });
  }

  // 2. Calibration adjustment — apply now (clamped to CALIBRATION_BOUNDS)
  const clampedAdj = Math.max(
    CALIBRATION_BOUNDS.minScoreAdjustment,
    Math.min(CALIBRATION_BOUNDS.maxScoreAdjustment, calibrationAdjustment),
  );
  if (clampedAdj !== 0) {
    adjustments.push({
      type: 'calibration_adjustment',
      amount: clampedAdj,
      reason: clampedAdj > 0
        ? `This area has a good accuracy history (+${clampedAdj} calibration boost)`
        : `This area has a history of inaccurate predictions (${clampedAdj} calibration penalty)`,
    });
    score += clampedAdj;
  }

  // 3. High-risk area checks
  const triggeredAreas = detectTriggeredAreas(codeRisk);
  const highRiskFlags: HighRiskFlag[] = [];

  for (const rule of HIGH_RISK_AREA_RULES) {
    if (!triggeredAreas.includes(rule.area)) continue;

    if (rule.requiresManualTesting) {
      highRiskFlags.push({
        area: rule.area,
        displayName: rule.displayName,
        requirement: 'manual_testing',
        satisfied: manuallyTested,
        message: manuallyTested
          ? `${rule.displayName}: manually tested`
          : `${rule.displayName}: manual testing required before approval`,
      });

      if (!manuallyTested && rule.extraPenaltyIfTestsMissing > 0) {
        const penalty = rule.extraPenaltyIfTestsMissing;
        adjustments.push({
          type: 'missing_manual_testing',
          amount: -penalty,
          reason: `${rule.displayName} touched but not manually tested (−${penalty})`,
        });
        score -= penalty;
      }
    }

    if (rule.requiresRollbackPlan) {
      highRiskFlags.push({
        area: rule.area,
        displayName: rule.displayName,
        requirement: 'rollback_plan',
        satisfied: rollbackPlanPresent,
        message: rollbackPlanPresent
          ? `${rule.displayName}: rollback plan documented`
          : `${rule.displayName}: explicit rollback plan required`,
      });

      if (!rollbackPlanPresent) {
        adjustments.push({
          type: 'missing_rollback_plan',
          amount: -10,
          reason: `${rule.displayName}: no rollback plan documented (−10)`,
        });
        score -= 10;
      }
    }

    if (rule.requiresStrongerEvidence) {
      const isWeakEvidence = ['weak', 'insufficient'].includes(confidenceLevel);
      highRiskFlags.push({
        area: rule.area,
        displayName: rule.displayName,
        requirement: 'stronger_evidence',
        satisfied: !isWeakEvidence,
        message: isWeakEvidence
          ? `${rule.displayName}: requires strong or partial evidence — current evidence is ${confidenceLevel}`
          : `${rule.displayName}: evidence level is adequate`,
      });
    }
  }

  // 4. Heightened caution — area has a bad prediction track record
  if (heightenedCautionActive) {
    adjustments.push({
      type: 'heightened_caution',
      amount: -HEIGHTENED_CAUTION_SCORE_REDUCTION,
      reason: `${heightenedCautionArea ?? 'This area'} is under heightened caution — repeated wrong predictions (−${HEIGHTENED_CAUTION_SCORE_REDUCTION})`,
    });
    score -= HEIGHTENED_CAUTION_SCORE_REDUCTION;
  }

  // 5. Confidence cap — hard ceiling based on evidence level (applied last)
  score = Math.max(0, Math.min(100, score));
  const confidenceCap = CONFIDENCE_CAPS[confidenceLevel];
  const capApplied = score > confidenceCap;
  if (capApplied) {
    adjustments.push({
      type: 'confidence_cap',
      amount: confidenceCap - score,
      reason: `Evidence is ${confidenceLevel} — score capped at ${confidenceCap} (was ${score})`,
    });
    score = confidenceCap;
  }

  // 6. Block "Approve immediately" (≥90) if any unsatisfied high-risk requirement
  const hasUnsatisfiedRequirement =
    highRiskFlags.some((f) => !f.satisfied) || heightenedCautionActive;
  const approveImmediatelyBlocked = score >= 90 && hasUnsatisfiedRequirement;
  if (approveImmediatelyBlocked) {
    adjustments.push({
      type: 'confidence_cap',
      amount: -(score - 89),
      reason: 'Unsatisfied requirements prevent "Approve immediately" verdict',
    });
    score = 89;
  }

  // Build human-readable audit summary
  const auditParts: string[] = [];
  if (evidencePenalty > 0)      auditParts.push(`−${evidencePenalty} evidence penalty`);
  if (clampedAdj < 0)           auditParts.push(`${clampedAdj} calibration`);
  if (clampedAdj > 0)           auditParts.push(`+${clampedAdj} calibration boost`);
  const highRiskPenaltyTotal = adjustments
    .filter((a) => ['missing_manual_testing', 'missing_rollback_plan', 'high_risk_penalty'].includes(a.type))
    .reduce((s, a) => s + a.amount, 0);
  if (highRiskPenaltyTotal < 0) auditParts.push(`${highRiskPenaltyTotal} high-risk area`);
  if (heightenedCautionActive)  auditParts.push(`−${HEIGHTENED_CAUTION_SCORE_REDUCTION} heightened caution`);
  if (capApplied)               auditParts.push(`capped at ${confidenceCap}`);
  if (approveImmediatelyBlocked) auditParts.push('approve-immediately blocked');

  const auditSummary = auditParts.length > 0
    ? `Score: ${rawScore} → ${score}. ${auditParts.join(', ')}.`
    : `Score: ${score}. No adjustments applied.`;

  return {
    requiresHumanDecision: true,
    originalScore: rawScore,
    finalScore: score,
    confidenceLevel,
    confidenceCap,
    capApplied,
    adjustments,
    highRiskFlags,
    heightenedCautionActive,
    heightenedCautionArea,
    approveImmediatelyBlocked,
    auditSummary,
  };
}

// ── Calibration clamping helper ───────────────────────────────────────────────

export function clampCalibration(
  scoreAdjustment: number,
  penaltyMultiplier: number,
): { scoreAdjustment: number; penaltyMultiplier: number } {
  return {
    scoreAdjustment: Math.max(
      CALIBRATION_BOUNDS.minScoreAdjustment,
      Math.min(CALIBRATION_BOUNDS.maxScoreAdjustment, scoreAdjustment),
    ),
    penaltyMultiplier: Math.max(
      CALIBRATION_BOUNDS.minPenaltyMultiplier,
      Math.min(CALIBRATION_BOUNDS.maxPenaltyMultiplier, penaltyMultiplier),
    ),
  };
}

// ── Wrong-streak calibration ──────────────────────────────────────────────────
// Compute updated wrong_recommendation_streak and heightened_caution flag
// after a new verdict arrives.

export type AccuracyVerdict = 'correct' | 'partially_correct' | 'wrong' | 'unknown';

export function computeUpdatedStreak(
  currentStreak: number,
  verdict: AccuracyVerdict,
): { newStreak: number; heightenedCaution: boolean } {
  let newStreak: number;
  if (verdict === 'wrong') {
    newStreak = currentStreak + 1;
  } else if (verdict === 'correct' || verdict === 'partially_correct') {
    // Gradual recovery — one correct prediction reduces streak by 1
    newStreak = Math.max(0, currentStreak - 1);
  } else {
    newStreak = currentStreak;
  }
  return {
    newStreak,
    heightenedCaution: newStreak >= HEIGHTENED_CAUTION_THRESHOLD,
  };
}
