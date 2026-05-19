/**
 * POST /api/agents/runs/[id]/archive
 *
 * Soft-archives an agent run so it no longer appears in Mission Control.
 *
 * TODO: add an 'archived' status variant to agent_runs once the schema migration
 * is ready. For now this marks the run as 'cancelled' as a placeholder so the
 * UI can hide it optimistically without touching production data destructively.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // TODO: replace 'cancelled' with 'archived' once migration 043_agent_run_archive.sql lands
  const { error } = await supabase
    .from('agent_runs')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .in('status', ['succeeded', 'failed', 'needs_approval']);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
