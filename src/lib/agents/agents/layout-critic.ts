/**
 * Layout Critic — reviews live pages for visual hierarchy, WCAG AA,
 * and mobile UX. Reads the rendered HTML + computed-style snapshot
 * provided in `ctx.input.pages[]` (your existing audit pipeline) or
 * generates one from the public site.
 */
import type { AgentDefinition, AgentContext } from '../types';

const SYSTEM = `You are the Layout Critic for Buds At Work. You review a page's
HTML structure, key styles, and a mobile screenshot description, then report
1-3 specific layout or accessibility issues. Score severity. Always include a
concrete CSS or markup change in proposed_change. Strict JSON:
{
  "findings": [
    { "title": "...", "severity": "low|medium|high|critical",
      "category": "hierarchy|a11y|mobile|spacing|contrast",
      "body": "...", "proposed_change": {"selector":"...","before":"...","after":"..."} }
  ]
}`;

interface PageAudit {
  path: string;
  html_snippet: string;
  computed_styles?: Record<string, string>;
  mobile_notes?: string;
}

export const layoutCriticAgent: AgentDefinition = {
  id: 'layout-critic',
  name: 'Layout Critic',
  description: 'Reviews pages for visual hierarchy, WCAG AA, and mobile UX.',
  category: 'ops',
  autonomy: 'review',
  async run(ctx: AgentContext) {
    const pages = (ctx.input?.pages as PageAudit[] | undefined) ?? [
      {
        path: '/',
        html_snippet: '<section class="hero"><h1>Good people doing honest work.</h1><p>Quote-first local services.</p><a class="cta-quote-hero">Get a quote</a></section>',
        mobile_notes: 'Hero CTA appears below the fold on iPhone SE (375x667).',
      },
    ];
    let count = 0;
    for (const page of pages) {
      const raw = await ctx.llm(JSON.stringify(page), { system: SYSTEM });
      let parsed: { findings: Array<{ title: string; severity: string; category: string; body: string; proposed_change: unknown }> };
      try { parsed = JSON.parse(raw); } catch { continue; }
      for (const f of parsed.findings ?? []) {
        await ctx.supabase.from('design_insights').insert({
          agent_id: 'layout-critic',
          run_id: ctx.runId,
          page_path: page.path,
          insight_type: 'a11y',
          title: f.title,
          body: f.body,
          severity: f.severity,
          proposed_change: f.proposed_change,
          evidence: { category: f.category },
        });
        count += 1;
      }
    }
    return { summary: `Logged ${count} layout/a11y finding(s).`, output: { findings: count } };
  },
};
