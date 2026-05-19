import { createClient } from '@supabase/supabase-js';
import { MissionControlClient } from './MissionControlClient';
import { evaluateGlobalHealth } from '@/lib/bud/health';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function loadData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const since7d = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

  const [agentsRes, runsRes, actionsRes, githubRes, insightsRes, statsRes, budStateRes, budActivityRes, budApprovalsRes] = await Promise.all([
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
      .from('bud_insights')
      .select('id, agent_id, category, severity, title, created_at')
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('agent_runs')
      .select('agent_id, status, cost_cents, duration_ms')
      .gte('started_at', since7d),
    supabase
      .from('bud_lobby_states')
      .select('bud_state, operational_status, summary')
      .eq('is_current', true)
      .maybeSingle(),
    supabase
      .from('bud_activity_feed')
      .select('id, event_type, narrative, actor, target, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('bud_approval_queue')
      .select('id, task_id, action_type, payload, status, requested_by, reviewed_by, reviewed_at, notes, created_at, bud_tasks(description, source_agent, risk_level, confidence)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10),
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

  const rawStats = new Map<string, {
    runs: number; successes: number; failures: number;
    costCents: number; totalDurationMs: number; durationCount: number;
  }>();
  for (const r of statsRes.data ?? []) {
    const cur = rawStats.get(r.agent_id as string) ?? {
      runs: 0, successes: 0, failures: 0, costCents: 0, totalDurationMs: 0, durationCount: 0,
    };
    cur.runs += 1;
    if (r.status === 'succeeded') cur.successes += 1;
    if (r.status === 'failed') cur.failures += 1;
    cur.costCents += (r.cost_cents as number) ?? 0;
    if (r.duration_ms != null) {
      cur.totalDurationMs += r.duration_ms as number;
      cur.durationCount += 1;
    }
    rawStats.set(r.agent_id as string, cur);
  }

  const statsMap = new Map(
    Array.from(rawStats.entries()).map(([id, s]) => [
      id,
      {
        runs: s.runs,
        successes: s.successes,
        failures: s.failures,
        costCents: s.costCents,
        avgDurationMs: s.durationCount > 0 ? Math.round(s.totalDurationMs / s.durationCount) : 0,
      },
    ]),
  );

  const totalRuns7d = Array.from(rawStats.values()).reduce((s, x) => s + x.runs, 0);
  const totalCostCents7d = Array.from(rawStats.values()).reduce((s, x) => s + x.costCents, 0);
  const totalSuccesses7d = Array.from(rawStats.values()).reduce((s, x) => s + x.successes, 0);
  const agents = agentsRes.data ?? [];
  const actions = actionsRes.data ?? [];
  const runs = runsRes.data ?? [];
  const budApprovals = (budApprovalsRes.data ?? []) as import('@/lib/bud/types').BudApprovalItem[];

  const githubData = githubRes.data ?? [];
  const vercelConnected = githubData.some((e) => e.event_type === 'deployment_status');

  const budState = budStateRes.data;
  const globalHealth = evaluateGlobalHealth({
    agents,
    runs,
    actions: [
      ...actions,
      ...budApprovals.map((approval) => ({
        id: approval.id,
        agent_id: null,
        status: approval.status,
      })),
    ],
    unresolvedAlerts: insightsRes.data?.length ?? 0,
  });

  return {
    agents,
    runs,
    actions,
    github: githubData,
    memory,
    insights: insightsRes.data ?? [],
    agentStatsMap: Object.fromEntries(statsMap),
    supabaseConnected: true,
    vercelConnected,
    metrics: {
      totalRuns7d,
      totalCostCents7d,
      successRate7d: totalRuns7d > 0 ? Math.round((totalSuccesses7d / totalRuns7d) * 100) : 0,
      activeAgents: agents.filter((a) => a.status === 'enabled').length,
      totalAgents: agents.length,
      pendingActions: actions.length + budApprovals.length,
    },
    budState: (budState?.bud_state ?? 'idle') as import('@/lib/bud/types').BudState,
    budStatus: globalHealth.bud_status,
    budSummary: globalHealth.is_nominal ? budState?.summary ?? null : globalHealth.summary,
    budActivity: (budActivityRes.data ?? []) as import('@/lib/bud/types').BudActivityEvent[],
    budApprovals,
    globalHealth,
  };
}

export default async function MissionControlPage() {
  const data = await loadData();
  return <MissionControlClient {...data} />;
}
