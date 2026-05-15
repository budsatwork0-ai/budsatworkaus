/**
 * POST /api/agents/actions/[id]
 * Body: { decision: 'approve' | 'reject', notes?: string }
 *
 * Approves and executes (or rejects) a queued agent action.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth';
import { executeApprovedAction } from '@/lib/agents/runtime';

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

  await supabase
    .from('agent_actions')
    .update({
      status: body.decision === 'approve' ? 'approved' : 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_notes: body.notes ?? null,
    })
    .eq('id', id);

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

  return NextResponse.json({ ok: true });
}
