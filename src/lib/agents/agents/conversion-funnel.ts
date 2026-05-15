/**
 * Conversion Funnel Watcher — runs the configured funnel daily, flags
 * step-over-step leaks, and produces ranked recommendations.
 */
import type { AgentDefinition, AgentContext } from '../types';
import * as LO from '@/lib/lucky-orange';

const SYSTEM = `You analyze a Buds At Work conversion funnel. Given visitor
counts per step and step-over-step conversion percentages, identify the 1-2
biggest leaks vs. baseline (industry: 35% visit→quote, 60% quote→accepted,
75% accepted→paid for local home services). Output strict JSON:
{
  "biggest_leak_step": "...",
  "severity": "low"|"medium"|"high"|"critical",
  "diagnosis": "...1 paragraph...",
  "experiments": ["..short hypothesis 1..", "..2..", "..3.."]
}`;

export const conversionFunnelAgent: AgentDefinition = {
  id: 'conversion-funnel',
  name: 'Conversion Funnel Watcher',
  description: 'Watches the quote → confirmed → paid funnel and spots leaks.',
  category: 'sales',
  autonomy: 'review',
  async run(ctx: AgentContext) {
    const steps = (ctx.config?.funnel_steps as string[] | undefined) ?? [
      'visit', 'quote_started', 'quote_submitted', 'quote_accepted', 'paid',
    ];
    const funnel = LO.isFixtureMode() ? LO.FIXTURES.funnel(steps) : await LO.funnel(steps, 14);

    const raw = await ctx.llm(
      `Funnel (14d):\n${JSON.stringify(funnel, null, 2)}`,
      { system: SYSTEM },
    );
    let parsed: { biggest_leak_step: string; severity: string; diagnosis: string; experiments: string[] };
    try { parsed = JSON.parse(raw); } catch { return { summary: 'Funnel parsed empty.' }; }

    await ctx.supabase.from('design_insights').insert({
      agent_id: 'conversion-funnel',
      run_id: ctx.runId,
      page_path: '/funnel',
      insight_type: 'funnel',
      title: `Funnel leak: ${parsed.biggest_leak_step}`,
      body: `${parsed.diagnosis}\n\n**Experiments:**\n- ${parsed.experiments.join('\n- ')}`,
      severity: parsed.severity,
      evidence: { funnel },
    });

    return { summary: `Identified leak at "${parsed.biggest_leak_step}" (${parsed.severity}).`, output: parsed };
  },
};
