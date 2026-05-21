/**
 * Admin UX Designer — reviews internal admin pages (admin dashboard,
 * crew portal), public marketing pages, and the agent lobby itself for
 * UX quality. Different audiences get different rubrics:
 *
 *   admin  — density, keyboard ergonomics, scannability of tables,
 *            "fewer clicks to action" thinking
 *   crew   — mobile-first, big tap targets, low-cognitive-load
 *   public — conversion focused, hierarchy, social proof
 *   lobby  — playfulness, info-at-a-glance, ambient energy
 *
 * Pages are passed in via input or default to a known list. The
 * agent prefers structured HTML over screenshots, but accepts both.
 */
import type { AgentDefinition, AgentContext } from '../types';

const SYSTEM = `You are the Admin UX Designer for Buds At Work. You audit
internal/operational pages with the same rigor a senior product designer
would apply during a Friday design crit. For each page given, return a
strict JSON object:
{
  "findings": [
    {
      "title": "...",
      "severity": "low" | "medium" | "high" | "critical",
      "category": "hierarchy" | "density" | "a11y" | "keyboard" | "mobile" | "scannability" | "actionability",
      "body": "...markdown — what is wrong and why it matters...",
      "proposed_change": { "selector_or_section": "...", "before": "...", "after": "..." }
    }
  ]
}
Rubric by audience:
- admin   : fewer clicks-to-action, scannable tables, sensible defaults
- crew    : ≥44px tap targets, plain English, single-purpose screens
- public  : clear hero CTA above fold, social proof, suburb specificity
- lobby   : info density, motion ≠ noise, playful but legible`;

interface PageAudit {
  path: string;
  audience: 'admin' | 'crew' | 'public' | 'lobby';
  html_snippet?: string;
  screenshot_url?: string;
  notes?: string;
}

export const adminUxDesignerAgent: AgentDefinition = {
  id: 'admin-ux-designer',
  name: 'Admin UX Designer',
  description: 'Reviews admin / crew / public / lobby pages with audience-specific UX rubrics.',
  category: 'ops',
  autonomy: 'review',
  async run(ctx: AgentContext) {
    const pages: PageAudit[] = (ctx.input?.pages as PageAudit[] | undefined) ?? defaultTargets();

    type Finding = { title: string; severity: string; category: string; body: string; proposed_change: unknown };
    type PageResult = { page: PageAudit; findings: Finding[] };

    // Run in sequential batches of 3 to stay well under the 300s run timeout
    const BATCH = 3;
    const results: PageResult[] = [];
    for (let i = 0; i < pages.length; i += BATCH) {
      const batch = pages.slice(i, i + BATCH);
      const batchResults = await Promise.all(batch.map(async (page): Promise<PageResult> => {
        const prompt = `Audience: ${page.audience}\nPath: ${page.path}\nNotes: ${page.notes ?? ''}\n${page.html_snippet ? `HTML:\n${page.html_snippet.slice(0, 6000)}` : ''}${page.screenshot_url ? `\nScreenshot: ${page.screenshot_url}` : ''}\nReturn findings JSON.`;
        const raw = await ctx.llm(prompt, { system: SYSTEM });
        try {
          const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
          const parsed: { findings: Finding[] } = JSON.parse(jsonStr);
          return { page, findings: parsed.findings ?? [] };
        } catch {
          return { page, findings: [] };
        }
      }));
      results.push(...batchResults);
    }

    const VALID_SEVERITY = ['low', 'medium', 'high', 'critical'] as const;
    type Sev = typeof VALID_SEVERITY[number];
    const findingStrings: string[] = [];
    let total = 0;
    let highestSeverity = 0; // 0=low,1=medium,2=high,3=critical
    const SEV_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
    for (const { page, findings } of results) {
      for (const f of findings) {
        const severity: Sev = VALID_SEVERITY.includes(f.severity as Sev) ? (f.severity as Sev) : 'medium';
        try {
          await ctx.supabase.from('admin_ux_proposals').insert({
            run_id: ctx.runId,
            page_path: page.path,
            audience: page.audience,
            severity,
            title: f.title,
            body: `**Category:** ${f.category}\n\n${f.body}`,
            proposed_change: f.proposed_change,
          });
        } catch {
          // Non-fatal — a single bad finding row should not fail the whole run
          ctx.log(`admin_ux_proposals insert failed for ${page.path}: ${f.title}`);
          continue;
        }
        findingStrings.push(`[${severity}] ${page.path}: ${f.title}`);
        highestSeverity = Math.max(highestSeverity, SEV_RANK[severity] ?? 0);
        total += 1;
      }
    }
    const RISK_MAP = ['low', 'medium', 'high', 'critical'] as const;
    return {
      summary: `Logged ${total} UX finding(s) across ${pages.length} page(s).`,
      output: {
        status: total > 0 ? 'success' : 'partial',
        summary: `Logged ${total} UX finding(s) across ${pages.length} page(s).`,
        findings: findingStrings,
        recommended_actions: total > 0 ? ['Review UX proposals in the admin panel'] : [],
        confidence: 0.85,
        risk_level: RISK_MAP[highestSeverity],
        raw_output: { findings_count: total, pages_audited: pages.length },
      },
    };
  },
};

function defaultTargets(): PageAudit[] {
  return [
    { path: '/dashboard',            audience: 'admin',  notes: 'Top-level admin dashboard — KPI cards, quick actions' },
    { path: '/dashboard/quotes',     audience: 'admin',  notes: 'Quotes table — needs to be scannable; agent_triaged_at and lead_score columns visible' },
    { path: '/dashboard/crew',       audience: 'admin',  notes: 'Crew pipeline view + applicant management' },
    { path: '/dashboard/agents',     audience: 'admin',  notes: 'Agent monitoring — cards + approval queue + recent runs' },
    { path: '/dashboard/agents/lobby', audience: 'lobby', notes: 'The live agent lobby — keep playful + legible' },
    { path: '/portal',               audience: 'crew',   notes: 'Crew portal — mobile-first, low cognitive load' },
    { path: '/',                     audience: 'public', notes: 'Public homepage — conversion focused' },
    { path: '/services/yard-care',   audience: 'public', notes: 'Service detail page — suburb specificity, social proof' },
  ];
}
