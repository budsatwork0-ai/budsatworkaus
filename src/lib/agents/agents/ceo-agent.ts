/**
 * CEO Agent — weekly strategic review of business health.
 *
 * Reads key metrics (revenue, jobs, leads, conversion) and issues
 * high-level strategic decisions. Only risk_level='low' decisions
 * auto-execute; medium/high are queued for human approval.
 *
 * Runs daily via cron. Decisions stored in executive_decisions.
 */
import type { AgentDefinition, AgentContext } from '../types';
import type { ExecutiveLlmOutput, InsertExecutiveDecision } from '../executive/types';

const SYSTEM = `You are the CEO of Buds At Work, a local services platform in Logan and South Brisbane.
Review the business metrics and issue strategic decisions.

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
- "summary": 1–2 sentences on overall business health.
- "decisions": 0–4 strategic decisions. Only include decisions with genuine data support.
- "confidence": 0–1. Be conservative — low confidence means medium/high risk.
- "risk_level": low = minor config/content change; medium = process/spend change; high = pricing/hire/major change.
- "evidence": bullet points of specific data points that support this decision.
- Flag hot leads awaiting first response and pending approvals — these are operational blockers.
- Be terse. Focus on what matters now.`;

const topRiskOf = (ds: Array<{ risk_level: string }>): 'low' | 'medium' | 'high' =>
  ds.some((d) => d.risk_level === 'high')   ? 'high'   :
  ds.some((d) => d.risk_level === 'medium') ? 'medium' : 'low';

const maxConfidenceOf = (ds: Array<{ confidence: number }>): number =>
  ds.length > 0 ? Math.max(...ds.map((d) => d.confidence)) : 0.7;

export const ceoAgent: AgentDefinition = {
  id: 'ceo-agent',
  name: 'CEO',
  description: 'Strategic business review — revenue, growth, and overall health decisions.',
  category: 'executive',
  autonomy: 'review',
  schedule: '0 6 * * *',

  async run(ctx: AgentContext) {
    const since7d  = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
    const since30d = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();

    const [
      ordersRes, leadsRes, quotesRes, subsRes,
      storyOppsRes, approvalsRes,
      ideasCountRes, scriptsCountRes, productionCountRes,
    ] = await Promise.all([
      ctx.supabase
        .from('orders')
        .select('id, total_cents, status, created_at')
        .gte('created_at', since7d),
      ctx.supabase
        .from('leads')
        .select('id, status, created_at, temperature, response_status')
        .gte('created_at', since7d),
      ctx.supabase
        .from('quotes')
        .select('id, status, total_cents, created_at')
        .gte('created_at', since7d),
      ctx.supabase
        .from('subscriptions')
        .select('id, status, plan_cents')
        .eq('status', 'active'),
      ctx.supabase
        .from('story_opportunities')
        .select('id, story_score')
        .eq('status', 'new'),
      ctx.supabase
        .from('bud_approval_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      ctx.supabase
        .from('content_ideas')
        .select('id', { count: 'exact', head: true })
        .neq('status', 'archived'),
      ctx.supabase
        .from('content_scripts')
        .select('id', { count: 'exact', head: true })
        .neq('status', 'archived'),
      ctx.supabase
        .from('content_production_cards')
        .select('id', { count: 'exact', head: true })
        .neq('status', 'published'),
    ]);

    const orders  = ordersRes.data ?? [];
    const leads   = leadsRes.data  ?? [];
    const quotes  = quotesRes.data ?? [];
    const subs    = subsRes.data   ?? [];

    const storyOpps          = storyOppsRes.data ?? [];
    const approvalCount      = approvalsRes.count ?? 0;
    const contentPipelineDepth =
      (ideasCountRes.count ?? 0) +
      (scriptsCountRes.count ?? 0) +
      (productionCountRes.count ?? 0);

    const hotLeadsAwaitingReply = leads.filter(
      (l) => l.temperature === 'HOT' && l.response_status === 'awaiting_response',
    ).length;

    const topOpportunityScore = storyOpps.length > 0
      ? Math.max(...storyOpps.map((o) => (o.story_score as number | null) ?? 0))
      : null;

    const revenue7d = orders
      .filter((o) => o.status === 'completed' || o.status === 'paid')
      .reduce((s, o) => s + ((o.total_cents as number) / 100), 0);
    const jobs7d          = orders.length;
    const leads7d         = leads.length;
    const convertedQuotes = quotes.filter((q) => q.status === 'accepted' || q.status === 'paid');
    const conversionRate  = quotes.length > 0 ? convertedQuotes.length / quotes.length : 0;
    const avgJobValue     = jobs7d > 0 ? revenue7d / jobs7d : 0;
    const recurringMonthly = subs.reduce((s, r) => s + ((r.plan_cents as number) / 100), 0);

    // Programmatic findings — guaranteed to surface key bottlenecks regardless of LLM output
    const findings: string[] = [];
    if (hotLeadsAwaitingReply > 0)
      findings.push(`${hotLeadsAwaitingReply} hot lead(s) awaiting first response — immediate revenue risk.`);
    if (approvalCount > 0)
      findings.push(`${approvalCount} item(s) pending human approval.`);
    if (contentPipelineDepth === 0)
      findings.push('Content pipeline is empty — no ideas, scripts, or production cards in flight.');
    else
      findings.push(`Content pipeline: ${contentPipelineDepth} item(s) across ideas, scripts, and production.`);
    if (topOpportunityScore !== null)
      findings.push(`Top story opportunity score: ${topOpportunityScore}/100.`);
    if (storyOpps.length > 0)
      findings.push(`${storyOpps.length} new story opportunit${storyOpps.length === 1 ? 'y' : 'ies'} awaiting development.`);

    // Capture metrics snapshot — skip in dry run
    if (!ctx.dryRun) {
      await ctx.supabase.from('executive_metrics_snapshots').insert({
        revenue_7d_aud:  revenue7d,
        jobs_7d:         jobs7d,
        leads_7d:        leads7d,
        conversion_rate: conversionRate,
        avg_job_value:   avgJobValue,
        raw: {
          quotes_7d:                   quotes.length,
          converted_quotes_7d:         convertedQuotes.length,
          active_subscriptions:        subs.length,
          recurring_monthly_aud:       recurringMonthly,
          pending_approvals:           approvalCount,
          hot_leads_awaiting_reply:    hotLeadsAwaitingReply,
          top_story_opportunity_score: topOpportunityScore,
          content_pipeline_depth:      contentPipelineDepth,
        },
      });
    }

    // Fetch last 30-day context for trend comparison
    const { data: prevOrders } = await ctx.supabase
      .from('orders')
      .select('id, total_cents, status, created_at')
      .gte('created_at', since30d)
      .lt('created_at', since7d);

    const prevRevenue = (prevOrders ?? [])
      .filter((o) => o.status === 'completed' || o.status === 'paid')
      .reduce((s, o) => s + ((o.total_cents as number) / 100), 0) / (30 / 7);

    const prompt = `Business metrics — week ending today:
Revenue: A$${revenue7d.toFixed(0)} (prev 7d avg: A$${prevRevenue.toFixed(0)})
Jobs completed: ${jobs7d}
New leads: ${leads7d}
Quote conversion: ${(conversionRate * 100).toFixed(1)}%
Avg job value: A$${avgJobValue.toFixed(0)}
Active subscriptions: ${subs.length} (A$${recurringMonthly.toFixed(0)}/mo recurring)
New quotes issued: ${quotes.length}
Hot leads awaiting first reply: ${hotLeadsAwaitingReply}

Growth & brand:
Content pipeline items in flight: ${contentPipelineDepth} (ideas + scripts + production)
Top story opportunity score: ${topOpportunityScore ?? 'none scored'}
New story opportunities waiting: ${storyOpps.length}

Operations:
Pending approvals: ${approvalCount}`;

    let parsed: ExecutiveLlmOutput;
    try {
      const raw = await ctx.llm(prompt, { system: SYSTEM });
      parsed = JSON.parse(raw) as ExecutiveLlmOutput;
    } catch {
      const fallbackSummary = findings[0]
        ?? `A$${revenue7d.toFixed(0)} revenue, ${jobs7d} jobs, ${leads7d} leads this week.`;
      return {
        summary: `CEO review: ${fallbackSummary}`,
        output: {
          status:              'success',
          summary:             fallbackSummary,
          findings,
          recommended_actions: [],
          confidence:          0.7,
          risk_level:          'low' as const,
          revenue7d, jobs7d, leads7d, conversionRate,
          hotLeadsAwaitingReply, approvalCount, contentPipelineDepth,
          decisions: [],
        },
      };
    }

    const decisions = parsed.decisions ?? [];

    if (ctx.dryRun) {
      const drySummary = findings.length > 0
        ? `[DRY RUN] ${findings[0]} ${parsed.summary}`
        : `[DRY RUN] ${parsed.summary}`;
      return {
        summary: drySummary,
        output: {
          status:              'success',
          summary:             drySummary,
          dry_run:             true,
          findings,
          recommended_actions: decisions.map((d) => d.title),
          confidence:          maxConfidenceOf(decisions),
          risk_level:          topRiskOf(decisions),
          metrics: {
            revenue7d, jobs7d, leads7d, conversionRate, avgJobValue,
            hotLeadsAwaitingReply, approvalCount, contentPipelineDepth, topOpportunityScore,
          },
          proposed_decisions: decisions,
        },
      };
    }

    // Persist decisions + route by risk level
    let autoExecuted = 0;
    let queuedApprovals = 0;

    for (const d of decisions) {
      const row: InsertExecutiveDecision = {
        agent_id:        'ceo-agent',
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
      agent_id:         'ceo-agent',
      decisions:        decisions.length,
      tasks:            0,
      auto_executed:    autoExecuted,
      queued_approvals: queuedApprovals,
    });

    return {
      summary: parsed.summary,
      output: {
        status:              'success',
        summary:             parsed.summary,
        findings:            [...findings, ...decisions.map((d) => d.title)],
        recommended_actions: decisions.map((d) => d.expected_impact),
        confidence:          maxConfidenceOf(decisions),
        risk_level:          topRiskOf(decisions),
        revenue7d,
        jobs7d,
        leads7d,
        conversionRate,
        hotLeadsAwaitingReply,
        contentPipelineDepth,
        topOpportunityScore,
        approvalCount,
        decisions:           decisions.length,
        auto_executed:       autoExecuted,
        queued_approvals:    queuedApprovals,
      },
    };
  },
};
