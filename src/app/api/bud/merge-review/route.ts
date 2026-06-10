/**
 * GET /api/bud/merge-review
 *
 * Fetches open PRs from GitHub, derives a plain-English review item for each,
 * and returns a structured list with risk, recommendation, CI status, and a
 * top-3 summary of changes most likely to improve agent efficacy.
 *
 * Admin/owner only. Returns an empty list gracefully if GitHub is not configured.
 */

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import {
  listAllOpenPRs,
  getPRDetails,
  getLatestWorkflowRun,
} from '@/lib/bud/github-executor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MergeReviewSystemArea =
  | 'agent_quality'
  | 'monitoring'
  | 'quote_funnel'
  | 'dashboard_ui'
  | 'infrastructure'
  | 'customer_experience';

export type MergeReviewRisk = 'low' | 'medium' | 'high';
export type MergeReviewRecommendation = 'approve' | 'hold' | 'reject' | 'needs_manual_review';
export type MergeReviewCheckStatus = 'pass' | 'fail' | 'unknown';

export interface MergeReviewItem {
  prNumber: number;
  branch: string;
  rawTitle: string;
  plainTitle: string;
  whatChanged: string;
  whyItMatters: string;
  systemArea: MergeReviewSystemArea;
  recommendation: MergeReviewRecommendation;
  recommendationLabel: string;
  riskLevel: MergeReviewRisk;
  confidence: number;
  checks: {
    typecheck: MergeReviewCheckStatus;
    lint: MergeReviewCheckStatus;
    build: MergeReviewCheckStatus;
    unitTests: MergeReviewCheckStatus;
    migrationSafe?: MergeReviewCheckStatus;
  };
  couldBreak: string;
  rollbackPlan: string;
  previewUrl: string | null;
  githubUrl: string;
  ciStatus: 'pending' | 'success' | 'failure' | 'unknown';
  isDraft: boolean;
  state: 'open';
  createdAt: string;
  additions: number;
  deletions: number;
  labels: string[];
}

export interface MergeReviewResponse {
  items: MergeReviewItem[];
  summary: {
    total: number;
    safeToApprove: number;
    needsManualReview: number;
    shouldNotPush: number;
    topRecommended: MergeReviewItem[];
  };
  githubConfigured: boolean;
}

// ── Plain-English title translation ──────────────────────────────────────────

// Maps conventional-commit scope tokens to readable context
const SCOPE_CONTEXT: Record<string, string> = {
  agent_quality:        'agent quality',
  agent:                'agent',
  agents:               'agents',
  monitoring:           'monitoring',
  dashboard:            'dashboard',
  dashboard_ui:         'dashboard UI',
  ui:                   'UI',
  ux:                   'UX',
  quote_funnel:         'quote funnel',
  quotes:               'quote system',
  quote:                'quotes',
  infra:                'infrastructure',
  infrastructure:       'infrastructure',
  db:                   'database',
  migration:            'database migration',
  crew:                 'crew portal',
  customer:             'customer experience',
  portal:               'client portal',
  email:                'email system',
  stripe:               'payments',
  auth:                 'authentication',
};

function camelOrSnakeToWords(s: string): string {
  return s
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
}

function translateTitle(raw: string): string {
  // Strip leading "bud/" branch prefix if someone passed a branch name
  const cleaned = raw.replace(/^bud\/[a-z]+-/, '').trim();

  // Match conventional commit: `type(scope): message` or `type: message`
  const conventionalMatch = cleaned.match(
    /^([a-z]+)(?:\(([^)]+)\))?:\s*(.+)$/i,
  );
  if (conventionalMatch) {
    const [, , scope, message] = conventionalMatch;
    const scopeLabel = scope ? (SCOPE_CONTEXT[scope.toLowerCase()] ?? scope) : '';
    const readable = camelOrSnakeToWords(message).replace(/\s+/g, ' ').trim();
    const capitalised = readable.charAt(0).toUpperCase() + readable.slice(1);
    return scopeLabel ? `${capitalised} (${scopeLabel})` : capitalised;
  }

  // No prefix — just clean up camelCase / snake_case
  return camelOrSnakeToWords(cleaned)
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

// ── System area inference ─────────────────────────────────────────────────────

function inferSystemArea(branch: string, title: string, body: string | null): MergeReviewSystemArea {
  const text = `${branch} ${title} ${body ?? ''}`.toLowerCase();

  if (/agent[\s_-]quality|guardrail|agent[_-]output|silent.success|hallucin/.test(text)) return 'agent_quality';
  if (/monitor|alert|spike|observer|error.rate|circuit.break|resilience/.test(text)) return 'monitoring';
  if (/quote|funnel|pricing|sqm|perimeter|step[_-]2|services.page/.test(text)) return 'quote_funnel';
  if (/dashboard|mission.control|ui|layout|panel|card|tab|design.system/.test(text)) return 'dashboard_ui';
  if (/migration|schema|supabase|vercel|ci[^/]|deploy|infra|env|cron|webhook/.test(text)) return 'infrastructure';
  if (/crew|customer|portal|email|ndis|booking|order|payment/.test(text)) return 'customer_experience';
  if (/agent/.test(text)) return 'agent_quality';

  return 'infrastructure';
}

// ── What changed / why it matters (derived from PR data) ─────────────────────

function deriveWhatChanged(raw: string, area: MergeReviewSystemArea, additions: number, deletions: number): string {
  const lines = `+${additions} / -${deletions} lines`;
  const areaLabel: Record<MergeReviewSystemArea, string> = {
    agent_quality:       'agent logic',
    monitoring:          'monitoring system',
    quote_funnel:        'quote builder',
    dashboard_ui:        'dashboard UI',
    infrastructure:      'infrastructure or config',
    customer_experience: 'customer-facing flow',
  };
  const conv = raw.match(/^([a-z]+)(?:\([^)]+\))?:\s*(.+)$/i);
  const verb = conv ? conv[1].toLowerCase() : 'updates';
  const verbMap: Record<string, string> = {
    feat: 'adds',    feature: 'adds',    fix: 'fixes',
    improve: 'improves', refactor: 'refactors', chore: 'updates',
    build: 'updates', ci: 'updates',     docs: 'updates',
  };
  return `${verbMap[verb] ?? 'Updates'} ${areaLabel[area]} (${lines}).`;
}

function deriveWhyItMatters(area: MergeReviewSystemArea, recommendation: MergeReviewRecommendation): string {
  const byArea: Record<MergeReviewSystemArea, string> = {
    agent_quality:       'Improves the reliability and truthfulness of the AI agent fleet.',
    monitoring:          'Gives earlier warning when something breaks in production.',
    quote_funnel:        'Affects how customers receive prices — could change revenue.',
    dashboard_ui:        'Changes what the operator sees in Mission Control.',
    infrastructure:      'Affects the deployment pipeline, database, or config.',
    customer_experience: 'Visible to customers or crew — affects their trust in the platform.',
  };
  const base = byArea[area];
  if (recommendation === 'approve') return `${base} Safe to merge based on CI and risk signals.`;
  if (recommendation === 'reject') return `${base} CI is failing — do not merge until fixed.`;
  return base;
}

// ── Risk classification ────────────────────────────────────────────────────────

function classifyRisk(
  area: MergeReviewSystemArea,
  ciStatus: 'pending' | 'success' | 'failure' | 'unknown',
  additions: number,
  deletions: number,
  labels: string[],
  body: string | null,
  branch: string,
): MergeReviewRisk {
  const totalLines = additions + deletions;
  const hasMigration = /migration|schema/.test(branch.toLowerCase() + (body ?? '').toLowerCase());
  const touchesPricing = /pricing|quote|sqm|perimeter|multiplier|rate/.test(branch + (body ?? ''));
  const touchesAuth = /auth|session|stripe|payment/.test(branch);

  if (ciStatus === 'failure') return 'high';
  if (hasMigration || touchesPricing || touchesAuth) return 'high';
  if (area === 'customer_experience' || area === 'quote_funnel') return 'medium';
  if (totalLines > 300 || ciStatus === 'unknown') return 'medium';
  if (labels.includes('breaking-change')) return 'high';

  return 'low';
}

// ── Recommendation logic ──────────────────────────────────────────────────────

function deriveRecommendation(
  risk: MergeReviewRisk,
  ciStatus: 'pending' | 'success' | 'failure' | 'unknown',
  isDraft: boolean,
  area: MergeReviewSystemArea,
): { recommendation: MergeReviewRecommendation; label: string; confidence: number } {
  if (isDraft) {
    return { recommendation: 'hold', label: 'Hold — draft PR, not ready', confidence: 90 };
  }
  if (ciStatus === 'failure') {
    return { recommendation: 'reject', label: 'Do not merge — CI is failing', confidence: 95 };
  }
  if (risk === 'high') {
    return { recommendation: 'needs_manual_review', label: 'Blocked — manual approval required', confidence: 85 };
  }
  if (area === 'dashboard_ui') {
    return { recommendation: 'needs_manual_review', label: 'Preview screenshot required before approving', confidence: 75 };
  }
  if (area === 'infrastructure') {
    return { recommendation: 'needs_manual_review', label: 'Rollback notes required before approving', confidence: 75 };
  }
  if (risk === 'medium' || ciStatus === 'unknown') {
    return { recommendation: 'needs_manual_review', label: 'Jackson review required', confidence: 70 };
  }
  // low risk, CI passed, not draft
  if (ciStatus === 'success' && (area === 'agent_quality' || area === 'monitoring')) {
    return { recommendation: 'approve', label: 'Recommended for auto-merge', confidence: 88 };
  }
  return { recommendation: 'approve', label: 'Safe to merge', confidence: 80 };
}

// ── What could break / rollback plan ─────────────────────────────────────────

function deriveCouldBreak(area: MergeReviewSystemArea, risk: MergeReviewRisk): string {
  if (risk === 'high') {
    const map: Record<MergeReviewSystemArea, string> = {
      agent_quality:       'Agent runs could fail silently or produce wrong results.',
      monitoring:          'Alerts may not fire. Issues could go undetected in production.',
      quote_funnel:        'Customers could receive incorrect prices. Revenue impact is possible.',
      dashboard_ui:        'Mission Control may display incorrect data or break layout on mobile.',
      infrastructure:      'Deployment or database could break. Potential data loss if migration fails.',
      customer_experience: 'Customers or crew may not be able to complete orders or log in.',
    };
    return map[area];
  }
  if (risk === 'medium') {
    return 'Minor regressions are possible. Test the golden path before pushing to production.';
  }
  return 'Unlikely to break anything. CI passing provides good confidence.';
}

function deriveRollbackPlan(area: MergeReviewSystemArea, risk: MergeReviewRisk): string {
  if (area === 'infrastructure') {
    return 'Revert the migration with the corresponding down migration. Re-deploy previous build from Vercel.';
  }
  if (risk === 'high') {
    return 'Revert the merge commit on GitHub. Trigger a Vercel re-deploy from the previous production commit.';
  }
  return 'Revert via GitHub and re-deploy. No database changes — instant rollback.';
}

// ── Check status derivation ───────────────────────────────────────────────────

function deriveChecks(
  ciStatus: 'pending' | 'success' | 'failure' | 'unknown',
  area: MergeReviewSystemArea,
  branch: string,
  body: string | null,
): MergeReviewItem['checks'] {
  const hasMigration = /migration|schema/.test(branch + (body ?? ''));

  // When CI passes we infer individual checks pass; when it fails we mark build failed.
  // Without a per-check breakdown from GitHub we cannot be more precise.
  const all: MergeReviewCheckStatus =
    ciStatus === 'success' ? 'pass' :
    ciStatus === 'failure' ? 'fail' :
    'unknown';

  return {
    typecheck: all,
    lint:      all,
    build:     all,
    unitTests: all,
    ...(hasMigration ? { migrationSafe: ciStatus === 'success' ? 'pass' : 'unknown' } : {}),
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET() {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    const empty: MergeReviewResponse = {
      items: [],
      summary: { total: 0, safeToApprove: 0, needsManualReview: 0, shouldNotPush: 0, topRecommended: [] },
      githubConfigured: false,
    };
    return NextResponse.json(empty);
  }

  // Fetch all open PRs — no prefix filter so we catch everything
  const openPRs = await listAllOpenPRs(undefined, 20);

  // Enrich each PR with per-PR details + CI status (parallelised)
  const enriched = await Promise.all(
    openPRs.map(async (pr) => {
      const [details, ciRun] = await Promise.all([
        getPRDetails(pr.number),
        getLatestWorkflowRun(pr.branch),
      ]);

      const additions   = details?.additions   ?? 0;
      const deletions   = details?.deletions   ?? 0;
      const body        = details?.body        ?? null;
      const isDraft     = details?.isDraft     ?? pr.isDraft;

      const ciStatus: MergeReviewItem['ciStatus'] =
        details?.ciStatus === 'success' ? 'success' :
        details?.ciStatus === 'failure' ? 'failure' :
        ciRun?.conclusion === 'success' ? 'success' :
        ciRun?.conclusion === 'failure' ? 'failure' :
        ciRun?.status === 'in_progress' || ciRun?.status === 'queued' ? 'pending' :
        'unknown';

      const area = inferSystemArea(pr.branch, pr.title, body);
      const risk = classifyRisk(area, ciStatus, additions, deletions, pr.labels, body, pr.branch);
      const { recommendation, label, confidence } = deriveRecommendation(
        risk, ciStatus, isDraft, area,
      );

      const item: MergeReviewItem = {
        prNumber:            pr.number,
        branch:              pr.branch,
        rawTitle:            pr.title,
        plainTitle:          translateTitle(pr.title),
        whatChanged:         deriveWhatChanged(pr.title, area, additions, deletions),
        whyItMatters:        deriveWhyItMatters(area, recommendation),
        systemArea:          area,
        recommendation,
        recommendationLabel: label,
        riskLevel:           risk,
        confidence,
        checks:              deriveChecks(ciStatus, area, pr.branch, body),
        couldBreak:          deriveCouldBreak(area, risk),
        rollbackPlan:        deriveRollbackPlan(area, risk),
        previewUrl:          null,
        githubUrl:           pr.url,
        ciStatus,
        isDraft,
        state:               'open',
        createdAt:           pr.createdAt,
        additions,
        deletions,
        labels:              pr.labels,
      };

      return item;
    }),
  );

  const safeToApprove = enriched.filter((i) => i.recommendation === 'approve').length;
  const needsManualReview = enriched.filter((i) => i.recommendation === 'needs_manual_review' || i.recommendation === 'hold').length;
  const shouldNotPush = enriched.filter((i) => i.recommendation === 'reject').length;

  // Top 3 agent-quality or monitoring changes that are safe to approve
  const topRecommended = enriched
    .filter((i) => ['agent_quality', 'monitoring'].includes(i.systemArea) && i.recommendation === 'approve')
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);

  const response: MergeReviewResponse = {
    items:  enriched,
    summary: { total: enriched.length, safeToApprove, needsManualReview, shouldNotPush, topRecommended },
    githubConfigured: true,
  };

  return NextResponse.json(response);
}
