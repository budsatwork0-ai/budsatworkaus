/**
 * POST /api/bud/merge-review/post-merge-verify
 *
 * Automated post-merge production verification.
 * Runs after the operator confirms the PR has been merged.
 * Distinct from /verify (pre-merge: checks PR/CI/preview state).
 * This checks production health: live routes, Vercel prod deployment,
 * agent system health, and — for agent_quality changes — a live test run.
 *
 * Admin/owner only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth';
import { runAgent } from '@/lib/agents/runtime';
import type { MergeReviewItem } from '../route';
import type { VerifyCheck, VerifyCheckStatus } from '../verify/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ── Types ─────────────────────────────────────────────────────────────────────

export type PostMergeRecommendation =
  | 'production_verified'
  | 'production_issue'
  | 'needs_manual_review';

export interface PostMergeVerifyResult {
  checks: VerifyCheck[];
  recommendation: PostMergeRecommendation;
  recommendationLabel: string;
  recommendationDetail: string;
  durationMs: number;
  testRunId?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PROD_BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://budsatwork.com').replace(/\/$/, '');

const AREA_PROD_PATH: Record<string, string> = {
  agent_quality:       '/dashboard/agents',
  monitoring:          '/dashboard',
  quote_funnel:        '/services',
  dashboard_ui:        '/dashboard',
  infrastructure:      '/',
  customer_experience: '/',
};

const AREA_PAGE_LABEL: Record<string, string> = {
  agent_quality:       'Agent dashboard (/dashboard/agents)',
  monitoring:          'Mission Control (/dashboard)',
  quote_funnel:        'Services / quote builder (/services)',
  dashboard_ui:        'Admin dashboard (/dashboard)',
  infrastructure:      'Production homepage',
  customer_experience: 'Production homepage',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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
      headers: { 'User-Agent': 'BudOS-PostMergeVerify/1.0' },
    });
    clearTimeout(timer);
    return { ok: res.status < 400, status: res.status, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, status: 0, latencyMs: Date.now() - start };
  }
}

async function checkVercelProduction(): Promise<{
  state: string | null;
  hasError: boolean;
  deployUrl?: string;
}> {
  const token = process.env.VERCEL_API_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!token) return { state: null, hasError: false };

  try {
    const teamParam = teamId ? `&teamId=${teamId}` : '';
    const res = await fetch(
      `https://api.vercel.com/v6/deployments?limit=5&target=production${teamParam}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return { state: null, hasError: false };

    type VD = { state?: string; url?: string };
    const data = await res.json() as { deployments: VD[] };
    const latest = data.deployments[0];
    if (!latest) return { state: null, hasError: false };

    return {
      state: latest.state ?? null,
      hasError: latest.state === 'ERROR',
      deployUrl: latest.url,
    };
  } catch {
    return { state: null, hasError: false };
  }
}

type AgentHealthResult = { failureRate: number; recentFailures: number; totalRecent: number };

async function checkAgentHealth(): Promise<AgentHealthResult> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('agent_runs')
    .select('id, status')
    .gte('started_at', since)
    .order('started_at', { ascending: false })
    .limit(50);

  if (error || !data) return { failureRate: 0, recentFailures: 0, totalRecent: 0 };

  const rows = data as { status: string }[];
  const failures = rows.filter(r => r.status === 'error' || r.status === 'failed');
  return {
    failureRate: rows.length > 0 ? failures.length / rows.length : 0,
    recentFailures: failures.length,
    totalRecent: rows.length,
  };
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

  // ── 1. Production homepage ping ───────────────────────────────────────────
  const homePing = await pingUrl(PROD_BASE);
  checks.push({
    id: 'prod_home',
    label: 'Production site reachable',
    status: homePing.ok ? 'pass' : homePing.status === 0 ? 'warn' : 'fail',
    detail: homePing.ok
      ? `${PROD_BASE} responding (HTTP ${homePing.status}, ${homePing.latencyMs}ms)`
      : homePing.status === 0
      ? 'Production site did not respond — may still be deploying'
      : `Production site returned HTTP ${homePing.status}`,
  });

  // ── 2–4. Area route ping + Vercel production + agent health (parallel) ────
  const areaPath   = AREA_PROD_PATH[item.systemArea] ?? '/';
  const areaUrl    = `${PROD_BASE}${areaPath}`;
  const sameAsRoot = areaPath === '/';

  const [areaPing, vercel, agentHealth] = await Promise.all([
    sameAsRoot ? Promise.resolve(null) : pingUrl(areaUrl),
    checkVercelProduction(),
    checkAgentHealth(),
  ]);

  // ── 3. Area-specific route ────────────────────────────────────────────────
  if (areaPing !== null) {
    checks.push({
      id: 'prod_area',
      label: AREA_PAGE_LABEL[item.systemArea] ?? 'Affected production route',
      status: areaPing.ok ? 'pass' : areaPing.status === 0 ? 'warn' : 'fail',
      detail: areaPing.ok
        ? `${areaPath} loads successfully (HTTP ${areaPing.status}, ${areaPing.latencyMs}ms)`
        : areaPing.status === 0
        ? `${areaPath} did not respond`
        : `${areaPath} returned HTTP ${areaPing.status}`,
    });
  }

  // ── 4. Vercel production deployment ───────────────────────────────────────
  const hasVercelToken = !!process.env.VERCEL_API_TOKEN;
  checks.push({
    id: 'vercel_prod',
    label: 'Vercel production deployment',
    status: vercel.hasError           ? 'fail'
          : vercel.state === 'READY'  ? 'pass'
          : vercel.state !== null     ? 'warn'
          : !hasVercelToken           ? 'skip'
          : 'warn',
    detail: vercel.hasError           ? 'Production deployment is in ERROR state'
          : vercel.state === 'READY'  ? `Deployed and READY${vercel.deployUrl ? ` (${vercel.deployUrl})` : ''}`
          : vercel.state !== null     ? `Deployment state: ${vercel.state} — may still be building`
          : !hasVercelToken           ? 'VERCEL_API_TOKEN not configured — check skipped'
          : 'No recent production deployment found',
  });

  // ── 5. Agent system health ────────────────────────────────────────────────
  const { failureRate, recentFailures, totalRecent } = agentHealth;
  const agentHealthStatus: VerifyCheckStatus =
    totalRecent === 0   ? 'skip'
    : failureRate > 0.5 ? 'fail'
    : failureRate > 0   ? 'warn'
    : 'pass';
  checks.push({
    id: 'agent_health',
    label: 'Agent system health (last 30 min)',
    status: agentHealthStatus,
    detail: totalRecent === 0
      ? 'No agent runs in the last 30 minutes — nothing to check'
      : failureRate > 0.5
      ? `${recentFailures}/${totalRecent} recent runs failed (${Math.round(failureRate * 100)}% failure rate)`
      : failureRate > 0
      ? `${recentFailures}/${totalRecent} recent runs had failures — may be unrelated to this change`
      : `${totalRecent} recent runs, no failures detected`,
  });

  // ── 6 & 7. Safe agent test run (agent_quality areas only) ─────────────────
  let testRunId: string | undefined;

  if (item.systemArea === 'agent_quality') {
    let testRunStatus: VerifyCheckStatus = 'skip';
    let testRunDetail = '';

    try {
      const result = await Promise.race([
        runAgent({
          agentId: 'internal-qa',
          trigger: 'manual',
          triggeredBy: user.id,
          input: {
            context: 'health-check',
            trigger: 'post-merge-verify',
            prNumber: item.prNumber,
          },
          intent: 'Verify agent runtime is healthy after deploy — this is an automated health check',
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Agent test run timed out after 25s')), 25000),
        ),
      ]);

      testRunId = result.runId;
      const succeeded = result.status === 'succeeded';
      testRunStatus = succeeded ? 'pass' : 'warn';
      testRunDetail = succeeded
        ? `Test run completed (run ${result.runId.slice(0, 8)}…, ${result.costCents}¢)`
        : `Test run finished with status: ${result.status} — ${result.summary.slice(0, 80)}`;
    } catch (e) {
      testRunStatus = 'warn';
      testRunDetail = e instanceof Error ? e.message : 'Test run could not be completed';
    }

    checks.push({
      id: 'agent_test_run',
      label: 'Safe agent test run',
      status: testRunStatus,
      detail: testRunDetail,
    });

    // Verify the run was recorded in Recent Runs
    if (testRunId) {
      const sbRecord = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );
      const { data: runRow } = await sbRecord
        .from('agent_runs')
        .select('id, status')
        .eq('id', testRunId)
        .single();

      checks.push({
        id: 'test_run_recorded',
        label: 'Test run recorded in Recent Runs',
        status: runRow ? 'pass' : 'warn',
        detail: runRow
          ? `Run ${testRunId.slice(0, 8)}… found in DB with status: ${(runRow as { status: string }).status}`
          : 'Test run not found in database — recording may be delayed',
      });
    }
  } else {
    checks.push({
      id: 'agent_test_run',
      label: 'Agent test run',
      status: 'skip',
      detail: `Not applicable for ${item.systemArea} changes — agent runtime checks use agent_health scan instead`,
    });
  }

  // ── Recommendation ────────────────────────────────────────────────────────
  const hasBlocker  = checks.some(c => c.status === 'fail');
  const hasWarning  = checks.some(c => c.status === 'warn');
  const passedCount = checks.filter(c => c.status === 'pass').length;
  const totalCount  = checks.filter(c => c.status !== 'skip').length;

  let recommendation: PostMergeRecommendation;
  let recommendationLabel: string;
  let recommendationDetail: string;

  if (hasBlocker) {
    const blocker = checks.find(c => c.status === 'fail')!;
    recommendation      = 'production_issue';
    recommendationLabel = 'Production issue detected';
    recommendationDetail = blocker.detail;
  } else if (hasWarning) {
    recommendation      = 'needs_manual_review';
    recommendationLabel = 'Needs manual review';
    recommendationDetail =
      'Automated checks found warnings but no hard failures. Confirm the flagged items look acceptable before completing.';
  } else {
    recommendation      = 'production_verified';
    recommendationLabel = 'Production verified';
    recommendationDetail = `${passedCount}/${totalCount} automated checks passed`;
  }

  return NextResponse.json({
    checks,
    recommendation,
    recommendationLabel,
    recommendationDetail,
    durationMs: Date.now() - started,
    testRunId,
  } satisfies PostMergeVerifyResult);
}
