/**
 * CMO Agent — marketing and growth review.
 *
 * Reviews lead generation, channel performance, conversion funnel,
 * and content activity. Issues growth decisions.
 *
 * Runs daily via cron.
 */
import type { AgentDefinition, AgentContext } from '../types';
import type { ExecutiveLlmOutput, InsertExecutiveDecision } from '../executive/types';

const SYSTEM = `You are the CMO of Buds At Work, a local services platform.
Review marketing metrics and issue decisions to improve lead generation and conversion.

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
- Focus on lead volume, quote conversion, channel ROI, and content performance.
- "risk_level": low = copy/content tweak; medium = channel budget shift; high = pricing/positioning change.
- 0–3 decisions. Be specific about which channel or content type.
- Be terse.`;

export const cmoAgent: AgentDefinition = {
  id: 'cmo-agent',
  name: 'CMO',
  description: 'Marketing and growth review — lead generation, conversion, and channel decisions.',
  category: 'executive',
  autonomy: 'review',
  schedule: '0 6 * * *',

  async run(ctx: AgentContext) {
    const since7d  = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
    const since14d = new Date(Date.now() - 14 * 24 * 3600_000).toISOString();

    const [leadsRes, quotesRes, contentRes, prevLeadsRes] = await Promise.all([
      ctx.supabase
        .from('leads')
        .select('id, source, status, created_at')
        .gte('created_at', since7d),
      ctx.supabase
        .from('quotes')
        .select('id, status, source, total_cents, created_at')
        .gte('created_at', since7d),
      ctx.supabase
        .from('content_studio_ideas')
        .select('id, status, created_at')
        .gte('created_at', since7d),
      ctx.supabase
        .from('leads')
        .select('id, source, status, created_at')
        .gte('created_at', since14d)
        .lt('created_at', since7d),
    ]);

    const leads      = leadsRes.data ?? [];
    const quotes     = quotesRes.data ?? [];
    const content    = contentRes.data ?? [];
    const prevLeads  = prevLeadsRes.data ?? [];

    const leadsThisWeek = leads.length;
    const leadsPrevWeek = prevLeads.length;
    const leadGrowth    = leadsPrevWeek > 0
      ? ((leadsThisWeek - leadsPrevWeek) / leadsPrevWeek) * 100
      : 0;

    // Source breakdown
    const sourceMap: Record<string, number> = {};
    for (const l of leads) {
      const src = (l.source as string) || 'unknown';
      sourceMap[src] = (sourceMap[src] ?? 0) + 1;
    }
    const topSource = Object.entries(sourceMap).sort((a, b) => b[1] - a[1])[0];

    const convertedQuotes = quotes.filter((q) => q.status === 'accepted' || q.status === 'paid');
    const conversionRate  = quotes.length > 0 ? (convertedQuotes.length / quotes.length) * 100 : 0;
    const contentIdeas    = content.length;

    const prompt = `Marketing metrics — last 7 days:
New leads: ${leadsThisWeek} (prev week: ${leadsPrevWeek}, ${leadGrowth > 0 ? '+' : ''}${leadGrowth.toFixed(1)}% WoW)
Top lead source: ${topSource ? `${topSource[0]} (${topSource[1]})` : 'unknown'}
Lead sources: ${JSON.stringify(sourceMap)}
Quotes issued: ${quotes.length}
Quote conversion: ${conversionRate.toFixed(1)}%
Content ideas created: ${contentIdeas}`;

    let parsed: ExecutiveLlmOutput;
    try {
      const raw = await ctx.llm(prompt, { system: SYSTEM });
      parsed = JSON.parse(raw) as ExecutiveLlmOutput;
    } catch {
      return {
        summary: `CMO review: ${leadsThisWeek} leads (${leadGrowth > 0 ? '+' : ''}${leadGrowth.toFixed(1)}% WoW), ${conversionRate.toFixed(1)}% conversion.`,
        output: { leadsThisWeek, conversionRate, decisions: [] },
      };
    }

    if (ctx.dryRun) {
      return {
        summary: `[DRY RUN] ${parsed.summary}`,
        output: {
          dry_run: true,
          metrics: { leadsThisWeek, conversionRate },
          proposed_decisions: parsed.decisions ?? [],
        },
      };
    }

    let autoExecuted = 0;
    let queuedApprovals = 0;

    for (const d of parsed.decisions ?? []) {
      const row: InsertExecutiveDecision = {
        agent_id:        'cmo-agent',
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
      agent_id:         'cmo-agent',
      decisions:        parsed.decisions?.length ?? 0,
      tasks:            0,
      auto_executed:    autoExecuted,
      queued_approvals: queuedApprovals,
    });

    return {
      summary: parsed.summary,
      output: {
        leadsThisWeek,
        leadGrowth,
        conversionRate,
        topSource: topSource?.[0] ?? 'unknown',
        decisions: parsed.decisions?.length ?? 0,
        auto_executed: autoExecuted,
        queued_approvals: queuedApprovals,
      },
    };
  },
};
