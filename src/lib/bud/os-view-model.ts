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

export type ApprovalReadinessReason =
  | 'ready'
  | 'awaiting_plan'
  | 'awaiting_patch'
  | 'awaiting_diff'
  | 'awaiting_repair'
  | 'awaiting_diagnosis'
  | 'blocked';

export type BudOsApprovalDetail = {
  action_type: string;
  payload: Record<string, unknown> | null;
  target_table: string | null;
  target_id: string | null;
  risk_level: 'low' | 'medium' | 'high' | 'critical' | null;
  confidence: number | null;
  proposed_plan: string[];
  diff_summary: string | null;
  affected_files: string[];
  blast_radius: string;
  rollback_story: string;
  linked_issue: string | null;
  linked_pr: string | null;
  linked_deployment: string | null;
  linked_memory_note: string | null;
  preview: string | null;
  full_description: string;
  readiness: ApprovalReadinessReason;
  readiness_summary: string;
  source_agent: string | null;
  requested_at: string;
};

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
  approval?: BudOsApprovalDetail;
};

export type BudOsRepairWorkspace = {
  selected_item_id: string | null;
  problem_summary: string;
  diagnosis: string;
  root_cause_type: string | null;
  confidence: number | null;
  proposed_plan: string[];
  diff_summary: string;
  approval_status: string;
  deployment_status: string;
  verification_status: string;
  sandbox_branch: string | null;
  deployment_url: string | null;
  affected_files: string[];
  logs: Array<{ id: string; level: string; message: string; created_at: string }>;
  steps: Array<{ id: string; state: string; status: string; summary: string; started_at: string }>;
  task_id: string | null;
  // Gate results (populated after a repair pipeline runs)
  ci_conclusion: string | null;
  ci_run_url: string | null;
  taste_score: number | null;
  taste_pass: boolean | null;
  taste_violations: string[];
  taste_suggestions: string[];
  browser_tests_passed: number | null;
  browser_tests_failed: number | null;
  browser_tests_total: number | null;
  browser_test_status: string | null;
  pr_url: string | null;
  issue_url: string | null;
  /** GitHub compare URL for this branch — present when a branch exists but no PR has been opened yet. */
  branch_compare_url: string | null;
  /** Structured JSON string with what_broke/how_fixed/pattern/next_action/at_risk from successful repair. */
  intelligence_summary: string | null;
  // Phase 7 — Rollback monitoring
  rollback_count: number;
  rollback_triggers: Record<string, number>;
  repair_success_rate: number | null;
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
  payload?: Record<string, unknown> | null;
  target_table?: string | null;
  target_id?: string | null;
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
  // Phase 2 — CI gate
  ci_conclusion: string | null;
  ci_run_url: string | null;
  // Phase 3 — Design Constitution taste
  taste_score: number | null;
  taste_pass: boolean | null;
  taste_violations: string[] | null;
  taste_suggestions: string[] | null;
  // Phase 4 — Browser / Playwright gate
  browser_tests_passed: number | null;
  browser_tests_failed: number | null;
  browser_tests_total: number | null;
  browser_test_status: string | null;
  // Phase 5 — PR + issue links
  pr_url: string | null;
  issue_url: string | null;
  // Phase 6 — Actionable intelligence (generated on successful repair)
  intelligence_summary?: string | null;
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

type RollbackEventRow = {
  id: string;
  execution_id: string | null;
  agent_id: string | null;
  trigger: string;
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

/* ────────────────────────────────────────────────────────────────────────── */
/*                       APPROVAL DETAIL + READINESS                          */
/* ────────────────────────────────────────────────────────────────────────── */

const DANGEROUS_ACTIONS = new Set([
  'delete_records',
  'mass_email',
  'financial_transfer',
  'ddl_sql',
  'modify_pricing',
  'modify_ndis',
  'modify_compliance',
]);

function inferAffectedFiles(payload: Record<string, unknown> | null | undefined, fallback: string): string[] {
  const text = `${JSON.stringify(payload ?? {})}\n${fallback}`;
  const matches = Array.from(text.matchAll(/[\w./-]+\.(?:ts|tsx|js|jsx|sql|md|json|css)/g));
  return Array.from(new Set(matches.map((m) => m[0]))).slice(0, 10);
}

function describeBlastRadius(args: {
  actionType: string;
  payload: Record<string, unknown> | null;
  riskLevel: string | null;
  targetTable: string | null;
}): string {
  if (DANGEROUS_ACTIONS.has(args.actionType)) {
    return `This is a guarded action (${args.actionType}). It can move money, change pricing, alter compliance data, or contact customers at scale. Side effects are NOT trivially reversible.`;
  }
  if (args.riskLevel === 'critical') return 'Critical risk - assume this affects production data or customer-facing surfaces.';
  if (args.riskLevel === 'high') return 'High risk - changes production code, configuration, or live data.';
  if (args.targetTable) return `Touches table "${args.targetTable}". Limited blast radius unless mass-update.`;
  if (args.payload && typeof args.payload === 'object') {
    const keys = Object.keys(args.payload);
    if (keys.length === 0) return 'No payload - approving this records an intent only.';
    return `Affects: ${keys.slice(0, 5).join(', ')}. Review the payload before approving.`;
  }
  return 'Low risk - small scoped change. Verify the diff still.';
}

function describeRollbackStory(args: {
  actionType: string;
  linkedDeployment: string | null;
  linkedPr: string | null;
}): string {
  if (DANGEROUS_ACTIONS.has(args.actionType)) {
    return 'Manual rollback only. Email/financial/data-mutating actions cannot be undone by Bud.';
  }
  if (args.linkedDeployment) return 'Linked to a deployment - Bud can revert by redeploying the previous SHA.';
  if (args.linkedPr) return 'Linked PR - revert the PR to roll back. Bud can open the revert automatically.';
  return 'Reversible at the data layer (status flip). No deploy involved.';
}

function planFromPayload(payload: Record<string, unknown> | null | undefined): string[] {
  if (!payload) return [];
  const plan = (payload as { plan?: unknown }).plan;
  if (Array.isArray(plan)) return plan.map(String);
  const steps = (payload as { steps?: unknown }).steps;
  if (Array.isArray(steps)) return steps.map(String);
  return [];
}

function diffFromPayload(payload: Record<string, unknown> | null | undefined): string | null {
  if (!payload) return null;
  const diff = (payload as { diff?: unknown; diff_summary?: unknown; patch?: unknown }).diff
    ?? (payload as { diff_summary?: unknown }).diff_summary
    ?? (payload as { patch?: unknown }).patch;
  if (typeof diff === 'string') return diff;
  if (diff && typeof diff === 'object') return JSON.stringify(diff, null, 2).slice(0, 2400);
  return null;
}

function computeReadiness(args: {
  source: BudOsQueueSource;
  payload: Record<string, unknown> | null;
  plan: string[];
  diff: string | null;
  linkedPr: string | null;
  taskStatus?: string;
  riskLevel?: string | null;
}): { readiness: ApprovalReadinessReason; summary: string } {
  if (args.taskStatus === 'blocked' || args.taskStatus === 'failed') {
    return { readiness: 'blocked', summary: 'Bud is blocked. Investigate before approving.' };
  }
  if (args.source === 'agent_action') {
    // Agent actions are typically ready once they exist (Bud has a preview + payload).
    if (!args.payload || Object.keys(args.payload).length === 0) {
      return { readiness: 'awaiting_patch', summary: 'No payload captured yet.' };
    }
    return { readiness: 'ready', summary: 'Action is fully drafted and ready for your decision.' };
  }
  if (args.taskStatus && ['detected', 'reproducing', 'analyzing'].includes(args.taskStatus)) {
    return { readiness: 'awaiting_diagnosis', summary: 'Bud is still diagnosing. Wait before approving.' };
  }
  if (args.taskStatus === 'planning' && args.plan.length === 0) {
    return { readiness: 'awaiting_plan', summary: 'Bud has not produced a plan yet.' };
  }
  if (['high', 'critical'].includes(args.riskLevel ?? '') && !args.diff && !args.linkedPr) {
    return { readiness: 'awaiting_diff', summary: 'High-risk change without a diff or PR - hold for review.' };
  }
  if (args.taskStatus === 'patching' && !args.diff) {
    return { readiness: 'awaiting_patch', summary: 'Bud is drafting the patch.' };
  }
  return { readiness: 'ready', summary: 'Drafted and gated. Safe to approve.' };
}

function buildApprovalDetailFromBudApproval(args: {
  approval: BudApprovalItem & {
    bud_tasks?: {
      description?: string;
      source_agent?: string | null;
      risk_level?: string | null;
      confidence?: number | null;
    } | null;
  };
  repairSession?: MissionControlHealth['repair_sessions'][number];
}): BudOsApprovalDetail {
  const task = args.approval.bud_tasks;
  const payload = (args.approval.payload ?? {}) as Record<string, unknown>;
  const repair = args.repairSession;

  // For improvement-pipeline approvals the signal context is embedded in the payload.
  const signalDescription = (payload['description'] as string | undefined) ?? null;
  const signalApproach = (payload['proposed_approach'] as string | undefined) ?? null;
  const signalFiles = Array.isArray(payload['reference_files'])
    ? (payload['reference_files'] as string[])
    : [];
  const signalArea = (payload['affected_area'] as string | undefined) ?? null;

  // Build plan from signal approach so the UI always has something concrete to show.
  const plan = planFromPayload(payload).length > 0
    ? planFromPayload(payload)
    : signalApproach ? [signalApproach] : [];
  const diff = diffFromPayload(payload);
  const riskLevel = (task?.risk_level ?? null) as BudOsApprovalDetail['risk_level'];
  const linkedPr = repair?.linked_pr ?? (payload['pr_url'] as string | undefined) ?? null;
  const linkedDeployment = repair?.linked_deployment ?? null;
  const linkedIssue = repair?.linked_issue ?? null;
  const linkedMemory = repair?.linked_memory_note ?? null;
  const readiness = computeReadiness({
    source: 'bud_approval',
    payload,
    plan,
    diff,
    linkedPr,
    taskStatus: repair?.status,
    riskLevel,
  });
  // Use the rich signal description when available, falling back to task description.
  const fullDescription = signalDescription
    ? `${signalDescription}${signalArea ? ` (area: ${signalArea})` : ''}`
    : task?.description ?? args.approval.action_type ?? 'Unspecified Bud task.';
  // Affected files: prefer explicit reference_files from signal over regex inference.
  const affectedFiles = signalFiles.length > 0
    ? signalFiles
    : inferAffectedFiles(payload, fullDescription);
  return {
    action_type: args.approval.action_type,
    payload,
    target_table: (payload['target_table'] as string | undefined) ?? null,
    target_id: (payload['target_id'] as string | undefined) ?? null,
    risk_level: riskLevel,
    confidence: task?.confidence ?? null,
    proposed_plan: plan,
    diff_summary: diff,
    affected_files: affectedFiles,
    blast_radius: describeBlastRadius({
      actionType: args.approval.action_type,
      payload,
      riskLevel,
      targetTable: (payload['target_table'] as string | undefined) ?? null,
    }),
    rollback_story: describeRollbackStory({
      actionType: args.approval.action_type,
      linkedDeployment,
      linkedPr,
    }),
    linked_issue: linkedIssue,
    linked_pr: linkedPr,
    linked_deployment: linkedDeployment,
    linked_memory_note: linkedMemory,
    preview: null,
    full_description: fullDescription,
    readiness: readiness.readiness,
    readiness_summary: readiness.summary,
    source_agent: task?.source_agent ?? null,
    requested_at: args.approval.created_at,
  };
}

function buildApprovalDetailFromAgentAction(args: { action: ActionRow }): BudOsApprovalDetail {
  const payload = (args.action.payload ?? {}) as Record<string, unknown>;
  const plan = planFromPayload(payload);
  const diff = diffFromPayload(payload);
  const readiness = computeReadiness({
    source: 'agent_action',
    payload,
    plan,
    diff,
    linkedPr: null,
  });
  const fullDescription = args.action.preview || `${args.action.action_type} requested by ${args.action.agent_id ?? 'an agent'}.`;
  return {
    action_type: args.action.action_type,
    payload,
    target_table: args.action.target_table ?? null,
    target_id: args.action.target_id ?? null,
    risk_level: DANGEROUS_ACTIONS.has(args.action.action_type) ? 'critical' : 'medium',
    confidence: null,
    proposed_plan: plan,
    diff_summary: diff,
    affected_files: inferAffectedFiles(payload, fullDescription),
    blast_radius: describeBlastRadius({
      actionType: args.action.action_type,
      payload,
      riskLevel: DANGEROUS_ACTIONS.has(args.action.action_type) ? 'critical' : 'medium',
      targetTable: args.action.target_table ?? null,
    }),
    rollback_story: describeRollbackStory({
      actionType: args.action.action_type,
      linkedDeployment: null,
      linkedPr: null,
    }),
    linked_issue: null,
    linked_pr: null,
    linked_deployment: null,
    linked_memory_note: null,
    preview: args.action.preview,
    full_description: fullDescription,
    readiness: readiness.readiness,
    readiness_summary: readiness.summary,
    source_agent: args.action.agent_id,
    requested_at: args.action.created_at,
  };
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

  const sessionByTask = new Map(args.commandState.repair_sessions.map((s) => [s.id, s]));

  // Build a map of the most recent repair task per agent.
  // Tasks created via the command bar all have source_agent='bud', so we match by
  // agent name appearing in the task description (e.g. "Admin UX Designer is broken").
  // Tasks created via triggerInvestigation have source_agent=agentId, so we match
  // those directly. Most-recent wins — sort ascending so later entries overwrite.
  const latestSessionByAgent = new Map<string, string>();
  const sorted = [...args.commandState.repair_sessions].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  for (const s of sorted) {
    if (s.agent_id && s.agent_id !== 'bud') {
      latestSessionByAgent.set(s.agent_id, s.id);
    }
  }
  // Second pass: match command-bar tasks (source_agent='bud') by agent name in description
  for (const s of sorted) {
    if (s.agent_id !== 'bud') continue;
    for (const agent of args.commandState.agents) {
      if (!latestSessionByAgent.has(agent.id) && agent.name && s.description.includes(agent.name)) {
        latestSessionByAgent.set(agent.id, s.id);
      }
    }
  }

  for (const approval of args.budApprovals) {
    const annotated = approval as BudApprovalItem & {
      bud_tasks?: { description?: string; source_agent?: string | null; risk_level?: string | null; confidence?: number | null } | null;
    };
    const task = annotated.bud_tasks;
    // Skip autonomous Bud self-investigation approvals — these are created by the
    // Bud cron investigating itself, which causes an infinite loop. They have both
    // source_agent='bud' AND requested_by='bud'. User-triggered "Fix with Bud"
    // commands also have source_agent='bud' but requested_by=<user UUID>, so they
    // must NOT be skipped.
    if (task?.source_agent === 'bud' && (approval.requested_by === 'bud' || !approval.requested_by)) continue;
    const repairSession = approval.task_id ? sessionByTask.get(approval.task_id) : undefined;
    const detail = buildApprovalDetailFromBudApproval({ approval: annotated, repairSession });
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
      approval: detail,
    });
  }

  for (const action of args.actions) {
    const detail = buildApprovalDetailFromAgentAction({ action });
    items.push({
      id: `agent-action:${action.id}`,
      source: 'agent_action',
      source_id: action.id,
      task_id: null,
      group: 'needs_approval',
      title: action.preview || action.action_type,
      detail: `An agent proposed ${action.action_type}.`,
      severity: detail.risk_level === 'critical' ? 'critical' : 'medium',
      status: 'pending',
      agent_id: action.agent_id,
      agent_name: action.agent_id ? agentById.get(action.agent_id)?.name ?? action.agent_id : null,
      created_at: action.created_at,
      actions: actionSet('needs_approval'),
      approval: detail,
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
      task_id: run.agent_id ? (latestSessionByAgent.get(run.agent_id) ?? null) : null,
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
      task_id: latestSessionByAgent.get(agent.id) ?? null,
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
  rollbackEvents?: RollbackEventRow[];
  changeRequests?: Array<{ id: string; task_id: string | null; branch_name: string | null; issue_url: string | null; pr_url: string | null; status: string }>;
}): BudOsRepairWorkspace {
  const selected = args.selectedItem;
  const explicitTaskId = selected?.task_id ?? (selected?.source === 'bud_task' ? selected.source_id : null);
  const taskId = explicitTaskId ?? null;
  const session = taskId ? args.commandState.repair_sessions.find((item) => item.id === taskId) ?? null : null;
  const execution = taskId ? args.executions.find((item) => item.task_id === taskId) ?? null : null;
  const executionSteps = execution ? args.steps.filter((step) => step.execution_id === execution.id) : [];
  const executionLogs = execution
    ? args.logs.filter((log) => log.execution_id === execution.id).map((log) => ({ id: String(log.id), level: log.level, message: log.message, created_at: log.created_at }))
    : args.activity.slice(0, 6).map((event) => ({ id: event.id, level: event.event_type, message: event.narrative, created_at: event.created_at }));
  const strategy = execution?.repair_strategy;
  const strategySteps = Array.isArray(strategy?.steps) ? strategy.steps.map(String) : [];
  const strategyBranch = typeof strategy?.branchName === 'string' ? strategy.branchName : null;

  // Find the change request for this task — used to surface the branch compare URL
  // when the repair pipeline hasn't run yet (branch exists, no PR opened).
  const taskCr = taskId
    ? (args.changeRequests ?? []).find((cr) => cr.task_id === taskId) ?? null
    : null;
  const crBranch = taskCr?.branch_name ?? null;
  const activeBranch = strategyBranch ?? crBranch;
  const prUrl = execution?.pr_url ?? session?.linked_pr ?? taskCr?.pr_url ?? null;
  const issueUrl = execution?.issue_url ?? session?.linked_issue ?? taskCr?.issue_url ?? null;
  // Derive compare URL from the issue URL's repo prefix + branch name
  const repoBase = issueUrl
    ? issueUrl.replace(/\/issues\/\d+.*$/, '')
    : null;
  const branchCompareUrl = (!prUrl && activeBranch && repoBase)
    ? `${repoBase}/compare/main...${activeBranch}`
    : null;
  const strategyFiles = Array.isArray(strategy?.affectedFiles) ? (strategy.affectedFiles as string[]) : [];

  // Rollback monitoring — scoped to the selected agent if there is one
  const allRollbacks = args.rollbackEvents ?? [];
  const agentRollbacks = selected?.agent_id
    ? allRollbacks.filter((r) => r.agent_id === selected.agent_id)
    : allRollbacks;
  const rollbackTriggers: Record<string, number> = {};
  for (const r of agentRollbacks) {
    rollbackTriggers[r.trigger] = (rollbackTriggers[r.trigger] ?? 0) + 1;
  }
  const totalRepairs = selected?.agent_id
    ? args.executions.filter((e) => {
        const task = args.commandState.repair_sessions.find((s) => s.id === e.task_id);
        return task?.agent_id === selected.agent_id || e.task_id === taskId;
      }).length
    : args.executions.length;
  const repairSuccessRate = totalRepairs > 0
    ? Math.round((1 - agentRollbacks.length / totalRepairs) * 100) / 100
    : null;

  return {
    selected_item_id: selected?.id ?? null,
    problem_summary: session?.description ?? selected?.detail ?? 'Select an item for Bud to explain the repair path.',
    diagnosis: execution?.root_cause_summary ?? (selected ? `${selected.title}: ${selected.detail}` : 'Bud has not opened a diagnosis yet.'),
    root_cause_type: execution?.root_cause_type ?? null,
    confidence: session?.confidence ?? null,
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
    sandbox_branch: activeBranch,
    deployment_url: execution?.deployment_url ?? null,
    affected_files: strategyFiles,
    // Gate results — only populated after a repair pipeline has run
    ci_conclusion: execution?.ci_conclusion ?? null,
    ci_run_url: execution?.ci_run_url ?? null,
    taste_score: execution?.taste_score ?? null,
    taste_pass: execution?.taste_pass ?? null,
    taste_violations: (execution?.taste_violations as string[] | null | undefined) ?? [],
    taste_suggestions: (execution?.taste_suggestions as string[] | null | undefined) ?? [],
    browser_tests_passed: execution?.browser_tests_passed ?? null,
    browser_tests_failed: execution?.browser_tests_failed ?? null,
    browser_tests_total: execution?.browser_tests_total ?? null,
    browser_test_status: execution?.browser_test_status ?? null,
    pr_url: prUrl,
    issue_url: issueUrl,
    branch_compare_url: branchCompareUrl,
    intelligence_summary: execution?.intelligence_summary ?? null,
    rollback_count: agentRollbacks.length,
    rollback_triggers: rollbackTriggers,
    repair_success_rate: repairSuccessRate,
  };
}
