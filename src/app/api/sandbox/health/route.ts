/**
 * GET /api/sandbox/health
 *
 * Monitoring data for the Agent Training Arena Health tab:
 *   - last cron run + latest batch statuses
 *   - latest health snapshot per agent (trend, delta F1)
 *   - failing scenarios (latest score < 0.5)
 *   - regressions (degrading agents)
 *   - needs-review queue (critical lessons, last 7 days)
 *
 * Admin-gated. Read-only.
 */
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { PASS_F1_THRESHOLD } from '@/lib/sandbox/runner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Local row types — sandbox_run_batches / sandbox_agent_health are not in the
// generated Supabase Database types yet, so query rows are typed explicitly.
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
  severity: string;
  created_at: string;
};

export async function GET() {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClientSafe();
  if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [batchesRes, healthRes, scoresRes, scenariosRes, lessonsRes] = await Promise.all([
      supabase
        .from('sandbox_run_batches')
        .select('id, agent_id, trigger, status, scenario_count, pass_count, avg_f1, total_cost_cents, started_at, finished_at')
        .order('started_at', { ascending: false })
        .limit(15),
      supabase
        .from('sandbox_agent_health')
        .select('agent_id, runs, pass_rate, avg_f1, baseline_f1, delta_f1, trend, computed_at')
        .order('computed_at', { ascending: false })
        .limit(200),
      supabase
        .from('sandbox_decision_scores')
        .select('scenario_id, agent_id, f1_score, scored_at')
        .order('scored_at', { ascending: false })
        .limit(300),
      supabase
        .from('sandbox_scenarios')
        .select('id, slug, title, category'),
      supabase
        .from('sandbox_lessons_learned')
        .select('id, agent_id, title, observation, severity, created_at')
        .eq('severity', 'critical')
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(25),
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

    return NextResponse.json({
      lastCronRun,
      batches,
      health,
      regressions,
      failingScenarios,
      needsReview: (lessonsRes.data ?? []) as LessonRow[],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
