/**
 * POST /api/bud/merge-review/evidence
 *
 * Builds a structured Evidence Pack for a MergeReviewItem.
 * Fetches the real file list from GitHub, then derives all 6 evidence sections
 * and computes an evidence confidence level + score penalty.
 *
 * Admin/owner only. Degrades gracefully when GitHub is not configured.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth';
import { getPRFiles } from '@/lib/bud/github-executor';
import { clampCalibration } from '@/lib/bud/reviewer-safety';
import type { MergeReviewItem } from '../route';
import type { PRFileEntry } from '@/lib/bud/github-executor';

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── High-risk file patterns ───────────────────────────────────────────────────

interface RiskPattern { pattern: RegExp; reason: string; area: string }

const HIGH_RISK_PATTERNS: RiskPattern[] = [
  { pattern: /src\/app\/\(public\)\/services/,           reason: 'Quote funnel — customer-facing pricing',      area: 'Quote Funnel' },
  { pattern: /src\/app\/api\/quotes/,                     reason: 'Quote API — affects order creation',          area: 'Quote API' },
  { pattern: /src\/app\/api\/webhooks\/stripe/,           reason: 'Stripe webhook — handles live payments',      area: 'Payments' },
  { pattern: /src\/app\/api\/.*checkout/,                 reason: 'Checkout flow — Stripe session creation',     area: 'Payments' },
  { pattern: /src\/lib\/auth/,                            reason: 'Auth layer — session and access control',     area: 'Auth' },
  { pattern: /supabase\/migrations/,                      reason: 'Database migration — irreversible schema change', area: 'Database' },
  { pattern: /src\/lib\/email/,                           reason: 'Email system — customer-facing notifications', area: 'Email' },
  { pattern: /src\/lib\/agents\/runtime/,                 reason: 'Agent runtime — all agent executions use this', area: 'Agent Runtime' },
  { pattern: /src\/lib\/agents\/guardrails/,              reason: 'Agent guardrails — safety policies',          area: 'Agent Safety' },
  { pattern: /src\/app\/\(app\)\/dashboard\/agents/,      reason: 'Agent dashboard — operator-facing UI',        area: 'Agent UI' },
  { pattern: /src\/app\/api\/agents\/cron/,               reason: 'Agent cron route — scheduled execution',     area: 'Cron' },
  { pattern: /\.env/,                                     reason: 'Environment secrets — must not be committed', area: 'Secrets' },
  { pattern: /vercel\.json|next\.config/,                 reason: 'Deployment configuration',                   area: 'Infra Config' },
];

const CORE_AREA_PATTERNS: Array<{ pattern: RegExp; area: string }> = [
  { pattern: /src\/app\/\(public\)\/services|src\/app\/api\/quotes/, area: 'Quote Funnel' },
  { pattern: /stripe|checkout|payment/i,                             area: 'Payments' },
  { pattern: /src\/lib\/auth|session/i,                              area: 'Auth' },
  { pattern: /supabase\/migrations/,                                 area: 'Database Migrations' },
  { pattern: /src\/lib\/agents\//,                                   area: 'Agent System' },
  { pattern: /src\/app\/\(app\)\/crew/,                              area: 'Crew Portal' },
  { pattern: /src\/app\/\(app\)\/portal/,                            area: 'Client Portal' },
  { pattern: /src\/lib\/email/,                                      area: 'Email' },
  { pattern: /src\/app\/(app)\/dashboard/,                           area: 'Dashboard' },
  { pattern: /src\/app\/ui\/|theme\.ts/,                             area: 'Design System' },
];

function classifyFiles(files: PRFileEntry[]): {
  highRisk: Array<PRFileEntry & { riskReason: string; riskArea: string }>;
  coreAreasTouched: string[];
} {
  const highRisk: Array<PRFileEntry & { riskReason: string; riskArea: string }> = [];
  const areasSet = new Set<string>();

  for (const file of files) {
    for (const { pattern, reason, area } of HIGH_RISK_PATTERNS) {
      if (pattern.test(file.filename)) {
        highRisk.push({ ...file, riskReason: reason, riskArea: area });
        break;
      }
    }
    for (const { pattern, area } of CORE_AREA_PATTERNS) {
      if (pattern.test(file.filename)) {
        areasSet.add(area);
      }
    }
  }

  return { highRisk, coreAreasTouched: Array.from(areasSet) };
}

// ── Code risk flags ───────────────────────────────────────────────────────────

function deriveCodeRisk(item: MergeReviewItem, files: PRFileEntry[], filesAvailable: boolean) {
  const allPaths = files.map((f) => f.filename).join('\n');
  const branchAndLabels = `${item.branch} ${item.labels.join(' ')}`.toLowerCase();

  const hasMigration = filesAvailable
    ? files.some((f) => f.filename.includes('supabase/migrations'))
    : /migration|schema/.test(branchAndLabels);

  const touchesAuth = filesAvailable
    ? /auth|session/.test(allPaths)
    : /auth|session/.test(branchAndLabels);

  const touchesPayments = filesAvailable
    ? /stripe|checkout|payment|webhook/.test(allPaths)
    : /stripe|payment|checkout/.test(branchAndLabels);

  const touchesQuotes = filesAvailable
    ? /services|quotes|pricing|sqm/.test(allPaths)
    : /quote|pricing|sqm/.test(branchAndLabels);

  const touchesCustomerFlow = filesAvailable
    ? /portal|crew|booking|order|email/.test(allPaths)
    : /portal|crew|customer|booking/.test(branchAndLabels);

  const touchesAgentSystem = filesAvailable
    ? /lib\/agents/.test(allPaths)
    : /agent/.test(branchAndLabels);

  const highRiskAreas: string[] = [];
  if (hasMigration)       highRiskAreas.push('Database migration');
  if (touchesAuth)        highRiskAreas.push('Auth / sessions');
  if (touchesPayments)    highRiskAreas.push('Payments / Stripe');
  if (touchesQuotes)      highRiskAreas.push('Quote funnel / pricing');
  if (touchesCustomerFlow) highRiskAreas.push('Customer-facing flow');

  return {
    filesCount: filesAvailable ? files.length : item.additions + item.deletions > 0 ? null : 0,
    linesAdded: item.additions,
    linesRemoved: item.deletions,
    hasMigration,
    touchesAuth,
    touchesPayments,
    touchesQuotes,
    touchesCustomerFlow,
    touchesAgentSystem,
    highRiskAreasTouched: highRiskAreas,
  };
}

// ── Evidence confidence ───────────────────────────────────────────────────────

type ConfidenceLevel = 'strong' | 'partial' | 'weak' | 'insufficient';

function computeConfidence(
  item: MergeReviewItem,
  filesAvailable: boolean,
  highRiskFileCount: number,
  manuallyTested: boolean,
): {
  level: ConfidenceLevel;
  score: number;
  scorePenalty: number;
  missing: string[];
  present: string[];
} {
  const present: string[] = [];
  const missing: string[] = [];

  // CI status
  if (item.ciStatus === 'success') {
    present.push('CI checks passed');
  } else if (item.ciStatus === 'failure') {
    missing.push('CI is failing');
  } else {
    missing.push('CI status unknown');
  }

  // Individual checks
  const checks = item.checks;
  const checkNames: Array<[string, string]> = [
    [checks.typecheck, 'TypeScript typecheck'],
    [checks.lint, 'Lint'],
    [checks.build, 'Build'],
    [checks.unitTests, 'Unit tests'],
  ];
  let checksPassed = 0;
  for (const [status, name] of checkNames) {
    if (status === 'pass') { present.push(name); checksPassed++; }
    else if (status === 'fail') { missing.push(`${name} failing`); }
  }
  if (checks.migrationSafe === 'pass') present.push('Migration safety check passed');
  else if (checks.migrationSafe === 'fail') missing.push('Migration safety check failed');

  // File list
  if (filesAvailable) {
    present.push('File list available');
  } else {
    missing.push('File list unavailable — GitHub not configured');
  }

  // High-risk files with weak CI
  if (highRiskFileCount > 0 && item.ciStatus !== 'success') {
    missing.push(`${highRiskFileCount} high-risk file${highRiskFileCount > 1 ? 's' : ''} changed without passing CI`);
  } else if (highRiskFileCount > 0) {
    present.push(`${highRiskFileCount} high-risk file${highRiskFileCount > 1 ? 's' : ''} identified`);
  }

  // Migration check
  if (item.checks.migrationSafe === undefined && /migration|schema/.test(item.branch.toLowerCase())) {
    missing.push('Migration detected but no migration safety check recorded');
  }

  // Preview / manual testing
  if (manuallyTested) {
    present.push('Manually tested and verified');
  } else if (item.previewUrl) {
    present.push('Preview URL available');
    missing.push('Preview not yet manually tested');
  } else if (['dashboard_ui', 'customer_experience'].includes(item.systemArea)) {
    missing.push('No preview URL — UI change untested visually');
  }

  // Draft
  if (item.isDraft) {
    missing.push('PR is still a draft');
  }

  // Score based on evidence quality
  let score = 50;
  if (item.ciStatus === 'success') score += 20;
  if (item.ciStatus === 'failure') score -= 30;
  score += checksPassed * 5;
  if (filesAvailable) score += 10;
  if (manuallyTested) score += 10;
  if (item.isDraft) score -= 20;
  if (highRiskFileCount > 0 && item.ciStatus !== 'success') score -= 15;
  score = Math.max(0, Math.min(100, score));

  // Level
  let level: ConfidenceLevel;
  let scorePenalty: number;
  if (score >= 75) {
    level = 'strong';
    scorePenalty = 0;
  } else if (score >= 50) {
    level = 'partial';
    scorePenalty = 10;
  } else if (score >= 25) {
    level = 'weak';
    scorePenalty = 25;
  } else {
    level = 'insufficient';
    scorePenalty = 40;
  }

  return { level, score, scorePenalty, missing, present };
}

// ── Response type ─────────────────────────────────────────────────────────────

export interface EvidencePack {
  filesChanged: {
    files: Array<PRFileEntry & { isHighRisk?: boolean; riskReason?: string; riskArea?: string }>;
    totalCount: number;
    highRiskFiles: Array<PRFileEntry & { riskReason: string; riskArea: string }>;
    coreAreasTouched: string[];
    available: boolean;
  };
  testEvidence: {
    ciStatus: MergeReviewItem['ciStatus'];
    typecheck: string;
    lint: string;
    build: string;
    unitTests: string;
    migrationSafe?: string;
    checksPassed: number;
    checksTotal: number;
  };
  codeRisk: {
    filesCount: number | null;
    linesAdded: number;
    linesRemoved: number;
    hasMigration: boolean;
    touchesAuth: boolean;
    touchesPayments: boolean;
    touchesQuotes: boolean;
    touchesCustomerFlow: boolean;
    touchesAgentSystem: boolean;
    highRiskAreasTouched: string[];
  };
  previewEvidence: {
    previewUrlAvailable: boolean;
    previewUrl: string | null;
    manuallyTested: boolean;
  };
  historicalEvidence: {
    relatedPRsInArea: Array<{ prNumber: number; plainTitle: string }>;
    duplicatePRs: number[];
    areaHasHighRiskHistory: boolean;
    historicalRiskNote: string;
  };
  confidence: {
    level: ConfidenceLevel;
    score: number;
    scorePenalty: number;
    missing: string[];
    present: string[];
  };
  calibration: {
    scoreAdjustment: number;
    penaltyMultiplier: number;
    accuracyRate: number | null;
    note: string | null;
    applied: boolean;
    heightenedCaution: boolean;
    wrongRecommendationStreak: number;
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as {
    item?: MergeReviewItem;
    allItems?: MergeReviewItem[];
    duplicateOf?: number[];
    manuallyTested?: boolean;
  };

  if (!body.item) {
    return NextResponse.json({ error: 'item required' }, { status: 400 });
  }

  const item = body.item;
  const allItems = body.allItems ?? [];
  const duplicateOf = body.duplicateOf ?? [];
  const manuallyTested = body.manuallyTested ?? false;

  // 1. Fetch file list from GitHub
  const rawFiles = await getPRFiles(item.prNumber);
  const filesAvailable = rawFiles.length > 0;

  // 2. Classify files
  const { highRisk, coreAreasTouched } = classifyFiles(rawFiles);

  const enrichedFiles = rawFiles.map((f) => {
    const risk = highRisk.find((h) => h.filename === f.filename);
    return risk
      ? { ...f, isHighRisk: true, riskReason: risk.riskReason, riskArea: risk.riskArea }
      : { ...f, isHighRisk: false };
  });

  // 3. Test evidence
  const checks = item.checks;
  const checkList: string[] = ['typecheck', 'lint', 'build', 'unitTests'];
  const checksPassed = checkList.filter((k) => checks[k as keyof typeof checks] === 'pass').length;
  const checksTotal = checkList.length + (checks.migrationSafe !== undefined ? 1 : 0);

  // 4. Code risk
  const codeRisk = deriveCodeRisk(item, rawFiles, filesAvailable);

  // 5. Historical / related PRs
  const relatedPRsInArea = allItems
    .filter((i) => i.prNumber !== item.prNumber && i.systemArea === item.systemArea)
    .map((i) => ({ prNumber: i.prNumber, plainTitle: i.plainTitle }));

  const HIGH_RISK_HISTORY_AREAS = ['quote_funnel', 'infrastructure', 'customer_experience'];
  const areaHasHighRiskHistory = HIGH_RISK_HISTORY_AREAS.includes(item.systemArea);

  const AREA_RISK_NOTES: Record<string, string> = {
    quote_funnel:        'The quote funnel is high-stakes — pricing bugs here directly affect revenue.',
    infrastructure:      'Infrastructure changes have caused deployment issues in the past. Verify Vercel and Supabase after merge.',
    customer_experience: 'Customer-facing changes require end-to-end testing before going live.',
    agent_quality:       'Agent changes are generally self-contained. Monitor agent_runs for errors post-deploy.',
    monitoring:          'Monitoring changes are low-risk but verify no false alerts fire post-deploy.',
    dashboard_ui:        'Dashboard UI changes require visual verification on mobile and desktop.',
  };

  const historicalRiskNote = AREA_RISK_NOTES[item.systemArea] ?? 'No specific historical risk pattern for this area.';

  // 6. Evidence confidence
  const confidence = computeConfidence(item, filesAvailable, highRisk.length, manuallyTested);

  // 7. Apply calibration adjustments from learning loop history
  const db = supabase();
  type CalibrationRow = {
    score_adjustment: number;
    penalty_multiplier: number;
    accuracy_rate: number | null;
    calibration_note: string | null;
    heightened_caution: boolean;
    wrong_recommendation_streak: number;
  };
  let calibrationRow: CalibrationRow | null = null;
  try {
    const { data } = await db
      .from('reviewer_calibration')
      .select('score_adjustment, penalty_multiplier, accuracy_rate, calibration_note, heightened_caution, wrong_recommendation_streak')
      .eq('system_area', item.systemArea)
      .single();
    calibrationRow = data as CalibrationRow | null;
  } catch {
    // calibration table not yet migrated — proceed without it
  }

  const rawScoreAdj    = calibrationRow ? Number(calibrationRow.score_adjustment)   : 0;
  const rawPenaltyMult = calibrationRow ? Number(calibrationRow.penalty_multiplier) : 1.0;

  // Clamp calibration values to safety bounds before using them
  const { scoreAdjustment, penaltyMultiplier } = clampCalibration(rawScoreAdj, rawPenaltyMult);
  const calibrationApplied = scoreAdjustment !== 0 || penaltyMultiplier !== 1.0;

  // Apply multiplier to the base penalty, then clip to [0, 50]
  const calibratedPenalty = Math.min(50, Math.max(0, Math.round(confidence.scorePenalty * penaltyMultiplier)));
  confidence.scorePenalty = calibratedPenalty;

  const pack: EvidencePack = {
    filesChanged: {
      files: enrichedFiles,
      totalCount: filesAvailable ? rawFiles.length : 0,
      highRiskFiles: highRisk,
      coreAreasTouched,
      available: filesAvailable,
    },
    testEvidence: {
      ciStatus: item.ciStatus,
      typecheck: checks.typecheck,
      lint: checks.lint,
      build: checks.build,
      unitTests: checks.unitTests,
      ...(checks.migrationSafe !== undefined ? { migrationSafe: checks.migrationSafe } : {}),
      checksPassed,
      checksTotal,
    },
    codeRisk: {
      ...codeRisk,
      filesCount: filesAvailable ? rawFiles.length : null,
    },
    previewEvidence: {
      previewUrlAvailable: !!item.previewUrl,
      previewUrl: item.previewUrl,
      manuallyTested,
    },
    historicalEvidence: {
      relatedPRsInArea,
      duplicatePRs: duplicateOf,
      areaHasHighRiskHistory,
      historicalRiskNote,
    },
    confidence,
    calibration: {
      scoreAdjustment,
      penaltyMultiplier,
      accuracyRate:              calibrationRow ? (calibrationRow.accuracy_rate as number | null) : null,
      note:                      calibrationRow ? (calibrationRow.calibration_note as string | null) : null,
      applied:                   calibrationApplied,
      heightenedCaution:         calibrationRow ? Boolean(calibrationRow.heightened_caution) : false,
      wrongRecommendationStreak: calibrationRow ? Number(calibrationRow.wrong_recommendation_streak) : 0,
    },
  };

  return NextResponse.json(pack);
}
