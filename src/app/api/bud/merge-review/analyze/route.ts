/**
 * POST /api/bud/merge-review/analyze
 *
 * Runs a full 8-section Agent Reviewer audit on a MergeReviewItem.
 * Returns a structured report written in business language — no code reading required.
 *
 * Admin/owner only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { applyGuardrails } from '@/lib/bud/reviewer-safety';
import type { ConfidenceLevel, SafetyResult } from '@/lib/bud/reviewer-safety';
import type { MergeReviewItem } from '../route';
import type { EvidencePack } from '../evidence/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_MODEL = process.env.AGENT_DEFAULT_MODEL ?? 'claude-sonnet-4-6';

export interface BusinessImpactScores {
  revenue: number;
  customer: number;
  operational: number;
  agentQuality: number;
  reliability: number;
  summary: string;
}

export interface BeforeAfter {
  before: string;
  after: string;
  whyItMatters: string;
}

export interface HiddenRisks {
  regressions: string;
  sideEffects: string;
  testCoverage: string;
  dependencyRisks: string;
  databaseRisks: string;
}

export interface ConfidenceAssessment {
  level: 'high' | 'medium' | 'low';
  score: number;
  reason: string;
  evidence: string;
}

export interface SimulatedOutcome {
  bestCase: string;
  expectedCase: string;
  worstCase: string;
}

export interface AgentReviewerReport {
  executiveSummary: string;
  beforeAfter: BeforeAfter;
  businessImpact: BusinessImpactScores;
  hiddenRisks: HiddenRisks;
  confidenceAssessment: ConfidenceAssessment;
  simulatedOutcome: SimulatedOutcome;
  recommendationQualityScore: number;
  approvalExplanation: string;
  safetyGuardrails: SafetyResult;
}

const FALLBACK_CODE_RISK = {
  touchesAuth: false, touchesPayments: false, touchesQuotes: false,
  hasMigration: false, touchesCustomerFlow: false, touchesAgentSystem: false,
  highRiskAreasTouched: [] as string[],
};

function isRollbackPlanExplicit(plan: string): boolean {
  const normalised = plan.trim().toLowerCase();
  return plan.length > 20 && !['n/a', 'none', 'no', 'tbd'].includes(normalised);
}

function buildEvidenceSummary(evidence: EvidencePack): string {
  const lines: string[] = ['## Evidence Pack'];

  // Files
  if (evidence.filesChanged.available) {
    lines.push(`\nFiles changed: ${evidence.filesChanged.totalCount}`);
    if (evidence.filesChanged.highRiskFiles.length > 0) {
      lines.push(`High-risk files: ${evidence.filesChanged.highRiskFiles.map(f => `${f.filename} (${f.riskReason})`).join('; ')}`);
    }
    if (evidence.filesChanged.coreAreasTouched.length > 0) {
      lines.push(`Core areas touched: ${evidence.filesChanged.coreAreasTouched.join(', ')}`);
    }
  } else {
    lines.push('\nFile list: unavailable (GitHub not configured)');
  }

  // Tests
  const t = evidence.testEvidence;
  lines.push(`\nCI: ${t.ciStatus} | typecheck: ${t.typecheck} | lint: ${t.lint} | build: ${t.build} | unit tests: ${t.unitTests}${t.migrationSafe ? ` | migration: ${t.migrationSafe}` : ''}`);
  lines.push(`Checks passed: ${t.checksPassed}/${t.checksTotal}`);

  // Code risk
  const r = evidence.codeRisk;
  lines.push(`\nLines: +${r.linesAdded} / -${r.linesRemoved}`);
  if (r.highRiskAreasTouched.length > 0) {
    lines.push(`High-risk areas: ${r.highRiskAreasTouched.join(', ')}`);
  }

  // Preview
  const p = evidence.previewEvidence;
  lines.push(`\nPreview URL: ${p.previewUrlAvailable ? 'available' : 'not available'}`);
  lines.push(`Manually tested: ${p.manuallyTested ? 'YES' : 'NO'}`);

  // Historical
  const h = evidence.historicalEvidence;
  if (h.duplicatePRs.length > 0) {
    lines.push(`\nPossible duplicate PRs: #${h.duplicatePRs.join(', #')}`);
  }
  if (h.relatedPRsInArea.length > 0) {
    lines.push(`Related PRs in same area: ${h.relatedPRsInArea.map(p => `#${p.prNumber} ${p.plainTitle}`).join('; ')}`);
  }
  lines.push(`Historical note: ${h.historicalRiskNote}`);

  // Confidence
  const c = evidence.confidence;
  lines.push(`\nEvidence confidence: ${c.level.toUpperCase()} (${c.score}/100)`);
  lines.push(`Score penalty from weak evidence: -${c.scorePenalty} points`);
  if (c.missing.length > 0) {
    lines.push(`Missing evidence: ${c.missing.join('; ')}`);
  }
  if (c.present.length > 0) {
    lines.push(`Present evidence: ${c.present.join('; ')}`);
  }

  return lines.join('\n');
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as { item?: MergeReviewItem; evidence?: EvidencePack };
  if (!body.item) {
    return NextResponse.json({ error: 'item required' }, { status: 400 });
  }

  const item = body.item;
  const evidence = body.evidence;
  const evidenceSummary = evidence ? buildEvidenceSummary(evidence) : null;
  const scorePenalty = evidence?.confidence.scorePenalty ?? 0;

  const prompt = `You are a senior technical lead at a software consultancy. You are reviewing a code change for Jackson, who owns Buds at Work — a local cleaning and home services platform in Brisbane. Jackson is a business owner, not a developer. He should not need to read code to understand whether a change is genuinely valuable.

Here is the change to review:

Title: ${item.plainTitle}
Raw branch/PR title: ${item.rawTitle}
System area: ${item.systemArea.replace(/_/g, ' ')}
Risk level: ${item.riskLevel}
CI status: ${item.ciStatus}
Lines added / removed: +${item.additions} / -${item.deletions}
Checks: typecheck=${item.checks.typecheck}, lint=${item.checks.lint}, build=${item.checks.build}, tests=${item.checks.unitTests}${item.checks.migrationSafe != null ? `, migration=${item.checks.migrationSafe}` : ''}
Current recommendation: ${item.recommendationLabel}
What changed: ${item.whatChanged}
Why it matters: ${item.whyItMatters}
Could break: ${item.couldBreak}
Rollback plan: ${item.rollbackPlan}
Labels: ${item.labels.length > 0 ? item.labels.join(', ') : 'none'}
Is draft: ${item.isDraft}
${evidenceSummary ? `\n${evidenceSummary}\n` : ''}
SCORING RULES:
- Your recommendationQualityScore must start from your honest assessment (0-100).
- Then subtract exactly ${scorePenalty} points as a penalty for evidence quality (this is pre-computed from the Evidence Pack above).
- If no Evidence Pack was provided, apply a default -15 penalty for missing evidence.
- The final score you output must already reflect this penalty — do not explain it separately.
- If evidence is "insufficient" and the score penalty is 40+, the score should not exceed 45.

Produce a complete 8-section review. Respond with ONLY a valid JSON object — no markdown, no code fences, no text outside the JSON.

{
  "executiveSummary": "2-3 sentences written for a business owner. What is this change, why does it exist, and what does it mean for the platform? Zero technical jargon.",

  "beforeAfter": {
    "before": "One sentence: what was the behaviour before this change?",
    "after": "One sentence: what is the behaviour after this change?",
    "whyItMatters": "One sentence: why does that difference matter to the business?"
  },

  "businessImpact": {
    "revenue": <0-100 integer, how much does this change risk or improve revenue>,
    "customer": <0-100 integer, how much does this affect customer experience>,
    "operational": <0-100 integer, how much does this affect internal operations and crew>,
    "agentQuality": <0-100 integer, how much does this affect the AI agent fleet reliability>,
    "reliability": <0-100 integer, how much does this affect platform uptime and stability>,
    "summary": "One sentence summarising the overall business impact profile."
  },

  "hiddenRisks": {
    "regressions": "What existing behaviour could silently break? Be specific.",
    "sideEffects": "What unintended consequences could occur in adjacent systems?",
    "testCoverage": "Which scenarios are NOT covered by the CI checks that passed?",
    "dependencyRisks": "Are there any third-party services, APIs, or packages that could cause issues?",
    "databaseRisks": "Any schema changes, migration risks, or data integrity concerns? Say 'None detected' if not applicable."
  },

  "confidenceAssessment": {
    "level": "<high|medium|low>",
    "score": <0-100 integer>,
    "reason": "One sentence: why is confidence at this level?",
    "evidence": "One sentence: what specific signals support this confidence rating?"
  },

  "simulatedOutcome": {
    "bestCase": "One sentence: what is the best realistic outcome if this merges cleanly?",
    "expectedCase": "One sentence: what is the most likely outcome?",
    "worstCase": "One sentence: what is the worst realistic outcome if something goes wrong?"
  },

  "recommendationQualityScore": <0-100 integer. 90-100 means approve immediately. 70-89 means approve after minor checks. 50-69 means hold and investigate. 30-49 means request changes. 0-29 means reject.>,

  "approvalExplanation": "Start with either 'Approve this PR because' or 'Do not approve this PR because'. Then give 2-3 plain-English sentences explaining the reasoning in business terms. This is the final verdict Jackson reads."
}`;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });
  }

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
        max_tokens: 1800,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `LLM error ${res.status}: ${text}` }, { status: 502 });
    }

    const json = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    const raw = json.content?.find((c) => c.type === 'text')?.text ?? '';
    const stripped = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

    let report: AgentReviewerReport;
    try {
      report = JSON.parse(stripped) as AgentReviewerReport;
    } catch {
      // Graceful fallback — build a minimal report from the item fields
      report = {
        executiveSummary: `${item.plainTitle}. ${item.whyItMatters}`,
        beforeAfter: {
          before: 'Previous behaviour as described in the PR.',
          after: item.whatChanged,
          whyItMatters: item.whyItMatters,
        },
        businessImpact: {
          revenue: item.systemArea === 'quote_funnel' ? 70 : 20,
          customer: item.systemArea === 'customer_experience' ? 70 : 25,
          operational: item.systemArea === 'infrastructure' ? 60 : 30,
          agentQuality: item.systemArea === 'agent_quality' ? 75 : 20,
          reliability: item.riskLevel === 'high' ? 65 : 30,
          summary: `This is a ${item.riskLevel}-risk change to the ${item.systemArea.replace(/_/g, ' ')} layer.`,
        },
        hiddenRisks: {
          regressions: item.couldBreak,
          sideEffects: 'Unable to assess — AI analysis failed. Manual review recommended.',
          testCoverage: `CI checks: typecheck=${item.checks.typecheck}, lint=${item.checks.lint}, build=${item.checks.build}.`,
          dependencyRisks: 'Unable to assess automatically.',
          databaseRisks: item.checks.migrationSafe != null
            ? `Migration detected. Status: ${item.checks.migrationSafe}.`
            : 'None detected.',
        },
        confidenceAssessment: {
          level: item.confidence >= 80 ? 'high' : item.confidence >= 60 ? 'medium' : 'low',
          score: item.confidence,
          reason: `Confidence is ${item.confidence}% based on CI status and risk classification.`,
          evidence: `CI status: ${item.ciStatus}. Risk level: ${item.riskLevel}. ${item.recommendationLabel}.`,
        },
        simulatedOutcome: {
          bestCase: 'Change deploys cleanly and delivers the described improvement.',
          expectedCase: item.recommendationLabel,
          worstCase: item.couldBreak,
        },
        recommendationQualityScore: Math.max(0, (item.recommendation === 'approve' ? 82 : item.recommendation === 'reject' ? 15 : 50) - scorePenalty),
        approvalExplanation: item.recommendation === 'approve'
          ? `Approve this PR because CI is passing and the risk level is ${item.riskLevel}. ${item.whyItMatters}`
          : `Do not approve this PR because ${item.couldBreak}. ${item.rollbackPlan}`,
        safetyGuardrails: null as unknown as SafetyResult, // filled below
      };
    }

    // Apply safety guardrails — enforce confidence caps, high-risk penalties,
    // calibration bounds, and heightened caution before returning the final score.
    const safetyResult = applyGuardrails({
      rawScore:               report.recommendationQualityScore,
      evidencePenalty:        evidence?.confidence.scorePenalty ?? (scorePenalty || 15),
      confidenceLevel:        (evidence?.confidence.level ?? 'insufficient') as ConfidenceLevel,
      calibrationAdjustment:  evidence?.calibration.scoreAdjustment ?? 0,
      manuallyTested:         evidence?.previewEvidence.manuallyTested ?? false,
      rollbackPlanPresent:    isRollbackPlanExplicit(item.rollbackPlan),
      codeRisk:               evidence?.codeRisk ?? FALLBACK_CODE_RISK,
      heightenedCautionActive: evidence?.calibration.heightenedCaution ?? false,
      heightenedCautionArea:  evidence?.calibration.heightenedCaution ? item.systemArea : null,
    });

    report.recommendationQualityScore = safetyResult.finalScore;
    report.safetyGuardrails = safetyResult;

    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 500 },
    );
  }
}
