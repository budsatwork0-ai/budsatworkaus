/**
 * COO Agent — operational excellence review.
 *
 * Reviews crew utilisation, job completion rates, scheduling gaps,
 * and on-time delivery. Issues operational decisions.
 *
 * Runs daily via cron.
 */
import type { AgentDefinition, AgentContext } from '../types';
import type { ExecutiveLlmOutput, InsertExecutiveDecision } from '../executive/types';

const SYSTEM = `You are the COO of Buds At Work, a local services platform.
Review operational metrics and issue decisions to improve efficiency.

Return strict JSON:
{
  "summary": string,
  "decisions": [
    {
      "title": string,
      "reasoning": string,
      "evidence": string[],
      "confidence": number,
      "risk_level": "low" | "medium" | "high",
      "expected_impact": string
    }
  ]
}

Rules:
- Focus on crew utilisation, scheduling gaps, job completion rate, and late deliveries.
- "risk_level": low = process nudge; medium = scheduling or crew change; high = policy change.
- 0–3 decisions. Only raise decisions with clear data support.
- Be terse.`;

export const cooAgent: AgentDefinition = {
  id: 'coo-agent',
  name: 'COO',
  description: 'Operational efficiency — crew utilisation, scheduling, and job delivery decisions.',
  category: 'executive',
  autonomy: 'review',
  schedule: '0 6 * * *',

  async run(ctx: AgentContext) {
    const since7d = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

    const [ordersRes, crewRes, assignmentsRes] = await Promise.all([
      ctx.supabase
        .from('orders')
        .select('id, status, scheduled_at, completed_at, created_at')
        .gte('created_at', since7d),
      ctx.supabase
        .from('crew_members')
        .select('id, status')
        .eq('status', 'active'),
      ctx.supabase
        .from('job_assignments')
        .select('id, crew_member_id, status, scheduled_at')
        .gte('scheduled_at', since7d),
    ]);

    const orders      = ordersRes.data ?? [];
    const crew        = crewRes.data ?? [];
    const assignments = assignmentsRes.data ?? [];

    const totalJobs     = orders.length;
    const completedJobs = orders.filter((o) => o.status === 'completed').length;
    const lateJobs      = orders.filter((o) => {
      if (!o.scheduled_at || !o.completed_at) return false;
      return new Date(o.completed_at) > new Date(o.scheduled_at);
    }).length;
    const completionRate  = totalJobs > 0 ? completedJobs / totalJobs : 0;
    const lateRate        = completedJobs > 0 ? lateJobs / completedJobs : 0;
    const activeCrewCount = crew.length;
    const avgJobsPerCrew  = activeCrewCount > 0 ? assignments.length / activeCrewCount : 0;
    const unassignedJobs  = orders.filter((o) =>
      o.status === 'scheduled' &&
      !assignments.some((a) => a.status !== 'cancelled'),
    ).length;

    const prompt = `Operational metrics — last 7 days:
Total jobs: ${totalJobs}
Completed: ${completedJobs} (${(completionRate * 100).toFixed(1)}% completion rate)
Late deliveries: ${lateJobs} (${(lateRate * 100).toFixed(1)}% of completed)
Active crew: ${activeCrewCount}
Assignments: ${assignments.length} (avg ${avgJobsPerCrew.toFixed(1)} per crew)
Unassigned scheduled jobs: ${unassignedJobs}`;

    let parsed: ExecutiveLlmOutput;
    try {
      const raw = await ctx.llm(prompt, { system: SYSTEM });
      parsed = JSON.parse(raw) as ExecutiveLlmOutput;
    } catch {
      return {
        summary: `COO review: ${completedJobs}/${totalJobs} jobs completed, ${lateJobs} late, ${activeCrewCount} active crew.`,
        output: { completionRate, lateRate, activeCrewCount, decisions: [] },
      };
    }

    if (ctx.dryRun) {
      return {
        summary: `[DRY RUN] ${parsed.summary}`,
        output: {
          dry_run: true,
          metrics: { completionRate, lateRate, activeCrewCount },
          proposed_decisions: parsed.decisions ?? [],
        },
      };
    }

    let autoExecuted = 0;
    let queuedApprovals = 0;

    for (const d of parsed.decisions ?? []) {
      const row: InsertExecutiveDecision = {
        agent_id:        'coo-agent',
        run_id:          ctx.runId,
        title:           d.title,
        reasoning:       d.reasoning,
        evidence:        d.evidence,
        confidence:      d.confidence,
        risk_level:      d.risk_level,
        expected_impact: d.expected_impact,
      };

      const { data: inserted } = await ctx.supabase
        .from('executive_decisions')
        .insert(row)
        .select('id')
        .single();

      if (d.risk_level === 'low' && d.confidence >= 0.7) {
        await ctx.supabase
          .from('executive_decisions')
          .update({ status: 'executed', executed_at: new Date().toISOString() })
          .eq('id', inserted?.id ?? '');
        autoExecuted++;
      } else {
        await ctx.proposeAction({
          action_type:      'executive_decision',
          target_table:     'executive_decisions',
          target_id:        inserted?.id,
          preview:          d.title,
          payload:          { decision: d },
          requiresApproval: true,
          confidence:       d.confidence,
          risk_level:       d.risk_level,
        });
        queuedApprovals++;
      }
    }

    await ctx.supabase.from('executive_agent_runs_meta').insert({
      run_id:           ctx.runId,
      agent_id:         'coo-agent',
      decisions:        parsed.decisions?.length ?? 0,
      tasks:            0,
      auto_executed:    autoExecuted,
      queued_approvals: queuedApprovals,
    });

    return {
      summary: parsed.summary,
      output: {
        completionRate,
        lateRate,
        activeCrewCount,
        unassignedJobs,
        decisions: parsed.decisions?.length ?? 0,
        auto_executed: autoExecuted,
        queued_approvals: queuedApprovals,
      },
    };
  },
};
