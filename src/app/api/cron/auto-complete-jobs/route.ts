import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAutomationSettings, getRelativeDateString } from '@/lib/automations';

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
  if (assignments.some((assignment) => assignment.status === 'declined' || assignment.status === 'available')) {
    return false;
  }
  return assignments.some((assignment) =>
    ['accepted', 'in_progress', 'completed'].includes(assignment.status)
  );
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
    .in('status', ['confirmed', 'scheduled', 'in_progress'])
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
        status: 'completed',
        completed_at: nowIso,
        auto_completed_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', order.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any)
      .from('job_assignments')
      .update({
        status: 'completed',
        completed_at: nowIso,
        updated_at: nowIso,
      })
      .eq('order_id', order.id)
      .neq('status', 'declined')
      .neq('status', 'completed');

    completed++;
  }

  return NextResponse.json({
    ok: true,
    cutoffDate,
    completed,
    skipped,
  });
}
