/**
 * SEO & Meta Agent — reviews titles, meta descriptions, JSON-LD structured
 * data, and internal linking, scoring each page against Logan / South
 * Brisbane local-SEO patterns.
 */
import type { AgentDefinition, AgentContext } from '../types';
import { detectSandboxSeoPage, sandboxId } from '../sandbox-input';

const SYSTEM = `You audit page metadata for Buds At Work — local services in
Logan & South Brisbane, Australia. Score titles for length (≤60 chars),
descriptions (≤155 chars, lead with service+suburb), and structured data
(LocalBusiness, Service, Review schema). Flag any page missing canonical
or OpenGraph tags. Strict JSON:
{
  "findings": [
    { "title": "...", "severity": "low|medium|high",
      "body": "...",
      "proposed_change": {"field":"title|description|jsonld","before":"...","after":"..."} }
  ]
}`;

interface PageMeta {
  path: string;
  title?: string;
  description?: string;
  canonical?: string;
  og?: Record<string, string>;
  jsonld?: unknown;
}

export const seoMetaAgent: AgentDefinition = {
  id: 'seo-meta',
  name: 'SEO & Meta Agent',
  description: 'Audits titles, descriptions, structured data, internal links.',
  category: 'sales',
  autonomy: 'review',
  async run(ctx: AgentContext) {
    // ── Sandbox path ──────────────────────────────────────────────────────────
    const sandboxPage = detectSandboxSeoPage(
      (ctx.input ?? {}) as Record<string, unknown>,
    );
    if (sandboxPage) {
      const syntheticPage: PageMeta = {
        path: sandboxPage.path,
        title: sandboxPage.suburb && sandboxPage.service
          ? `${sandboxPage.service.charAt(0).toUpperCase() + sandboxPage.service.slice(1)} in ${sandboxPage.suburb} | Buds At Work`
          : 'Buds At Work',
        description: sandboxPage.suburb && sandboxPage.service
          ? `${sandboxPage.service} services in ${sandboxPage.suburb}, South Brisbane.`
          : 'Local home services.',
      };
      let findingTitle = `SEO audit: ${sandboxPage.path}`;
      try {
        const raw = await ctx.llm(JSON.stringify(syntheticPage), { system: SYSTEM });
        const parsed = JSON.parse(raw) as { findings?: Array<{ title: string }> };
        if (parsed.findings?.[0]?.title) findingTitle = parsed.findings[0].title;
      } catch { /* use default */ }
      await ctx.proposeAction({
        action_type: 'flag_for_review',
        target_table: 'design_insights',
        target_id: sandboxId('seo-finding'),
        preview: findingTitle,
        payload: { sandbox: true, path: sandboxPage.path, pageType: sandboxPage.pageType, suburb: sandboxPage.suburb, service: sandboxPage.service },
        requiresApproval: true,
      });
      return {
        summary: `Sandbox SEO audit: ${sandboxPage.path} — 1 finding flagged.`,
        output: { sandbox: true, findings: 1 },
      };
    }
    // ── Production path ───────────────────────────────────────────────────────
    const pages: PageMeta[] = (ctx.input?.pages as PageMeta[] | undefined) ?? [
      { path: '/', title: 'Buds At Work | Local Home & Property Services in Logan & South Brisbane',
        description: 'Quote-first local services in Logan & South Brisbane: home cleaning, window cleaning, yard care, dump runs, car detailing. NDIS-friendly support available.',
        canonical: 'https://budsatwork.com' },
      { path: '/services/yard-care', title: 'Yard Care | Buds At Work',
        description: 'Yard care in Logan.' },
    ];

    let count = 0;
    for (const p of pages) {
      const raw = await ctx.llm(JSON.stringify(p), { system: SYSTEM });
      let parsed: { findings: Array<{ title: string; severity: string; body: string; proposed_change: unknown }> };
      try { parsed = JSON.parse(raw); } catch { continue; }
      for (const f of parsed.findings ?? []) {
        await ctx.supabase.from('design_insights').insert({
          agent_id: 'seo-meta',
          run_id: ctx.runId,
          page_path: p.path,
          insight_type: 'seo',
          title: f.title,
          body: f.body,
          severity: f.severity,
          proposed_change: f.proposed_change,
        });
        count += 1;
      }
    }
    return { summary: `Logged ${count} SEO finding(s).`, output: { findings: count } };
  },
};
