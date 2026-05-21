/**
 * Bud — autonomous AI operating system for Buds At Work.
 *
 * Bud is the single orchestrator intelligence layer. It:
 *   - monitors all specialist agents
 *   - detects failures and parse errors
 *   - derives lifecycle states for every agent
 *   - detects bottlenecks across workflow chains
 *   - generates operational briefings with cinematic state
 *   - writes to bud_lobby_states and bud_insights
 *   - narrates activity to bud_activity_feed
 *
 * Runs every 15 minutes via Vercel Cron. Can also be triggered manually
 * via POST /api/agents/bud.
 */
import type { AgentDefinition, AgentContext } from '../types';
import { WORKFLOWS } from '../workflows';
import { writeBudActivity, triggerInvestigation } from '@/lib/bud/orchestrator';
import type { BudState } from '@/lib/bud/types';
import { evaluateGlobalHealth, formatHealthCounts } from '@/lib/bud/health';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AgentLifecycleState =
  | 'active'           // currently executing a run
  | 'idle'             // enabled, ran recently, no issues
  | 'awaiting_review'  // has pending actions needing approval
  | 'degraded'         // failure rate > 40% over 7d
  | 'blocked'          // blocked by guardrail or external dependency
  | 'overloaded'       // pending queue depth ≥ 5
  | 'dormant'          // enabled but no run in > 7d
  | 'retired';         // disabled

export type OperationalStatus = 'nominal' | 'elevated' | 'critical';

interface AgentMetrics {
  agent_id: string;
  runs_24h: number;
  successes_24h: number;
  failures_24h: number;
  cost_cents_24h: number;
  is_running: boolean;
  pending_count: number;
  last_run_at: string | null;
  failure_rate_7d: number;
  has_parse_failures: boolean;
}

interface LobbySection {
  id: string;
  label: string;
  priority: number;
  visible: boolean;
  agent_ids: string[];
  workflow_ids: string[];
  status: 'nominal' | 'elevated' | 'critical';
  reason?: string;
}

interface WorkflowStatus {
  id: string;
  label: string;
  domain: string;
  type: string;
  active: boolean;
  bottleneck_agent_id: string | null;
  chain: string[];
  runs_24h: number;
  active_agents: string[];
}

interface LobbyKPIs {
  agents_active: number;
  agents_degraded: number;
  agents_awaiting_review: number;
  pending_approvals: number;
  total_runs_24h: number;
  total_cost_cents_24h: number;
  active_workflows: number;
  parse_failures_24h: number;
  bud_tasks_open: number;
  failed_runs_24h: number;
  broken_agents: number;
  needs_repair_agents: number;
  watch_agents: number;
  unresolved_alerts: number;
  low_success_rate_agents: number;
}

// ── LLM system prompt ─────────────────────────────────────────────────────────

const SYSTEM = `You are Bud, the autonomous AI operating system for Buds At Work's agent workforce.
You receive a structured summary of agent activity and return a concise operational briefing.

Output strict JSON matching this exact shape:
{
  "operational_status": "nominal" | "elevated" | "critical",
  "bud_state": "thinking" | "investigating" | "repairing" | "testing" | "reviewing" | "deploying" | "learning" | "idle" | "verifying" | "blocked" | "repaired" | "needs_human_approval",
  "summary": string,
  "section_priorities": {
    "needs-attention": number,
    "live-operations": number,
    "customer-pipeline": number,
    "finance-risk": number,
    "compliance": number,
    "growth-systems": number,
    "dormant": number
  },
  "insights": [
    { "agent_id": string | null, "workflow_id": string | null, "category": string, "severity": string, "title": string }
  ]
}

Rules:
- "summary" is 1–2 plain English sentences, no markdown. Report what Bud DID this cycle, not just what it observed.
- CRITICAL: "operational_status" MUST be "elevated" or "critical" if ANY agents are degraded, overloaded, or have parse failures. NEVER return "nominal" when needs-attention agents exist. Only "nominal" when zero agents need attention.
- CRITICAL: "operational_status" MUST be "critical" if more than 2 agents are degraded, or any agent has been failing continuously.
- "bud_state": use "investigating" if Bud ran investigations this cycle. Use "repairing" if repair tasks are open. Use "needs_human_approval" if investigations are awaiting approval. Use "blocked" if investigations failed. Use "idle" only when ALL agents are healthy. NEVER use "idle" when agents need attention.
- "section_priorities": 1 = show first, 7 = show last, 0 = hide entirely.
- "insights": 0–5 items. Category is one of: bottleneck, anomaly, pattern, opportunity, risk.
- Severity: low | medium | high | critical.
- Be terse. Admin reads this at a glance.`;

// ── Section membership maps ───────────────────────────────────────────────────

const LIVE_OPS_IDS = new Set([
  'scheduling', 'crew-briefing', 'photo-qa', 'yard-map-geo', 'crew-coach',
]);
const CUSTOMER_IDS = new Set([
  'phone-transcriber', 'customer-reply', 'quote-triage', 'lead-scorer',
  'lapsed-win-back', 'reviews',
]);
const FINANCE_IDS = new Set([
  'reconciliation', 'cash-flow-forecaster', 'stripe-dispute-manager', 'price-optimizer',
]);
const COMPLIANCE_IDS = new Set([
  'ndis-compliance', 'ndis-plan-matcher', 'whs-safety-reminder', 'internal-qa', 'applicant-screener',
]);
const GROWTH_IDS = new Set([
  'seo-meta', 'copy-optimizer', 'content-agent', 'ab-test-architect',
  'conversion-funnel', 'competitor-scout', 'competitor-watcher',
  'heatmap-analyst', 'layout-critic', 'admin-ux-designer',
  'lobby-theme-curator', 'agent-architect',
]);

// ── Agent definition ──────────────────────────────────────────────────────────

export const budAgent: AgentDefinition = {
  id: 'bud',
  name: 'Bud',
  description:
    'Autonomous AI orchestrator — monitors all agents, investigates failures, detects bottlenecks, coordinates repairs, and generates the living operational state for Mission Control.',
  category: 'ops',
  autonomy: 'manual',
  schedule: null,

  async run(ctx: AgentContext) {
    const now = Date.now();
    const since24h = new Date(now - 24 * 3600_000).toISOString();
    const since7d  = new Date(now - 7 * 24 * 3600_000).toISOString();
    const since48h = new Date(now - 48 * 3600_000).toISOString();
    const since30d = new Date(now - 30 * 24 * 3600_000).toISOString();

    await writeBudActivity(ctx.supabase,
      'Bud is thinking — analyzing agent workforce status...',
      { event_type: 'delegation', actor: 'bud' },
    );

    // ── 1. Load source data ────────────────────────────────────────────────
    // Fetch agents first so we can filter run queries to enabled agents only,
    // avoiding unnecessary DB reads for retired/paused agents.
    const agentsRes = await ctx.supabase
      .from('agents')
      .select('id, name, category, status, autonomy, schedule');

    const agents = agentsRes.data ?? [];
    const enabledAgentIds = agents.filter((a) => a.status !== 'disabled').map((a) => a.id);

    const [runs24hRes, runs7dRes, pendingRes, budTasksRes, stuckTasksRes, unresolvedInsightsRes, budApprovalsRes, prevLobbyRes] = await Promise.all([
      ctx.supabase
        .from('agent_runs')
        .select('id, agent_id, status, cost_cents, started_at, summary, output, quality_score')
        .gte('started_at', since24h)
        .in('agent_id', enabledAgentIds),
      ctx.supabase
        .from('agent_runs')
        .select('id, agent_id, status, summary, output, started_at, quality_score')
        .gte('started_at', since7d)
        .in('agent_id', enabledAgentIds),
      ctx.supabase
        .from('v_pending_agent_actions')
        .select('id, agent_id, status, created_at')
        .eq('status', 'pending'),
      ctx.supabase
        .from('bud_tasks')
        .select('id, status, source_agent')
        .in('status', ['pending', 'in_progress', 'awaiting_approval']),
      // Completed tasks older than 48h — used to detect persistently broken agents
      // that have already been investigated but never actually fixed.
      ctx.supabase
        .from('bud_tasks')
        .select('id, source_agent, created_at')
        .eq('status', 'completed')
        .lt('created_at', since48h),
      ctx.supabase
        .from('bud_insights')
        .select('id')
        .is('resolved_at', null),
      ctx.supabase
        .from('bud_approval_queue')
        .select('id, status')
        .eq('status', 'pending'),
      // Previous lobby state — used to skip the LLM call when nothing has changed.
      ctx.supabase
        .from('bud_lobby_states')
        .select('kpis, agent_states, operational_status, bud_state, summary')
        .eq('is_current', true)
        .maybeSingle(),
    ]);

    const runs24h   = runs24hRes.data ?? [];
    const runs7d    = runs7dRes.data ?? [];
    const pending   = pendingRes.data ?? [];
    const budTasks  = budTasksRes.data ?? [];
    const stuckTasks = stuckTasksRes.data ?? [];
    const unresolvedAlertCount = unresolvedInsightsRes.data?.length ?? 0;
    const budApprovalCount = budApprovalsRes.data?.length ?? 0;
    const prevLobby = prevLobbyRes.data ?? null;

    // Agents already investigated (and task completed) more than 48h ago — these
    // are "persistently broken" and should not be re-investigated every cycle.
    const alreadyInvestigatedStuck = new Set(
      stuckTasks.map((t) => t.source_agent).filter(Boolean) as string[],
    );

    // ── 2. Build per-agent metrics ─────────────────────────────────────────
    const metrics = new Map<string, AgentMetrics>();
    for (const a of agents) {
      metrics.set(a.id, {
        agent_id: a.id,
        runs_24h: 0, successes_24h: 0, failures_24h: 0, cost_cents_24h: 0,
        is_running: false, pending_count: 0, last_run_at: null, failure_rate_7d: 0,
        has_parse_failures: false,
      });
    }

    let totalParseFailures = 0;
    for (const r of runs24h) {
      const m = metrics.get(r.agent_id);
      if (!m) continue;
      m.runs_24h++;
      m.cost_cents_24h += r.cost_cents ?? 0;
      if (r.status === 'succeeded')   m.successes_24h++;
      if (r.status === 'failed')      m.failures_24h++;
      if (r.status === 'running')     m.is_running = true;
      if (!m.last_run_at || r.started_at > m.last_run_at) m.last_run_at = r.started_at;

      // Detect parse failures from summary text
      const s = (r.summary ?? '').toLowerCase();
      if (
        r.status === 'failed' &&
        (s.includes('could not parse') || s.includes('failed to parse') || s.includes('json parse'))
      ) {
        m.has_parse_failures = true;
        totalParseFailures++;
      }
    }

    // 7-day failure rates
    const hist7d = new Map<string, { runs: number; failures: number }>();
    for (const r of runs7d) {
      const h = hist7d.get(r.agent_id) ?? { runs: 0, failures: 0 };
      h.runs++;
      if (r.status === 'failed') h.failures++;
      hist7d.set(r.agent_id, h);
    }
    for (const [aid, h] of hist7d) {
      const m = metrics.get(aid);
      if (m) m.failure_rate_7d = h.runs > 0 ? h.failures / h.runs : 0;
    }

    for (const p of pending) {
      const m = metrics.get(p.agent_id);
      if (m) m.pending_count++;
    }

    // ── 3. Derive lifecycle states ─────────────────────────────────────────
    const agentStates: Record<string, AgentLifecycleState> = {};

    for (const a of agents) {
      if (a.status === 'disabled') { agentStates[a.id] = 'retired'; continue; }
      const m = metrics.get(a.id)!;
      const ageMs = m.last_run_at ? now - new Date(m.last_run_at).getTime() : Infinity;

      if (m.is_running)                                { agentStates[a.id] = 'active';          continue; }
      if (m.pending_count >= 5)                        { agentStates[a.id] = 'overloaded';       continue; }
      if (m.pending_count > 0)                         { agentStates[a.id] = 'awaiting_review';  continue; }
      if (m.failure_rate_7d > 0.4 && m.runs_24h >= 2) { agentStates[a.id] = 'degraded';         continue; }
      if (a.status === 'paused' || ageMs > 7 * 24 * 3600_000) { agentStates[a.id] = 'dormant'; continue; }
      agentStates[a.id] = 'idle';
    }

    // ── 4. Needs-attention set ────────────────────────────────────────────
    const lifecycleNeedsAttention = agents
      .filter((a) => {
        const ls = agentStates[a.id];
        const m = metrics.get(a.id)!;
        return (
          ls === 'degraded' ||
          ls === 'overloaded' ||
          m.has_parse_failures ||
          (ls === 'awaiting_review' && m.pending_count >= 3)
        );
      })
      .map((a) => a.id);

    const globalHealth = evaluateGlobalHealth({
      agents,
      runs: runs7d,
      actions: [
        ...pending,
        ...(budApprovalsRes.data ?? []).map((approval) => ({
          id: approval.id,
          agent_id: null,
          status: approval.status,
        })),
      ],
      unresolvedAlerts: unresolvedAlertCount,
    });

    const needsAttention = Array.from(new Set([
      ...lifecycleNeedsAttention,
      ...globalHealth.agents_needing_attention,
    ]));
    const needsAttentionSet = new Set(needsAttention);

    // ── 4b. Fetch structured failure details for needs-attention agents ───
    interface FailedRunDetail {
      runId: string;
      error: string;
      summary: string;
      logs: string[];
      started_at: string;
    }
    const failureDetails = new Map<string, FailedRunDetail>();

    if (needsAttention.length > 0) {
      const { data: recentFailed } = await ctx.supabase
        .from('agent_runs')
        .select('id, agent_id, status, error, summary, output, started_at')
        .in('agent_id', needsAttention)
        .in('status', ['failed', 'needs_repair'])
        .gte('started_at', since24h)
        .order('started_at', { ascending: false });

      for (const failRun of (recentFailed ?? [])) {
        if (failureDetails.has(failRun.agent_id)) continue; // keep most recent only
        const runOutput = (failRun.output ?? {}) as Record<string, unknown>;
        const runLogs = Array.isArray(runOutput.logs) ? (runOutput.logs as string[]) : [];
        failureDetails.set(failRun.agent_id, {
          runId: failRun.id,
          error: failRun.error ?? failRun.summary ?? 'No error message captured',
          summary: failRun.summary ?? '',
          logs: runLogs,
          started_at: failRun.started_at,
        });
      }
    }

    // ── 4c. Auto-resolve stale bud_tasks for recovered agents ─────────────
    // If an agent has an open task (pending/in_progress/awaiting_approval) but
    // its last run in the past 24h was a success, the issue is likely resolved.
    // Mark the task as 'recovered' and write an activity event so the Action
    // Queue clears automatically without admin intervention.
    const agentsWithOpenTasks = new Set(
      budTasks.map((t) => t.source_agent).filter(Boolean) as string[],
    );
    if (agentsWithOpenTasks.size > 0) {
      // Find agents that have an open task AND a recent successful run
      const recoveredAgents = Array.from(agentsWithOpenTasks).filter((aid) => {
        const m = metrics.get(aid);
        if (!m) return false;
        // Recovered = had at least one success in 24h and no failures
        return m.successes_24h > 0 && m.failures_24h === 0 && !m.has_parse_failures;
      });

      for (const aid of recoveredAgents) {
        const openTasks = budTasks.filter((t) => t.source_agent === aid);
        for (const task of openTasks) {
          await ctx.supabase
            .from('bud_tasks')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', task.id);
        }
        const agentName = agents.find((a) => a.id === aid)?.name ?? aid;
        await writeBudActivity(
          ctx.supabase,
          `${agentName} recovered — last run succeeded. Closed ${openTasks.length} stale task(s).`,
          { event_type: 'completion', actor: 'bud', target: aid },
        );
      }
    }

    // ── 5. Build workflow statuses ─────────────────────────────────────────
    const wfStatuses: WorkflowStatus[] = WORKFLOWS.map((w) => {
      const chainMetrics = w.chain
        .map((aid) => metrics.get(aid))
        .filter((m): m is AgentMetrics => m !== undefined);
      const bottleneck = chainMetrics.find(
        (m) => m.pending_count >= 3 || (m.failure_rate_7d > 0.3 && m.runs_24h >= 2),
      );
      const activeAgents = w.chain.filter((aid) => agentStates[aid] === 'active');
      return {
        id: w.id, label: w.label, domain: w.domain, type: w.type,
        active: activeAgents.length > 0,
        bottleneck_agent_id: bottleneck?.agent_id ?? null,
        chain: w.chain,
        runs_24h: chainMetrics.reduce((s, m) => s + m.runs_24h, 0),
        active_agents: activeAgents,
      };
    });

    // ── 6. Build section agent lists ───────────────────────────────────────
    function sectionIds(memberSet: Set<string>): string[] {
      return agents
        .filter((a) =>
          memberSet.has(a.id) &&
          !needsAttentionSet.has(a.id) &&
          agentStates[a.id] !== 'dormant' &&
          agentStates[a.id] !== 'retired',
        )
        .map((a) => a.id);
    }

    const dormantIds = agents
      .filter((a) => agentStates[a.id] === 'dormant' || agentStates[a.id] === 'retired')
      .map((a) => a.id);

    // ── 7. KPIs ────────────────────────────────────────────────────────────
    const kpis: LobbyKPIs = {
      agents_active:          Object.values(agentStates).filter((s) => s === 'active').length,
      agents_degraded:        Object.values(agentStates).filter((s) => s === 'degraded').length,
      agents_awaiting_review: Object.values(agentStates).filter((s) => s === 'awaiting_review').length,
      pending_approvals:      pending.length + budApprovalCount,
      total_runs_24h:         runs24h.length,
      total_cost_cents_24h:   runs24h.reduce((s, r) => s + (r.cost_cents ?? 0), 0),
      active_workflows:       wfStatuses.filter((w) => w.active).length,
      parse_failures_24h:     totalParseFailures,
      bud_tasks_open:         budTasks.length,
      failed_runs_24h:        runs24h.filter((r) => r.status === 'failed').length,
      broken_agents:          globalHealth.counts.broken_agents,
      needs_repair_agents:    globalHealth.counts.needs_repair_agents,
      watch_agents:           globalHealth.counts.watch_agents,
      unresolved_alerts:      unresolvedAlertCount,
      low_success_rate_agents: globalHealth.counts.low_success_rate_agents,
    };

    // ── 7b. Trigger investigations for degraded/failing agents ────────────
    interface InvestigationOutcome {
      agentId: string;
      agentName: string;
      taskId: string;
      taskStatus: string;
      errorType?: string;
    }
    const investigationResults: InvestigationOutcome[] = [];

    // Only investigate agents that have concrete failure data in the last 24h.
    // Exclude 'bud' itself to avoid self-investigation loops.
    // Exclude agents already investigated >48h ago whose task completed but the
    // agent is STILL broken — re-investigating them wastes budget and produces
    // identical reports. Emit a persistent-failure escalation insight for those
    // instead, nudging the admin to disable or manually fix the agent.
    const persistentlyBroken = needsAttention
      .filter((id) => id !== 'bud')
      .filter((id) => alreadyInvestigatedStuck.has(id));

    const agentsToInvestigate = needsAttention
      .filter((id) => failureDetails.has(id))
      .filter((id) => id !== 'bud')
      .filter((id) => !alreadyInvestigatedStuck.has(id))
      .slice(0, 5); // cap at 5 per cycle to stay within timeout

    if (agentsToInvestigate.length > 0) {
      await writeBudActivity(
        ctx.supabase,
        `Bud is investigating ${agentsToInvestigate.length} agent(s) with recent failures...`,
        { event_type: 'investigation', actor: 'bud' },
      );

      for (const aid of agentsToInvestigate) {
        const detail = failureDetails.get(aid)!;
        const agentName = agents.find((a) => a.id === aid)?.name ?? aid;
        try {
          const task = await triggerInvestigation(ctx.supabase, detail.runId, aid, agentName);
          const rawOut = (task.raw_output ?? {}) as Record<string, unknown>;
          const sf = rawOut.structured_failure as { errorType?: string } | undefined;
          investigationResults.push({
            agentId: aid,
            agentName,
            taskId: task.id,
            taskStatus: task.status,
            errorType: sf?.errorType,
          });
        } catch (err) {
          ctx.log(`[bud] investigation failed for ${aid}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    // Emit one escalation insight per persistently-broken agent (capped at 3 per cycle
    // to avoid flooding the insights table). The insight deduplicates on title via
    // upsert-style: we only insert if no unresolved insight for this agent exists.
    if (persistentlyBroken.length > 0) {
      for (const aid of persistentlyBroken.slice(0, 3)) {
        const agentName = agents.find((a) => a.id === aid)?.name ?? aid;
        const { data: existing } = await ctx.supabase
          .from('bud_insights')
          .select('id')
          .eq('agent_id', aid)
          .eq('category', 'anomaly')
          .is('resolved_at', null)
          .ilike('title', '%persistently broken%')
          .maybeSingle();
        if (!existing) {
          await ctx.supabase.from('bud_insights').insert({
            agent_id: aid,
            category: 'anomaly',
            severity: 'high',
            title: `${agentName} is persistently broken — disable or fix manually`,
            body: `${agentName} has been in a broken state for more than 48 hours. Bud has already investigated it. The root cause was not fixed. Consider disabling this agent in the registry until the underlying issue is resolved.`,
            metadata: { investigated_at_48h_plus: true },
          });
          await writeBudActivity(ctx.supabase,
            `Bud escalated ${agentName} — broken for 48h+, no longer re-investigating. Disable or fix manually.`,
            { event_type: 'detection', actor: 'bud', target: aid },
          );
        }
      }
    }

    // ── 8. LLM briefing ────────────────────────────────────────────────────
    const highPendingAgents = agents
      .filter((a) => (metrics.get(a.id)?.pending_count ?? 0) > 0)
      .map((a) => `${a.name} (${metrics.get(a.id)!.pending_count} pending)`);
    const degradedAgents = agents
      .filter((a) => agentStates[a.id] === 'degraded')
      .map((a) => a.name);
    const parseFailingAgents = agents
      .filter((a) => metrics.get(a.id)?.has_parse_failures)
      .map((a) => a.name);
    const bottleneckedWfs = wfStatuses
      .filter((w) => w.bottleneck_agent_id)
      .map((w) => `${w.label} → ${w.bottleneck_agent_id}`);

    const investigationSummary = investigationResults.length > 0
      ? investigationResults.map((r) =>
          `  • ${r.agentName} (${r.errorType ?? 'unknown'}) → task ${r.taskStatus}`,
        ).join('\n')
      : '  none this cycle';

    const llmPrompt = `Workforce status as of ${new Date().toISOString()}:
Total agents: ${agents.length}
Active right now: ${kpis.agents_active}
Awaiting review: ${highPendingAgents.join(', ') || 'none'}
Degraded agents: ${degradedAgents.join(', ') || 'none'}
Parse failing agents: ${parseFailingAgents.join(', ') || 'none'}
Open Bud repair tasks: ${kpis.bud_tasks_open}
Runs last 24h: ${kpis.total_runs_24h}
Parse failures 24h: ${kpis.parse_failures_24h}
Pending approvals: ${kpis.pending_approvals}
Active workflows: ${wfStatuses.filter((w) => w.active).map((w) => w.label).join(', ') || 'none'}
Bottlenecks: ${bottleneckedWfs.join(', ') || 'none detected'}
Needs-attention agents: ${needsAttention.length > 0 ? needsAttention.join(', ') : 'none'}
Global health: ${globalHealth.status}
Health issues: ${formatHealthCounts(globalHealth.counts)}
Investigations triggered this cycle:
${investigationSummary}`;

    type LlmResult = {
      operational_status: OperationalStatus;
      bud_state: BudState;
      summary: string;
      section_priorities: Record<string, number>;
      insights: Array<{
        agent_id: string | null;
        workflow_id: string | null;
        category: string;
        severity: string;
        title: string;
      }>;
    };

    // Skip the LLM call entirely if the operational picture hasn't changed since
    // the last cycle. We compare the sorted needsAttention IDs and three key KPIs.
    // A quiet, unchanged system doesn't need a fresh Claude call every 15 minutes.
    let llmResult: LlmResult;
    const prevKpis = prevLobby?.kpis as Partial<LobbyKPIs> | null | undefined;
    const prevAttentionIds = prevLobby?.agent_states
      ? Object.entries(prevLobby.agent_states as Record<string, string>)
          .filter(([, s]) => ['degraded', 'overloaded'].includes(s))
          .map(([id]) => id)
          .sort()
          .join(',')
      : '';
    const curAttentionIds = [...needsAttention].sort().join(',');
    const stateUnchanged =
      prevLobby !== null &&
      investigationResults.length === 0 &&
      persistentlyBroken.length === 0 &&
      curAttentionIds === prevAttentionIds &&
      prevKpis?.failed_runs_24h === kpis.failed_runs_24h &&
      prevKpis?.parse_failures_24h === kpis.parse_failures_24h &&
      prevKpis?.bud_tasks_open === kpis.bud_tasks_open &&
      prevKpis?.pending_approvals === kpis.pending_approvals &&
      prevKpis?.watch_agents === kpis.watch_agents;

    if (stateUnchanged) {
      ctx.log('[bud] state unchanged from previous cycle — skipping LLM call');
      llmResult = {
        operational_status: (prevLobby!.operational_status as OperationalStatus) ?? 'nominal',
        bud_state: (prevLobby!.bud_state as BudState) ?? 'idle',
        summary: prevLobby!.summary as string ?? 'No change since last cycle.',
        section_priorities: {
          'needs-attention': 1, 'live-operations': 2, 'customer-pipeline': 3,
          'finance-risk': 4, 'compliance': 5, 'growth-systems': 6, 'dormant': 7,
        },
        insights: [],
      };
    } else {
    try {
      const raw = await ctx.llm(llmPrompt, { system: SYSTEM });
      llmResult = JSON.parse(raw) as LlmResult;
    } catch {
      ctx.log('LLM parse failed, using fallback briefing');
      const hasCritical = kpis.parse_failures_24h > 0 || needsAttention.length > 2;
      llmResult = {
        operational_status: hasCritical ? 'elevated' : needsAttention.length > 0 ? 'elevated' : 'nominal',
        bud_state: kpis.bud_tasks_open > 0 ? 'repairing'
          : kpis.parse_failures_24h > 0 ? 'investigating'
          : needsAttention.length > 0 ? 'investigating'
          : 'idle',
        summary: needsAttention.length > 0
          ? `${needsAttention.length} agent(s) need attention. ${kpis.total_runs_24h} runs in 24h${kpis.parse_failures_24h > 0 ? `, ${kpis.parse_failures_24h} parse failures detected` : ''}.`
          : `${kpis.total_runs_24h} runs in 24h. All systems nominal.`,
        section_priorities: {
          'needs-attention': 1, 'live-operations': 2, 'customer-pipeline': 3,
          'finance-risk': 4, 'compliance': 5, 'growth-systems': 6, 'dormant': 7,
        },
        insights: [],
      };
    }
    } // end else (LLM was called)

    const forcedOperationalStatus = globalHealth.bud_status;
    const hasAwaitingApproval = investigationResults.some((r) => r.taskStatus === 'awaiting_approval');
    const forcedBudState: BudState = investigationResults.length > 0
      ? hasAwaitingApproval ? 'needs_human_approval' : 'investigating'
      : kpis.bud_tasks_open > 0 ? 'repairing'
      : globalHealth.status === 'attention_required' ? 'investigating'
      : globalHealth.status === 'degraded' && kpis.pending_approvals > 0 ? 'needs_human_approval'
      : globalHealth.status === 'degraded' ? 'reviewing'
      : 'idle';

    llmResult = {
      ...llmResult,
      operational_status: forcedOperationalStatus,
      bud_state: forcedBudState,
      summary: globalHealth.is_nominal ? llmResult.summary : globalHealth.summary,
    };

    // ── 9. Assemble sections ───────────────────────────────────────────────
    const sp = llmResult.section_priorities;
    const sections: LobbySection[] = [
      {
        id: 'needs-attention', label: 'Needs Attention',
        priority: sp['needs-attention'] ?? 1,
        visible: needsAttention.length > 0,
        agent_ids: needsAttention,
        workflow_ids: WORKFLOWS
          .filter((w) => w.chain.some((id) => needsAttentionSet.has(id)))
          .map((w) => w.id),
        status: (needsAttention.length > 0 ? 'elevated' : 'nominal') as LobbySection['status'],
        reason: needsAttention.length > 0 ? `${needsAttention.length} agent(s) require attention` : undefined,
      },
      { id: 'live-operations', label: 'Live Operations', priority: sp['live-operations'] ?? 2, visible: true, agent_ids: sectionIds(LIVE_OPS_IDS), workflow_ids: ['job-delivery', 'talent-pipeline'], status: 'nominal' as const },
      { id: 'customer-pipeline', label: 'Customer Pipeline', priority: sp['customer-pipeline'] ?? 3, visible: true, agent_ids: sectionIds(CUSTOMER_IDS), workflow_ids: ['customer-acquisition', 'win-back'], status: 'nominal' as const },
      { id: 'finance-risk', label: 'Finance & Risk', priority: sp['finance-risk'] ?? 4, visible: true, agent_ids: sectionIds(FINANCE_IDS), workflow_ids: ['revenue-intelligence'], status: 'nominal' as const },
      { id: 'compliance', label: 'Compliance', priority: sp['compliance'] ?? 5, visible: true, agent_ids: sectionIds(COMPLIANCE_IDS), workflow_ids: ['compliance-safety'], status: 'nominal' as const },
      { id: 'growth-systems', label: 'Growth Systems', priority: sp['growth-systems'] ?? 6, visible: true, agent_ids: sectionIds(GROWTH_IDS), workflow_ids: ['growth-loop'], status: 'nominal' as const },
      { id: 'dormant', label: 'Dormant', priority: sp['dormant'] ?? 7, visible: dormantIds.length > 0, agent_ids: dormantIds, workflow_ids: [], status: 'nominal' as const, reason: 'Agents that have not run recently or are paused.' },
    ].sort((a, b) => a.priority - b.priority);

    // ── 10. Write bud_lobby_states ─────────────────────────────────────────
    const budState: BudState = llmResult.bud_state ?? 'idle';

    await ctx.supabase
      .from('bud_lobby_states')
      .update({ is_current: false })
      .eq('is_current', true);

    await ctx.supabase.from('bud_lobby_states').insert({
      generated_at:       new Date().toISOString(),
      operational_status: llmResult.operational_status,
      bud_state:          budState,
      summary:            llmResult.summary,
      sections,
      workflows:          wfStatuses,
      kpis,
      agent_states:       agentStates,
      is_current:         true,
    });

    // ── 11. Write bud_insights ─────────────────────────────────────────────
    if (llmResult.insights?.length > 0) {
      await ctx.supabase.from('bud_insights').insert(
        llmResult.insights.map((i) => ({
          agent_id:    i.agent_id ?? null,
          workflow_id: i.workflow_id ?? null,
          category:    i.category,
          severity:    i.severity,
          title:       i.title,
        })),
      );
    }

    // ── 11b. Cross-agent insight synthesis ───────────────────────────────────
    // Correlate recent insights across agents to surface compound signals that
    // no single agent can see alone (e.g. both cash-flow + lead-scorer flagging
    // a weak pipeline, or multiple ops agents flagging crew load).
    // Runs at most once per 6h per category pair to avoid duplicate compounds.
    if (!stateUnchanged && llmResult.insights.length > 0) {
      try {
        const since6h = new Date(now - 6 * 3600_000).toISOString();
        const { data: recentInsights } = await ctx.supabase
          .from('bud_insights')
          .select('id, agent_id, category, severity, title, created_at')
          .gte('created_at', since7d)
          .is('resolved_at', null)
          .neq('category', 'compound') // avoid compounding compounds
          .order('created_at', { ascending: false })
          .limit(40);

        // Group by category across agents
        const byCat = new Map<string, Array<{ agentId: string | null; title: string }>>();
        for (const ins of (recentInsights ?? [])) {
          const cat = ins.category as string;
          if (!byCat.has(cat)) byCat.set(cat, []);
          byCat.get(cat)!.push({ agentId: ins.agent_id as string | null, title: ins.title as string });
        }

        // Find categories where ≥2 different agents raised an issue
        const crossAgentCategories = Array.from(byCat.entries()).filter(([, items]) => {
          const uniqueAgents = new Set(items.map((i) => i.agentId).filter(Boolean));
          return uniqueAgents.size >= 2;
        });

        for (const [cat, items] of crossAgentCategories.slice(0, 2)) {
          // Don't write a compound for this category if one was written in the last 6h
          const { data: existing } = await ctx.supabase
            .from('bud_insights')
            .select('id')
            .eq('category', 'compound')
            .ilike('title', `%${cat}%`)
            .gte('created_at', since6h)
            .maybeSingle();
          if (existing) continue;

          const agentNames = Array.from(new Set(
            items.map((i) => i.agentId)
              .filter(Boolean)
              .map((id) => agents.find((a) => a.id === id)?.name ?? id),
          )).slice(0, 4);

          const synthPrompt = `Two or more agents have independently flagged issues in the same category.
Category: ${cat}
Agents: ${agentNames.join(', ')}
Individual signals:\n${items.slice(0, 6).map((i) => `- ${i.title}`).join('\n')}

Write a single compound insight title (≤ 12 words) that captures the cross-agent pattern.
Return only the title string, no JSON, no preamble.`;

          try {
            const synthTitle = await ctx.llm(synthPrompt, {
              model: 'claude-haiku-4-5-20251001',
            });
            if (synthTitle.trim().length > 0) {
              await ctx.supabase.from('bud_insights').insert({
                agent_id: null,
                category: 'compound',
                severity: 'medium',
                title: synthTitle.trim().slice(0, 120),
                metadata: {
                  source_category: cat,
                  source_agents: agentNames,
                  signal_count: items.length,
                },
              });
            }
          } catch {
            // Non-fatal — synthesis is best-effort
          }
        }
      } catch {
        // Cross-agent synthesis must never break the main Bud cycle
      }
    }

    // ── 11c. Prune old rows (fire-and-forget) ─────────────────────────────
    // Keep bud_insights and bud_activity_feed lean — delete rows older than 30 days.
    // Run in parallel and ignore errors so a prune failure never breaks the cycle.
    void Promise.all([
      ctx.supabase.from('bud_insights').delete().lt('created_at', since30d),
      ctx.supabase.from('bud_activity_feed').delete().lt('created_at', since30d),
    ]);

    // ── 12. Narrate to activity feed ───────────────────────────────────────
    const summaryNarrative = investigationResults.length > 0
      ? `Bud investigated ${investigationResults.length} agent(s): ${investigationResults.map((r) => `${r.agentName} (${r.errorType ?? 'unknown error'})`).join(', ')}.`
      : budState === 'repairing'   ? `Bud reviewed open repair tasks — ${kpis.bud_tasks_open} task(s) in progress.`
      : budState === 'learning'    ? `Bud analyzed patterns and updated operational memory.`
      : !globalHealth.is_nominal   ? globalHealth.summary
      : `Bud completed operational review — ${kpis.total_runs_24h} runs analyzed, system ${llmResult.operational_status}.`;

    await writeBudActivity(ctx.supabase, summaryNarrative, {
      event_type: budState === 'investigating' ? 'investigation'
        : budState === 'repairing' ? 'repair'
        : budState === 'learning' ? 'learning'
        : 'completion',
      actor: 'bud',
      metadata: { operational_status: llmResult.operational_status, kpis },
    });

    const activeCount   = kpis.agents_active;
    const degradedCount = kpis.agents_degraded;
    const investigatedCount = investigationResults.length;
    const uninvestigatedCount = needsAttention.length - agentsToInvestigate.length;

    // Determine true output status based on what Bud actually did
    const outputStatus: 'success' | 'investigating' | 'repairing' | 'needs_action' | 'blocked' | 'degraded' | 'attention_required' =
      globalHealth.status === 'nominal'                                              ? 'success'
      : kpis.bud_tasks_open > 0                                                      ? 'repairing'
      : globalHealth.status === 'attention_required'                                 ? 'attention_required'
      : investigatedCount > 0 && investigationResults.some((r) => r.taskStatus === 'awaiting_approval') ? 'needs_action'
      : investigatedCount > 0                                                        ? 'investigating'
      : globalHealth.status === 'degraded'                                           ? 'degraded'
      : 'needs_action';

    const runSummary = investigatedCount > 0
      ? `Bud investigated ${investigatedCount} agent(s) — ${degradedCount} degraded, ${kpis.parse_failures_24h} parse failures. State: ${budState}.`
      : !globalHealth.is_nominal
      ? globalHealth.summary
      : `Bud completed review — ${activeCount} active, ${kpis.total_runs_24h} runs in 24h. System ${llmResult.operational_status}.`;

    const recommendedActions: string[] = [];
    if (investigationResults.some((r) => r.taskStatus === 'awaiting_approval')) {
      recommendedActions.push(`Approve ${investigationResults.filter((r) => r.taskStatus === 'awaiting_approval').length} investigation task(s) in Mission Control`);
    }
    if (uninvestigatedCount > 0) {
      recommendedActions.push(`${uninvestigatedCount} agent(s) flagged but no recent failure logs — manually run or check those agents`);
    }
    if (kpis.bud_tasks_open > 0) {
      recommendedActions.push(`${kpis.bud_tasks_open} repair task(s) open — review in Mission Control`);
    }
    if (recommendedActions.length === 0 && globalHealth.is_nominal) {
      recommendedActions.push('All nominal — no action required');
    } else if (recommendedActions.length === 0) {
      recommendedActions.push('Review Agent Health, failed runs, and pending approvals in Mission Control');
    }

    return {
      summary: runSummary,
      output: {
        status: outputStatus,
        bud_state: budState,
        operational_status: llmResult.operational_status,
        summary: llmResult.summary,
        findings: [
          ...(needsAttention.length > 0
            ? [`${needsAttention.length} agent(s) need attention: ${needsAttention.join(', ')}`]
            : []),
          ...(!globalHealth.is_nominal ? [formatHealthCounts(globalHealth.counts)] : []),
          ...(degradedCount > 0 ? [`${degradedCount} degraded`] : []),
          ...(kpis.parse_failures_24h > 0 ? [`${kpis.parse_failures_24h} parse failures in 24h`] : []),
          ...(kpis.bud_tasks_open > 0 ? [`${kpis.bud_tasks_open} open repair tasks`] : []),
          ...(investigatedCount > 0 ? [`${investigatedCount} investigation(s) triggered this cycle`] : []),
        ],
        investigation_results: investigationResults,
        agents_needing_attention: needsAttention,
        recommended_actions: recommendedActions,
        confidence: needsAttention.length === 0 ? 0.95 : investigatedCount > 0 ? 0.80 : 0.60,
        risk_level: llmResult.operational_status === 'critical' ? 'high'
          : llmResult.operational_status === 'elevated' ? 'medium'
          : 'low',
        next_step: investigatedCount > 0
          ? `Review ${investigatedCount} investigation task(s) in Mission Control`
          : needsAttention.length > 0
          ? 'Agents flagged but no recent logs available — check agent run history'
          : undefined,
      },
    };
  },
};
