/**
 * GET /api/sandbox/run-history
 *
 * Read-only run history for the Agent Training Arena.
 * Uses existing sandbox_* tables; no production data and no new persistence.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ScenarioJoin = {
  slug: string;
  title: string;
  category: string;
  agent_id: string;
  expected_action_types: string[] | null;
} | null;

type TrainingRunRow = {
  id: string;
  scenario_id: string;
  batch_id: string | null;
  trigger: string;
  status: string;
  duration_ms: number | null;
  cost_cents: number | null;
  started_at: string;
  finished_at: string | null;
  sandbox_scenarios: ScenarioJoin | ScenarioJoin[];
};

type ResponseRow = {
  id: string;
  training_run_id: string;
  summary: string | null;
  proposed_actions: Array<{ action_type?: string; preview?: string }> | null;
  llm_calls: number | null;
};

type ScoreRow = {
  response_id: string;
  precision_score: number | null;
  recall_score: number | null;
  f1_score: number | null;
  hit: boolean | null;
  scored_at: string;
};

type LessonRow = {
  scenario_id: string | null;
};

function firstJoin<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClientSafe();
  if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 25), 1), 100);

  try {
    const { data: runs, error: runsError } = await (supabase as any)
      .from('sandbox_training_runs')
      .select(`
        id,
        scenario_id,
        batch_id,
        trigger,
        status,
        duration_ms,
        cost_cents,
        started_at,
        finished_at,
        sandbox_scenarios(slug,title,category,agent_id,expected_action_types)
      `)
      .eq('environment', 'sandbox')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (runsError) throw runsError;

    const runRows = (runs ?? []) as TrainingRunRow[];
    const runIds = runRows.map((run) => run.id);
    const scenarioIds = runRows.map((run) => run.scenario_id).filter(Boolean);

    const [responsesResult, lessonsResult] = await Promise.all([
      runIds.length > 0
        ? (supabase as any)
            .from('sandbox_agent_responses')
            .select('id, training_run_id, summary, proposed_actions, llm_calls')
            .in('training_run_id', runIds)
            .eq('environment', 'sandbox')
        : Promise.resolve({ data: [], error: null }),
      scenarioIds.length > 0
        ? (supabase as any)
            .from('sandbox_lessons_learned')
            .select('scenario_id')
            .in('scenario_id', scenarioIds)
            .eq('environment', 'sandbox')
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (responsesResult.error) throw responsesResult.error;
    if (lessonsResult.error) throw lessonsResult.error;

    const responses = (responsesResult.data ?? []) as ResponseRow[];
    const responseIds = responses.map((response) => response.id);

    const scoresResult = responseIds.length > 0
      ? await (supabase as any)
          .from('sandbox_decision_scores')
          .select('response_id, precision_score, recall_score, f1_score, hit, scored_at')
          .in('response_id', responseIds)
          .eq('environment', 'sandbox')
      : { data: [], error: null };

    if (scoresResult.error) throw scoresResult.error;

    const responseByRun = new Map(responses.map((response) => [response.training_run_id, response]));
    const scoreByResponse = new Map(
      ((scoresResult.data ?? []) as ScoreRow[]).map((score) => [score.response_id, score]),
    );

    const lessonCounts = new Map<string, number>();
    for (const lesson of (lessonsResult.data ?? []) as LessonRow[]) {
      if (!lesson.scenario_id) continue;
      lessonCounts.set(lesson.scenario_id, (lessonCounts.get(lesson.scenario_id) ?? 0) + 1);
    }

    const history = runRows.map((run) => {
      const scenario = firstJoin(run.sandbox_scenarios);
      const response = responseByRun.get(run.id) ?? null;
      const score = response ? scoreByResponse.get(response.id) ?? null : null;

      return {
        id: run.id,
        batchId: run.batch_id,
        trigger: run.trigger,
        status: run.status,
        startedAt: run.started_at,
        finishedAt: run.finished_at,
        durationMs: run.duration_ms ?? 0,
        costCents: run.cost_cents ?? 0,
        scenario: {
          id: run.scenario_id,
          slug: scenario?.slug ?? null,
          title: scenario?.title ?? 'Unknown scenario',
          category: scenario?.category ?? 'unknown',
          agentId: scenario?.agent_id ?? 'unknown',
          expectedActionTypes: scenario?.expected_action_types ?? [],
        },
        response: response
          ? {
              summary: response.summary ?? '',
              proposedActions: response.proposed_actions ?? [],
              llmCalls: response.llm_calls ?? 0,
            }
          : null,
        score: score
          ? {
              precisionScore: Number(score.precision_score ?? 0),
              recallScore: Number(score.recall_score ?? 0),
              f1Score: Number(score.f1_score ?? 0),
              hit: Boolean(score.hit),
              scoredAt: score.scored_at,
            }
          : null,
        lessonCount: lessonCounts.get(run.scenario_id) ?? 0,
      };
    });

    return NextResponse.json({ history, count: history.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
