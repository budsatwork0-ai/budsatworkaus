/**
 * UX Intelligence Agent — autonomous Obsidian-powered UX audit system.
 *
 * Responsibilities:
 *  · Analyse UX issues across 6 focus areas: quoting flows, sticky footers,
 *    authenticated states, admin UX, map interfaces, mobile responsiveness
 *  · Recall and compare historical UX problems from Obsidian memory
 *  · Detect recurring friction patterns across runs
 *  · Generate markdown audit reports, priority-scored findings, and tasks
 *  · Backlink findings to affected pages, workflows, and prior issues
 *
 * Obsidian output (via logAgentRun → workspace.ts):
 *  · Findings  → Agents/UX-Agent/Findings/
 *  · Tasks     → Agents/UX-Agent/Tasks/
 *  · Issues    → Agents/UX-Agent/Active-Issues/
 *
 * Supabase output:
 *  · design_insights rows for cross-agent visibility
 *  · Proposed actions for P0 items (approval required)
 */
import type { AgentDefinition, AgentContext, AgentRunResult } from '../types';
import type { AgentFinding, AgentTask, AgentIssue } from '@/lib/memory/agents/types';

// ── Focus area definitions ────────────────────────────────────────────────────

const FOCUS_AREAS = [
  {
    id: 'quoting-flow',
    label: 'Quoting Flow',
    pages: ['/services'],
    workflow: 'Quote wizard → service selector → pricing engine → submission',
    rubric: `Multi-step wizard abandonment, CTA visibility per step, price reveal friction,
      form validation UX (inline vs submit-time), step progress indicator clarity,
      back-navigation losing state, address autocomplete errors, service-option layout
      density on mobile, sticky "Get Quote" vs step-locked CTA conflicts.`,
  },
  {
    id: 'sticky-footer',
    label: 'Sticky Footer / Persistent CTAs',
    pages: ['/'],
    workflow: 'Cross-page persistent navigation and fixed CTAs',
    rubric: `Z-index conflicts covering form inputs or modals, content obscured on mobile
      by fixed bars, contrast ratio of sticky elements (WCAG AA), CTA text clarity
      (generic "Book" vs contextual), dismiss affordance, double-sticky conflicts on
      nested layouts (quote wizard + site footer), safe-area inset handling on notched
      devices (env(safe-area-inset-bottom)).`,
  },
  {
    id: 'authenticated-states',
    label: 'Authenticated States',
    pages: ['/portal', '/crew', '/crew/jobs', '/crew/earnings', '/crew/documents', '/crew/schedule'],
    workflow: 'Login → crew portal → job management → earnings tracking',
    rubric: `Post-login redirect accuracy, empty states (no jobs, no earnings history),
      loading skeleton vs spinner consistency, session expiry UX (silent vs prompted),
      role-gated content visibility (admin vs crew vs client), mobile tap targets ≥44px
      in authenticated views, error states on failed data fetches.`,
  },
  {
    id: 'admin-ux',
    label: 'Admin UX',
    pages: ['/dashboard', '/dashboard/quotes', '/dashboard/orders', '/dashboard/crew', '/dashboard/agents', '/dashboard/ndis', '/dashboard/reports'],
    workflow: 'Admin dashboard → quote management → crew management → financial oversight',
    rubric: `Data table density and column scannability, keyboard shortcut coverage,
      action confirmation dialogs (destructive vs safe), batch operation affordance,
      filter/sort state persistence across navigation, date range picker ergonomics,
      agent approval queue friction (one-click approve vs multi-step), financial report
      readability (currency formatting, negative values, zero states).`,
  },
  {
    id: 'map-interfaces',
    label: 'Map Interfaces',
    pages: ['/services (yard-care FloorPlanBuilder)', '/portal/property'],
    workflow: 'Yard area mapping → touch-draw measurement → area calculation → quote',
    rubric: `Google Maps API load latency, touch-draw accuracy on mobile (finger vs stylus),
      undo/redo gesture clarity, satellite vs roadmap toggle discoverability, area
      calculation display precision, error states when Maps API fails or key quota hit,
      polygon close affordance, minimum viable area validation before quoting.`,
  },
  {
    id: 'mobile-responsiveness',
    label: 'Mobile Responsiveness',
    pages: ['/', '/services', '/portal', '/crew'],
    workflow: 'Full mobile journey: homepage → quote → portal',
    rubric: `Breakpoint behaviour at 375px / 390px / 414px / 768px, font scaling legibility,
      image optimisation and CLS, horizontal scroll regressions, form input zoom prevention
      (font-size ≥16px on inputs), bottom nav bar tap target sizing, glass-morphism
      backdrop-filter performance on mid-range Android, overflow-x hidden side-effects.`,
  },
] as const;

type FocusAreaId = (typeof FOCUS_AREAS)[number]['id'];

// ── LLM system prompts ────────────────────────────────────────────────────────

const ANALYSIS_SYSTEM = `You are the UX Intelligence Agent for Buds At Work — a local home
services platform (cleaning, yard care, car detailing, window cleaning, laundry) serving
Logan & South Brisbane. Customers are homeowners 25–65; crew are tradies using the platform
on mobile.

For the given focus area, analyse UX issues using the rubric. Cross-reference historical
findings to flag recurring patterns. Return strict JSON only:

{
  "findings": [
    {
      "id": "unique-kebab-slug",
      "title": "Concise issue title",
      "severity": "low" | "medium" | "high" | "critical",
      "priority": "P0" | "P1" | "P2" | "P3",
      "category": "abandonment" | "friction" | "accessibility" | "visual-clutter" | "mobile" | "navigation" | "data-density" | "map-ux",
      "affected_pages": ["..."],
      "body": "Detailed markdown analysis. Explain what is wrong, why it matters for conversions or crew productivity, and the specific element or flow involved.",
      "proposed_change": {
        "what": "What should change",
        "where": "Specific selector, component, or page section",
        "expected_impact": "Quantified or qualified improvement"
      },
      "is_recurring": false,
      "recurrence_note": "If recurring, reference the prior instance by title/date",
      "backlinks": ["[[/services]]", "[[Quote Wizard]]"]
    }
  ],
  "pattern_summary": "1–2 sentences on the dominant friction theme in this area.",
  "quick_wins": ["Actionable one-liner tasks that can ship in < 2 hours each"],
  "p0_actions": ["Critical blockers requiring immediate human review"]
}

Priority rules:
  P0 = Critical: revenue impact or complete flow blockage (must propose action)
  P1 = High: significant friction reducing conversions or crew productivity
  P2 = Medium: noticeable friction but workaround exists
  P3 = Low: polish — nice-to-have

Output only the JSON object. No prose, no fences.`;

const SYNTHESIS_SYSTEM = `You are synthesising UX findings for Buds At Work across 6 focus
areas. Given the per-area results, produce a cross-area intelligence report. Return strict JSON:

{
  "recurring_patterns": [
    {
      "pattern": "Short pattern name",
      "description": "What recurring friction this represents",
      "occurrences": number,
      "affected_areas": ["area-id", ...],
      "severity": "low" | "medium" | "high" | "critical"
    }
  ],
  "roadmap": [
    {
      "priority": "P0" | "P1" | "P2" | "P3",
      "title": "Implementation task title",
      "effort": "hours" | "days" | "weeks",
      "impact": "Brief description of expected outcome"
    }
  ],
  "executive_summary": "3–4 sentences: most critical findings, key patterns, top recommendation."
}

Output only the JSON object. No prose, no fences.`;

// ── Helpers ───────────────────────────────────────────────────────────────────

interface AreaFinding {
  id: string;
  title: string;
  severity: string;
  priority: string;
  category: string;
  affected_pages: string[];
  body: string;
  proposed_change: { what: string; where: string; expected_impact: string };
  is_recurring: boolean;
  recurrence_note: string;
  backlinks: string[];
}

interface AreaResult {
  areaId: FocusAreaId;
  findings: AreaFinding[];
  pattern_summary: string;
  quick_wins: string[];
  p0_actions: string[];
}

interface SynthesisResult {
  recurring_patterns: Array<{
    pattern: string;
    description: string;
    occurrences: number;
    affected_areas: string[];
    severity: string;
  }>;
  roadmap: Array<{
    priority: string;
    title: string;
    effort: string;
    impact: string;
  }>;
  executive_summary: string;
}

function toFindingSeverity(s: string): 'info' | 'warning' | 'critical' {
  if (s === 'critical') return 'critical';
  if (s === 'high') return 'warning';
  return 'info';
}

function toTaskPriority(p: string): 'critical' | 'high' | 'medium' | 'low' {
  if (p === 'P0') return 'critical';
  if (p === 'P1') return 'high';
  if (p === 'P2') return 'medium';
  return 'low';
}

function toIssueSeverity(s: string): 'critical' | 'high' | 'medium' | 'low' {
  if (s === 'critical') return 'critical';
  if (s === 'high') return 'high';
  if (s === 'medium') return 'medium';
  return 'low';
}

// ── Agent definition ──────────────────────────────────────────────────────────

export const uxIntelligenceAgent: AgentDefinition = {
  id: 'ux-intelligence',
  name: 'UX Intelligence',
  description:
    'Autonomous UX audit across quoting flows, sticky footers, admin UX, maps, and mobile. ' +
    'Stores findings in Obsidian with historical pattern detection and priority scoring.',
  category: 'ops',
  autonomy: 'review',
  schedule: '0 8 * * 1', // Monday 8 am AEST

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const now = new Date().toISOString().slice(0, 10);
    ctx.log('UX Intelligence Agent starting', { date: now, runId: ctx.runId });

    // ── 1. Pull recent history from Supabase ──────────────────────────────

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: recentInsights }, { data: recentProposals }] = await Promise.all([
      ctx.supabase
        .from('design_insights')
        .select('page_path, insight_type, title, body, severity, evidence, created_at')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(50),
      ctx.supabase
        .from('admin_ux_proposals')
        .select('page_path, audience, severity, title, body, created_at')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

    // ── 2. Semantic memory recall per focus area ──────────────────────────

    const memoryByArea: Record<string, string[]> = {};
    for (const area of FOCUS_AREAS) {
      const results = await ctx.memory.search(
        `UX issue: ${area.label} — ${area.rubric.slice(0, 120)}`,
        { category: 'ux', agentScope: 'ux-intelligence', threshold: 0.65, limit: 6 },
      );
      memoryByArea[area.id] = results.map(
        (r) =>
          `**${r.title}** (similarity ${r.similarity.toFixed(2)}, freshness ${r.freshness_score.toFixed(2)})\n` +
          r.body.slice(0, 400),
      );
    }

    // ── 3. Analyse each focus area (parallel) ────────────────────────────

    const combinedHistory = [
      ...(recentInsights ?? []).map((i) => ({
        page_path: (i as Record<string, unknown>).page_path as string,
        severity: (i as Record<string, unknown>).severity as string,
        title: (i as Record<string, unknown>).title as string,
        body: (i as Record<string, unknown>).body as string,
      })),
      ...(recentProposals ?? []).map((p) => ({
        page_path: (p as Record<string, unknown>).page_path as string,
        severity: (p as Record<string, unknown>).severity as string,
        title: (p as Record<string, unknown>).title as string,
        body: (p as Record<string, unknown>).body as string,
      })),
    ];

    const areaResults: AreaResult[] = await Promise.all(
      FOCUS_AREAS.map(async (area): Promise<AreaResult> => {
        // Filter recent DB findings relevant to this area
        const prefix = area.pages[0].split(' ')[0].replace('/*', '');
        const relevantHistory = combinedHistory
          .filter((i) => i.page_path?.startsWith(prefix))
          .slice(0, 10)
          .map((i) => `- [${i.severity}] ${i.title}: ${(i.body ?? '').slice(0, 180)}`);

        const historicalMemory = memoryByArea[area.id] ?? [];

        const prompt = [
          `Focus area: ${area.label}`,
          `Affected pages: ${area.pages.join(', ')}`,
          `Workflow: ${area.workflow}`,
          `Rubric: ${area.rubric.trim()}`,
          '',
          historicalMemory.length > 0
            ? `### Historical Obsidian Memory (${historicalMemory.length} entries)\n\n${historicalMemory.join('\n\n')}`
            : '### Historical Memory\nNo prior memory entries for this area.',
          '',
          relevantHistory.length > 0
            ? `### Recent DB Findings (${relevantHistory.length})\n\n${relevantHistory.join('\n')}`
            : '### Recent DB Findings\nNone in last 30 days.',
          '',
          'Analyse and return the JSON findings object.',
        ].join('\n');

        const raw = await ctx.llm(prompt, { system: ANALYSIS_SYSTEM });

        try {
          const parsed = JSON.parse(raw) as {
            findings: AreaFinding[];
            pattern_summary: string;
            quick_wins: string[];
            p0_actions: string[];
          };
          return {
            areaId: area.id,
            findings: parsed.findings ?? [],
            pattern_summary: parsed.pattern_summary ?? '',
            quick_wins: parsed.quick_wins ?? [],
            p0_actions: parsed.p0_actions ?? [],
          };
        } catch {
          ctx.log(`Parse failed for area ${area.id}`, { rawHead: raw.slice(0, 300) });
          return { areaId: area.id, findings: [], pattern_summary: '', quick_wins: [], p0_actions: [] };
        }
      }),
    );

    // ── 4. Cross-area synthesis ───────────────────────────────────────────

    const allFindings = areaResults.flatMap((r) =>
      r.findings.map((f) => ({ ...f, areaId: r.areaId })),
    );

    const synthPrompt = [
      'Per-area results:',
      JSON.stringify(
        areaResults.map((r) => ({
          area: r.areaId,
          findingCount: r.findings.length,
          pattern_summary: r.pattern_summary,
          p0_actions: r.p0_actions,
          severities: r.findings.map((f) => f.severity),
          priorities: r.findings.map((f) => f.priority),
        })),
        null,
        2,
      ),
      '',
      'All finding titles:',
      allFindings
        .map((f) => `[${f.priority}/${f.severity}] (${f.areaId}) ${f.title}`)
        .join('\n'),
    ].join('\n');

    let synthesis: SynthesisResult = {
      recurring_patterns: [],
      roadmap: [],
      executive_summary: '',
    };

    try {
      const synthRaw = await ctx.llm(synthPrompt, { system: SYNTHESIS_SYSTEM });
      synthesis = JSON.parse(synthRaw) as SynthesisResult;
    } catch {
      ctx.log('Synthesis parse failed — proceeding with per-area findings only');
    }

    // ── 5. Persist to design_insights + memory ────────────────────────────

    let dbInserted = 0;
    for (const f of allFindings) {
      await ctx.supabase.from('design_insights').insert({
        agent_id: 'ux-intelligence',
        run_id: ctx.runId,
        page_path: f.affected_pages[0] ?? '/',
        insight_type: `ux-${f.category}`,
        title: f.title,
        body: f.body,
        severity: f.severity,
        proposed_change: f.proposed_change,
        evidence: {
          priority: f.priority,
          area: f.areaId,
          is_recurring: f.is_recurring,
          recurrence_note: f.recurrence_note,
          affected_pages: f.affected_pages,
          backlinks: f.backlinks,
        },
      });
      dbInserted += 1;

      // Write high-signal findings to Obsidian memory for future recall
      if (f.severity === 'critical' || f.severity === 'high') {
        await ctx.memory.write({
          category: 'ux',
          title: `[${f.priority}] ${f.title}`,
          body: [
            f.body,
            '',
            `**Area:** ${f.areaId}`,
            `**Affected pages:** ${f.affected_pages.join(', ')}`,
            `**Proposed change:** ${f.proposed_change.what} (${f.proposed_change.where})`,
            `**Expected impact:** ${f.proposed_change.expected_impact}`,
            f.is_recurring ? `\n**Recurring issue.** ${f.recurrence_note}` : '',
            f.backlinks.length > 0 ? `\n${f.backlinks.join('  ')}` : '',
          ]
            .filter((l) => l !== '')
            .join('\n'),
          tags: ['ux-audit', f.category, f.areaId, f.priority.toLowerCase()],
          agentScope: 'ux-intelligence',
          vaultPath: `ux/${now}-${f.id}.md`,
        });
      }
    }

    // ── 6. Propose actions for P0 items ───────────────────────────────────

    const p0s = allFindings.filter((f) => f.priority === 'P0' || f.severity === 'critical');
    for (const f of p0s) {
      await ctx.proposeAction({
        action_type: 'ux_fix_required',
        payload: {
          finding_title: f.title,
          area: f.areaId,
          affected_pages: f.affected_pages,
          proposed_change: f.proposed_change,
          priority: f.priority,
          backlinks: f.backlinks,
        },
        preview: `[P0 UX Fix] ${f.title} — ${f.proposed_change.what} on ${f.affected_pages[0] ?? 'unknown page'}`,
        requiresApproval: true,
      });
    }

    // ── 7. Build structured Obsidian output ───────────────────────────────

    const obsidianFindings: AgentFinding[] = areaResults.flatMap((areaResult) => {
      const area = FOCUS_AREAS.find((a) => a.id === areaResult.areaId)!;
      return areaResult.findings.map(
        (f): AgentFinding => ({
          title: `[${f.priority}] ${f.title}`,
          summary:
            `**Area:** ${area.label}` +
            ` | **Pages:** ${f.affected_pages.slice(0, 3).join(', ')}` +
            ` | **Category:** ${f.category}` +
            (f.is_recurring ? ' | **RECURRING**' : ''),
          severity: toFindingSeverity(f.severity),
          systems: f.affected_pages,
          tags: [
            'ux-audit',
            f.category,
            areaResult.areaId,
            f.priority.toLowerCase(),
            ...(f.is_recurring ? ['recurring'] : ['new-finding']),
          ],
          body: buildFindingBody(f, area.label),
        }),
      );
    });

    // Quick-win tasks per area
    const quickWinTasks: AgentTask[] = areaResults.flatMap((areaResult) =>
      areaResult.quick_wins.slice(0, 4).map(
        (win): AgentTask => ({
          title: win.slice(0, 80),
          context:
            `Quick win identified by UX Intelligence (run ${ctx.runId}) in focus area **${areaResult.areaId}**.`,
          priority: 'medium',
          systems: [areaResult.areaId],
          tags: ['ux-quick-win', areaResult.areaId],
          acceptanceCriteria: [
            win,
            'Verified on mobile viewport (375px) and desktop (1440px)',
            'No regressions in adjacent flows',
          ],
        }),
      ),
    );

    // Roadmap P0/P1 tasks from synthesis
    const roadmapTasks: AgentTask[] = synthesis.roadmap
      .filter((item) => item.priority === 'P0' || item.priority === 'P1')
      .map(
        (item): AgentTask => ({
          title: `[${item.priority}] ${item.title}`,
          context: `UX Intelligence synthesis — **Impact:** ${item.impact} | **Effort:** ${item.effort}`,
          priority: toTaskPriority(item.priority),
          tags: ['ux-roadmap', item.priority.toLowerCase()],
          acceptanceCriteria: [
            `Implement: ${item.title}`,
            `Verify expected impact: ${item.impact}`,
            'QA across mobile + desktop',
          ],
        }),
      );

    const obsidianTasks: AgentTask[] = [...roadmapTasks, ...quickWinTasks];

    // Recurring + P0 issues → Active-Issues
    const obsidianIssues: AgentIssue[] = allFindings
      .filter((f) => f.is_recurring || f.priority === 'P0')
      .slice(0, 12)
      .map(
        (f): AgentIssue => ({
          title: `${f.title}${f.is_recurring ? ' [RECURRING]' : ' [CRITICAL]'}`,
          description: f.body.slice(0, 700),
          impact: `Priority ${f.priority} — ${f.proposed_change.expected_impact}`,
          severity: toIssueSeverity(f.severity),
          systems: f.affected_pages,
          tags: ['ux-issue', f.is_recurring ? 'recurring' : 'critical', f.areaId],
          stepsToReproduce:
            f.affected_pages.length > 0
              ? [
                  `Navigate to ${f.affected_pages[0]}`,
                  'Reproduce on mobile (375px) and desktop',
                  `Observe: ${f.proposed_change.where}`,
                ]
              : undefined,
        }),
      );

    // ── 8. Assemble summary ───────────────────────────────────────────────

    const totalFindings = allFindings.length;
    const p0Count = allFindings.filter((f) => f.priority === 'P0').length;
    const p1Count = allFindings.filter((f) => f.priority === 'P1').length;
    const recurringCount = allFindings.filter((f) => f.is_recurring).length;
    const patternCount = synthesis.recurring_patterns.length;

    const summary = [
      `UX audit complete — ${totalFindings} findings across ${FOCUS_AREAS.length} focus areas.`,
      `P0: ${p0Count}, P1: ${p1Count}, recurring: ${recurringCount}, cross-area patterns: ${patternCount}.`,
      synthesis.executive_summary || '',
    ]
      .filter(Boolean)
      .join(' ');

    ctx.log('UX Intelligence complete', {
      total: totalFindings,
      p0: p0Count,
      recurring: recurringCount,
      dbInserted,
    });

    return {
      summary,
      output: {
        findings: obsidianFindings,
        tasks: obsidianTasks,
        issues: obsidianIssues,
        // Structured data for downstream agents (A/B test architect, foreman)
        ux_audit: {
          run_date: now,
          total_findings: totalFindings,
          p0_count: p0Count,
          p1_count: p1Count,
          recurring_count: recurringCount,
          patterns: synthesis.recurring_patterns,
          roadmap: synthesis.roadmap,
          executive_summary: synthesis.executive_summary,
          area_summaries: areaResults.map((r) => ({
            area: r.areaId,
            finding_count: r.findings.length,
            pattern: r.pattern_summary,
          })),
        },
      },
    };
  },
};

// ── Body builder ──────────────────────────────────────────────────────────────

function buildFindingBody(
  f: AreaFinding,
  areaLabel: string,
): string {
  const lines: string[] = [
    `**Focus area:** ${areaLabel}`,
    `**Category:** ${f.category}`,
    `**Affected pages:** ${f.affected_pages.join(', ')}`,
    '',
    f.body,
    '',
    '## Proposed Change',
    `**What:** ${f.proposed_change.what}`,
    `**Where:** ${f.proposed_change.where}`,
    `**Expected impact:** ${f.proposed_change.expected_impact}`,
  ];

  if (f.is_recurring) {
    lines.push('', '## Recurrence', f.recurrence_note);
  }

  if (f.backlinks.length > 0) {
    lines.push('', '## Backlinks', f.backlinks.join('  \n'));
  }

  return lines.join('\n');
}
