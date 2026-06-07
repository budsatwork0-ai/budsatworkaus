/**
 * GET /api/agents/reap-zombies
 *
 * Dedicated cron handler for zombie run cleanup. Finds agent_runs stuck in
 * 'running' past their wall-clock deadline and marks them failed.
 *
 * Runs on its own schedule (every 10 min) so it is not duplicated across
 * every agent cron invocation. Logged to resilience_events so Mission
 * Control can surface stuck-run incidents.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { reapZombieRuns } from '@/lib/agents/resilience';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const provided = req.headers.get('authorization') ?? url.searchParams.get('secret');
  if (provided !== `Bearer ${process.env.CRON_SECRET}` && provided !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = adminClient();

  try {
    const result = await reapZombieRuns(supabase);

    if (result.reaped > 0) {
      console.log(`[reap-zombies] cleared ${result.reaped} stuck run(s): ${result.runIds.join(', ')}`);
      await supabase.from('resilience_events').insert({
        guard: 'zombie_reaper',
        event_type: 'runs_reaped',
        payload: { reaped_count: result.reaped, run_ids: result.runIds },
      }).then(() => {/* fire-and-forget */});
    }

    return NextResponse.json({ reaped: result.reaped, runIds: result.runIds });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[reap-zombies] error: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
