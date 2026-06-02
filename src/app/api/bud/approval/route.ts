/**
 * GET  /api/bud/approval  — list pending approval items
 * POST /api/bud/approval  — approve or reject an item
 *   Body: { id: string, decision: 'approved' | 'rejected', notes?: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth';
import { executeRepairPlan } from '@/lib/bud/orchestrator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function GET(_req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const supabase = adminClient();
  const { data, error } = await supabase
    .from('bud_approval_queue')
    .select('*, bud_tasks(description, source_agent, risk_level, confidence)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as {
    id?: string;
    decision?: 'approved' | 'rejected';
    notes?: string;
  };

  if (!body.id || !body.decision) {
    return NextResponse.json({ error: 'id and decision required' }, { status: 400 });
  }

  const supabase = adminClient();

  const { data: item, error: fetchErr } = await supabase
    .from('bud_approval_queue')
    .select('*, bud_tasks(id, status, risk_level, linked_pr)')
    .eq('id', body.id)
    .eq('status', 'pending')
    .single();

  if (fetchErr || !item) {
    return NextResponse.json({ error: 'Pending approval item not found' }, { status: 404 });
  }

  if (body.decision === 'approved') {
    const task = Array.isArray(item.bud_tasks) ? item.bud_tasks[0] : item.bud_tasks;
    const payload = (item.payload ?? {}) as Record<string, unknown>;
    const riskLevel = task?.risk_level ?? null;
    const diff = payload.diff ?? payload.diff_summary ?? payload.patch;
    const linkedPr = task?.linked_pr ?? payload.pr_url;
    if (['blocked', 'failed', 'archived', 'completed'].includes(task?.status ?? '')) {
      return NextResponse.json({ error: 'Cannot approve a blocked, archived, completed, or failed Bud task' }, { status: 409 });
    }
    if (['high', 'critical'].includes(String(riskLevel)) && !diff && !linkedPr) {
      return NextResponse.json(
        { error: 'High-risk Bud approval requires a diff summary or linked PR before approval' },
        { status: 400 },
      );
    }
  }

  // Update the approval record
  const { data: updated, error: updateErr } = await supabase
    .from('bud_approval_queue')
    .update({
      status: body.decision,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      notes: body.notes ?? null,
    })
    .eq('id', body.id)
    .eq('status', 'pending')
    .select('id')
    .single();
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  if (!updated) {
    return NextResponse.json({ error: 'Approval is no longer pending' }, { status: 409 });
  }

  // If there's a linked task, execute the repair plan
  const linkedTask = Array.isArray(item.bud_tasks) ? item.bud_tasks[0] : item.bud_tasks;
  const taskId = linkedTask?.id ?? item.task_id;
  if (taskId) {
    try {
      await executeRepairPlan(supabase, taskId, body.decision === 'approved');
    } catch (err) {
      // Non-fatal — the approval record was already updated
      console.error('executeRepairPlan error:', err);
    }
  }

  return NextResponse.json({ ok: true, decision: body.decision });
}
