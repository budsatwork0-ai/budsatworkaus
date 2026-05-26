import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { Suspense } from 'react';
import MissionControlAutonomy from './_components/MissionControlAutonomy';
import type { PipelineSurface } from '@/lib/pipeline/types';

const VALID_SURFACES: PipelineSurface[] = ['public', 'admin', 'crew', 'customer'];
import { MissionControlClient } from './MissionControlClient';
import { computeMissionControlHealth } from '@/lib/bud/health';
import { buildBudOsActionQueue, buildBudOsAutonomy, buildBudOsMemoryLayer, buildBudOsWorkforce, deriveBudOsState } from '@/lib/bud/os-view-model';
import { buildUxEvolutionRecommendations } from '@/lib/bud/ux-evolution-engine';
import { computeBudAuthority, type BudAuthorityLevel } from '@/lib/bud/authority';
import { getBudCapabilities } from '@/lib/bud/capabilities';
import { buildStructuredFailures } from '@/lib/bud/structured-failure';
import { buildBudInitiatives } from '@/lib/bud/initiatives';
import { buildThoughtStream } from '@/lib/bud/thought-stream';
import { BUD_AUTHORITY_COOKIE } from '@/lib/bud/authority';
import { getCircuitSummary } from '@/lib/agents/resilience';
import type { DevOsResponse } from '@/app/api/dev-os/route';

const VALID_CEILINGS: BudAuthorityLevel[] = [
  'L0_OBSERVER',
  'L1_ASSISTANT',
  'L2_OPERATOR',
  'L3_AUTONOMOUS_OPERATOR',
  'L4_SELF_EVOLVING_SYSTEM',
];

async function resolveAuthorityCeiling(): Promise<BudAuthorityLevel> {
  const store = await cookies();
  const cookieValue = store.get(BUD_AUTHORITY_COOKIE)?.value;
  if (cookieValue && VALID_CEILINGS.includes(cookieValue as BudAuthorityLevel)) {
    return cookieValue as BudAuthorityLevel;
  }
  const envValue = process.env.BUD_AUTHORITY_CEILING;
  if (envValue && VALID_CEILINGS.includes(envValue as BudAuthorityLevel)) {
    return envValue as BudAuthorityLevel;
  }
  return 'L3_AUTONOMOUS_OPERATOR';
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function loadData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const [agentsRes, runsRes, actionsRes, githubRes, insightsRes, statsRes, budStateRes, budActivityRes, budApprovalsRes, budTasksRes, changeRequestsRes, repairExecutionsRes, repairStepsRes, repairLearningsRes, adminUxRes, designInsightsRes, agentEvolutionsRes, efficiencyFindingsRes] = await Promise.all([
    supabase
      .from('agents')
      .select('id, name, status, category, autonomy')
      .order('name'),
    supabase
      .from('agent_runs')
      .select('id, agent_id, status, summary, error, cost_cents, duration_ms, started_at, trigger')
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
      .from('v_agent_stats_7d')
      .select('agent_id, runs, successes, failures, cost_cents, avg_duration_ms'),
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
    supabase
      .from('bud_tasks')
      .select('id, source_agent, target_agent, status, confidence, risk_level, description, autonomy_level, linked_issue, linked_pr, linked_deployment, linked_memory_note, created_at, updated_at')
      .in('status', [
        'pending',
        'detected',
        'reproducing',
        'analyzing',
        'planning',
        'awaiting_approval',
        'patching',
        'validating',
        'deploying',
        'verifying',
        'monitoring',
        'recovered',
        'rolled_back',
        'blocked',
        'in_progress',
        'completed',
        'failed',
      ])
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('bud_change_requests')
      .select('id, task_id, branch_name, issue_url, pr_url, deployment_url, status, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('bud_repair_executions')
      .select('id, task_id, status, root_cause_type, root_cause_summary, repair_strategy, diff_summary, deployment_url, verification_status, ci_conclusion, ci_run_url, taste_score, taste_pass, taste_violations, taste_suggestions, browser_tests_passed, browser_tests_failed, browser_tests_total, browser_test_status, pr_url, issue_url, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('bud_repair_steps')
      .select('id, execution_id, state, status, summary, started_at')
      .order('started_at', { ascending: false })
      .limit(80),
    supabase
      .from('bud_repair_learnings')
      .select('id, root_cause_type, fix_pattern, outcome, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('admin_ux_proposals')
      .select('id, page_path, audience, severity, title, body, proposed_change, status, created_at')
      .in('status', ['new', 'reviewing', 'accepted'])
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('design_insights')
      .select('id, page_path, insight_type, severity, title, body, proposed_change, status, created_at')
      .in('status', ['new', 'reviewing', 'accepted'])
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('agent_evolutions')
      .select('id, target_agent_id, evolution_type, rationale, proposed_diff, status, created_at')
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('efficiency_findings')
      .select('id, domain, title, severity, priority, body, affected_agents, proposed_fix, estimated_saving, automation_candidate, created_at')
      .in('status', ['new', 'reviewing'])
      .order('created_at', { ascending: false })
      .limit(20),
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

  const statsMap = new Map(
    (statsRes.data ?? []).map((r) => [
      r.agent_id as string,
      {
        runs: (r.runs as number) ?? 0,
        successes: (r.successes as number) ?? 0,
        failures: (r.failures as number) ?? 0,
        costCents: (r.cost_cents as number) ?? 0,
        avgDurationMs: (r.avg_duration_ms as number) ?? 0,
      },
    ]),
  );

  const totalRuns7d = (statsRes.data ?? []).reduce((s, r) => s + ((r.runs as number) ?? 0), 0);
  const totalCostCents7d = (statsRes.data ?? []).reduce((s, r) => s + ((r.cost_cents as number) ?? 0), 0);
  const totalSuccesses7d = (statsRes.data ?? []).reduce((s, r) => s + ((r.successes as number) ?? 0), 0);
  const agents = agentsRes.data ?? [];
  const actions = actionsRes.data ?? [];
  const runs = runsRes.data ?? [];
  const budApprovals = (budApprovalsRes.data ?? []) as import('@/lib/bud/types').BudApprovalItem[];

  const githubData = githubRes.data ?? [];
  const budTasks = budTasksRes.data ?? [];
  const changeRequests = changeRequestsRes.data ?? [];
  const vercelConnected = githubData.some((e) => e.event_type === 'deployment_status');

  const budState = budStateRes.data;
  const commandState = computeMissionControlHealth({
    agents,
    runs,
    actions,
    budApprovals: budApprovals.map((approval) => ({
      id: approval.id,
      agent_id: null,
      status: approval.status,
    })),
    tasks: budTasks,
    changeRequests,
    github: githubData,
    insights: insightsRes.data ?? [],
    memory,
  });
  const uxEvolution = buildUxEvolutionRecommendations({
    adminUxProposals: adminUxRes.data ?? [],
    designInsights: designInsightsRes.data ?? [],
    agentEvolutions: agentEvolutionsRes.data ?? [],
    budInsights: insightsRes.data ?? [],
    memory,
    failedRuns: runs.filter((run) => ['failed', 'needs_repair'].includes(run.status as string)).map((run) => ({
      id: run.id as string,
      agent_id: run.agent_id as string,
      status: run.status as string,
      summary: run.summary as string | null,
      started_at: run.started_at as string,
    })),
  });
  const agentNameById = new Map<string, string>(agents.map((a) => [a.id as string, (a.name ?? a.id) as string]));
  const structuredFailures = buildStructuredFailures({
    runs: runs.map((r) => ({
      id: r.id as string,
      agent_id: r.agent_id as string | null,
      status: r.status as string,
      summary: r.summary as string | null,
      error: r.error as string | null | undefined,
      started_at: r.started_at as string,
    })),
    agentNameById,
  });
  const initiatives = buildBudInitiatives({ commandState, uxEvolution, structuredFailures });
  let devOs: DevOsResponse = { sessions: [], agentStats: {}, totalSessions: 0, conventionCount: 0 };
  try {
    const devOsRes = await supabase
      .from('dev_os_sessions')
      .select('id, session_id, agents_used, task, files_changed, summary, risk_level, created_at')
      .order('created_at', { ascending: false })
      .limit(30);
    const conventionRes = await supabase
      .from('convention_learnings')
      .select('id', { count: 'exact', head: true });
    const sessions = (devOsRes.data ?? []) as DevOsResponse['sessions'];
    const agentStats: DevOsResponse['agentStats'] = {};
    for (const session of sessions) {
      for (const agentId of session.agents_used) {
        if (!agentStats[agentId]) agentStats[agentId] = { runCount: 0, lastRunAt: null };
        agentStats[agentId].runCount++;
        if (!agentStats[agentId].lastRunAt || session.created_at > agentStats[agentId].lastRunAt!) {
          agentStats[agentId].lastRunAt = session.created_at;
        }
      }
    }
    devOs = { sessions, agentStats, totalSessions: sessions.length, conventionCount: conventionRes.count ?? 0 };
  } catch { /* dev_os_sessions may not exist yet — degrade gracefully */ }

  const [configuredCeiling, circuit] = await Promise.all([
    resolveAuthorityCeiling(),
    getCircuitSummary().catch(() => ({ state: 'closed' as const, resetsAt: null, failureStreak: 0, label: 'API healthy' })),
  ]);
  const authority = computeBudAuthority({
    commandState,
    configuredCeiling,
    learnings: (repairLearningsRes.data ?? []).map((l) => ({
      id: l.id as string,
      outcome: (l.outcome as string) ?? '',
      created_at: l.created_at as string,
    })),
  });
  const capabilities = getBudCapabilities({
    commandState,
    authority,
    githubConnected: githubData.length > 0,
    deploymentConnected: vercelConnected,
    memoryConnected: commandState.memory.connected,
  });
  const thoughtStream = buildThoughtStream({
    commandState,
    activity: (budActivityRes.data ?? []) as import('@/lib/bud/types').BudActivityEvent[],
    failures: structuredFailures,
    initiatives,
  });

  const budOsState = deriveBudOsState(commandState, (budState?.bud_state ?? 'idle') as import('@/lib/bud/types').BudState);
  const actionQueue = buildBudOsActionQueue({
    commandState,
    runs: runs.map((run) => ({
      id: run.id as string,
      agent_id: run.agent_id as string,
      status: run.status as string,
      summary: run.summary as string | null,
      started_at: run.started_at as string,
    })),
    actions: actions.map((action) => ({
      id: action.id as string,
      agent_id: action.agent_id as string | null,
      action_type: action.action_type as string,
      preview: action.preview as string,
      created_at: action.created_at as string,
      payload: (action as { payload?: Record<string, unknown> | null }).payload ?? null,
      target_table: (action as { target_table?: string | null }).target_table ?? null,
      target_id: (action as { target_id?: string | null }).target_id ?? null,
    })),
    insights: insightsRes.data ?? [],
    budApprovals,
    uxEvolution,
  });

  return {
    agents,
    runs,
    actions,
    github: githubData,
    memory,
    devOs,
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
    budStatus: commandState.bud_status,
    budSummary: commandState.is_nominal ? budState?.summary ?? null : commandState.summary,
    budActivity: (budActivityRes.data ?? []) as import('@/lib/bud/types').BudActivityEvent[],
    budApprovals,
    commandState,
    budOs: {
      state: budOsState,
      actionQueue,
      workforce: buildBudOsWorkforce(commandState),
      memoryLayer: buildBudOsMemoryLayer(memory, repairLearningsRes.data ?? []),
      autonomy: buildBudOsAutonomy(commandState),
      uxEvolution,
      repairExecutions: repairExecutionsRes.data ?? [],
      repairSteps: repairStepsRes.data ?? [],
      changeRequests: changeRequests.map((cr) => ({
        id: cr.id as string,
        task_id: (cr.task_id as string | null) ?? null,
        branch_name: (cr.branch_name as string | null) ?? null,
        issue_url: (cr.issue_url as string | null) ?? null,
        pr_url: (cr.pr_url as string | null) ?? null,
        status: (cr.status as string) ?? 'open',
      })),
      authority,
      capabilities,
      initiatives,
      structuredFailures,
      thoughtStream,
      githubConnected: githubData.length > 0,
      circuit,
      efficiencyFindings: (efficiencyFindingsRes.data ?? []) as Array<{
        id: string;
        domain: string;
        title: string;
        severity: string;
        priority: string;
        body: string | null;
        affected_agents: string[];
        proposed_fix: string | null;
        estimated_saving: string | null;
        automation_candidate: boolean;
        created_at: string;
      }>,
    },
  };
}

export default async function MissionControlPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const surface = VALID_SURFACES.includes(params.surface as PipelineSurface)
    ? (params.surface as PipelineSurface)
    : 'admin';

  const [data] = await Promise.all([loadData()]);
  return (
    <Suspense>
      <MissionControlClient
        {...data}
        pipelinePanel={<MissionControlAutonomy surface={surface} />}
      />
    </Suspense>
  );
}
