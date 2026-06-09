/**
 * CMO Agent — marketing and growth review.
 *
 * Reviews lead generation, channel performance, conversion funnel,
 * content pipeline health, and story engine activity. Issues growth decisions.
 *
 * Runs daily via cron.
 */
import type { AgentDefinition, AgentContext } from '../types';
import type { ExecutiveLlmOutput, InsertExecutiveDecision } from '../executive/types';

const SYSTEM = `You are the CMO of Buds At Work, a local services platform.
Review marketing metrics and issue decisions to improve lead generation, conversion, and content output.

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
- Focus on lead volume, quote conversion, content pipeline depth, brand output velocity, and lead response speed.
- "risk_level": low = copy/content tweak; medium = channel budget or pipeline shift; high = pricing/positioning change.
- 0–3 decisions. Be specific about which channel, content stage, or opportunity type.
- Flag content pipeline stalls: ideas with no scripts; approved scripts with no production card.
- Flag hot leads awaiting response — these are immediate revenue risk.
- Be terse.`;

const topRiskOf = (ds: Array<{ risk_level: string }>): 'low' | 'medium' | 'high' =>
  ds.some((d) => d.risk_level === 'high')   ? 'high'   :
  ds.some((d) => d.risk_level === 'medium') ? 'medium' : 'low';

const maxConfidenceOf = (ds: Array<{ confidence: number }>): number =>
  ds.length > 0 ? Math.max(...ds.map((d) => d.confidence)) : 0.7;

/** Synthesise 1–3 low-risk decisions from programmatic findings when the LLM returns none. */
function buildFallbackDecisions(params: {
  hotLeadsAwaitingReply: number;
  journalToday: boolean;
  draftBacklog: number;
  contentPipeline: { ideas: number; scripts: number; scripts_approved: number; production_active: number };
  storyOpps: Array<{ story_score: unknown }>;
}): ExecutiveLlmOutput['decisions'] {
  const out: ExecutiveLlmOutput['decisions'] = [];

  if (params.hotLeadsAwaitingReply > 0) {
    out.push({
      title: 'Review and respond to hot leads',
      reasoning: `${params.hotLeadsAwaitingReply} hot lead(s) awaiting first response — immediate revenue risk.`,
      evidence: [`Hot leads awaiting reply: ${params.hotLeadsAwaitingReply}`],
      confidence: 0.9,
      risk_level: 'low',
      expected_impact: 'Reduces lead drop-off and increases conversion.',
    });
  }

  if (!params.journalToday && out.length < 3) {
    out.push({
      title: 'Capture founder journal entry today',
      reasoning: 'No founder journal entry recorded today — story engine feed is stalled.',
      evidence: ['Founder journal entry today: no'],
      confidence: 0.85,
      risk_level: 'low',
      expected_impact: 'Feeds the story engine and unblocks content pipeline.',
    });
  }

  if (params.storyOpps.length > 0 && out.length < 3) {
    const topScore = Math.max(...params.storyOpps.map((o) => (o.story_score as number | null) ?? 0));
    out.push({
      title: 'Convert top story opportunity into a content idea',
      reasoning: `${params.storyOpps.length} new story opportunit${params.storyOpps.length === 1 ? 'y' : 'ies'} awaiting development (top score: ${topScore}/100).`,
      evidence: [`New story opportunities: ${params.storyOpps.length}`, `Top score: ${topScore}/100`],
      confidence: 0.8,
      risk_level: 'low',
      expected_impact: 'Advances content pipeline and brand storytelling.',
    });
  }

  if (params.draftBacklog > 0 && out.length < 3) {
    out.push({
      title: 'Review AI-generated story drafts',
      reasoning: `${params.draftBacklog} AI draft(s) generated in the last 48h are pending review.`,
      evidence: [`AI drafts pending review: ${params.draftBacklog}`],
      confidence: 0.8,
      risk_level: 'low',
      expected_impact: 'Clears draft backlog and advances story engine output.',
    });
  }

  if (params.contentPipeline.ideas > 0 && params.contentPipeline.scripts === 0 && out.length < 3) {
    out.push({
      title: 'Convert top content idea into a script',
      reasoning: `${params.contentPipeline.ideas} idea(s) exist with no scripts — pipeline is stalled at ideation stage.`,
      evidence: [`Ideas: ${params.contentPipeline.ideas}`, 'Scripts: 0'],
      confidence: 0.8,
      risk_level: 'low',
      expected_impact: 'Unblocks content pipeline and moves ideas toward production.',
    });
  }

  return out.slice(0, 3);
}

export const cmoAgent: AgentDefinition = {
  id: 'cmo-agent',
  name: 'CMO',
  description: 'Marketing and growth review — lead generation, conversion, content pipeline, and brand decisions.',
  category: 'executive',
  autonomy: 'review',
  schedule: '0 6 * * *',

  async run(ctx: AgentContext) {
    const since7d  = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
    const since14d = new Date(Date.now() - 14 * 24 * 3600_000).toISOString();
    const since48h = new Date(Date.now() - 48 * 3600_000).toISOString();
    const today    = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane' }).format(new Date());

    const [
      leadsRes, quotesRes, prevLeadsRes,
      storyOppsRes, storyDraftsRes, journalTodayRes,
      ideasRes, scriptsRes, productionRes, queueRes,
    ] = await Promise.all([
      ctx.supabase
        .from('leads')
        .select('id, source, status, created_at, temperature, response_status')
        .gte('created_at', since7d),
      ctx.supabase
        .from('quotes')
        .select('id, status, source, total_cents, created_at')
        .gte('created_at', since7d),
      ctx.supabase
        .from('leads')
        .select('id, source, status, created_at')
        .gte('created_at', since14d)
        .lt('created_at', since7d),
      ctx.supabase
        .from('story_opportunities')
        .select('id, story_score')
        .eq('status', 'new'),
      ctx.supabase
        .from('story_drafts')
        .select('id')
        .eq('is_ai_generated', true)
        .eq('status', 'draft')
        .gte('created_at', since48h),
      ctx.supabase
        .from('founder_journal_entries')
        .select('id')
        .eq('entry_date', today)
        .maybeSingle(),
      ctx.supabase
        .from('content_ideas')
        .select('id, status')
        .neq('status', 'archived'),
      ctx.supabase
        .from('content_scripts')
        .select('id, status')
        .neq('status', 'archived'),
      ctx.supabase
        .from('content_production_cards')
        .select('id, status')
        .neq('status', 'published'),
      ctx.supabase
        .from('marketing_publishing_queue')
        .select('id, status')
        .neq('status', 'archived'),
    ]);

    const leads       = leadsRes.data      ?? [];
    const quotes      = quotesRes.data     ?? [];
    const prevLeads   = prevLeadsRes.data  ?? [];
    const storyOpps   = storyOppsRes.data  ?? [];
    const storyDrafts = storyDraftsRes.data ?? [];
    const ideas       = ideasRes.data      ?? [];
    const scripts     = scriptsRes.data    ?? [];
    const production  = productionRes.data ?? [];
    const queue       = queueRes.data      ?? [];

    // Lead funnel
    const leadsThisWeek = leads.length;
    const leadsPrevWeek = prevLeads.length;
    const leadGrowth    = leadsPrevWeek > 0
      ? ((leadsThisWeek - leadsPrevWeek) / leadsPrevWeek) * 100
      : 0;

    const sourceMap: Record<string, number> = {};
    for (const l of leads) {
      const src = (l.source as string) || 'unknown';
      sourceMap[src] = (sourceMap[src] ?? 0) + 1;
    }
    const topSource = Object.entries(sourceMap).sort((a, b) => b[1] - a[1])[0];

    const convertedQuotes       = quotes.filter((q) => q.status === 'accepted' || q.status === 'paid');
    const conversionRate        = quotes.length > 0 ? (convertedQuotes.length / quotes.length) * 100 : 0;
    const hotLeadsAwaitingReply = leads.filter(
      (l) => l.temperature === 'HOT' && l.response_status === 'awaiting_response',
    ).length;

    // Content pipeline depth
    const contentPipeline = {
      ideas:             ideas.length,
      ideas_developed:   ideas.filter((i) => (i.status as string) === 'developed' || (i.status as string) === 'scripted').length,
      scripts:           scripts.length,
      scripts_approved:  scripts.filter((s) => (s.status as string) === 'approved').length,
      production_active: production.filter((p) => ['to_film', 'in_edit'].includes(p.status as string)).length,
      ready_to_publish:  production.filter((p) => (p.status as string) === 'ready_to_publish').length,
      queue_ready:       queue.filter((q) => (q.status as string) === 'ready').length,
    };

    // Story engine
    const topOpportunityScore = storyOpps.length > 0
      ? Math.max(...storyOpps.map((o) => (o.story_score as number | null) ?? 0))
      : null;
    const draftBacklog = storyDrafts.length;
    const journalToday = !!journalTodayRes.data;

    // Programmatic findings — guaranteed to surface key bottlenecks regardless of LLM output
    const findings: string[] = [];
    if (hotLeadsAwaitingReply > 0)
      findings.push(`${hotLeadsAwaitingReply} hot lead(s) awaiting first response — immediate revenue risk.`);
    if (!journalToday)
      findings.push('No founder journal entry today — story engine feed is stalled.');
    if (draftBacklog > 0)
      findings.push(`${draftBacklog} AI draft(s) pending review.`);
    if (contentPipeline.ideas > 0 && contentPipeline.scripts === 0)
      findings.push(`Content pipeline stalled: ${contentPipeline.ideas} idea(s) with no scripts.`);
    else if (contentPipeline.scripts_approved > 0 && contentPipeline.production_active === 0)
      findings.push(`${contentPipeline.scripts_approved} approved script(s) with no active production card.`);
    if (topOpportunityScore !== null)
      findings.push(`Top story opportunity score: ${topOpportunityScore}/100.`);
    if (storyOpps.length > 0)
      findings.push(`${storyOpps.length} new story opportunit${storyOpps.length === 1 ? 'y' : 'ies'} awaiting development.`);

    const prompt = `Marketing metrics — last 7 days:
New leads: ${leadsThisWeek} (prev week: ${leadsPrevWeek}, ${leadGrowth > 0 ? '+' : ''}${leadGrowth.toFixed(1)}% WoW)
Top lead source: ${topSource ? `${topSource[0]} (${topSource[1]})` : 'unknown'}
Lead sources: ${JSON.stringify(sourceMap)}
Quotes issued: ${quotes.length}
Quote conversion: ${conversionRate.toFixed(1)}%
Hot leads awaiting first response: ${hotLeadsAwaitingReply}

Content pipeline:
Ideas: ${contentPipeline.ideas} total (${contentPipeline.ideas_developed} developed/scripted)
Scripts: ${contentPipeline.scripts} total (${contentPipeline.scripts_approved} approved)
Production: ${contentPipeline.production_active} active, ${contentPipeline.ready_to_publish} ready to publish
Publishing queue: ${contentPipeline.queue_ready} ready

Story engine:
New opportunities: ${storyOpps.length} (top score: ${topOpportunityScore ?? 'none scored'})
AI drafts pending review: ${draftBacklog}
Founder journal entry today: ${journalToday ? 'yes' : 'no'}`;

    let parsed: ExecutiveLlmOutput;
    try {
      const raw = await ctx.llm(prompt, { system: SYSTEM });
      parsed = JSON.parse(raw) as ExecutiveLlmOutput;
    } catch {
      const fallbackSummary = findings[0]
        ?? `${leadsThisWeek} leads (${leadGrowth > 0 ? '+' : ''}${leadGrowth.toFixed(1)}% WoW), ${conversionRate.toFixed(1)}% conversion.`;
      return {
        summary: `CMO review: ${fallbackSummary}`,
        output: {
          status:              'success',
          summary:             fallbackSummary,
          findings,
          recommended_actions: [],
          confidence:          0.7,
          risk_level:          'low' as const,
          leadsThisWeek, conversionRate, hotLeadsAwaitingReply,
          contentPipeline, draftBacklog, journalToday,
          decisions: [],
        },
      };
    }

    const llmDecisions = parsed.decisions ?? [];
    const decisions = llmDecisions.length > 0 || findings.length === 0
      ? llmDecisions
      : buildFallbackDecisions({ hotLeadsAwaitingReply, journalToday, draftBacklog, contentPipeline, storyOpps });

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
            leadsThisWeek, conversionRate, hotLeadsAwaitingReply,
            contentPipeline, topOpportunityScore, draftBacklog, journalToday,
          },
          proposed_decisions: decisions,
        },
      };
    }

    let autoExecuted = 0;
    let queuedApprovals = 0;

    for (const d of decisions) {
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
        leadsThisWeek,
        leadGrowth,
        conversionRate,
        topSource:           topSource?.[0] ?? 'unknown',
        hotLeadsAwaitingReply,
        contentPipeline,
        topOpportunityScore,
        draftBacklog,
        journalToday,
        decisions:           decisions.length,
        auto_executed:       autoExecuted,
        queued_approvals:    queuedApprovals,
      },
    };
  },
};
