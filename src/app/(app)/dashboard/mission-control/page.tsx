import { createClient } from '@supabase/supabase-js';
import { Suspense } from 'react';
import { MissionControlClient } from './MissionControlClient';
import type { QuarantineRow } from './_components/RepairQuarantineSection';
import { computeMissionControlHealth } from '@/lib/bud/health';
import { buildBudOsActionQueue, buildAgentImpactMap } from '@/lib/bud/os-view-model';
import { buildUxEvolutionRecommendations } from '@/lib/bud/ux-evolution-engine';
import type { DevOsResponse } from '@/app/api/dev-os/route';
import type { ApprovalTruthLabel } from '@/lib/bud/health';
import type { BudApprovalItem } from '@/lib/bud/types';

type BudApprovalTruthRow = {
  id: string;
  task_id: string | null;
  action_type: string;
  status: BudApprovalItem['status'];
  created_at: string;
  archived_at: string | null;
  archive_reason: string | null;
  blocked_reason: string | null;
  task_status: string | null;
  risk_level: string | null;
  linked_pr: string | null;
  truth_label: ApprovalTruthLabel;
};

type BudTaskContextRow = {
  id: string;
  status: string;
  description: string;
  source_agent: string | null;
  risk_level: string | null;
  confidence: number | null;
  linked_pr: string | null;
  raw_input: Record<string, unknown> | null;
};

function buildApprovalPayload(row: BudApprovalTruthRow, task: BudTaskContextRow | null): Record<string, unknown> {
  return {
    ...((task?.raw_input ?? {}) as Record<string, unknown>),
    action_type: row.action_type,
    truth_label: row.truth_label,
    task_status: row.task_status,
    risk_level: row.risk_level,
    linked_pr: row.linked_pr,
    archive_reason: row.archive_reason,
    blocked_reason: row.blocked_reason,
  };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function loadData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const today = now.toISOString().slice(0, 10);
  const since30d = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();

  // 13 queries — 11 agent/ops queries + 2 lightweight business snapshot queries
  const [
    agentsRes, runsRes, actionsRes, githubRes,
    githubLastSuccessRes, githubLastFailureRes,
    insightsRes,
    budActivityRes, budApprovalsRes, budTasksRes,
    changeRequestsRes,
    ordersSnapshotRes, todayJobsRes,
  ] = await Promise.all([
    supabase.from('agents').select('id, name, status, category, autonomy, config, last_run_at, last_success_at').order('name'),
    supabase.from('agent_runs')
      .select('id, agent_id, status, summary, error, cost_cents, duration_ms, started_at, trigger')
      .order('started_at', { ascending: false }).limit(40),
    supabase.from('v_pending_agent_actions').select('*').limit(20),
    // Recent events (push/PR/deployment created) — general activity
    supabase.from('github_events')
      .select('id, event_type, action, repo, metadata, status, created_at')
      .order('created_at', { ascending: false }).limit(20),
    // Most recent deployment success — fetched separately because 'created' events
    // bury it in the general limit-20 window.
    supabase.from('github_events')
      .select('id, event_type, action, repo, metadata, status, created_at')
      .eq('event_type', 'deployment_status')
      .eq('action', 'success')
      .order('created_at', { ascending: false }).limit(1),
    // Most recent deployment failure — same reason
    supabase.from('github_events')
      .select('id, event_type, action, repo, metadata, status, created_at')
      .eq('event_type', 'deployment_failure')
      .order('created_at', { ascending: false }).limit(1),
    supabase.from('bud_insights')
      .select('id, agent_id, category, severity, title, created_at')
      .is('resolved_at', null).order('created_at', { ascending: false }).limit(8),
    supabase.from('bud_activity_feed')
      .select('id, event_type, narrative, actor, target, metadata, created_at')
      .order('created_at', { ascending: false }).limit(50),
    supabase.from('v_bud_approval_truth')
      .select('id, task_id, action_type, status, created_at, archived_at, archive_reason, blocked_reason, task_status, risk_level, linked_pr, truth_label')
      .in('truth_label', ['Actionable', 'Needs manual review', 'Blocked', 'Archived'])
      .order('created_at', { ascending: false })
      .limit(120),
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
    // Business snapshot — MTD orders (lightweight: only final_price + status)
    supabase.from('orders')
      .select('final_price, status')
      .gte('created_at', startOfMonth)
      .neq('status', 'cancelled'),
    // Jobs scheduled today
    supabase.from('orders')
      .select('id')
      .eq('scheduled_date', today)
      .neq('status', 'cancelled'),
  ]);

  // memory_documents is small and feeds commandState — keep but don't return raw
  let memory: { id: string; category: string; title: string; vault_path: string; created_at: string }[] = [];
  try {
    const { data } = await supabase
      .from('memory_documents').select('id, category, title, vault_path, created_at')
      .eq('status', 'active').order('created_at', { ascending: false }).limit(8);
    memory = data ?? [];
  } catch {}

  // Agent impact telemetry — actions and succeeded outputs in the last 30 days.
  // Wrapped in try/catch so missing tables never break the page.
  let impactActionRows: Array<{ agent_id: string | null; status: string }> = [];
  let impactOutputRows: Array<{ agent_id: string | null }> = [];
  try {
    const [actionsImpactRes, outputsImpactRes] = await Promise.all([
      supabase.from('agent_actions').select('agent_id, status').gte('created_at', since30d),
      supabase.from('agent_runs').select('agent_id').eq('status', 'succeeded').gte('started_at', since30d),
    ]);
    impactActionRows = (actionsImpactRes.data ?? []) as typeof impactActionRows;
    impactOutputRows = (outputsImpactRes.data ?? []) as typeof impactOutputRows;
  } catch { /* agent_actions or agent_runs table may not be available */ }

  const agentImpact = buildAgentImpactMap({ actionRows: impactActionRows, outputRows: impactOutputRows });

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
  const approvalTruthRows = (budApprovalsRes.data ?? []) as BudApprovalTruthRow[];
  const approvalTaskIds = Array.from(
    new Set(approvalTruthRows.map((row) => row.task_id).filter((id): id is string => Boolean(id))),
  );
  let approvalTaskContext: BudTaskContextRow[] = [];
  if (approvalTaskIds.length > 0) {
    const { data } = await supabase
      .from('bud_tasks')
      .select('id, status, description, source_agent, risk_level, confidence, linked_pr, raw_input')
      .in('id', approvalTaskIds);
    approvalTaskContext = (data ?? []) as BudTaskContextRow[];
  }
  const approvalTaskById = new Map(approvalTaskContext.map((task) => [task.id, task]));
  const budApprovals = approvalTruthRows.map((row) => {
    const task = row.task_id ? approvalTaskById.get(row.task_id) ?? null : null;
    return {
      id: row.id,
      task_id: row.task_id,
      action_type: row.action_type,
      payload: buildApprovalPayload(row, task),
      status: row.status,
      requested_by: null,
      reviewed_by: null,
      reviewed_at: null,
      notes: null,
      archived_at: row.archived_at,
      archive_reason: row.archive_reason,
      blocked_reason: row.blocked_reason,
      created_at: row.created_at,
      truth_label: row.truth_label,
      bud_tasks: task
        ? {
            id: task.id,
            status: task.status,
            description: task.description,
            source_agent: task.source_agent,
            risk_level: task.risk_level,
            confidence: task.confidence,
            linked_pr: task.linked_pr,
          }
        : {
            id: row.task_id,
            status: row.task_status,
            description: null,
            source_agent: null,
            risk_level: row.risk_level,
            confidence: null,
            linked_pr: row.linked_pr,
          },
    };
  }) as Array<BudApprovalItem & { bud_tasks?: unknown }>;
  // Merge general events with targeted success/failure lookups; deduplicate by id.
  const githubMerged = [
    ...(githubRes.data ?? []),
    ...(githubLastSuccessRes.data ?? []),
    ...(githubLastFailureRes.data ?? []),
  ];
  const seenIds = new Set<string>();
  const githubData = githubMerged.filter((e) => {
    if (seenIds.has(e.id as string)) return false;
    seenIds.add(e.id as string);
    return true;
  });
  const budTasks = budTasksRes.data ?? [];
  const changeRequests = changeRequestsRes.data ?? [];
  const commandState = computeMissionControlHealth({
    agents, runs, actions,
    budApprovals: budApprovals.map((a) => ({
      id: a.id,
      agent_id: null,
      status: a.status,
      created_at: a.created_at,
      payload: a.payload,
      task_id: a.task_id,
      bud_tasks: (a as { bud_tasks?: unknown }).bud_tasks as never,
      truth_label: a.truth_label,
    })),
    tasks: budTasks, changeRequests, github: githubData,
    insights: insightsRes.data ?? [], memory,
  });

  // uxEvolution: UX-signal tables removed from fetch (were always empty in practice).
  // Still computed from budInsights + failed runs so it degrades gracefully.
  const uxEvolution = buildUxEvolutionRecommendations({
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

  const actionQueue = buildBudOsActionQueue({
    commandState,
    runs: runs.map((r) => ({
      id: r.id as string, agent_id: r.agent_id as string,
      status: r.status as string, summary: r.summary as string | null,
      started_at: r.started_at as string,
    })),
    actions: actions.map((a) => ({
      id: ((a as { id?: string; action_id?: string }).id ?? (a as { action_id?: string }).action_id) as string,
      agent_id: (a.agent_id as string | null) ?? null,
      action_type: a.action_type as string, preview: a.preview as string,
      created_at: a.created_at as string,
      payload: (a as { payload?: Record<string, unknown> | null }).payload ?? null,
      target_table: (a as { target_table?: string | null }).target_table ?? null,
      target_id: (a as { target_id?: string | null }).target_id ?? null,
      root_cause_id: (a as { root_cause_id?: string | null }).root_cause_id ?? null,
      root_cause_key: (a as { root_cause_key?: string | null }).root_cause_key ?? null,
      initiative_id: (a as { initiative_id?: string | null }).initiative_id ?? null,
    })),
    insights: insightsRes.data ?? [],
    budApprovals,
    uxEvolution,
  });

  const ordersThisMonth = ordersSnapshotRes.data ?? [];
  const businessSnapshot = {
    mtd_revenue: ordersThisMonth.reduce((sum, o) => sum + ((o.final_price as number | null) ?? 0), 0),
    mtd_orders:  ordersThisMonth.length,
    completed_mtd: ordersThisMonth.filter((o) => o.status === 'completed').length,
    in_progress:   ordersThisMonth.filter((o) => o.status === 'in_progress' || o.status === 'confirmed').length,
    jobs_today:  (todayJobsRes.data ?? []).length,
  };

  // Repair quarantine — fetched separately to avoid disrupting the destructured Promise.all
  let quarantineRows: QuarantineRow[] = [];
  try {
    const { data: qData } = await supabase
      .from('bud_repair_quarantine')
      .select('id, branch, commit_sha, deployment_id, error_text, failing_file, failing_line, source_agent, rejection_reason, attempt_count, status, blocked_until, updated_at')
      .order('updated_at', { ascending: false })
      .limit(50);
    quarantineRows = (qData ?? []) as QuarantineRow[];
  } catch { /* table may not exist in older environments */ }

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
    businessSnapshot,
    agentImpact,
    budActivity: (budActivityRes.data ?? []) as import('@/lib/bud/types').BudActivityEvent[],
    commandState,
    budOs: {
      actionQueue,
    },
    quarantineRows,
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
