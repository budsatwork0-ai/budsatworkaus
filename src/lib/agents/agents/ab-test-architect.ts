/**
 * A/B Test Architect — combines heatmap insights, funnel data, and the
 * existing design_insights backlog to propose 1-3 high-leverage A/B tests
 * with predicted impact and sample-size estimates.
 *
 * `autonomy: 'manual'` — only runs when you ask, since these become
 * meaningful product decisions.
 */
import type { AgentDefinition, AgentContext } from '../types';

const SYSTEM = `You are the A/B Test Architect for Buds At Work. From the
provided heatmap insights and funnel data, propose 1-3 A/B tests, each
with: hypothesis, variant A description (control), variant B description,
primary metric, predicted lift range, and an estimate of how many sessions
per variant you'd need (rough — assume p<0.05, current funnel rate as
baseline). Strict JSON:
{
  "tests": [
    {
      "hypothesis": "...",
      "page_path": "...",
      "variant_a": "...",
      "variant_b": "...",
      "primary_metric": "...",
      "predicted_lift_pct_range": [number, number],
      "sample_size_per_variant": number,
      "risk_notes": "..."
    }
  ]
}`;

export const abTestArchitectAgent: AgentDefinition = {
  id: 'ab-test-architect',
  name: 'A/B Test Architect',
  description: 'Proposes high-leverage A/B tests with predicted impact.',
  category: 'sales',
  autonomy: 'manual',
  async run(ctx: AgentContext) {
    const { data: insights } = await ctx.supabase
      .from('design_insights')
      .select('page_path, insight_type, title, body, severity, evidence')
      .in('status', ['new', 'reviewing'])
      .order('severity', { ascending: false })
      .limit(20);

    if (!insights?.length) return { summary: 'No insights available — run Heatmap Analyst or Funnel first.' };

    const raw = await ctx.llm(
      `Insights backlog:\n${JSON.stringify(insights, null, 2)}\nReturn tests JSON.`,
      { system: SYSTEM },
    );
    let parsed: { tests: Array<{ hypothesis: string; page_path: string; variant_a: string; variant_b: string; primary_metric: string; predicted_lift_pct_range: [number, number]; sample_size_per_variant: number; risk_notes: string }> };
    try { parsed = JSON.parse(raw); } catch { return { summary: 'Could not parse test proposals.' }; }

    for (const t of parsed.tests ?? []) {
      await ctx.supabase.from('design_insights').insert({
        agent_id: 'ab-test-architect',
        run_id: ctx.runId,
        page_path: t.page_path,
        insight_type: 'ab_test',
        title: `A/B test: ${t.hypothesis}`,
        body:
          `**Variant A (control):** ${t.variant_a}\n\n` +
          `**Variant B:** ${t.variant_b}\n\n` +
          `**Primary metric:** ${t.primary_metric}\n\n` +
          `**Predicted lift:** ${t.predicted_lift_pct_range[0]}% – ${t.predicted_lift_pct_range[1]}%\n\n` +
          `**Sample size / variant:** ${t.sample_size_per_variant}\n\n` +
          `**Risks:** ${t.risk_notes}`,
        severity: 'medium',
        proposed_change: { page_path: t.page_path, variant_a: t.variant_a, variant_b: t.variant_b },
      });
    }

    return {
      summary: `Proposed ${parsed.tests?.length ?? 0} A/B test(s).`,
      output: { tests: parsed.tests?.length ?? 0 },
    };
  },
};
