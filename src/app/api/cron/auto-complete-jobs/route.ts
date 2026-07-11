import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAutomationSettings, getRelativeDateString } from '@/lib/automations';
import { OrderStatus, JobAssignmentStatus } from '@/lib/types/status';

export const dynamic = 'force-dynamic';

type OrderWithAssignments = {
  id: string;
  status: string;
  scheduled_date: string | null;
  job_assignments?: Array<{ id: string; status: string }>;
};

function canAutoComplete(order: OrderWithAssignments): boolean {
  const assignments = order.job_assignments ?? [];
  if (assignments.length === 0) return false;
  if (assignments.some((a) => a.status === JobAssignmentStatus.declined || a.status === JobAssignmentStatus.available)) {
    return false;
  }
  return assignments.some((a) =>
    ([JobAssignmentStatus.accepted, JobAssignmentStatus.inProgress, JobAssignmentStatus.completed] as string[]).includes(a.status)
  );
}

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const automations = await getAutomationSettings();
  if (!automations.autoCompleteJobs) {
    return NextResponse.json({ ok: true, skipped: 'disabled' });
  }

  const cutoffDate = getRelativeDateString(-1);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orders, error } = await (client as any)
    .from('orders')
    .select(`
      id,
      status,
      scheduled_date,
      job_assignments ( id, status )
    `)
    .in('status', [OrderStatus.confirmed, OrderStatus.scheduled, OrderStatus.inProgress])
    .lte('scheduled_date', cutoffDate)
    .is('completed_at', null)
    .limit(100);

  if (error) {
    console.error('[cron/auto-complete-jobs] query failed:', error.message);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  const nowIso = new Date().toISOString();
  let completed = 0;
  let skipped = 0;

  for (const order of (orders ?? []) as OrderWithAssignments[]) {
    if (!canAutoComplete(order)) {
      skipped++;
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any)
      .from('orders')
      .update({
        status: OrderStatus.completed,
        completed_at: nowIso,
        auto_completed_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', order.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any)
      .from('job_assignments')
      .update({
        status: JobAssignmentStatus.completed,
        completed_at: nowIso,
        updated_at: nowIso,
      })
      .eq('order_id', order.id)
      .neq('status', JobAssignmentStatus.declined)
      .neq('status', JobAssignmentStatus.completed);

    completed++;
  }

  // Stale detection: find in_progress orders whose status hasn't changed in 48+ hours.
  // Writes a bud_insights record per stuck order so Mission Control surfaces them.
  const staleThreshold = new Date(Date.now() - 48 * 3600_000).toISOString();
  let stuckFlagged = 0;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: stuckOrders } = await (client as any)
      .from('orders')
      .select('id, scheduled_date, status_updated_at')
      .eq('status', OrderStatus.inProgress)
      .eq('environment', 'production')
      .lt('status_updated_at', staleThreshold)
      .limit(20);

    for (const order of (stuckOrders ?? []) as Array<{ id: string; scheduled_date: string | null; status_updated_at: string | null }>) {
      // Dedup: skip if an unresolved stuck_job insight already exists for this order
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (client as any)
        .from('bud_insights')
        .select('id')
        .eq('category', 'stuck_job')
        .is('resolved_at', null)
        .eq('metadata->>order_id', order.id)
        .maybeSingle();

      if (existing) continue;

      const hoursStuck = order.status_updated_at
        ? Math.round((Date.now() - new Date(order.status_updated_at).getTime()) / 3_600_000)
        : null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (client as any).from('bud_insights').insert({
        agent_id: 'auto-complete-jobs',
        category: 'stuck_job',
        severity: hoursStuck !== null && hoursStuck > 72 ? 'critical' : 'warning',
        title: `Job ${order.id.slice(0, 8)} stuck in_progress${hoursStuck !== null ? ` for ${hoursStuck}h` : ''}`,
        body: order.scheduled_date
          ? `Scheduled ${order.scheduled_date}. Status has not changed in over 48 hours.`
          : 'Status has not changed in over 48 hours.',
        metadata: {
          order_id: order.id,
          scheduled_date: order.scheduled_date,
          status_updated_at: order.status_updated_at,
          hours_stuck: hoursStuck,
        },
      });

      stuckFlagged++;
    }
  } catch (err) {
    console.error('[cron/auto-complete-jobs] stale detection failed:', err);
  }

  return NextResponse.json({
    ok: true,
    cutoffDate,
    completed,
    skipped,
    stuck_flagged: stuckFlagged,
  });
}
