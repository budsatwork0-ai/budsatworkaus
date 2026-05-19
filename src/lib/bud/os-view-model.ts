import { BUD_CLUSTERS, type BudActivityEvent, type BudApprovalItem, type BudState } from './types';
import type { MissionControlHealth } from './health';
import type { UxEvolutionRecommendation } from './ux-evolution-engine';

export type BudOsStateLabel =
  | 'Observing'
  | 'Thinking'
  | 'Investigating'
  | 'Planning'
  | 'Waiting for approval'
  | 'Repairing'
  | 'Deploying'
  | 'Verifying'
  | 'Learning'
  | 'Blocked';

export type BudOsQueueGroup = 'critical' | 'needs_approval' | 'suggested_improvements' | 'watch_items' | 'completed_actions';
export type BudOsQueueSource =
  | 'bud_task'
  | 'bud_approval'
  | 'agent_action'
  | 'agent_run'
  | 'bud_insight'
  | 'agent_health'
  | 'ux_evolution'
  | 'repair_session';

export type BudOsQueueItem = {
  id: string;
  source: BudOsQueueSource;
  source_id: string;
  task_id: string | null;
  group: BudOsQueueGroup;
  title: string;
  detail: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  agent_id: string | null;
  agent_name: string | null;
  created_at: string;
  actions: Array<'explain' | 'investigate' | 'fix_with_bud' | 'approve' | 'dismiss'>;
};

export type BudOsRepairWorkspace = {
  selected_item_id: string | null;
  problem_summary: string;
  diagnosis: string;
  proposed_plan: string[];
  diff_summary: string;
  approval_status: string;
  deployment_status: string;
  verification_status: string;
  logs: Array<{ id: string; level: string; message: string; created_at: string }>;
  steps: Array<{ id: string; state: string; status: string; summary: string; started_at: string }>;
  task_id: string | null;
};

export type BudOsWorkforceCluster = {
  name: string;
  agents: Array<{
    id: string;
    name: string;
    role: string;
    health: string;
    current_task: string;
    last_useful_output: string;
    can_delegate: boolean;
  }>;
};

export type BudOsMemoryLayer = Array<{
  name: 'Recent fixes' | 'Design decisions' | 'Known site problems' | 'Recurring failures' | 'Business rules' | 'Pricing rules';
  items: Array<{ id: string; title: string; detail: string; created_at: string }>;
}>;

export type BudOsAutonomyCapability = {
  key: 'monitor' | 'diagnose' | 'draft_fix' | 'create_pr' | 'deploy' | 'verify' | 'learn';
  label: string;
  status: 'online' | 'partial' | 'blocked';
  detail: string;
};

type RunRow = {
  id: string;
  agent_id: string;
  status: string;
  summary: string | null;
  started_at: string;
};

type ActionRow = {
  id: string;
  agent_id: string | null;
  action_type: string;
  preview: string;
  created_at: string;
};

type InsightRow = {
  id: string;
  agent_id: string | null;
  category: string;
  severity: string;
  title: string;
  created_at: string;
};

type MemoryRow = {
  id: string;
  category: string;
  title: string;
  vault_path: string | null;
  created_at: string;
};

type RepairExecutionRow = {
  id: string;
  task_id: string | null;
  status: string;
  root_cause_type: string | null;
  root_cause_summary: string | null;
  repair_strategy: Record<string, unknown> | null;
  diff_summary: string | null;
  deployment_url: string | null;
  verification_status: string;
  created_at: string;
};

type RepairStepRow = {
  id: string;
  execution_id: string;
  state: string;
  status: string;
  summary: string;
  started_at: string;
};

type RepairLogRow = {
  id: number;
  execution_id: string;
  level: string;
  message: string;
  created_at: string;
};

const stateMap: Partial<Record<BudState, BudOsStateLabel>> = {
  thinking: 'Thinking',
  investigating: 'Investigating',
  reviewing: 'Planning',
  needs_human_approval: 'Waiting for approval',
  repairing: 'Repairing',
  testing: 'Verifying',
  deploying: 'Deploying',
  verifying: 'Verifying',
  learning: 'Learning',
  blocked: 'Blocked',
  repaired: 'Learning',
  idle: 'Observing',
};

export function deriveBudOsState(commandState: MissionControlHealth, budState: BudState | undefined): {
  label: BudOsStateLabel;
  summary: string;
  hasIssues: boolean;
} {
  const hasIssues = !commandState.is_nominal;
  if (commandState.approvals.total_pending > 0 || commandState.repair_sessions.some((s) => s.phase === 'awaiting_approval')) {
    return { label: 'Waiting for approval', summary: 'Bud has work ready but needs a human decision before continuing.', hasIssues };
  }
  if (commandState.repair_sessions.some((s) => ['patching', 'repairing'].includes(s.phase))) {
    return { label: 'Repairing', summary: 'Bud is working through an active repair path.', hasIssues };
  }
  if (commandState.repair_sessions.some((s) => ['validating', 'verifying', 'monitoring'].includes(s.phase))) {
    return { label: 'Verifying', summary: 'Bud is checking whether the fix actually held.', hasIssues };
  }
  if (commandState.deployment.status === 'deploying') {
    return { label: 'Deploying', summary: commandState.deployment.summary, hasIssues };
  }
  if (commandState.bud_status === 'critical') {
    return { label: 'Investigating', summary: commandState.summary, hasIssues };
  }
  if (commandState.bud_status === 'elevated') {
    return { label: 'Thinking', summary: commandState.summary, hasIssues };
  }
  return {
    label: stateMap[budState ?? 'idle'] ?? 'Observing',
    summary: hasIssues ? commandState.summary : 'Bud is awake and watching the business for changes.',
    hasIssues,
  };
}

function severityFrom(value: string | null | undefined): BudOsQueueItem['severity'] {
  if (value === 'critical') return 'critical';
  if (value === 'high' || value === 'failed' || value === 'broken') return 'high';
  if (value === 'low' || value === 'info') return 'low';
  return 'medium';
}

function queueGroupForSeverity(severity: BudOsQueueItem['severity']): BudOsQueueGroup {
  if (severity === 'critical') return 'critical';
  if (severity === 'high') return 'watch_items';
  return 'suggested_improvements';
}

function actionSet(group: BudOsQueueGroup): BudOsQueueItem['actions'] {
  if (group === 'needs_approval') return ['explain', 'approve', 'dismiss'];
  if (group === 'completed_actions') return ['explain'];
  return ['explain', 'investigate', 'fix_with_bud', 'dismiss'];
}

export function buildBudOsActionQueue(args: {
  commandState: MissionControlHealth;
  runs: RunRow[];
  actions: ActionRow[];
  insights: InsightRow[];
  budApprovals: BudApprovalItem[];
  uxEvolution: UxEvolutionRecommendation[];
}): BudOsQueueItem[] {
  const items: BudOsQueueItem[] = [];
  const agentById = new Map(args.commandState.agents.map((agent) => [agent.id, agent]));

  for (const approval of args.budApprovals) {
    const task = (approval as BudApprovalItem & {
      bud_tasks?: { description?: string; source_agent?: string | null; risk_level?: string | null } | null;
    }).bud_tasks;
    items.push({
      id: `bud-approval:${approval.id}`,
      source: 'bud_approval',
      source_id: approval.id,
      task_id: approval.task_id,
      group: 'needs_approval',
      title: task?.description ?? approval.action_type,
      detail: `Bud needs approval for ${approval.action_type}.`,
      severity: severityFrom(task?.risk_level),
      status: approval.status,
      agent_id: task?.source_agent ?? null,
      agent_name: task?.source_agent ? agentById.get(task.source_agent)?.name ?? task.source_agent : 'Bud',
      created_at: approval.created_at,
      actions: actionSet('needs_approval'),
    });
  }

  for (const action of args.actions) {
    items.push({
      id: `agent-action:${action.id}`,
      source: 'agent_action',
      source_id: action.id,
      task_id: null,
      group: 'needs_approval',
      title: action.preview || action.action_type,
      detail: `An agent proposed ${action.action_type}.`,
      severity: 'medium',
      status: 'pending',
      agent_id: action.agent_id,
      agent_name: action.agent_id ? agentById.get(action.agent_id)?.name ?? action.agent_id : null,
      created_at: action.created_at,
      actions: actionSet('needs_approval'),
    });
  }

  for (const run of args.runs) {
    if (!['failed', 'needs_repair'].includes(run.status)) continue;
    const severity = run.status === 'needs_repair' ? 'high' : 'medium';
    const group: BudOsQueueGroup = run.status === 'needs_repair' ? 'critical' : 'watch_items';
    items.push({
      id: `run:${run.id}`,
      source: 'agent_run',
      source_id: run.id,
      task_id: null,
      group,
      title: `${agentById.get(run.agent_id)?.name ?? run.agent_id} needs Bud`,
      detail: run.summary ?? 'Bud noticed a failed run without a useful explanation.',
      severity,
      status: run.status,
      agent_id: run.agent_id,
      agent_name: agentById.get(run.agent_id)?.name ?? run.agent_id,
      created_at: run.started_at,
      actions: actionSet(group),
    });
  }

  for (const insight of args.insights) {
    const severity = severityFrom(insight.severity);
    const group = queueGroupForSeverity(severity);
    items.push({
      id: `insight:${insight.id}`,
      source: 'bud_insight',
      source_id: insight.id,
      task_id: null,
      group,
      title: insight.title,
      detail: `Bud noticed this in ${insight.category}.`,
      severity,
      status: 'open',
      agent_id: insight.agent_id,
      agent_name: insight.agent_id ? agentById.get(insight.agent_id)?.name ?? insight.agent_id : null,
      created_at: insight.created_at,
      actions: actionSet(group),
    });
  }

  for (const agent of args.commandState.agents) {
    if (!['broken', 'needs_repair', 'watch'].includes(agent.health.label)) continue;
    const severity = agent.health.label === 'broken' ? 'critical' : agent.health.label === 'needs_repair' ? 'high' : 'medium';
    const group = severity === 'critical' ? 'critical' : 'watch_items';
    items.push({
      id: `agent-health:${agent.id}`,
      source: 'agent_health',
      source_id: agent.id,
      task_id: null,
      group,
      title: `${agent.name} is ${agent.health.label.replace('_', ' ')}`,
      detail: agent.recommended_action,
      severity,
      status: agent.lifecycle,
      agent_id: agent.id,
      agent_name: agent.name,
      created_at: agent.last_run_at ?? new Date(0).toISOString(),
      actions: actionSet(group),
    });
  }

  for (const rec of args.uxEvolution) {
    const group = rec.severity === 'critical' ? 'critical' : 'suggested_improvements';
    items.push({
      id: `ux:${rec.id}`,
      source: 'ux_evolution',
      source_id: rec.source_id,
      task_id: null,
      group,
      title: rec.title,
      detail: rec.summary,
      severity: rec.severity,
      status: rec.status,
      agent_id: null,
      agent_name: 'Bud UX Evolution Engine',
      created_at: rec.created_at,
      actions: actionSet(group),
    });
  }

  for (const session of args.commandState.repair_sessions) {
    if (!['recovered', 'learned'].includes(session.phase)) continue;
    items.push({
      id: `repair:${session.id}`,
      source: 'repair_session',
      source_id: session.id,
      task_id: session.id,
      group: 'completed_actions',
      title: `${session.agent_name} repair verified`,
      detail: session.description,
      severity: 'low',
      status: session.phase,
      agent_id: session.agent_id,
      agent_name: session.agent_name,
      created_at: session.created_at,
      actions: actionSet('completed_actions'),
    });
  }

  const groupOrder: Record<BudOsQueueGroup, number> = {
    critical: 0,
    needs_approval: 1,
    suggested_improvements: 2,
    watch_items: 3,
    completed_actions: 4,
  };

  return items.sort((a, b) => {
    const byGroup = groupOrder[a.group] - groupOrder[b.group];
    if (byGroup !== 0) return byGroup;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function buildBudOsWorkforce(commandState: MissionControlHealth): BudOsWorkforceCluster[] {
  const byId = new Map(commandState.agents.map((agent) => [agent.id, agent]));
  return Object.entries(BUD_CLUSTERS).map(([name, ids]) => ({
    name,
    agents: ids
      .map((id) => byId.get(id))
      .filter((agent): agent is MissionControlHealth['agents'][number] => Boolean(agent))
      .map((agent) => ({
        id: agent.id,
        name: agent.name,
        role: agent.category,
        health: agent.health.label.replace('_', ' '),
        current_task: agent.lifecycle === 'active' ? 'Bud is using this agent now' : agent.recommended_action,
        last_useful_output: agent.last_failure ?? (agent.last_run_at ? `Last useful signal ${new Date(agent.last_run_at).toLocaleString()}` : 'No useful output yet'),
        can_delegate: agent.configured_status !== 'disabled' && agent.health.label !== 'broken',
      })),
  })).filter((cluster) => cluster.agents.length > 0);
}

export function buildBudOsMemoryLayer(memory: MemoryRow[], learnings: Array<{ id: string; root_cause_type: string | null; fix_pattern: string; outcome: string; created_at: string }>): BudOsMemoryLayer {
  const groups: BudOsMemoryLayer = [
    { name: 'Recent fixes', items: learnings.map((item) => ({ id: item.id, title: item.root_cause_type ?? item.outcome, detail: item.fix_pattern, created_at: item.created_at })) },
    { name: 'Design decisions', items: [] },
    { name: 'Known site problems', items: [] },
    { name: 'Recurring failures', items: [] },
    { name: 'Business rules', items: [] },
    { name: 'Pricing rules', items: [] },
  ];

  function targetFor(row: MemoryRow): BudOsMemoryLayer[number] {
    const text = `${row.category} ${row.title} ${row.vault_path ?? ''}`.toLowerCase();
    if (text.includes('design') || text.includes('adr')) return groups[1];
    if (text.includes('site') || text.includes('problem') || text.includes('bug')) return groups[2];
    if (text.includes('recurring') || text.includes('failure')) return groups[3];
    if (text.includes('pricing') || text.includes('price')) return groups[5];
    return groups[4];
  }

  for (const row of memory) {
    targetFor(row).items.push({
      id: row.id,
      title: row.title,
      detail: row.vault_path ?? row.category,
      created_at: row.created_at,
    });
  }

  return groups.map((group) => ({ ...group, items: group.items.slice(0, 5) }));
}

export function buildBudOsAutonomy(commandState: MissionControlHealth): BudOsAutonomyCapability[] {
  const existing = new Map(commandState.capabilities.map((capability) => [capability.key, capability]));
  const repair = existing.get('repair');
  const hasPr = commandState.repair_sessions.some((session) => Boolean(session.linked_pr));
  return [
    { key: 'monitor', label: 'Monitor', status: existing.get('monitor')?.status ?? 'blocked', detail: existing.get('monitor')?.detail ?? 'Agent registry unavailable' },
    { key: 'diagnose', label: 'Diagnose', status: existing.get('diagnose')?.status ?? 'blocked', detail: existing.get('diagnose')?.detail ?? 'No run signals available' },
    { key: 'draft_fix', label: 'Draft fix', status: repair?.status ?? 'partial', detail: repair?.detail ?? 'Bud can draft repair tasks from detected problems' },
    { key: 'create_pr', label: 'Create PR', status: hasPr ? 'online' : 'partial', detail: hasPr ? 'Bud has linked at least one PR' : 'PR creation is gated by repair executor and GitHub configuration' },
    { key: 'deploy', label: 'Deploy', status: existing.get('deploy')?.status ?? 'blocked', detail: existing.get('deploy')?.detail ?? commandState.deployment.summary },
    { key: 'verify', label: 'Verify', status: existing.get('verify')?.status ?? 'blocked', detail: existing.get('verify')?.detail ?? 'Deployment verification not wired' },
    { key: 'learn', label: 'Learn', status: existing.get('learn')?.status ?? 'blocked', detail: existing.get('learn')?.detail ?? 'Memory layer unavailable' },
  ];
}

export function buildRepairWorkspace(args: {
  selectedItem: BudOsQueueItem | null;
  commandState: MissionControlHealth;
  executions: RepairExecutionRow[];
  steps: RepairStepRow[];
  logs: RepairLogRow[];
  activity: BudActivityEvent[];
}): BudOsRepairWorkspace {
  const selected = args.selectedItem;
  const taskId = selected?.task_id ?? (selected?.source === 'bud_task' ? selected.source_id : null);
  const session = taskId ? args.commandState.repair_sessions.find((item) => item.id === taskId) ?? null : null;
  const execution = taskId ? args.executions.find((item) => item.task_id === taskId) ?? null : null;
  const executionSteps = execution ? args.steps.filter((step) => step.execution_id === execution.id) : [];
  const executionLogs = execution
    ? args.logs.filter((log) => log.execution_id === execution.id).map((log) => ({ id: String(log.id), level: log.level, message: log.message, created_at: log.created_at }))
    : args.activity.slice(0, 6).map((event) => ({ id: event.id, level: event.event_type, message: event.narrative, created_at: event.created_at }));
  const strategy = execution?.repair_strategy;
  const strategySteps = Array.isArray(strategy?.steps) ? strategy.steps.map(String) : [];

  return {
    selected_item_id: selected?.id ?? null,
    problem_summary: session?.description ?? selected?.detail ?? 'Select an item for Bud to explain the repair path.',
    diagnosis: execution?.root_cause_summary ?? (selected ? `${selected.title}: ${selected.detail}` : 'Bud has not opened a diagnosis yet.'),
    proposed_plan: strategySteps.length > 0 ? strategySteps : [
      'Explain the problem in business terms.',
      'Inspect the affected agent, workflow, or page.',
      'Draft the smallest safe change.',
      'Wait for approval before risky execution.',
      'Verify and write down what Bud learned.',
    ],
    diff_summary: execution?.diff_summary ?? session?.linked_pr ?? 'No code/config diff has been produced yet.',
    approval_status: selected?.group === 'needs_approval' ? 'Needs your approval' : session?.phase === 'awaiting_approval' ? 'Needs your approval' : 'No approval pending for this item',
    deployment_status: execution?.deployment_url ?? session?.linked_deployment ?? args.commandState.deployment.summary,
    verification_status: execution?.verification_status ?? session?.phase ?? 'not_started',
    logs: executionLogs,
    steps: executionSteps.map((step) => ({ id: step.id, state: step.state, status: step.status, summary: step.summary, started_at: step.started_at })),
    task_id: taskId,
  };
}
