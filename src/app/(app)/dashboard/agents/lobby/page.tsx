/**
 * /dashboard/agents/lobby — Bud Command Console
 *
 * Server component: loads the latest Bud lobby state + agent roster +
 * recent events. Passes everything to BudConsole which handles realtime
 * subscriptions and adaptive rendering.
 */
import { createClient } from '@supabase/supabase-js';
import { BudConsole } from './_components/BudConsole';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function loadInitial() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const since1h = new Date(Date.now() - 3600_000).toISOString();

  const [agentsRes, lobbyStateRes, recentRunsRes, pendingRes, insightsRes] = await Promise.all([
    supabase
      .from('agents')
      .select('id, name, description, category, autonomy, status, schedule')
      .order('name'),
    supabase
      .from('bud_lobby_states')
      .select('*')
      .eq('is_current', true)
      .maybeSingle(),
    supabase
      .from('agent_runs')
      .select('id, agent_id, status, summary, started_at, finished_at')
      .gte('started_at', since1h)
      .order('started_at', { ascending: false })
      .limit(80),
    supabase
      .from('agent_actions')
      .select('id, agent_id, preview, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase
      .from('bud_insights')
      .select('id, agent_id, workflow_id, category, severity, title, created_at')
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  return {
    agents:     agentsRes.data ?? [],
    lobbyState: lobbyStateRes.data ?? null,
    runs:       recentRunsRes.data ?? [],
    pending:    pendingRes.data ?? [],
    insights:   insightsRes.data ?? [],
  };
}

export default async function AgentLobbyPage() {
  const data = await loadInitial();
  return <BudConsole initial={data} />;
}
