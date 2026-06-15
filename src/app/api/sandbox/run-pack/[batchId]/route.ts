/**
 * GET  /api/sandbox/run-pack/[batchId]  — poll batch progress
 * DELETE /api/sandbox/run-pack/[batchId] — cancel a running batch
 *
 * Admin-gated. Read-only GET; DELETE sets status='cancelled' so the SSE
 * runner stops between scenarios.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ batchId: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { batchId } = await ctx.params;

  const supabase = createServiceClientSafe();
  if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { data: batch, error } = await (supabase as any)
    .from('sandbox_run_batches')
    .select('id, status, scenario_count, pass_count, avg_f1, total_cost_cents, started_at, finished_at')
    .eq('id', batchId)
    .single();

  if (error || !batch) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
  }

  // Count completed (non-running) training runs linked to this batch for
  // fine-grained progress without polling the SSE stream.
  const { count: completedCount } = await (supabase as any)
    .from('sandbox_training_runs')
    .select('id', { count: 'exact', head: true })
    .eq('batch_id', batchId)
    .neq('status', 'running');

  return NextResponse.json({ ...batch, completedCount: completedCount ?? 0 });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { batchId } = await ctx.params;

  const supabase = createServiceClientSafe();
  if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { error } = await (supabase as any)
    .from('sandbox_run_batches')
    .update({ status: 'cancelled', finished_at: new Date().toISOString() })
    .eq('id', batchId)
    .in('status', ['running', 'pending']);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, batchId, status: 'cancelled' });
}
