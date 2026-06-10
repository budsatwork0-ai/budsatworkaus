/**
 * POST /api/bud/merge-review/verify
 *
 * Automated Verification Pipeline for the Merge Decision Workflow.
 * Runs a structured set of checks against a MergeReviewItem — covering PR
 * readiness, CI status, build sub-checks, migration safety, preview URL
 * reachability, and Vercel deployment health — then returns a recommendation.
 *
 * Called automatically when the testing stage opens in MergeDecisionWorkflow.
 * Admin/owner only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import type { MergeReviewItem } from '../route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── Types ─────────────────────────────────────────────────────────────────────

export type VerifyCheckStatus = 'pass' | 'fail' | 'warn' | 'skip';

export interface VerifyCheck {
  id: string;
  label: string;
  status: VerifyCheckStatus;
  detail: string;
}

export type VerifyRecommendation = 'ready_to_deploy' | 'needs_manual_check' | 'do_not_deploy';

export interface VerifyResult {
  checks: VerifyCheck[];
  recommendation: VerifyRecommendation;
  recommendationLabel: string;
  recommendationDetail: string;
  durationMs: number;
}

// ── Area → path mapping for page-load checks ─────────────────────────────────

const AREA_CHECK_PATH: Record<string, string> = {
  agent_quality:       '/dashboard/agents',
  monitoring:          '/dashboard',
  quote_funnel:        '/services',
  dashboard_ui:        '/dashboard',
  infrastructure:      '/',
  customer_experience: '/',
};

const AREA_PAGE_LABEL: Record<string, string> = {
  agent_quality:       'Agent dashboard page',
  monitoring:          'Mission Control dashboard',
  quote_funnel:        'Services / quote builder',
  dashboard_ui:        'Admin dashboard',
  infrastructure:      'Homepage',
  customer_experience: 'Homepage',
};

// ── HTTP ping helper ──────────────────────────────────────────────────────────

async function pingUrl(
  url: string,
  timeoutMs = 9000,
): Promise<{ ok: boolean; status: number; latencyMs: number }> {
  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'BudOS-Verify/1.0' },
    });
    clearTimeout(timer);
    return { ok: res.status < 400, status: res.status, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, status: 0, latencyMs: Date.now() - start };
  }
}

// ── Vercel deployment health check ───────────────────────────────────────────

async function checkVercelDeployment(
  branch: string,
): Promise<{ state: string | null; hasError: boolean }> {
  const token = process.env.VERCEL_API_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!token) return { state: null, hasError: false };

  try {
    const teamParam = teamId ? `&teamId=${teamId}` : '';
    const res = await fetch(
      `https://api.vercel.com/v6/deployments?limit=10&target=preview${teamParam}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return { state: null, hasError: false };

    type VD = { uid: string; meta?: { githubCommitRef?: string }; state?: string };
    const data = await res.json() as { deployments: VD[] };

    const deployment = data.deployments.find(d => d.meta?.githubCommitRef === branch);
    if (!deployment) return { state: null, hasError: false };

    return {
      state: deployment.state ?? null,
      hasError: deployment.state === 'ERROR',
    };
  } catch {
    return { state: null, hasError: false };
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let item: MergeReviewItem;
  try {
    const body = await req.json() as { item: MergeReviewItem };
    item = body.item;
    if (!item?.prNumber) throw new Error('Missing item');
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const started = Date.now();
  const checks: VerifyCheck[] = [];

  // ── 1. PR readiness ───────────────────────────────────────────────────────
  checks.push({
    id: 'pr_ready',
    label: 'PR is ready for review',
    status: item.isDraft ? 'fail' : 'pass',
    detail: item.isDraft
      ? 'PR is still a draft — the author must mark it ready before merging'
      : 'PR is marked ready, not a draft',
  });

  // ── 2. CI status ──────────────────────────────────────────────────────────
  const ciStatusMap: Record<string, VerifyCheckStatus> = {
    success: 'pass', failure: 'fail', pending: 'warn', unknown: 'warn',
  };
  const ciDetailMap: Record<string, string> = {
    success: 'All CI checks are passing',
    failure: 'CI checks are failing — fix the build before merging',
    pending: 'CI is still running — wait for results',
    unknown: 'CI status is unknown — verify on GitHub',
  };
  checks.push({
    id: 'ci_status',
    label: 'CI status',
    status: ciStatusMap[item.ciStatus] ?? 'warn',
    detail: ciDetailMap[item.ciStatus] ?? 'CI status unknown',
  });

  // ── 3. Build sub-checks ───────────────────────────────────────────────────
  const subs = [
    { key: 'typecheck' as const, label: 'Typecheck' },
    { key: 'lint'      as const, label: 'Lint'      },
    { key: 'build'     as const, label: 'Build'     },
    { key: 'unitTests' as const, label: 'Unit tests'},
  ];
  const failed  = subs.filter(s => item.checks[s.key] === 'fail');
  const unknown = subs.filter(s => item.checks[s.key] === 'unknown');
  checks.push({
    id: 'build_checks',
    label: 'Build & type checks',
    status: failed.length  > 0 ? 'fail'
          : unknown.length > 0 ? 'warn'
          : 'pass',
    detail: failed.length  > 0
      ? `${failed.map(s => s.label).join(', ')} ${failed.length === 1 ? 'is' : 'are'} failing`
      : unknown.length > 0
      ? `${unknown.map(s => s.label).join(', ')} status unknown`
      : 'Typecheck, lint, build, and unit tests all passing',
  });

  // ── 4. Migration safety ───────────────────────────────────────────────────
  if (item.checks.migrationSafe !== undefined) {
    const ms = item.checks.migrationSafe;
    checks.push({
      id: 'migration',
      label: 'Database migration safety',
      status: ms === 'pass' ? 'pass' : ms === 'fail' ? 'fail' : 'warn',
      detail: ms === 'pass' ? 'Migration appears safe to apply'
            : ms === 'fail' ? 'Migration safety check failed — review carefully before merging'
            : 'Migration safety could not be assessed',
    });
  }

  // ── 5, 6 & 7. Preview pings + Vercel health — all run in parallel ────────
  const areaPath   = AREA_CHECK_PATH[item.systemArea] ?? '/';
  const areaUrl    = item.previewUrl
    ? `${item.previewUrl.replace(/\/$/, '')}${areaPath}`
    : null;
  const sameAsRoot = areaUrl === item.previewUrl;

  const [rootPing, areaPing, vercel] = await Promise.all([
    item.previewUrl ? pingUrl(item.previewUrl) : Promise.resolve(null),
    item.previewUrl && !sameAsRoot ? pingUrl(areaUrl!) : Promise.resolve(null),
    checkVercelDeployment(item.branch),
  ]);

  if (rootPing !== null) {
    checks.push({
      id: 'preview_reachable',
      label: 'Preview deployment',
      status: rootPing.ok ? 'pass' : rootPing.status === 0 ? 'warn' : 'fail',
      detail: rootPing.ok
        ? `Preview is live and responding (HTTP ${rootPing.status}, ${rootPing.latencyMs}ms)`
        : rootPing.status === 0
        ? 'Preview did not respond — may still be deploying or URL is invalid'
        : `Preview returned HTTP ${rootPing.status}`,
    });
  } else {
    checks.push({
      id: 'preview_reachable',
      label: 'Preview deployment',
      status: 'skip',
      detail: 'No preview URL for this PR — visual checks must be done manually',
    });
  }

  if (areaPing !== null) {
    checks.push({
      id: 'area_page',
      label: AREA_PAGE_LABEL[item.systemArea] ?? 'Affected page',
      status: areaPing.ok ? 'pass' : areaPing.status === 0 ? 'warn' : 'fail',
      detail: areaPing.ok
        ? `${areaPath} loads successfully (HTTP ${areaPing.status}, ${areaPing.latencyMs}ms)`
        : areaPing.status === 0
        ? `${areaPath} did not respond`
        : `${areaPath} returned HTTP ${areaPing.status}`,
    });
  }

  // ── Vercel deployment health (result already fetched above) ───────────────
  checks.push({
    id: 'vercel_deploy',
    label: 'Vercel deployment health',
    status: vercel.hasError           ? 'fail'
          : vercel.state === 'READY'  ? 'pass'
          : vercel.state !== null     ? 'warn'
          : !process.env.VERCEL_API_TOKEN ? 'skip'
          : 'warn',
    detail: vercel.hasError           ? `Deployment is in ERROR state on branch ${item.branch}`
          : vercel.state === 'READY'  ? `Deployment is READY on branch ${item.branch}`
          : vercel.state !== null     ? `Deployment state: ${vercel.state}`
          : !process.env.VERCEL_API_TOKEN ? 'VERCEL_API_TOKEN not set — deployment check skipped'
          : `No preview deployment found for branch ${item.branch}`,
  });

  // ── Recommendation ────────────────────────────────────────────────────────
  const hasBlocker  = checks.some(c => c.status === 'fail');
  const hasWarning  = checks.some(c => c.status === 'warn');
  const passedCount = checks.filter(c => c.status === 'pass').length;
  const totalCount  = checks.filter(c => c.status !== 'skip').length;

  let recommendation: VerifyRecommendation;
  let recommendationLabel: string;
  let recommendationDetail: string;

  if (hasBlocker) {
    const blocker = checks.find(c => c.status === 'fail')!;
    recommendation        = 'do_not_deploy';
    recommendationLabel   = 'Do not deploy';
    recommendationDetail  = blocker.detail;
  } else if (hasWarning) {
    const warning = checks.find(c => c.status === 'warn')!;
    recommendation        = 'needs_manual_check';
    recommendationLabel   = 'Needs manual check';
    recommendationDetail  = `${warning.label}: ${warning.detail}`;
  } else {
    recommendation        = 'ready_to_deploy';
    recommendationLabel   = 'Ready to deploy';
    recommendationDetail  = `${passedCount}/${totalCount} automated checks passed`;
  }

  return NextResponse.json({
    checks,
    recommendation,
    recommendationLabel,
    recommendationDetail,
    durationMs: Date.now() - started,
  } satisfies VerifyResult);
}
