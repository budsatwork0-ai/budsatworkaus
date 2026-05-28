import { createClient } from '@supabase/supabase-js';
import { Suspense } from 'react';
import { MissionControlClient } from './MissionControlClient';
import { computeMissionControlHealth } from '@/lib/bud/health';
import { buildBudOsActionQueue } from '@/lib/bud/os-view-model';
import { buildUxEvolutionRecommendations } from '@/lib/bud/ux-evolution-engine';
import { buildStructuredFailures } from '@/lib/bud/structured-failure';
import { buildBudInitiatives } from '@/lib/bud/initiatives';
import { buildThoughtStream } from '@/lib/bud/thought-stream';
import type { DevOsResponse } from '@/app/api/dev-os/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function loadData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // 11 queries (was 18) — removed: stats, repair learnings, adminUx, designInsights,
  // agentEvolutions, efficiencyFindings, bud_lobby_states (all fed into unused client fields)
  const [
    agentsRes, runsRes, actionsRes, githubRes, insightsRes,
    budActivityRes, budApprovalsRes, budTasksRes,
    changeRequestsRes, repairExecutionsRes, repairStepsRes,
  ] = await Promise.all([
    supabase.from('agents').select('id, name, status, category, autonomy, last_run_at, last_success_at').order('name'),
    supabase.from('agent_runs')
      .select('id, agent_id, status, summary, error, cost_cents, duration_ms, started_at, trigger')
      .order('started_at', { ascending: false }).limit(40),
    supabase.from('v_pending_agent_actions').select('*').limit(20),
    supabase.from('github_events')
      .select('id, event_type, action, repo, metadata, status, created_at')
      .order('created_at', { ascending: false }).limit(20),
    supabase.from('bud_insights')
      .select('id, agent_id, category, severity, title, created_at')
      .is('resolved_at', null).order('created_at', { ascending: false }).limit(8),
    supabase.from('bud_activity_feed')
      .select('id, event_type, narrative, actor, target, metadata, created_at')
      .order('created_at', { ascending: false }).limit(50),
    supabase.from('bud_approval_queue')
      .select('id, task_id, action_type, payload, status, requested_by, reviewed_by, reviewed_at, notes, created_at, bud_tasks(description, source_agent, risk_level, confidence)')
      .eq('status', 'pending').order('created_at', { ascending: false }).limit(10),
    supabase.from('bud_tasks')
      .select('id, source_agent, target_agent, status, confidence, risk_level, description, autonomy_level, linked_issue, linked_pr, linked_deployment, linked_memory_note, created_at, updated_at')
      .in('status', [
        'pending', 'detected', 'reproducing', 'analyzing', 'planning', 'awaiting_approval',
        'patching', 'validating', 'deploying', 'verifying', 'monitoring',
        'blocked', 'in_progress',
      ])
      .order('created_at', { ascending: false }).limit(20),
    supabase.from('bud_change_requests')
      .select('id, task_id, branch_name, issue_url, pr_url, deployment_url, status, created_at')
      .order('created_at', { ascending: false }).limit(20),
    supabase.from('bud_repair_executions')
      .select('id, task_id, status, root_cause_type, root_cause_summary, repair_strategy, diff_summary, deployment_url, verification_status, ci_conclusion, ci_run_url, taste_score, taste_pass, taste_violations, taste_suggestions, browser_tests_passed, browser_tests_failed, browser_tests_total, browser_test_status, pr_url, issue_url, created_at')
      .order('created_at', { ascending: false }).limit(20),
    supabase.from('bud_repair_steps')
      .select('id, execution_id, state, status, summary, started_at')
      .order('started_at', { ascending: false }).limit(80),
  ]);

  // memory_documents is small and feeds commandState — keep but don't return raw
  let memory: { id: string; category: string; title: string; vault_path: string; created_at: string }[] = [];
  try {
    const { data } = await supabase
      .from('memory_documents').select('id, category, title, vault_path, created_at')
      .eq('status', 'active').order('created_at', { ascending: false }).limit(8);
    memory = data ?? [];
  } catch {}

  // Latest run per agent (confidence score + last run time) — view added in migration 076.
  // Wrapped in try/catch so the page still loads before the migration is applied.
  const latestRuns: Record<string, { confidence_score: number | null; finished_at: string | null }> = {};
  try {
    const { data: latestRunsData } = await supabase
      .from('v_agent_latest_run')
      .select('agent_id, confidence_score, finished_at');
    for (const row of latestRunsData ?? []) {
      latestRuns[row.agent_id as string] = {
        confidence_score: (row.confidence_score as number | null) ?? null,
        finished_at: (row.finished_at as string | null) ?? null,
      };
    }
  } catch {}

  const agents = agentsRes.data ?? [];
  const runs   = runsRes.data ?? [];
  const actions = actionsRes.data ?? [];
  const budApprovals = (budApprovalsRes.data ?? []) as import('@/lib/bud/types').BudApprovalItem[];
  const githubData = githubRes.data ?? [];
  const budTasks = budTasksRes.data ?? [];
  const changeRequests = changeRequestsRes.data ?? [];
  const commandState = computeMissionControlHealth({
    agents, runs, actions,
    budApprovals: budApprovals.map((a) => ({ id: a.id, agent_id: null, status: a.status })),
    tasks: budTasks, changeRequests, github: githubData,
    insights: insightsRes.data ?? [], memory,
  });

  // uxEvolution: UX-signal tables removed from fetch (were always empty in practice).
  // Still computed from budInsights + failed runs so it degrades gracefully.
  const uxEvolution = buildUxEvolutionRecommendations({
    adminUxProposals: [],
    designInsights: [],
    agentEvolutions: [],
    budInsights: insightsRes.data ?? [],
    memory,
    failedRuns: runs
      .filter((r) => ['failed', 'needs_repair'].includes(r.status as string))
      .map((r) => ({
        id: r.id as string, agent_id: r.agent_id as string,
        status: r.status as string, summary: r.summary as string | null,
        started_at: r.started_at as string,
      })),
  });

  const agentNameById = new Map<string, string>(agents.map((a) => [a.id as string, (a.name ?? a.id) as string]));
  const structuredFailures = buildStructuredFailures({
    runs: runs.map((r) => ({
      id: r.id as string, agent_id: r.agent_id as string | null,
      status: r.status as string, summary: r.summary as string | null,
      error: r.error as string | null | undefined, started_at: r.started_at as string,
    })),
    agentNameById,
  });

  // initiatives only used server-side to build thoughtStream
  const initiatives = buildBudInitiatives({ commandState, uxEvolution, structuredFailures });
  const thoughtStream = buildThoughtStream({
    commandState,
    activity: (budActivityRes.data ?? []) as import('@/lib/bud/types').BudActivityEvent[],
    failures: structuredFailures,
    initiatives,
  });

  const actionQueue = buildBudOsActionQueue({
    commandState,
    runs: runs.map((r) => ({
      id: r.id as string, agent_id: r.agent_id as string,
      status: r.status as string, summary: r.summary as string | null,
      started_at: r.started_at as string,
    })),
    actions: actions.map((a) => ({
      id: a.id as string, agent_id: (a.agent_id as string | null) ?? null,
      action_type: a.action_type as string, preview: a.preview as string,
      created_at: a.created_at as string,
      payload: (a as { payload?: Record<string, unknown> | null }).payload ?? null,
      target_table: (a as { target_table?: string | null }).target_table ?? null,
      target_id: (a as { target_id?: string | null }).target_id ?? null,
    })),
    insights: insightsRes.data ?? [],
    budApprovals,
    uxEvolution,
  });

  let devOs: DevOsResponse = { sessions: [], agentStats: {}, totalSessions: 0, conventionCount: 0 };
  try {
    const [devOsRes, conventionRes] = await Promise.all([
      supabase.from('dev_os_sessions')
        .select('id, session_id, agents_used, task, files_changed, summary, risk_level, created_at')
        .order('created_at', { ascending: false }).limit(30),
      supabase.from('convention_learnings').select('id', { count: 'exact', head: true }),
    ]);
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
  } catch { /* dev_os_sessions may not exist yet */ }

  return {
    agents,
    latestRuns,
    devOs,
    budActivity: (budActivityRes.data ?? []) as import('@/lib/bud/types').BudActivityEvent[],
    commandState,
    budOs: {
      actionQueue,
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
      structuredFailures,
      thoughtStream,
    },
  };
}

export default async function MissionControlPage() {
  const data = await loadData();
  return (
    <Suspense>
      <MissionControlClient {...data} />
    </Suspense>
  );
}
