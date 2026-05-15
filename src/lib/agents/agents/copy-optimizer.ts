/**
 * Copy Optimizer — audits page copy (headings, CTAs, microcopy) and
 * proposes warmer, clearer, higher-converting alternatives in the
 * Buds At Work voice (warm Australian tradie).
 */
import type { AgentDefinition, AgentContext } from '../types';

const SYSTEM = `You are the Copy Optimizer for Buds At Work — a local services
crew in Logan & South Brisbane (cleaning, windows, yard, dump runs, detailing,
NDIS-friendly). Voice: warm, plain-spoken Australian tradie. Never corporate
jargon, never American spelling. You audit copy on a single page and propose
specific replacements.

Strict JSON output:
{
  "findings": [
    {
      "title": "...",
      "severity": "low" | "medium" | "high",
      "body": "...why this matters in 1 paragraph...",
      "proposed_change": {
        "selector": "...",
        "before": "...current text...",
        "after":  "...replacement..."
      }
    }
  ]
}`;

interface PageBundle { path: string; sections: Array<{ selector: string; text: string }> }

export const copyOptimizerAgent: AgentDefinition = {
  id: 'copy-optimizer',
  name: 'Copy Optimizer',
  description: 'Audits copy and proposes warmer, higher-converting alternatives.',
  category: 'sales',
  autonomy: 'review',
  async run(ctx: AgentContext) {
    const inputPages = (ctx.input?.pages as PageBundle[] | undefined) ?? defaultPages();
    let count = 0;

    for (const page of inputPages) {
      const raw = await ctx.llm(
        `Page ${page.path}\nSections:\n${JSON.stringify(page.sections, null, 2)}\nReturn findings JSON.`,
        { system: SYSTEM },
      );

      let parsed: { findings: Array<{ title: string; severity: string; body: string; proposed_change: unknown }> };
      try { parsed = JSON.parse(raw); } catch { continue; }

      for (const f of parsed.findings ?? []) {
        await ctx.supabase.from('design_insights').insert({
          agent_id: 'copy-optimizer',
          run_id: ctx.runId,
          page_path: page.path,
          insight_type: 'copy',
          title: f.title,
          body: f.body,
          severity: f.severity,
          proposed_change: f.proposed_change,
        });
        count += 1;
      }
    }

    return { summary: `Proposed ${count} copy change(s).`, output: { findings: count } };
  },
};

function defaultPages(): PageBundle[] {
  return [
    {
      path: '/',
      sections: [
        { selector: 'h1.hero',          text: 'Good people doing honest work.' },
        { selector: 'p.hero-sub',       text: 'Quote-first local services in Logan & South Brisbane.' },
        { selector: 'a.cta-quote-hero', text: 'Get a quote' },
      ],
    },
    {
      path: '/services/yard-care',
      sections: [
        { selector: 'h1', text: 'Yard Care' },
        { selector: 'p.lede', text: 'Mowing, hedging, weeding, and clean-ups by your local crew.' },
      ],
    },
  ];
}
