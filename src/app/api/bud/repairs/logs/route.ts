import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function GET(req: NextRequest) {
  const executionId = req.nextUrl.searchParams.get('execution_id');
  if (!executionId) {
    return NextResponse.json({ logs: [], steps: [], rollbackEvents: [] });
  }

  const supabase = db();

  const [logsRes, stepsRes, rollbackRes] = await Promise.all([
    supabase
      .from('bud_repair_logs')
      .select('id, execution_id, level, message, created_at')
      .eq('execution_id', executionId)
      .order('created_at', { ascending: true })
      .limit(200),
    supabase
      .from('bud_repair_steps')
      .select('id, execution_id, state, status, summary, started_at')
      .eq('execution_id', executionId)
      .order('started_at', { ascending: true }),
    supabase
      .from('bud_rollback_events')
      .select('id, execution_id, agent_id, trigger, created_at')
      .eq('execution_id', executionId)
      .order('created_at', { ascending: false }),
  ]);

  return NextResponse.json({
    logs: logsRes.data ?? [],
    steps: stepsRes.data ?? [],
    rollbackEvents: rollbackRes.data ?? [],
  });
}
