/**
 * POST /api/agents/actions/bulk
 * Body: { ids: string[] }
 * Bulk-approves pending agent actions that share the same action_type,
 * source_agent, and risk_level. High/critical risk and dangerous action types
 * are rejected — individual approval with notes is required for those.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth';
import { executeApprovedAction } from '@/lib/agents/runtime';
import { isDangerousAction } from '@/lib/bud/autonomy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as { ids?: unknown };
  const ids = body.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50) {
    return NextResponse.json({ error: 'ids must be a non-empty array of up to 50' }, { status: 400 });
  }
  if (!ids.every((id) => typeof id === 'string')) {
    return NextResponse.json({ error: 'all ids must be strings' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: actions, error: readErr } = await supabase
    .from('agent_actions')
    .select('id, action_type, agent_id, payload, status')
    .in('id', ids as string[]);

  if (readErr || !actions) {
    return NextResponse.json({ error: 'failed to load actions' }, { status: 500 });
  }

  // All must be pending — idempotency guard
  const nonPending = actions.filter((a) => a.status !== 'pending');
  if (nonPending.length > 0) {
    return NextResponse.json(
      { error: `${nonPending.length} action(s) are not pending` },
      { status: 409 },
    );
  }

  // Homogeneity checks — the UI enforces these but the server validates too
  const actionTypes = new Set(actions.map((a) => a.action_type as string));
  if (actionTypes.size > 1) {
    return NextResponse.json({ error: 'all actions must share the same action_type' }, { status: 400 });
  }

  const agentIds = new Set(actions.map((a) => a.agent_id as string));
  if (agentIds.size > 1) {
    return NextResponse.json({ error: 'all actions must share the same source_agent' }, { status: 400 });
  }

  const getRisk = (a: { payload: unknown }) => {
    const p = (a.payload ?? {}) as Record<string, unknown>;
    return typeof p.risk_level === 'string' ? p.risk_level : 'medium';
  };
  const riskLevels = new Set(actions.map(getRisk));
  if (riskLevels.size > 1) {
    return NextResponse.json({ error: 'all actions must share the same risk_level' }, { status: 400 });
  }

  const riskLevel = [...riskLevels][0];
  if (['high', 'critical'].includes(riskLevel)) {
    return NextResponse.json(
      { error: 'bulk approve is not available for high or critical risk actions — approve individually with notes' },
      { status: 400 },
    );
  }

  const actionType = [...actionTypes][0];
  if (isDangerousAction(actionType)) {
    return NextResponse.json(
      { error: 'bulk approve is not available for dangerous action types' },
      { status: 400 },
    );
  }

  // Process sequentially — each gets its own audit row
  const now = new Date().toISOString();
  let approved = 0;
  const failed: Array<{ id: string; error: string }> = [];

  for (const action of actions) {
    const { error: updateErr } = await supabase
      .from('agent_actions')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: now,
        review_notes: 'bulk approved',
      })
      .eq('id', action.id)
      .eq('status', 'pending');

    if (updateErr) {
      failed.push({ id: action.id as string, error: updateErr.message });
      continue;
    }

    try {
      await executeApprovedAction(action.id as string);
      approved++;
    } catch (err) {
      failed.push({ id: action.id as string, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ ok: true, approved, failed });
}
