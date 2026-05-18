import { createClient } from '@supabase/supabase-js';
import { MissionControlClient } from './MissionControlClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function loadData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const since7d = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

  const [agentsRes, runsRes, actionsRes, githubRes, insightsRes, statsRes] = await Promise.all([
    supabase
      .from('agents')
      .select('id, name, status, category, autonomy')
      .order('name'),
    supabase
      .from('agent_runs')
      .select('id, agent_id, status, summary, cost_cents, duration_ms, started_at, trigger')
      .order('started_at', { ascending: false })
      .limit(40),
    supabase
      .from('v_pending_agent_actions')
      .select('*')
      .limit(20),
    supabase
      .from('github_events')
      .select('id, event_type, action, repo, metadata, status, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('foreman_insights')
      .select('id, agent_id, category, severity, title, created_at')
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('agent_runs')
      .select('agent_id, status, cost_cents')
      .gte('started_at', since7d),
  ]);

  let memory: { id: string; category: string; title: string; vault_path: string; created_at: string }[] = [];
  try {
    const { data } = await supabase
      .from('memory_documents')
      .select('id, category, title, vault_path, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(8);
    memory = data ?? [];
  } catch {}

  const statsMap = new Map<string, { runs: number; successes: number; failures: number; costCents: number }>();
  for (const r of statsRes.data ?? []) {
    const cur = statsMap.get(r.agent_id as string) ?? { runs: 0, successes: 0, failures: 0, costCents: 0 };
    cur.runs += 1;
    if (r.status === 'succeeded') cur.successes += 1;
    if (r.status === 'failed') cur.failures += 1;
    cur.costCents += (r.cost_cents as number) ?? 0;
    statsMap.set(r.agent_id as string, cur);
  }

  const totalRuns7d = Array.from(statsMap.values()).reduce((s, x) => s + x.runs, 0);
  const totalCostCents7d = Array.from(statsMap.values()).reduce((s, x) => s + x.costCents, 0);
  const totalSuccesses7d = Array.from(statsMap.values()).reduce((s, x) => s + x.successes, 0);
  const agents = agentsRes.data ?? [];
  const actions = actionsRes.data ?? [];

  return {
    agents,
    runs: runsRes.data ?? [],
    actions,
    github: githubRes.data ?? [],
    memory,
    insights: insightsRes.data ?? [],
    agentStatsMap: Object.fromEntries(statsMap),
    metrics: {
      totalRuns7d,
      totalCostCents7d,
      successRate7d: totalRuns7d > 0 ? Math.round((totalSuccesses7d / totalRuns7d) * 100) : 0,
      activeAgents: agents.filter((a) => a.status === 'enabled').length,
      totalAgents: agents.length,
      pendingActions: actions.length,
    },
  };
}

export default async function MissionControlPage() {
  const data = await loadData();
  return <MissionControlClient {...data} />;
}
