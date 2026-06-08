/**
 * Chief of Staff — reads executive decisions from the other 4 execs and
 * synthesises them into actionable agent_tasks for the fleet.
 *
 * Does NOT produce its own strategic decisions.
 * Routes work to the right fleet agent based on decision category.
 *
 * Runs daily after the 4 functional execs (schedule offset by 30min).
 */
import type { AgentDefinition, AgentContext } from '../types';
import type { InsertExecutiveTask, TaskPriority } from '../executive/types';

const SYSTEM = `You are the Chief of Staff at Buds At Work.
You receive a list of executive decisions from the CEO, COO, CMO, and CFO.
Your job is to translate each decision into a concrete task for the right agent.

Return strict JSON:
{
  "summary": string,
  "tasks": [
    {
      "decision_id": string,
      "source_agent_id": string,
      "target_agent_id": string | null,
      "title": string,
      "description": string,
      "priority": "critical" | "high" | "normal" | "low"
    }
  ]
}

Agent routing guide:
- Revenue / pricing decisions → "cash-flow-forecaster" or null (human action)
- Lead / marketing decisions → "content-agent" or "copy-optimizer"
- Scheduling / crew decisions → "scheduling" or "crew-briefing"
- Compliance / safety → "whs-safety-reminder" or "ndis-compliance"
- Customer retention → "lapsed-win-back" or "customer-reply"
- Data reconciliation → "reconciliation"
- If no clear fleet agent fits, set target_agent_id to null (human task).

Rules:
- One task per decision. Don't merge or split decisions.
- "priority": critical if risk_level=high; high if risk_level=medium; normal/low otherwise.
- "description": 1–2 sentences max. Concrete and actionable.
- Be terse.`;

/** Map decision risk level to task priority. */
function riskToPriority(riskLevel: string): TaskPriority {
  if (riskLevel === 'high')   return 'critical';
  if (riskLevel === 'medium') return 'high';
  return 'normal';
}

export const chiefOfStaffAgent: AgentDefinition = {
  id: 'chief-of-staff',
  name: 'Chief of Staff',
  description: 'Reads executive decisions and routes them as tasks to the right fleet agents.',
  category: 'executive',
  autonomy: 'review',
  schedule: '30 6 * * *',

  async run(ctx: AgentContext) {
    // Fetch pending decisions from all 4 functional execs from the last 48h
    const since48h = new Date(Date.now() - 48 * 3600_000).toISOString();

    const { data: decisions } = await ctx.supabase
      .from('executive_decisions')
      .select('id, agent_id, title, reasoning, evidence, risk_level, expected_impact, status')
      .in('agent_id', ['ceo-agent', 'coo-agent', 'cmo-agent', 'cfo-agent'])
      .in('status', ['pending', 'approved'])
      .gte('created_at', since48h)
      .order('created_at', { ascending: false });

    if (!decisions || decisions.length === 0) {
      return {
        summary: 'Chief of Staff: no new executive decisions to route.',
        output: { tasks_created: 0 },
      };
    }

    const decisionList = decisions.map((d) =>
      `ID: ${d.id}\nFrom: ${d.agent_id}\nDecision: ${d.title}\nReasoning: ${d.reasoning}\nRisk: ${d.risk_level}\nImpact: ${d.expected_impact}`,
    ).join('\n---\n');

    const prompt = `Executive decisions to route:\n\n${decisionList}`;

    let tasksToCreate: Array<{
      decision_id: string;
      source_agent_id: string;
      target_agent_id: string | null;
      title: string;
      description: string;
      priority: TaskPriority;
    }> = [];

    try {
      const raw = await ctx.llm(prompt, { system: SYSTEM });
      const parsed = JSON.parse(raw) as {
        summary: string;
        tasks: Array<{
          decision_id: string;
          source_agent_id: string;
          target_agent_id: string | null;
          title: string;
          description: string;
          priority: TaskPriority;
        }>;
      };
      tasksToCreate = parsed.tasks ?? [];
    } catch {
      // Fallback: create a task per decision using rule-based routing
      for (const d of decisions) {
        tasksToCreate.push({
          decision_id:     d.id as string,
          source_agent_id: d.agent_id as string,
          target_agent_id: null,
          title:           `Act on: ${d.title}`,
          description:     d.reasoning as string,
          priority:        riskToPriority(d.risk_level as string),
        });
      }
    }

    if (ctx.dryRun) {
      return {
        summary: `[DRY RUN] Chief of Staff would route ${tasksToCreate.length} task(s) from ${decisions.length} decision(s).`,
        output: {
          dry_run: true,
          decisions_reviewed: decisions.length,
          proposed_tasks: tasksToCreate,
        },
      };
    }

    // Insert tasks
    let tasksCreated = 0;
    for (const t of tasksToCreate) {
      const row: InsertExecutiveTask = {
        decision_id:     t.decision_id,
        source_agent_id: t.source_agent_id,
        target_agent_id: t.target_agent_id ?? null,
        title:           t.title,
        description:     t.description,
        priority:        t.priority,
      };

      await ctx.supabase.from('executive_tasks').insert(row);
      tasksCreated++;

      // If there's a target fleet agent, also write a proposed action
      if (t.target_agent_id) {
        await ctx.proposeAction({
          action_type:      'delegate_to_agent',
          target_table:     'executive_tasks',
          target_id:        t.decision_id,
          preview:          `Route to ${t.target_agent_id}: ${t.title}`,
          payload:          { task: t },
          requiresApproval: t.priority === 'critical' || t.priority === 'high',
          confidence:       0.75,
          risk_level:       t.priority === 'critical' ? 'high' : t.priority === 'high' ? 'medium' : 'low',
        });
      }
    }

    await ctx.supabase.from('executive_agent_runs_meta').insert({
      run_id:           ctx.runId,
      agent_id:         'chief-of-staff',
      decisions:        decisions.length,
      tasks:            tasksCreated,
      auto_executed:    0,
      queued_approvals: tasksToCreate.filter((t) => t.target_agent_id).length,
    });

    return {
      summary: `Chief of Staff routed ${tasksCreated} task(s) from ${decisions.length} executive decision(s).`,
      output: {
        decisions_reviewed: decisions.length,
        tasks_created: tasksCreated,
      },
    };
  },
};
