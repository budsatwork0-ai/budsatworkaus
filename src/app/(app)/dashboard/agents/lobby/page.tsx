/**
 * /dashboard/agents/lobby — live "video-game" view of all agents working.
 *
 * Server component: pulls the current agent roster + recent runs + pending
 * approvals + recent design insights, hands them to the client component
 * which streams updates via Supabase Realtime.
 */
import { createClient } from '@supabase/supabase-js';
import { LobbyClient } from './_components/LobbyClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function loadInitial() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const since5m = new Date(Date.now() - 5 * 60_000).toISOString();
  const since1d = new Date(Date.now() - 24 * 3600_000).toISOString();

  const [agentsRes, recentRunsRes, pendingRes, insightsRes, themeRes] = await Promise.all([
    supabase.from('agents').select('id, name, description, category, autonomy, status, schedule').order('name'),
    supabase
      .from('agent_runs')
      .select('id, agent_id, status, summary, started_at, finished_at')
      .gte('started_at', since5m)
      .order('started_at', { ascending: false })
      .limit(50),
    supabase.from('agent_actions').select('id, agent_id, preview, created_at').eq('status', 'pending'),
    supabase
      .from('design_insights')
      .select('id, agent_id, page_path, title, severity, created_at')
      .gte('created_at', since1d)
      .order('severity', { ascending: false })
      .limit(10),
    supabase.from('lobby_themes').select('id, name, tokens').eq('active', true).maybeSingle(),
  ]);

  return {
    agents: agentsRes.data ?? [],
    runs: recentRunsRes.data ?? [],
    pending: pendingRes.data ?? [],
    insights: insightsRes.data ?? [],
    theme: themeRes.data ?? null,
  };
}

export default async function AgentLobbyPage() {
  const data = await loadInitial();
  return <LobbyClient initial={data} />;
}
