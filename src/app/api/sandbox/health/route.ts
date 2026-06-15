/**
 * GET /api/sandbox/health
 *
 * Monitoring data for the Agent Training Arena Health tab (Phase 1 + Phase 2):
 *   - last cron run + latest batch statuses
 *   - latest health snapshot per agent (trend, delta F1)
 *   - failing scenarios (latest score < 0.5)
 *   - regressions (degrading agents)
 *   - needs-review queue (critical lessons, last 7 days)
 *   - [Phase 2] activeRootCauses / resolvedRootCauses (split by agent pass status)
 *   - [Phase 2] improvement proposals (one per root cause, read-only)
 *   - [Phase 2] promotion recommendations (one per agent with health data)
 *
 * Admin-gated. Read-only.
 */
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { PASS_F1_THRESHOLD } from '@/lib/sandbox/runner';
import { buildProposals, buildRecommendations } from '@/lib/sandbox/proposals';
import type { RootCauseInput, AgentHealthInput } from '@/lib/sandbox/proposals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type BatchRow = {
  id: string;
  agent_id: string;
  trigger: string;
  status: string;
  scenario_count: number;
  pass_count: number;
  avg_f1: number | null;
  total_cost_cents: number;
  started_at: string;
  finished_at: string | null;
};

type HealthRow = {
  agent_id: string;
  runs: number;
  pass_rate: number | null;
  avg_f1: number | null;
  baseline_f1: number | null;
  delta_f1: number | null;
  trend: 'improving' | 'stable' | 'degrading';
  computed_at: string;
};

type ScoreRow = { scenario_id: string; agent_id: string; f1_score: number; scored_at: string };
type ScenarioRow = { id: string; slug: string; title: string; category: string };
type LessonRow = {
  id: string;
  agent_id: string;
  title: string;
  observation: string;
  recommendation: string | null;
  severity: string;
  created_at: string;
};

type RootCause = RootCauseInput & {
  key: string;
  title: string;
  severity: 'critical' | 'warning';
  agentId: string;
  failureType: 'zero_action' | 'wrong_actions';
  rootCauseSummary: string;
  lessonCount: number;
  latestAt: string;
  exampleObservations: string[];
  recommendedFix: string;
  lessonIds: string[];
};

function groupLessonsIntoRootCauses(lessons: LessonRow[]): RootCause[] {
  const groups = new Map<string, { items: LessonRow[]; failureType: 'zero_action' | 'wrong_actions' }>();
  for (const lesson of lessons) {
    const isZeroAction =
      lesson.observation.includes('[nothing]') ||
      lesson.observation.includes('proposed []');
    const failureType = isZeroAction ? 'zero_action' : 'wrong_actions';
    const key = `${lesson.agent_id}::${failureType}`;
    if (!groups.has(key)) groups.set(key, { items: [], failureType });
    groups.get(key)!.items.push(lesson);
  }

  const result: RootCause[] = [];
  for (const [key, { items, failureType }] of groups) {
    const agentId = items[0].agent_id;
    const severity = items.some((l) => l.severity === 'critical') ? 'critical' : 'warning';
    result.push({
      key,
      title:
        failureType === 'zero_action'
          ? `Zero-action failure — ${agentId}`
          : `Wrong action types — ${agentId}`,
      severity,
      agentId,
      failureType,
      rootCauseSummary:
        failureType === 'zero_action'
          ? 'Agent produces no proposed actions. DB query returns empty in sandbox (missing sandbox input detection).'
          : 'Agent proposed action types that did not match expected. Review agent system prompt.',
      lessonCount: items.length,
      latestAt: items[0].created_at,
      exampleObservations: items.slice(0, 3).map((l) => l.observation),
      recommendedFix:
        failureType === 'zero_action'
          ? 'Add ctx.input guard and deterministic fallback to the agent.'
          : 'Review agent system prompt and scenario inputs to align action type coverage.',
      lessonIds: items.map((l) => l.id),
    });
  }

  return result.sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (b.severity === 'critical' && a.severity !== 'critical') return 1;
    return b.lessonCount - a.lessonCount;
  });
}

export async function GET() {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClientSafe();
  if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [batchesRes, healthRes, scoresRes, scenariosRes, lessonsRes, allLessonsCountRes] =
      await Promise.all([
        supabase
          .from('sandbox_run_batches')
          .select('id, agent_id, trigger, status, scenario_count, pass_count, avg_f1, total_cost_cents, started_at, finished_at')
          .order('started_at', { ascending: false })
          .limit(15),
        supabase
          .from('sandbox_agent_health')
          .select('agent_id, runs, pass_rate, avg_f1, baseline_f1, delta_f1, trend, computed_at')
          .order('computed_at', { ascending: false })
          .limit(60),
        supabase
          .from('sandbox_decision_scores')
          .select('scenario_id, agent_id, f1_score, scored_at')
          .order('scored_at', { ascending: false })
          .limit(300),
        supabase.from('sandbox_scenarios').select('id, slug, title, category'),
        // Critical lessons in the last 7 days for root-cause grouping
        supabase
          .from('sandbox_lessons_learned')
          .select('id, agent_id, title, observation, recommendation, severity, created_at')
          .eq('severity', 'critical')
          .gte('created_at', sevenDaysAgo)
          .order('created_at', { ascending: false })
          .limit(50),
        // Per-agent lesson counts via server-side COUNT(*) GROUP BY — no row cap.
        // Replaces the previous .select('agent_id').limit(2000) approach which
        // under-counted once the table exceeded 2000 rows.
        (supabase as any).rpc('sandbox_lesson_counts_by_agent'),
      ]);

    const batches = (batchesRes.data ?? []) as BatchRow[];
    const lastCronRun = batches.find((b) => b.trigger === 'cron') ?? null;

    // Latest health snapshot per agent.
    const latestHealth = new Map<string, HealthRow>();
    for (const row of (healthRes.data ?? []) as HealthRow[]) {
      if (!latestHealth.has(row.agent_id)) latestHealth.set(row.agent_id, row);
    }
    const health = [...latestHealth.values()];
    const regressions = health.filter((h) => h.trend === 'degrading');

    // Latest score per scenario; failing = below pass threshold.
    const scenarioMeta = new Map(
      ((scenariosRes.data ?? []) as ScenarioRow[]).map((s) => [
        s.id,
        { slug: s.slug, title: s.title, category: s.category },
      ]),
    );
    const latestScore = new Map<string, { agentId: string; f1: number; scoredAt: string }>();
    for (const row of (scoresRes.data ?? []) as ScoreRow[]) {
      if (!latestScore.has(row.scenario_id)) {
        latestScore.set(row.scenario_id, {
          agentId: row.agent_id,
          f1: Number(row.f1_score),
          scoredAt: row.scored_at,
        });
      }
    }
    const failingScenarios = [...latestScore.entries()]
      .filter(([, v]) => v.f1 < PASS_F1_THRESHOLD)
      .map(([scenarioId, v]) => ({
        scenarioId,
        title: scenarioMeta.get(scenarioId)?.title ?? scenarioId,
        category: scenarioMeta.get(scenarioId)?.category ?? 'unknown',
        agentId: v.agentId,
        f1: v.f1,
        scoredAt: v.scoredAt,
      }))
      .sort((a, b) => a.f1 - b.f1);

    // Agents that still have at least one failing scenario.
    const failingAgentIds = new Set(failingScenarios.map((s) => s.agentId));

    const needsReview = (lessonsRes.data ?? []) as LessonRow[];
    const allRootCauses = groupLessonsIntoRootCauses(needsReview);

    // ── Phase 2: split root causes into active / resolved ──────────────────
    const activeRootCauses = allRootCauses.filter((rc) => failingAgentIds.has(rc.agentId));
    const resolvedRootCauses = allRootCauses.filter((rc) => !failingAgentIds.has(rc.agentId));

    // ── Phase 2: improvement proposals ────────────────────────────────────
    const healthByAgent = new Map<string, AgentHealthInput>(
      health.map((h) => [h.agent_id, h as AgentHealthInput]),
    );
    const proposals = buildProposals(activeRootCauses, healthByAgent);

    // ── Phase 2: promotion recommendations ────────────────────────────────
    // Lesson counts per agent (all-time) — from RPC COUNT(*) GROUP BY agent_id.
    const lessonsByAgent = new Map<string, number>(
      ((allLessonsCountRes.data ?? []) as Array<{ agent_id: string; lesson_count: number }>)
        .map((row) => [row.agent_id, Number(row.lesson_count)]),
    );
    const recommendations = buildRecommendations(
      health as AgentHealthInput[],
      activeRootCauses,
      lessonsByAgent,
    );

    return NextResponse.json({
      lastCronRun,
      batches,
      health,
      regressions,
      failingScenarios,
      needsReview,
      // Phase 1 compat — keep rootCauses = activeRootCauses
      rootCauses: activeRootCauses,
      // Phase 2
      activeRootCauses,
      resolvedRootCauses,
      proposals,
      recommendations,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
