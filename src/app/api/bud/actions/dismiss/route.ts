import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth';
import { writeBudActivity } from '@/lib/bud/orchestrator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function updateManyCandidates(supabase: ReturnType<typeof adminClient>, id: string, userId: string) {
  const now = new Date().toISOString();
  await Promise.all([
    supabase.from('admin_ux_proposals').update({ status: 'rejected' }).eq('id', id),
    supabase.from('design_insights').update({ status: 'rejected', reviewed_by: userId, reviewed_at: now }).eq('id', id),
    supabase.from('agent_evolutions').update({ status: 'rejected', reviewed_by: userId, reviewed_at: now }).eq('id', id),
  ]);
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as {
    source?: string;
    id?: string;
  };
  if (!body.source || !body.id) {
    return NextResponse.json({ error: 'source and id required' }, { status: 400 });
  }

  const supabase = adminClient();
  const now = new Date().toISOString();

  try {
    if (body.source === 'bud_insight') {
      await supabase.from('bud_insights').update({ resolved_at: now }).eq('id', body.id);
    } else if (body.source === 'bud_approval') {
      await supabase.from('bud_approval_queue').update({ status: 'rejected', reviewed_by: user.id, reviewed_at: now, notes: 'Dismissed from Bud OS' }).eq('id', body.id);
    } else if (body.source === 'agent_action') {
      await supabase.from('agent_actions').update({ status: 'rejected', reviewed_by: user.id, reviewed_at: now, review_notes: 'Dismissed from Bud OS' }).eq('id', body.id);
    } else if (body.source === 'repair_session' || body.source === 'bud_task') {
      await supabase.from('bud_tasks').update({ status: 'archived', updated_at: now }).eq('id', body.id);
    } else if (body.source === 'ux_evolution') {
      await updateManyCandidates(supabase, body.id, user.id);
    }

    await writeBudActivity(supabase, `Bud dismissed ${body.source}`, {
      event_type: 'completion',
      actor: 'bud',
      target: body.source,
      metadata: { id: body.id, dismissed_by: user.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
