/**
 * POST /api/agents/actions/[id]
 * Body: { decision: 'approve' | 'reject', notes?: string }
 * Approves and executes (or rejects) a queued agent action.
 *
 * PATCH /api/agents/actions/[id]
 * Body: { preview: string }
 * Updates the preview text of a pending action before approving.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth';
import { executeApprovedAction } from '@/lib/agents/runtime';
import { isDangerousAction } from '@/lib/bud/autonomy';
import { auditLog } from '@/lib/audit/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as { decision: 'approve' | 'reject'; notes?: string };
  if (!['approve', 'reject'].includes(body.decision)) {
    return NextResponse.json({ error: 'invalid decision' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: action, error: readErr } = await supabase
    .from('agent_actions')
    .select('id, action_type, payload, status, requires_approval, environment')
    .eq('id', id)
    .single();

  if (readErr || !action) {
    return NextResponse.json({ error: 'action not found' }, { status: 404 });
  }
  if (action.status !== 'pending') {
    return NextResponse.json({ error: `action is already ${action.status}` }, { status: 409 });
  }
  if (action.environment === 'sandbox') {
    return NextResponse.json({ error: 'sandbox actions cannot be executed from the production approval API' }, { status: 409 });
  }

  if (body.decision === 'approve') {
    const payload = (action.payload ?? {}) as Record<string, unknown>;
    const riskLevel = typeof payload.risk_level === 'string' ? payload.risk_level : 'medium';
    if (isDangerousAction(action.action_type as string) || ['high', 'critical'].includes(riskLevel)) {
      if (!body.notes?.trim()) {
        return NextResponse.json(
          { error: 'approval notes required for guarded actions' },
          { status: 400 },
        );
      }
    }
  }

  const { error: updateErr } = await supabase
    .from('agent_actions')
    .update({
      status: body.decision === 'approve' ? 'approved' : 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_notes: body.notes ?? null,
    })
    .eq('id', id)
    .eq('status', 'pending');

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  if (body.decision === 'approve') {
    try {
      await executeApprovedAction(id);
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : String(err) },
        { status: 500 },
      );
    }
  }

  await auditLog(supabase, {
    entity_type: 'agent_action',
    entity_id: id,
    action: body.decision === 'approve' ? 'approved' : 'rejected',
    source: 'admin',
    new_value: { decision: body.decision, notes: body.notes ?? null },
    user_email: user.email ?? undefined,
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as { preview?: string };
  if (!body.preview?.trim()) {
    return NextResponse.json({ error: 'preview required' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: action, error: readErr } = await supabase
    .from('agent_actions')
    .select('id, status, environment')
    .eq('id', id)
    .single();

  if (readErr || !action) return NextResponse.json({ error: 'action not found' }, { status: 404 });
  if (action.environment === 'sandbox') {
    return NextResponse.json({ error: 'sandbox actions cannot be edited from the production approval API' }, { status: 409 });
  }
  if (action.status !== 'pending') {
    return NextResponse.json({ error: `action is already ${action.status}` }, { status: 409 });
  }

  const { error } = await supabase
    .from('agent_actions')
    .update({ preview: body.preview.trim() })
    .eq('id', id)
    .eq('status', 'pending');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
