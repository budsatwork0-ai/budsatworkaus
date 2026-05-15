/**
 * Heatmap Analyst — pulls Lucky Orange data on the top pages, finds
 * dead clicks, rage clicks, and scroll dropoffs. Writes findings to
 * `design_insights` and queues a notification action.
 */
import type { AgentDefinition, AgentContext } from '../types';
import * as LO from '@/lib/lucky-orange';

const SYSTEM = `You are the Heatmap Analyst for Buds At Work. Given click and
scroll data for a page, you produce 1-3 high-leverage findings. Each finding
includes a clear title, severity (low/medium/high/critical), a 1-paragraph
explanation referencing the data, and a structured proposed change with a
CSS selector and a before/after description. Output strict JSON:
{
  "findings": [
    {
      "title": "...",
      "severity": "low" | "medium" | "high" | "critical",
      "body": "...markdown...",
      "proposed_change": { "selector": "...", "before": "...", "after": "..." }
    }
  ]
}`;

export const heatmapAnalystAgent: AgentDefinition = {
  id: 'heatmap-analyst',
  name: 'Heatmap Analyst',
  description: 'Pulls Lucky Orange data, finds dead clicks, rage clicks, scroll dropoffs.',
  category: 'ops',
  autonomy: 'review',
  async run(ctx: AgentContext) {
    const minSessions = Number((ctx.config?.min_sessions as number) ?? 30);
    const pages = LO.isFixtureMode()
      ? LO.FIXTURES.topPages
      : await LO.topPages(7, 10);

    let total = 0;
    for (const p of pages) {
      if (p.sessions < minSessions) continue;
      const heatmap = LO.isFixtureMode()
        ? LO.FIXTURES.pageHeatmap(p.page)
        : await LO.pageHeatmap(p.page, 7);

      const raw = await ctx.llm(
        `Page: ${p.page}\nHeatmap data:\n${JSON.stringify(heatmap, null, 2)}\nReturn findings JSON.`,
        { system: SYSTEM },
      );

      let parsed: { findings: Array<{ title: string; severity: string; body: string; proposed_change: unknown }> };
      try { parsed = JSON.parse(raw); } catch { continue; }

      for (const f of parsed.findings ?? []) {
        await ctx.supabase.from('design_insights').insert({
          agent_id: 'heatmap-analyst',
          run_id: ctx.runId,
          page_path: p.page,
          insight_type: 'heatmap',
          title: f.title,
          body: f.body,
          severity: f.severity,
          proposed_change: f.proposed_change,
          evidence: { sessions: heatmap.sessions, scroll_depth: heatmap.scroll_depth },
        });
        total += 1;
      }
    }

    return { summary: `Found ${total} heatmap insight(s) across ${pages.length} page(s).`, output: { insights: total } };
  },
};
