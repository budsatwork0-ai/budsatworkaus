/**
 * /dashboard/agents — overview of all agents, recent runs, and approval queue.
 *
 * Server component — fetches data from Supabase using the admin client.
 * Client interactions (run now / approve / reject) live in the child
 * components in _components/.
 */
import { createClient } from '@supabase/supabase-js';
import { AgentGrid } from './_components/AgentGrid';
import { ApprovalQueue } from './_components/ApprovalQueue';
import { RecentRuns } from './_components/RecentRuns';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function loadData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const [agentsRes, runsRes, actionsRes] = await Promise.all([
    supabase.from('agents').select('*').order('name'),
    supabase
      .from('agent_runs')
      .select('id, agent_id, status, summary, cost_cents, duration_ms, started_at, trigger')
      .order('started_at', { ascending: false })
      .limit(25),
    supabase
      .from('v_pending_agent_actions')
      .select('*')
      .limit(50),
  ]);

  // Pre-aggregate: per-agent stats over last 7 days
  const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const { data: rolling } = await supabase
    .from('agent_runs')
    .select('agent_id, status, cost_cents')
    .gte('started_at', since);

  const stats = new Map<string, { runs: number; successes: number; failures: number; costCents: number }>();
  for (const r of rolling ?? []) {
    const cur = stats.get(r.agent_id as string) ?? { runs: 0, successes: 0, failures: 0, costCents: 0 };
    cur.runs += 1;
    if (r.status === 'succeeded') cur.successes += 1;
    if (r.status === 'failed') cur.failures += 1;
    cur.costCents += r.cost_cents ?? 0;
    stats.set(r.agent_id as string, cur);
  }

  return {
    agents: agentsRes.data ?? [],
    runs: runsRes.data ?? [],
    actions: actionsRes.data ?? [],
    stats,
  };
}

export default async function AgentsDashboardPage() {
  const { agents, runs, actions, stats } = await loadData();

  const totalRuns7d = Array.from(stats.values()).reduce((s, x) => s + x.runs, 0);
  const totalCost7d = Array.from(stats.values()).reduce((s, x) => s + x.costCents, 0);
  const enabled = agents.filter((a) => a.status === 'enabled').length;

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      <header className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-zinc-600 mt-1">
            Autonomous helpers running the back office of Buds At Work.
          </p>
        </div>
        <div className="flex gap-6 text-sm">
          <Stat label="Active agents" value={`${enabled}/${agents.length}`} />
          <Stat label="Runs (7d)" value={totalRuns7d.toString()} />
          <Stat label="Cost (7d)" value={`$${(totalCost7d / 100).toFixed(2)}`} />
          <Stat label="Pending approvals" value={(actions.length).toString()} accent={actions.length > 0} />
        </div>
      </header>

      <AgentGrid agents={agents} stats={Object.fromEntries(stats)} />

      <section className="mt-10">
        <h2 className="text-lg font-medium mb-3">Pending approvals</h2>
        <ApprovalQueue actions={actions} />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium mb-3">Recent runs</h2>
        <RecentRuns runs={runs} agents={agents} />
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-right">
      <div className={`text-xl font-semibold ${accent ? 'text-amber-600' : 'text-zinc-900'}`}>{value}</div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
    </div>
  );
}
