/**
 * Efficiency Architect — fleet-wide operational efficiency intelligence.
 *
 * Distinct from related agents:
 *   admin-optimization  → admin UX friction (click counts, page usability)
 *   agent-architect     → agent prompt / config / schedule tweaks
 *   efficiency-architect → system-wide efficiency (fleet metrics, redundancy,
 *                          automation ROI, deployment latency, cost-per-outcome)
 *
 * Analyses four domains:
 *   1. Agent fleet efficiency — cost, success rate, duration trends; identify
 *      underperformers and overlapping agents
 *   2. Workflow redundancy    — repeated multi-hop patterns, duplicate writes,
 *      noisy approval chains, low-value runs
 *   3. Automation gaps        — manual work that agents could handle based on
 *      job/quote/action patterns in the last 30 days
 *   4. Operational throughput — time-to-resolve from issue detection to
 *      verified fix; repair bottlenecks; deployment latency
 *
 * Findings are written to `efficiency_findings`. P0 findings get a proposed
 * action in the approval queue.
 *
 * Schedule: Sunday 6 am AEST (weekly operational review cadence)
 */
import type { AgentDefinition, AgentContext, AgentRunResult } from '../types';

const ANALYSIS_SYSTEM = `You are the Efficiency Architect for Buds At Work — a local home
services business (cleaning, yard care, car detailing, window cleaning, laundry) running on
an AI-native operating system called Buds OS.

Your job is operational efficiency: find where the system wastes compute, money, human
attention, or calendar time, and propose concrete fixes.

You have access to fleet-wide telemetry. Analyse it across four domains:
  1. AGENT FLEET — efficiency, overlap, cost, success rates, redundancy
  2. WORKFLOW REDUNDANCY — repeated patterns, duplicate logic, low-value runs
  3. AUTOMATION GAPS — manual work agents could own
  4. OPERATIONAL THROUGHPUT — detection → repair → verification latency

Return strict JSON:
{
  "findings": [
    {
      "id": "unique-kebab-slug",
      "domain": "agent_fleet" | "workflow_redundancy" | "automation_gap" | "operational_throughput",
      "title": "Concise finding title (max 80 chars)",
      "severity": "low" | "medium" | "high" | "critical",
      "priority": "P0" | "P1" | "P2" | "P3",
      "body": "2-4 sentence analysis with evidence",
      "affected_agents": ["agent-id-1"],
      "affected_workflows": ["workflow or page name"],
      "current_cost": "What this inefficiency costs (time, money, compute, attention)",
      "proposed_fix": "Concrete 1-3 step action Bud can take or propose",
      "estimated_saving": "Weekly minutes OR cents saved OR % improvement",
      "automation_candidate": boolean,
      "automation_trigger": "If automatable: what triggers the automation",
      "automation_action": "If automatable: what the automation does"
    }
  ],
  "fleet_summary": {
    "total_agents": number,
    "efficient_agents": number,
    "underperforming_agents": ["agent-id"],
    "overlapping_pairs": [["agent-a", "agent-b"]],
    "total_cost_7d_cents": number,
    "cost_per_successful_run_cents": number,
    "avg_success_rate_pct": number
  },
  "top_automation_gap": "The single highest-ROI automation gap found",
  "executive_summary": "2-3 sentences: biggest inefficiency, top fix, projected weekly saving."
}

Priority:
  P0 = wasting >A$50/week or blocking daily operations
  P1 = significant inefficiency, >30 min/week or >A$20/week
  P2 = meaningful improvement, <30 min/week
  P3 = polish — low effort, incremental gain

Output only the JSON. No prose, no fences.`;

interface EfficiencyFinding {
  id: string;
  domain: string;
  title: string;
  severity: string;
  priority: string;
  body: string;
  affected_agents: string[];
  affected_workflows: string[];
  current_cost: string;
  proposed_fix: string;
  estimated_saving: string;
  automation_candidate: boolean;
  automation_trigger: string;
  automation_action: string;
}

interface FleetSummary {
  total_agents: number;
  efficient_agents: number;
  underperforming_agents: string[];
  overlapping_pairs: [string, string][];
  total_cost_7d_cents: number;
  cost_per_successful_run_cents: number;
  avg_success_rate_pct: number;
}

interface AnalysisResult {
  findings: EfficiencyFinding[];
  fleet_summary: FleetSummary;
  top_automation_gap: string;
  executive_summary: string;
}

function countBy<T extends Record<string, unknown>>(rows: T[], key: keyof T): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const val = String(r[key] ?? 'unknown');
    out[val] = (out[val] ?? 0) + 1;
  }
  return out;
}

export const efficiencyArchitectAgent: AgentDefinition = {
  id: 'efficiency-architect',
  name: 'Efficiency Architect',
  description:
    'Fleet-wide operational efficiency analysis: cost-per-outcome, redundant agents, automation ROI, ' +
    'workflow redundancy, and throughput bottlenecks. Distinct from admin-optimization (UX) and ' +
    'agent-architect (prompt tweaks).',
  category: 'ops',
  autonomy: 'review',
  schedule: '0 6 * * 0', // Sunday 6 am AEST

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const now = new Date().toISOString().slice(0, 10);
    ctx.log('Efficiency Architect starting', { date: now });

    const since7d  = new Date(Date.now() -  7 * 24 * 3_600_000).toISOString();
    const since30d = new Date(Date.now() - 30 * 24 * 3_600_000).toISOString();

    // ── 1. Fleet telemetry ────────────────────────────────────────────────────

    const [
      { data: agentRows },
      { data: runRows },
      { data: actionRows },
      { data: approvalRows },
      { data: taskRows },
      { data: jobRows },
      { data: quoteRows },
      { data: repairRows },
      { data: circuitRow },
    ] = await Promise.all([
      ctx.supabase
        .from('agents')
        .select('id, name, category, autonomy, status, schedule, config'),

      ctx.supabase
        .from('agent_runs')
        .select('id, agent_id, status, cost_cents, duration_ms, started_at, finished_at')
        .gte('started_at', since30d)
        .order('started_at', { ascending: false })
        .limit(500),

      ctx.supabase
        .from('agent_actions')
        .select('id, agent_id, action_type, status, created_at')
        .gte('created_at', since30d)
        .limit(200),

      ctx.supabase
        .from('bud_approval_queue')
        .select('id, action_type, status, created_at, reviewed_at')
        .gte('created_at', since30d)
        .limit(100),

      ctx.supabase
        .from('bud_tasks')
        .select('id, status, created_at, updated_at')
        .gte('created_at', since30d)
        .limit(100),

      ctx.supabase
        .from('orders')
        .select('id, status, assigned_crew_id, created_at')
        .gte('created_at', since7d)
        .limit(200),

      ctx.supabase
        .from('quotes')
        .select('id, status, created_at, agent_triaged_at')
        .gte('created_at', since30d)
        .limit(200),

      ctx.supabase
        .from('bud_repair_executions')
        .select('id, status, created_at, verification_status')
        .gte('created_at', since30d)
        .limit(50),

      ctx.supabase
        .from('bud_circuit_states')
        .select('state, failure_streak, updated_at')
        .eq('id', 'anthropic_api')
        .maybeSingle(),
    ]);

    const runs   = (runRows   ?? []) as Array<Record<string, unknown>>;
    const agents = (agentRows ?? []) as Array<Record<string, unknown>>;
    const actions = (actionRows ?? []) as Array<Record<string, unknown>>;
    const approvals = (approvalRows ?? []) as Array<Record<string, unknown>>;
    const tasks = (taskRows ?? []) as Array<Record<string, unknown>>;
    const jobs = (jobRows ?? []) as Array<Record<string, unknown>>;
    const quotes = (quoteRows ?? []) as Array<Record<string, unknown>>;
    const repairs = (repairRows ?? []) as Array<Record<string, unknown>>;

    // ── 2. Per-agent metrics ──────────────────────────────────────────────────

    const agentMetrics: Record<string, {
      runs7d: number; runs30d: number;
      success7d: number; failed7d: number;
      cost7d: number; cost30d: number;
      totalDurationMs: number; durationCount: number;
      approvedActions: number; rejectedActions: number;
    }> = {};

    const ensure = (id: string) => {
      if (!agentMetrics[id]) {
        agentMetrics[id] = {
          runs7d: 0, runs30d: 0,
          success7d: 0, failed7d: 0,
          cost7d: 0, cost30d: 0,
          totalDurationMs: 0, durationCount: 0,
          approvedActions: 0, rejectedActions: 0,
        };
      }
      return agentMetrics[id];
    };

    for (const r of runs) {
      const id = r.agent_id as string;
      const m = ensure(id);
      const isRecent = new Date(r.started_at as string).getTime() >= new Date(since7d).getTime();
      m.runs30d += 1;
      if (isRecent) {
        m.runs7d += 1;
        m.cost7d += (r.cost_cents as number) ?? 0;
        if (r.status === 'succeeded') m.success7d += 1;
        if (r.status === 'failed') m.failed7d += 1;
      }
      m.cost30d += (r.cost_cents as number) ?? 0;
      if (r.duration_ms != null) {
        m.totalDurationMs += r.duration_ms as number;
        m.durationCount += 1;
      }
    }

    for (const a of actions) {
      const id = a.agent_id as string;
      if (!id) continue;
      const m = ensure(id);
      if (a.status === 'approved' || a.status === 'executed') m.approvedActions += 1;
      if (a.status === 'rejected') m.rejectedActions += 1;
    }

    // ── 3. Compute fleet-level stats ──────────────────────────────────────────

    const totalCost7d = Object.values(agentMetrics).reduce((s, m) => s + m.cost7d, 0);
    const totalRuns7d = Object.values(agentMetrics).reduce((s, m) => s + m.runs7d, 0);
    const totalSuccess7d = Object.values(agentMetrics).reduce((s, m) => s + m.success7d, 0);
    const avgSuccessRate = totalRuns7d > 0
      ? Math.round((totalSuccess7d / totalRuns7d) * 100)
      : 0;
    const costPerSuccess = totalSuccess7d > 0
      ? Math.round(totalCost7d / totalSuccess7d)
      : 0;

    // Approval queue velocity
    const resolvedApprovals = approvals.filter(
      (a) => a.status !== 'pending' && a.reviewed_at != null,
    );
    const avgApprovalMs = resolvedApprovals.length > 0
      ? resolvedApprovals.reduce((s, a) => {
          return s + (new Date(a.reviewed_at as string).getTime() - new Date(a.created_at as string).getTime());
        }, 0) / resolvedApprovals.length
      : 0;

    // Repair-to-verification latency
    const verifiedRepairs = repairs.filter((r) => r.verification_status === 'verified');
    const avgRepairMs = verifiedRepairs.length > 0
      ? verifiedRepairs.reduce((s, r) => {
          return s + (new Date(r.updated_at as string ?? r.created_at as string).getTime() - new Date(r.created_at as string).getTime());
        }, 0) / verifiedRepairs.length
      : 0;

    // Quote triage automation gap
    const untriagedQuotes = (quotes as Array<{ agent_triaged_at: string | null }>)
      .filter((q) => !q.agent_triaged_at).length;

    // Unassigned jobs (jobs == orders in the live schema)
    const unassignedJobs = (jobs as Array<{ assigned_crew_id: string | null }>)
      .filter((j) => !j.assigned_crew_id).length;

    // Task cycle time
    const completedTasks = (tasks as Array<{ status: string; created_at: string; updated_at: string }>)
      .filter((t) => ['completed', 'recovered'].includes(t.status));
    const avgTaskMs = completedTasks.length > 0
      ? completedTasks.reduce((s, t) => s + (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()), 0) / completedTasks.length
      : 0;

    ctx.log('Fleet stats computed', {
      totalRuns7d, totalCost7d, avgSuccessRate, costPerSuccess,
      untriagedQuotes, unassignedJobs,
    });

    // ── 4. Build LLM payload ──────────────────────────────────────────────────

    const agentSummary = agents.map((a) => {
      const m = agentMetrics[a.id as string] ?? {};
      const runs7d = (m as { runs7d?: number }).runs7d ?? 0;
      const success7d = (m as { success7d?: number }).success7d ?? 0;
      const cost7d = (m as { cost7d?: number }).cost7d ?? 0;
      const totalDurationMs = (m as { totalDurationMs?: number }).totalDurationMs ?? 0;
      const durationCount = (m as { durationCount?: number }).durationCount ?? 0;
      const approvedActions = (m as { approvedActions?: number }).approvedActions ?? 0;
      const rejectedActions = (m as { rejectedActions?: number }).rejectedActions ?? 0;
      return {
        id: a.id,
        name: a.name,
        category: a.category,
        autonomy: a.autonomy,
        status: a.status,
        schedule: a.schedule,
        runs_7d: runs7d,
        success_rate_7d: runs7d > 0 ? Math.round((success7d / runs7d) * 100) : null,
        cost_7d_cents: cost7d,
        avg_duration_ms: durationCount > 0 ? Math.round(totalDurationMs / durationCount) : null,
        action_reject_ratio: (approvedActions + rejectedActions) > 0
          ? Math.round((rejectedActions / (approvedActions + rejectedActions)) * 100)
          : null,
      };
    });

    const workflowSignals = {
      approval_queue: {
        total_30d: approvals.length,
        pending: approvals.filter((a) => a.status === 'pending').length,
        avg_review_hours: avgApprovalMs > 0 ? Math.round(avgApprovalMs / 3_600_000 * 10) / 10 : null,
        by_action_type: countBy(approvals as Array<Record<string, unknown>>, 'action_type'),
      },
      repair_throughput: {
        total_30d: repairs.length,
        verified: verifiedRepairs.length,
        avg_verify_hours: avgRepairMs > 0 ? Math.round(avgRepairMs / 3_600_000 * 10) / 10 : null,
      },
      task_cycle: {
        total_30d: tasks.length,
        avg_complete_hours: avgTaskMs > 0 ? Math.round(avgTaskMs / 3_600_000 * 10) / 10 : null,
      },
    };

    const automationSignals = {
      untriaged_quotes_30d: untriagedQuotes,
      unassigned_jobs_7d: unassignedJobs,
      circuit_state: (circuitRow as { state?: string } | null)?.state ?? 'closed',
      circuit_failure_streak: (circuitRow as { failure_streak?: number } | null)?.failure_streak ?? 0,
    };

    const prompt = [
      '### Agent fleet (last 30 days)',
      JSON.stringify(agentSummary, null, 2),
      '',
      '### Workflow signals',
      JSON.stringify(workflowSignals, null, 2),
      '',
      '### Automation gap signals',
      JSON.stringify(automationSignals, null, 2),
      '',
      '### Fleet totals (7-day window)',
      JSON.stringify({
        total_runs: totalRuns7d,
        total_cost_cents: totalCost7d,
        avg_success_rate_pct: avgSuccessRate,
        cost_per_successful_run_cents: costPerSuccess,
      }, null, 2),
      '',
      'Analyse and return findings JSON.',
    ].join('\n');

    const raw = await ctx.llm(prompt, { system: ANALYSIS_SYSTEM });

    let result: AnalysisResult;
    try {
      result = JSON.parse(raw) as AnalysisResult;
    } catch {
      ctx.log('Parse failed', { rawHead: raw.slice(0, 300) });
      return { summary: 'Efficiency Architect could not parse LLM output.' };
    }

    // ── 5. Persist findings ───────────────────────────────────────────────────

    let persisted = 0;
    for (const f of result.findings ?? []) {
      const { error } = await ctx.supabase.from('efficiency_findings').insert({
        agent_id: 'efficiency-architect',
        run_id: ctx.runId,
        domain: f.domain,
        title: f.title,
        body: f.body,
        severity: f.severity,
        priority: f.priority,
        affected_agents: f.affected_agents ?? [],
        affected_workflows: f.affected_workflows ?? [],
        current_cost: f.current_cost,
        proposed_fix: f.proposed_fix,
        estimated_saving: f.estimated_saving,
        automation_candidate: f.automation_candidate ?? false,
        automation_trigger: f.automation_trigger || null,
        automation_action: f.automation_action || null,
        evidence: {
          fleet_summary: result.fleet_summary,
          top_automation_gap: result.top_automation_gap,
        },
      });
      if (!error) persisted += 1;
    }

    // ── 6. Propose actions for P0 / critical findings ─────────────────────────

    const criticals = (result.findings ?? []).filter(
      (f) => f.priority === 'P0' || f.severity === 'critical',
    );
    for (const f of criticals) {
      await ctx.proposeAction({
        action_type: 'efficiency_improvement',
        payload: {
          finding_id: f.id,
          domain: f.domain,
          proposed_fix: f.proposed_fix,
          estimated_saving: f.estimated_saving,
          affected_agents: f.affected_agents,
          automation_candidate: f.automation_candidate,
        },
        preview: `[${f.priority}] ${f.title} — saves ${f.estimated_saving}`,
        requiresApproval: true,
      });
    }

    // ── 7. Store key insights in memory for cross-agent recall ────────────────

    if (result.executive_summary) {
      await ctx.memory.write({
        category: 'architecture',
        title: `[Efficiency Review ${now}] ${result.top_automation_gap ?? 'Fleet analysis'}`,
        body: [
          result.executive_summary,
          '',
          `**Top automation gap:** ${result.top_automation_gap ?? 'none identified'}`,
          `**Fleet stats:** ${agentSummary.length} agents · ${totalRuns7d} runs/7d · ${avgSuccessRate}% success · ${totalCost7d}¢ total cost`,
          `**Critical findings:** ${criticals.length}`,
          result.findings
            ?.filter((f) => ['P0', 'P1'].includes(f.priority))
            .slice(0, 5)
            .map((f) => `- [${f.priority}] ${f.title}: ${f.proposed_fix}`)
            .join('\n') ?? '',
        ].filter(Boolean).join('\n'),
        tags: ['efficiency-architect', 'weekly-review', 'operational-intelligence'],
        agentScope: 'efficiency-architect',
        vaultPath: `efficiency/${now}-efficiency-review.md`,
      });
    }

    ctx.log('Efficiency Architect complete', {
      findings: result.findings?.length ?? 0,
      persisted,
      criticals: criticals.length,
      executive_summary: result.executive_summary,
    });

    return {
      summary: [
        `Efficiency review complete — ${result.findings?.length ?? 0} findings.`,
        result.executive_summary,
      ].filter(Boolean).join(' '),
      output: {
        findings: result.findings,
        fleet_summary: result.fleet_summary,
        top_automation_gap: result.top_automation_gap,
        executive_summary: result.executive_summary,
      },
    };
  },
};
