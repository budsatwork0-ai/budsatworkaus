/**
 * The Foreman — operations brain for the Buds At Work AI workforce.
 *
 * Does NOT perform customer-facing work. Instead it:
 *   - aggregates 24h agent run data
 *   - derives lifecycle states for every agent
 *   - detects bottlenecks across workflow chains
 *   - calls the LLM for an operational briefing + section priorities
 *   - writes a foreman_lobby_state record consumed by the ForemanConsole
 *
 * Runs every 15 minutes via Vercel Cron. Can also be triggered manually
 * from the ForemanConsole via POST /api/agents/foreman.
 */
import type { AgentDefinition, AgentContext } from '../types';
import { WORKFLOWS, workflowsByAgent } from '../workflows';

// ── Types ────────────────────────────────────────────────────────────────────

export type AgentLifecycleState =
  | 'active'        // currently executing a run
  | 'idle'          // enabled, ran recently, no issues
  | 'awaiting_review' // has pending actions needing approval
  | 'degraded'      // failure rate > 40% over 7d
  | 'blocked'       // blocked by guardrail or external dependency
  | 'overloaded'    // pending queue depth ≥ 5
  | 'dormant'       // enabled but no run in > 7d
  | 'retired';      // disabled

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
}

// ── LLM system prompt ────────────────────────────────────────────────────────

const SYSTEM = `You are The Foreman, the operations brain for Buds At Work's AI agent workforce.
You receive a structured summary of agent activity and return a concise operational briefing.

Output strict JSON matching this exact shape:
{
  "operational_status": "nominal" | "elevated" | "critical",
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
- "summary" is 1–2 plain English sentences, no markdown. State what is actually happening, not what could happen.
- "operational_status": nominal = all clear; elevated = something needs admin attention; critical = immediate action required.
- "section_priorities": 1 = show first, 7 = show last, 0 = hide entirely. Needs Attention must be ≥ 1 if it has any agents.
- "insights": 0–5 items. Category is one of: bottleneck, anomaly, pattern, opportunity, risk.
- Severity: low | medium | high | critical.
- Be terse. Admin reads this at a glance.`;

// ── Section membership maps ───────────────────────────────────────────────────
// These are static sets — what section each agent "belongs to" in the lobby.
// An agent not in any set ends up in "dormant" or "needs-attention" only.

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

// ── Agent definition ─────────────────────────────────────────────────────────

export const foremanAgent: AgentDefinition = {
  id: 'foreman',
  name: 'The Foreman',
  description:
    'Operations brain — monitors all agents, detects bottlenecks, and generates the adaptive lobby state for the admin console.',
  category: 'ops',
  autonomy: 'auto',
  schedule: '*/15 * * * *',

  async run(ctx: AgentContext) {
    const now = Date.now();
    const since24h = new Date(now - 24 * 3600_000).toISOString();
    const since7d  = new Date(now - 7 * 24 * 3600_000).toISOString();

    // ── 1. Load source data ────────────────────────────────────────────────
    const [agentsRes, runs24hRes, runs7dRes, pendingRes] = await Promise.all([
      ctx.supabase.from('agents').select('id, name, category, status, autonomy, schedule'),
      ctx.supabase
        .from('agent_runs')
        .select('agent_id, status, cost_cents, started_at')
        .gte('started_at', since24h),
      ctx.supabase
        .from('agent_runs')
        .select('agent_id, status')
        .gte('started_at', since7d),
      ctx.supabase
        .from('agent_actions')
        .select('agent_id, status, created_at')
        .eq('status', 'pending'),
    ]);

    const agents  = agentsRes.data ?? [];
    const runs24h = runs24hRes.data ?? [];
    const runs7d  = runs7dRes.data ?? [];
    const pending = pendingRes.data ?? [];

    // ── 2. Build per-agent metrics ─────────────────────────────────────────
    const metrics = new Map<string, AgentMetrics>();
    for (const a of agents) {
      metrics.set(a.id, {
        agent_id: a.id,
        runs_24h: 0, successes_24h: 0, failures_24h: 0, cost_cents_24h: 0,
        is_running: false, pending_count: 0, last_run_at: null, failure_rate_7d: 0,
      });
    }

    for (const r of runs24h) {
      const m = metrics.get(r.agent_id);
      if (!m) continue;
      m.runs_24h++;
      m.cost_cents_24h += r.cost_cents ?? 0;
      if (r.status === 'succeeded')       m.successes_24h++;
      if (r.status === 'failed')          m.failures_24h++;
      if (r.status === 'running')         m.is_running = true;
      if (!m.last_run_at || r.started_at > m.last_run_at) m.last_run_at = r.started_at;
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
      if (a.status === 'paused' || ageMs > 7 * 24 * 3600_000) { agentStates[a.id] = 'dormant';  continue; }
      agentStates[a.id] = 'idle';
    }

    // ── 4. Determine "needs attention" set ────────────────────────────────
    const needsAttention = agents
      .filter((a) => {
        const ls = agentStates[a.id];
        const m = metrics.get(a.id)!;
        return (
          ls === 'degraded' ||
          ls === 'overloaded' ||
          (ls === 'awaiting_review' && m.pending_count >= 3)
        );
      })
      .map((a) => a.id);
    const needsAttentionSet = new Set(needsAttention);

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
        id: w.id,
        label: w.label,
        domain: w.domain,
        type: w.type,
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
        .filter(
          (a) =>
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
      pending_approvals:      pending.length,
      total_runs_24h:         runs24h.length,
      total_cost_cents_24h:   runs24h.reduce((s, r) => s + (r.cost_cents ?? 0), 0),
      active_workflows:       wfStatuses.filter((w) => w.active).length,
    };

    // ── 8. LLM briefing ────────────────────────────────────────────────────
    const highPendingAgents = agents
      .filter((a) => (metrics.get(a.id)?.pending_count ?? 0) > 0)
      .map((a) => `${a.name} (${metrics.get(a.id)!.pending_count} pending)`);
    const degradedAgents = agents
      .filter((a) => agentStates[a.id] === 'degraded')
      .map((a) => a.name);
    const bottleneckedWfs = wfStatuses
      .filter((w) => w.bottleneck_agent_id)
      .map((w) => `${w.label} → ${w.bottleneck_agent_id}`);

    const llmPrompt = `Workforce status as of ${new Date().toISOString()}:
Total agents: ${agents.length}
Active right now: ${kpis.agents_active}
Awaiting review: ${highPendingAgents.join(', ') || 'none'}
Degraded agents: ${degradedAgents.join(', ') || 'none'}
Runs last 24h: ${kpis.total_runs_24h}
Pending approvals: ${kpis.pending_approvals}
Active workflows: ${wfStatuses.filter((w) => w.active).map((w) => w.label).join(', ') || 'none'}
Bottlenecks: ${bottleneckedWfs.join(', ') || 'none detected'}
Needs-attention agents: ${needsAttention.length > 0 ? needsAttention.join(', ') : 'none'}

Section agent counts:
  Needs Attention: ${needsAttention.length}
  Live Operations: ${sectionIds(LIVE_OPS_IDS).length}
  Customer Pipeline: ${sectionIds(CUSTOMER_IDS).length}
  Finance & Risk: ${sectionIds(FINANCE_IDS).length}
  Compliance: ${sectionIds(COMPLIANCE_IDS).length}
  Growth Systems: ${sectionIds(GROWTH_IDS).length}
  Dormant/Retired: ${dormantIds.length}`;

    type LlmResult = {
      operational_status: OperationalStatus;
      summary: string;
      section_priorities: Record<string, number>;
      insights: Array<{ agent_id: string | null; workflow_id: string | null; category: string; severity: string; title: string }>;
    };

    let llmResult: LlmResult;
    try {
      const raw = await ctx.llm(llmPrompt, { system: SYSTEM });
      llmResult = JSON.parse(raw) as LlmResult;
    } catch {
      ctx.log('LLM parse failed, using fallback briefing');
      llmResult = {
        operational_status: needsAttention.length > 0 ? 'elevated' : 'nominal',
        summary: needsAttention.length > 0
          ? `${needsAttention.length} agent(s) need admin attention. ${kpis.total_runs_24h} runs completed in the last 24h.`
          : `${kpis.total_runs_24h} runs in the last 24h. All systems nominal.`,
        section_priorities: {
          'needs-attention': 1, 'live-operations': 2, 'customer-pipeline': 3,
          'finance-risk': 4, 'compliance': 5, 'growth-systems': 6, 'dormant': 7,
        },
        insights: [],
      };
    }

    // ── 9. Assemble sections ───────────────────────────────────────────────
    const sp = llmResult.section_priorities;
    const sections: LobbySection[] = [
      {
        id: 'needs-attention',
        label: 'Needs Attention',
        priority: sp['needs-attention'] ?? 1,
        visible: needsAttention.length > 0,
        agent_ids: needsAttention,
        workflow_ids: WORKFLOWS
          .filter((w) => w.chain.some((id) => needsAttentionSet.has(id)))
          .map((w) => w.id),
        status: (needsAttention.length > 0 ? 'elevated' : 'nominal') as LobbySection['status'],
        reason: needsAttention.length > 0
          ? `${needsAttention.length} agent(s) require admin action`
          : undefined,
      },
      {
        id: 'live-operations',
        label: 'Live Operations',
        priority: sp['live-operations'] ?? 2,
        visible: true,
        agent_ids: sectionIds(LIVE_OPS_IDS),
        workflow_ids: ['job-delivery', 'talent-pipeline'],
        status: 'nominal' as const,
      },
      {
        id: 'customer-pipeline',
        label: 'Customer Pipeline',
        priority: sp['customer-pipeline'] ?? 3,
        visible: true,
        agent_ids: sectionIds(CUSTOMER_IDS),
        workflow_ids: ['customer-acquisition', 'win-back'],
        status: 'nominal' as const,
      },
      {
        id: 'finance-risk',
        label: 'Finance & Risk',
        priority: sp['finance-risk'] ?? 4,
        visible: true,
        agent_ids: sectionIds(FINANCE_IDS),
        workflow_ids: ['revenue-intelligence'],
        status: 'nominal' as const,
      },
      {
        id: 'compliance',
        label: 'Compliance',
        priority: sp['compliance'] ?? 5,
        visible: true,
        agent_ids: sectionIds(COMPLIANCE_IDS),
        workflow_ids: ['compliance-safety'],
        status: 'nominal' as const,
      },
      {
        id: 'growth-systems',
        label: 'Growth Systems',
        priority: sp['growth-systems'] ?? 6,
        visible: true,
        agent_ids: sectionIds(GROWTH_IDS),
        workflow_ids: ['growth-loop'],
        status: 'nominal' as const,
      },
      {
        id: 'dormant',
        label: 'Dormant',
        priority: sp['dormant'] ?? 7,
        visible: dormantIds.length > 0,
        agent_ids: dormantIds,
        workflow_ids: [],
        status: 'nominal' as const,
        reason: 'Agents that have not run in over 7 days or are paused.',
      },
    ].sort((a, b) => a.priority - b.priority);

    // ── 10. Write lobby state ──────────────────────────────────────────────
    await ctx.supabase
      .from('foreman_lobby_states')
      .update({ is_current: false })
      .eq('is_current', true);

    await ctx.supabase.from('foreman_lobby_states').insert({
      generated_at:       new Date().toISOString(),
      operational_status: llmResult.operational_status,
      summary:            llmResult.summary,
      sections,
      workflows:          wfStatuses,
      kpis,
      agent_states:       agentStates,
      is_current:         true,
    });

    // ── 11. Write foreman insights ─────────────────────────────────────────
    if (llmResult.insights?.length > 0) {
      await ctx.supabase.from('foreman_insights').insert(
        llmResult.insights.map((i) => ({
          agent_id:    i.agent_id ?? null,
          workflow_id: i.workflow_id ?? null,
          category:    i.category,
          severity:    i.severity,
          title:       i.title,
        })),
      );
    }

    const activeCount   = kpis.agents_active;
    const degradedCount = kpis.agents_degraded;

    return {
      summary: `Foreman briefing complete — ${activeCount} active, ${degradedCount} degraded, ${pending.length} pending approvals. Status: ${llmResult.operational_status}.`,
      output: { operational_status: llmResult.operational_status, kpis },
    };
  },
};
