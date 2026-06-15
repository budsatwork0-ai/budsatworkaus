/**
 * POST /api/sandbox/run-pack
 *
 * Server-side pack runner with SSE progress streaming and DB-level
 * cancellation. Creates a sandbox_run_batches record immediately and then
 * streams events while executing scenarios sequentially:
 *
 *   { type: 'started',   batchId, total }
 *   { type: 'progress',  batchId, index, total, scenarioSlug, scenarioTitle }
 *   { type: 'result',    batchId, index, total, scenarioSlug, agentId, result }
 *   { type: 'error',     batchId, index, scenarioSlug, error }
 *   { type: 'cancelled', batchId, completed }
 *   { type: 'complete',  batchId, passCount, total, avgF1, totalCost }
 *   { type: 'failed',    batchId, error }
 *
 * Accepts:
 *   { pack: 'all' | 'stress' | ScenarioCategory }
 *   OR the legacy form: { category?, difficulty?, slugs? }
 *
 * Cancellation: DELETE /api/sandbox/run-pack/[batchId] sets
 * status='cancelled'. The runner checks the DB between each scenario and
 * stops immediately if cancelled.
 *
 * The existing client sequential runner (startPackRun in page.tsx) remains
 * available as a fallback — this route is additive groundwork.
 *
 * Admin-gated. No production side effects.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { runSandboxScenario } from '@/lib/sandbox/arena';
import { SANDBOX_SCENARIOS } from '@/lib/sandbox/scenarios';
import type { ScenarioCategory, ScenarioDifficulty } from '@/lib/sandbox/scenarios';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const PASS_THRESHOLD = 0.5;

function resolvePack(body: Record<string, unknown>) {
  // New: { pack: 'all' | 'stress' | category }
  if (typeof body.pack === 'string') {
    const pack = body.pack;
    if (pack === 'all') return SANDBOX_SCENARIOS;
    if (pack === 'stress') return SANDBOX_SCENARIOS.filter((s) => s.slug === 'stress-agent-cascade');
    return SANDBOX_SCENARIOS.filter((s) => s.category === pack);
  }

  // Legacy: { category?, difficulty?, slugs? }
  let scenarios = SANDBOX_SCENARIOS;
  if (Array.isArray(body.slugs) && body.slugs.length > 0) {
    const slugSet = new Set(body.slugs as string[]);
    return scenarios.filter((s) => slugSet.has(s.slug));
  }
  if (typeof body.category === 'string') {
    scenarios = scenarios.filter((s) => s.category === (body.category as ScenarioCategory));
  }
  if (typeof body.difficulty === 'string') {
    scenarios = scenarios.filter((s) => s.difficulty === (body.difficulty as ScenarioDifficulty));
  }
  return scenarios;
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const scenarios = resolvePack(body as Record<string, unknown>);

  if (scenarios.length === 0) {
    return NextResponse.json({ error: 'No scenarios found for the given filters' }, { status: 400 });
  }

  const supabase = createServiceClientSafe();
  if (!supabase) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const { data: batchRow, error: batchErr } = await (supabase as any)
    .from('sandbox_run_batches')
    .insert({
      agent_id: `pack:${String(body.pack ?? body.category ?? 'custom')}`,
      trigger: 'manual',
      status: 'running',
      scenario_count: scenarios.length,
      pass_count: 0,
      avg_f1: null,
      total_cost_cents: 0,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (batchErr || !batchRow) {
    return NextResponse.json({ error: 'Failed to create batch record' }, { status: 500 });
  }

  const batchId: string = batchRow.id;
  const encoder = new TextEncoder();
  let ctrl!: ReadableStreamDefaultController<Uint8Array>;

  function emit(data: object) {
    try {
      ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch {
      // Stream already closed (client disconnected).
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    start(c) { ctrl = c; },
  });

  // Execute scenarios async while the ReadableStream is consumed by the client.
  (async () => {
    let passCount = 0;
    let totalCost = 0;
    let totalF1 = 0;
    let completed = 0;

    try {
      emit({ type: 'started', batchId, total: scenarios.length });

      for (const scenario of scenarios) {
        // Cancellation checkpoint — checked before each scenario.
        const { data: batchStatus } = await (supabase as any)
          .from('sandbox_run_batches')
          .select('status')
          .eq('id', batchId)
          .single();

        if (batchStatus?.status === 'cancelled') {
          emit({ type: 'cancelled', batchId, completed });
          return;
        }

        emit({
          type: 'progress',
          batchId,
          index: completed,
          total: scenarios.length,
          scenarioSlug: scenario.slug,
          scenarioTitle: scenario.title,
        });

        try {
          const result = await runSandboxScenario(scenario, {
            triggeredBy: user.id,
            batchId,
            trigger: 'manual',
          });
          completed += 1;
          if (result.score.f1Score >= PASS_THRESHOLD) passCount += 1;
          totalCost += result.costCents;
          totalF1 += result.score.f1Score;

          // Checkpoint: update batch progress after each scenario.
          await (supabase as any)
            .from('sandbox_run_batches')
            .update({ pass_count: passCount, total_cost_cents: totalCost })
            .eq('id', batchId);

          emit({
            type: 'result',
            batchId,
            index: completed,
            total: scenarios.length,
            scenarioSlug: scenario.slug,
            scenarioTitle: scenario.title,
            agentId: scenario.agentId,
            result: {
              status: result.status,
              f1Score: result.score.f1Score,
              precisionScore: result.score.precisionScore,
              recallScore: result.score.recallScore,
              hit: result.score.hit,
              costCents: result.costCents,
              durationMs: result.durationMs,
            },
          });
        } catch (scenarioErr) {
          completed += 1;
          emit({
            type: 'error',
            batchId,
            index: completed,
            scenarioSlug: scenario.slug,
            error: scenarioErr instanceof Error ? scenarioErr.message : String(scenarioErr),
          });
        }
      }

      const avgF1 = completed > 0 ? totalF1 / completed : 0;

      await (supabase as any)
        .from('sandbox_run_batches')
        .update({
          status: 'complete',
          pass_count: passCount,
          avg_f1: avgF1,
          total_cost_cents: totalCost,
          finished_at: new Date().toISOString(),
        })
        .eq('id', batchId);

      emit({ type: 'complete', batchId, passCount, total: completed, avgF1, totalCost });
    } catch (err) {
      await (supabase as any)
        .from('sandbox_run_batches')
        .update({ status: 'failed', finished_at: new Date().toISOString() })
        .eq('id', batchId);
      emit({ type: 'failed', batchId, error: err instanceof Error ? err.message : String(err) });
    } finally {
      try { ctrl.close(); } catch { /* already closed */ }
    }
  })();

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Batch-Id': batchId,
    },
  });
}
