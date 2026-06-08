/**
 * CFO Agent — financial health review.
 *
 * Reviews cash position, receivables, payables, and subscription MRR.
 * Issues financial decisions and flags cash flow risks.
 *
 * Runs daily via cron.
 */
import type { AgentDefinition, AgentContext } from '../types';
import type { ExecutiveLlmOutput, InsertExecutiveDecision } from '../executive/types';

const SYSTEM = `You are the CFO of Buds At Work, a local services platform.
Review financial metrics and issue decisions to protect cash flow and profitability.

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
- Focus on cash position, overdue receivables, unexpected payables, and MRR trends.
- "risk_level": low = flag/report; medium = chase overdue or defer spend; high = pricing or major cost change.
- 0–3 decisions. Flag cash risks aggressively but only act on ones with clear evidence.
- Be terse. Report amounts in AUD.`;

export const cfoAgent: AgentDefinition = {
  id: 'cfo-agent',
  name: 'CFO',
  description: 'Financial health review — cash position, receivables, payables, and MRR decisions.',
  category: 'executive',
  autonomy: 'review',
  schedule: '0 6 * * *',

  async run(ctx: AgentContext) {
    const since7d   = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
    const horizonEnd = new Date(Date.now() + 14 * 24 * 3600_000).toISOString();

    const [receivablesRes, payablesRes, subsRes, recentPaymentsRes] = await Promise.all([
      ctx.supabase
        .from('orders')
        .select('id, total_cents, due_date, status')
        .in('status', ['invoiced', 'partially_paid']),
      ctx.supabase
        .from('payables')
        .select('id, amount_cents, due_date, status')
        .neq('status', 'paid')
        .lte('due_date', horizonEnd),
      ctx.supabase
        .from('subscriptions')
        .select('id, plan_cents, status')
        .eq('status', 'active'),
      ctx.supabase
        .from('payments')
        .select('id, amount_cents, created_at')
        .gte('created_at', since7d),
    ]);

    const receivables    = receivablesRes.data ?? [];
    const payables       = payablesRes.data ?? [];
    const subs           = subsRes.data ?? [];
    const recentPayments = recentPaymentsRes.data ?? [];

    const now = Date.now();
    const overdueReceivables = receivables.filter((r) =>
      r.due_date && new Date(r.due_date as string).getTime() < now,
    );
    const totalReceivables = receivables.reduce((s, r) => s + ((r.total_cents as number) / 100), 0);
    const overdueAmount    = overdueReceivables.reduce((s, r) => s + ((r.total_cents as number) / 100), 0);
    const totalPayables    = payables.reduce((s, p) => s + ((p.amount_cents as number) / 100), 0);
    const mrr              = subs.reduce((s, r) => s + ((r.plan_cents as number) / 100), 0);
    const cashCollected7d  = recentPayments.reduce((s, p) => s + ((p.amount_cents as number) / 100), 0);
    const projectedCash    = cashCollected7d - totalPayables;

    const prompt = `Financial metrics:
Open receivables: A$${totalReceivables.toFixed(0)} (${receivables.length} invoices)
Overdue receivables: A$${overdueAmount.toFixed(0)} (${overdueReceivables.length} overdue)
Payables due next 14d: A$${totalPayables.toFixed(0)}
Cash collected last 7d: A$${cashCollected7d.toFixed(0)}
Projected net position (7d): A$${projectedCash.toFixed(0)}
MRR (active subscriptions): A$${mrr.toFixed(0)}`;

    let parsed: ExecutiveLlmOutput;
    try {
      const raw = await ctx.llm(prompt, { system: SYSTEM });
      parsed = JSON.parse(raw) as ExecutiveLlmOutput;
    } catch {
      return {
        summary: `CFO review: A$${totalReceivables.toFixed(0)} open receivables, A$${overdueAmount.toFixed(0)} overdue, A$${mrr.toFixed(0)} MRR.`,
        output: { totalReceivables, overdueAmount, mrr, decisions: [] },
      };
    }

    if (ctx.dryRun) {
      return {
        summary: `[DRY RUN] ${parsed.summary}`,
        output: {
          dry_run: true,
          metrics: { totalReceivables, overdueAmount, mrr },
          proposed_decisions: parsed.decisions ?? [],
        },
      };
    }

    let autoExecuted = 0;
    let queuedApprovals = 0;

    for (const d of parsed.decisions ?? []) {
      const row: InsertExecutiveDecision = {
        agent_id:        'cfo-agent',
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
      agent_id:         'cfo-agent',
      decisions:        parsed.decisions?.length ?? 0,
      tasks:            0,
      auto_executed:    autoExecuted,
      queued_approvals: queuedApprovals,
    });

    return {
      summary: parsed.summary,
      output: {
        totalReceivables,
        overdueAmount,
        totalPayables,
        cashCollected7d,
        mrr,
        projectedCash,
        decisions: parsed.decisions?.length ?? 0,
        auto_executed: autoExecuted,
        queued_approvals: queuedApprovals,
      },
    };
  },
};
