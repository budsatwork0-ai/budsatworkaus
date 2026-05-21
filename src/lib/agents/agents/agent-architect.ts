/**
 * Agent Architect — the meta-agent.
 *
 * Once a week, looks at the performance of every other agent over the
 * last 30 days and proposes targeted changes:
 *   • prompt tweak       — rewrite the SYSTEM prompt of an agent
 *   • config change      — adjust a config knob (e.g. auto_send_under_aud)
 *   • autonomy change    — promote auto → review, or vice versa
 *   • schedule change    — run more or less often
 *   • retire             — disable an underperformer
 *   • new agent          — propose a brand-new agent to fill a gap
 *
 * Proposals land in `agent_evolutions` for human review. Approved
 * proposals can be applied with a follow-up action (or by hand).
 */
import type { AgentDefinition, AgentContext } from '../types';

const SYSTEM = `You are the Agent Architect — a senior systems designer
reviewing the team of autonomous agents that run Buds At Work. Given
30-day performance metrics for every agent, identify 3-6 targeted
improvements. Be concrete. Prefer small high-leverage changes over
big rewrites. Strict JSON:
{
  "evolutions": [
    {
      "target_agent_id": "...",
      "evolution_type": "prompt_tweak"|"config_change"|"autonomy_change"|"schedule_change"|"retire"|"new_agent",
      "rationale": "...one paragraph referencing the metrics...",
      "proposed_diff": {
        "before": "...",
        "after": "..."
      }
    }
  ]
}`;

interface AgentMetric {
  agent_id: string;
  runs: number;
  succeeded: number;
  failed: number;
  needs_approval: number;
  avg_duration_ms: number;
  total_cost_cents: number;
  actions_proposed: number;
  actions_approved: number;
  actions_rejected: number;
  reject_ratio: number;
}

export const agentArchitectAgent: AgentDefinition = {
  id: 'agent-architect',
  name: 'Agent Architect',
  description: 'Meta-agent. Reviews other agents and proposes prompt / config / schedule tweaks.',
  category: 'ops',
  autonomy: 'review',
  async run(ctx: AgentContext) {
    const minRuns = Number((ctx.config?.min_runs_for_review as number) ?? 10);

    // 30-day stats per agent
    const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
    const { data: runs } = await ctx.supabase
      .from('agent_runs')
      .select('agent_id, status, duration_ms, cost_cents')
      .gte('started_at', since);

    const { data: actions } = await ctx.supabase
      .from('agent_actions')
      .select('agent_id, status')
      .gte('created_at', since);

    const metrics = new Map<string, AgentMetric>();
    function ensure(id: string): AgentMetric {
      let m = metrics.get(id);
      if (!m) {
        m = { agent_id: id, runs: 0, succeeded: 0, failed: 0, needs_approval: 0, avg_duration_ms: 0, total_cost_cents: 0, actions_proposed: 0, actions_approved: 0, actions_rejected: 0, reject_ratio: 0 };
        metrics.set(id, m);
      }
      return m;
    }
    let durSum: Record<string, number> = {};
    let durN: Record<string, number> = {};
    for (const r of runs ?? []) {
      const m = ensure(r.agent_id as string);
      m.runs += 1;
      if (r.status === 'succeeded')      m.succeeded += 1;
      if (r.status === 'failed')         m.failed += 1;
      if (r.status === 'needs_approval') m.needs_approval += 1;
      m.total_cost_cents += (r.cost_cents as number) ?? 0;
      if (r.duration_ms != null) {
        durSum[r.agent_id as string] = (durSum[r.agent_id as string] ?? 0) + (r.duration_ms as number);
        durN[r.agent_id as string]   = (durN[r.agent_id as string]   ?? 0) + 1;
      }
    }
    for (const id of Object.keys(durSum)) {
      const m = metrics.get(id)!;
      m.avg_duration_ms = Math.round(durSum[id] / durN[id]);
    }
    for (const a of actions ?? []) {
      const m = ensure(a.agent_id as string);
      m.actions_proposed += 1;
      if (a.status === 'approved' || a.status === 'executed') m.actions_approved += 1;
      if (a.status === 'rejected') m.actions_rejected += 1;
    }
    for (const m of metrics.values()) {
      const decided = m.actions_approved + m.actions_rejected;
      m.reject_ratio = decided > 0 ? m.actions_rejected / decided : 0;
    }

    // Pull current prompt configs so the model can suggest specific changes
    const { data: agentRows } = await ctx.supabase
      .from('agents')
      .select('id, name, description, category, autonomy, schedule, config, status');

    const reviewable = Array.from(metrics.values()).filter((m) => m.runs >= minRuns);
    if (!reviewable.length) {
      return { summary: 'Not enough runs in the last 30 days to review (need ≥' + minRuns + ').' };
    }

    const prompt = `Agents (current state):\n${JSON.stringify(agentRows, null, 2)}\n\nMetrics (last 30d):\n${JSON.stringify(reviewable, null, 2)}\n\nReturn evolutions JSON.`;
    const raw = await ctx.llm(prompt, { system: SYSTEM });

    let parsed: { evolutions: Array<{ target_agent_id: string; evolution_type: string; rationale: string; proposed_diff: unknown }> };
    try {
      const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = codeBlock ? codeBlock[1].trim() : (raw.match(/\{[\s\S]*\}/) ?? [raw])[0].trim();
      parsed = JSON.parse(jsonStr);
    } catch { return { summary: 'Could not parse architect output.' }; }

    let count = 0;
    const findingStrings: string[] = [];
    const actionStrings: string[] = [];
    for (const e of parsed.evolutions ?? []) {
      const { data: row } = await ctx.supabase.from('agent_evolutions').insert({
        target_agent_id: e.target_agent_id,
        run_id: ctx.runId,
        evolution_type: e.evolution_type,
        rationale: e.rationale,
        evidence: metrics.get(e.target_agent_id) ?? {},
        proposed_diff: e.proposed_diff,
      }).select('id').single();

      await ctx.proposeAction({
        action_type: 'flag_for_review',
        target_table: 'agent_evolutions',
        target_id: row?.id,
        preview: `${e.evolution_type} → ${e.target_agent_id}: ${e.rationale.slice(0, 80)}…`,
        payload: { evolution_id: row?.id, target: e.target_agent_id, type: e.evolution_type },
      });
      findingStrings.push(`${e.evolution_type} → ${e.target_agent_id}: ${e.rationale.slice(0, 100)}`);
      actionStrings.push(`Review ${e.evolution_type} for ${e.target_agent_id}`);
      count += 1;
    }

    return {
      summary: `Reviewed ${reviewable.length} agent(s); proposed ${count} evolution(s).`,
      output: {
        status: count > 0 ? 'needs_action' : 'success',
        summary: `Reviewed ${reviewable.length} agent(s); proposed ${count} evolution(s).`,
        findings: findingStrings,
        recommended_actions: actionStrings,
        confidence: 0.8,
        risk_level: 'low',
        raw_output: { reviewed: reviewable.length, proposed: count },
      },
    };
  },
};
