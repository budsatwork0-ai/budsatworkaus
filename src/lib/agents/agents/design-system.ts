/**
 * Design Integrity & System Guardian — orchestrates the full design audit workflow.
 *
 * Coordinates:
 *   · Layout Critic      — page hierarchy, WCAG AA, mobile UX
 *   · Admin UX Designer  — audience-segmented UX review (admin/crew/public)
 *   · UX Intelligence    — cross-area UX signals (read from design_insights)
 *   · Design Developer   — receives implementation task proposals (approval required)
 *   · Bud Observer       — registers post-deployment verification signal
 *
 * Workflow:
 *   1. Pull prior audit history + open violations + UX findings
 *   2. Semantic memory recall
 *   3. Call Layout Critic + Admin UX Designer as sub-agents
 *   4. Run own LLM audit with all context (8 design areas + sub-agent input)
 *   5. Score + persist to Supabase
 *   6. Generate canonical design spec (first run or when P0/P1s present)
 *   7. Write integrity report → docs/design-integrity/latest-report.md
 *   8. Propose Design Developer implementation tasks (requiresApproval: true)
 *   9. Register improvement signals with Bud Observer
 *  10. Return structured result
 *
 * Output:
 *   · docs/design-integrity/latest-report.md — human-readable integrity report
 *   · design_audits              — per-run score snapshots
 *   · design_violations          — individual violations
 *   · Obsidian: design/audits/   — full run report
 *   · Obsidian: design/violations/ — high-severity violation notes
 *
 * Schedule: Saturday 6 AM AEST (weekly, post-week code review)
 */
import type { AgentDefinition, AgentContext, AgentRunResult } from '../types';
import type { AgentFinding, AgentTask, AgentIssue, AgentDecision } from '@/lib/memory/agents/types';
import { AUDIT_AREAS, buildAuditContext, computeOverallScore, scoreLabel, COMPONENT_STANDARDS } from '@/lib/design-system/rules';
import { KNOWN_DUPLICATES, SIMPLICITY_RULES, GLASS_VARIANTS } from '@/lib/design-system/tokens';
import fs from 'fs';
import path from 'path';

void COMPONENT_STANDARDS;

// ── LLM prompts ───────────────────────────────────────────────────────────────

const AUDIT_SYSTEM = `You are the Design Integrity & System Guardian for Buds At Work — a local home-services
platform with an Apple-inspired glass morphism UI (deep green brand, Geist Sans font, Tailwind v4).

You receive:
  · The full design audit rubric (8 areas, pass criteria, common violations)
  · A curated snapshot of key component source files
  · Historical audit memory (prior scores and findings)
  · Open design violations from Supabase
  · Recent deployment + UX findings (for cross-reference)
  · Layout Critic findings (page hierarchy, WCAG AA, mobile)
  · Admin UX Designer findings (admin/crew/public audience UX)

Audit each area and return strict JSON only — no prose, no fences:

{
  "area_scores": {
    "glass-consistency": number,
    "typography-hierarchy": number,
    "color-literals": number,
    "component-duplication": number,
    "spacing-consistency": number,
    "cta-interactive-patterns": number,
    "sticky-footer": number,
    "apple-simplicity": number
  },
  "violations": [
    {
      "id": "unique-kebab-slug",
      "area": "area-id",
      "title": "Concise violation title",
      "severity": "low" | "medium" | "high" | "critical",
      "priority": "P0" | "P1" | "P2" | "P3",
      "component": "ComponentName or filename",
      "violation_type": "drift" | "duplication" | "missing-token" | "accessibility" | "simplicity" | "spacing",
      "description": "Specific markdown description. Quote exact class names or values that violate the rule.",
      "proposed_fix": "Specific code change. Quote the exact replacement class names or component.",
      "affected_files": ["path/to/file.tsx"],
      "effort": "< 30min" | "1–2h" | "half-day" | "1+ days",
      "backlinks": ["[[GlassUI.tsx]]", "[[/services]]"]
    }
  ],
  "quick_wins": ["Actionable one-liner fixes doable in < 30 minutes each"],
  "consolidation_candidates": [
    {
      "components": ["ComponentA", "ComponentB"],
      "description": "Why they should be merged",
      "proposed_primitive": "Name and location for the unified component"
    }
  ],
  "spec_decisions": [
    {
      "title": "Approved design decision title",
      "rationale": "Why this is now the standard",
      "rule": "The specific rule being codified"
    }
  ],
  "executive_summary": "3–4 sentences: overall score direction, most critical violation, most valuable quick win, and one architecture decision to codify this cycle."
}

Scoring guidelines:
  100 = Perfect compliance (rare)
  85–99 = Minor drift, < 3 violations
  70–84 = Noticeable drift, 3–6 violations, at least 1 medium
  50–69 = Significant drift, ≥ 1 high violation
  30–49 = Poor compliance, ≥ 1 critical violation
  0–29 = Systemic breakdown

Priority rules:
  P0 = Critical accessibility or revenue-blocking visual breakage
  P1 = Significant visual inconsistency affecting user trust
  P2 = Moderate drift that accumulates over time
  P3 = Polish — nice-to-have consistency improvement

Output only the JSON object.`;

const SPEC_SYSTEM = `You are generating the canonical Obsidian design system specification for Buds At Work.
Given the design token constants, component standards, and current audit findings, produce a
comprehensive markdown document that serves as the single source of truth for the design system.

The document should be:
  · Written as authoritative documentation (not a report)
  · Organised with H2 sections for each major system area
  · Include exact class name implementations for copy-paste use
  · Backlink all component file references with [[filename]]
  · Include a quick-reference table at the top

Return only the markdown content — no JSON wrapper.`;

// ── Component snapshot ────────────────────────────────────────────────────────

const COMPONENT_SNAPSHOT = `
## Key Component Implementations (snapshot for audit)

### src/app/ui/theme.ts — Brand tokens
\`\`\`
glass = 'bg-white/80 backdrop-blur-2xl border border-black/10 shadow-[0_10px_30px_rgba(2,6,23,0.08)]'
glassSoft = 'bg-white/70 backdrop-blur-2xl border border-black/10 shadow-[0_6px_20px_rgba(2,6,23,0.06)]'
brand.primary = '#0F3D2E', brand.accent = '#1C7C54', brand.focus = '#8BC8A8'
\`\`\`

### UIComponents.tsx — glassCard() function
\`\`\`
glassCard = (active) => cls('rounded-2xl p-4 cursor-pointer', glass, active ? 'ring-2 ring-[var(--accent)]' : 'ring-1 ring-black/10')
// NOTE: glass here is imported from constants.ts as 'bg-white/75 ...' — DIFFERENT from theme.ts 'bg-white/80'
\`\`\`

### GlassUI.tsx — GlassCard component
\`\`\`
<div className="rounded-2xl p-5 border border-white/40 bg-white/60 backdrop-blur-2xl shadow-[0_10px_30px_rgba(2,6,23,0.10)]">
// NOTE: bg-white/60 is the third different opacity value — violates glass consistency rule
\`\`\`

### GlassUI.tsx — S3_Card component
\`\`\`
<div className="rounded-2xl p-4 border border-black/10 bg-white/80">
// Correct opacity but NO backdrop-blur — intentional for Step 3 (checkout) performance
\`\`\`

### GlassUI.tsx — Chip vs S3_Chip
\`\`\`
Chip:    px-2.5 py-1 rounded-full text-[11px] bg-white/70 border-white/50   (10px horizontal padding)
S3_Chip: px-2 py-1 rounded-full text-[11px] bg-white/80 border-white/40     (8px horizontal padding — tighter)
// Near-identical but different opacity and padding
\`\`\`

### GlassUI.tsx — Row vs S3_Row
\`\`\`
Row:    <div className="flex items-center justify-between">
S3_Row: <div className="flex items-center justify-between py-1">
// Only difference: S3_Row has py-1. Both valid but should be one component with variant.
\`\`\`

### UIComponents.tsx — Tile component
\`\`\`
// Active: border-[color:var(--accent)] shadow-[0_4px_20px_rgba(15,61,46,0.12)]
// Active bg: color-mix(in srgb, var(--accent) 5%, #fff)  [inline color-mix — no token]
// Icon bg: active → color-mix(in srgb, var(--accent) 14%, transparent)  [different mix ratio — no token]
// Transition: 180ms cubic-bezier(0.25,0.46,0.45,0.94)  [custom easing inline — not from MOTION tokens]
\`\`\`

### GlassUI.tsx — KPI component
\`\`\`
<div className="rounded-xl border border-white/50 bg-white/70 px-4 py-3 text-slate-900">
// Uses rounded-xl (not rounded-2xl) — acceptable for KPI inside glass card? Inconsistent.
\`\`\`

### Icon stroke widths observed
\`\`\`
HomePage.tsx icons: strokeWidth={1.75}  ✓
UIComponents.tsx checkmark: strokeWidth="3"  ✗ (non-standard)
UIComponents.tsx chevron in tapHint: strokeWidth="2.5"  ✗ (non-standard)
GlassUI.tsx Caret: strokeWidth={2}  ✗ (non-standard)
\`\`\`

### Typography observed
\`\`\`
Tile title: text-[15px] (base) / text-[22px] (feature)  [inline — no token]
Tile subtitle: text-[12px] (base) / text-[14px] (feature)  [inline]
tapHint text: text-[10px]  [below 11px floor]
KPI label: text-[11px] uppercase tracking-wide  [near-eyebrow but missing letter-spacing token]
KPI value: text-xl font-semibold  [standard Tailwind — acceptable]
\`\`\`
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  if (s === 'critical' || s === 'high') return s as 'critical' | 'high';
  if (s === 'medium') return 'medium';
  return 'low';
}

function scoreColor(score: number): string {
  if (score >= 85) return 'green';
  if (score >= 70) return 'amber';
  if (score >= 50) return 'orange';
  return 'red';
}

// ── Agent definition ──────────────────────────────────────────────────────────

interface Violation {
  id: string;
  area: string;
  title: string;
  severity: string;
  priority: string;
  component: string;
  violation_type: string;
  description: string;
  proposed_fix: string;
  affected_files: string[];
  effort: string;
  backlinks: string[];
}

interface ConsolidationCandidate {
  components: string[];
  description: string;
  proposed_primitive: string;
}

interface SpecDecision {
  title: string;
  rationale: string;
  rule: string;
}

export const designSystemAgent: AgentDefinition = {
  id: 'design-system',
  name: 'Design Integrity & System Guardian',
  description:
    'Orchestrates the full design integrity workflow. Coordinates Layout Critic, Admin UX Designer, ' +
    'and UX Intelligence signals. Scores 8 design areas (0–100), detects token drift and hardcoded styles, ' +
    'generates an integrity report at docs/design-integrity/latest-report.md, and queues implementation ' +
    'tasks for Design Developer (human approval required before any UI changes).',
  category: 'ops',
  autonomy: 'review',
  schedule: '0 6 * * 6', // Saturday 6 AM AEST

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const now = new Date().toISOString().slice(0, 10);
    ctx.log('Design Integrity & System Guardian starting', { date: now, runId: ctx.runId });

    // ── 1. Pull prior audit history ───────────────────────────────────────

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: priorAudits }, { data: openViolations }, { data: uxFindings }] = await Promise.all([
      ctx.supabase
        .from('design_audits')
        .select('id, audit_date, overall_score, area_scores, executive_summary')
        .order('audit_date', { ascending: false })
        .limit(4),
      ctx.supabase
        .from('design_violations')
        .select('area, title, severity, priority, component, violation_type, status')
        .eq('status', 'open')
        .order('priority', { ascending: true })
        .limit(30),
      ctx.supabase
        .from('design_insights')
        .select('page_path, insight_type, title, severity')
        .gte('created_at', thirtyDaysAgo)
        .limit(20),
    ]);

    // ── 2. Semantic memory recall ─────────────────────────────────────────

    const historyMemory = await ctx.memory.search(
      'design system audit glass morphism typography consistency score violations',
      { category: 'design', agentScope: 'design-system', threshold: 0.60, limit: 6 },
    );

    const historyText = historyMemory
      .map(
        (m) =>
          `**${m.title}** (${new Date(m.created_at).toISOString().slice(0, 10)}, sim ${m.similarity.toFixed(2)})\n` +
          m.body.slice(0, 500),
      )
      .join('\n\n');

    // ── 3. Sub-agent orchestration ────────────────────────────────────────
    // Call Layout Critic + Admin UX Designer in parallel for fresh page signals.
    // UX Intelligence findings are already in design_insights (read above) — no double-run.

    const subAgentSummaries: Record<string, string> = {};

    const [layoutResult, adminUxResult] = await Promise.allSettled([
      ctx.callAgent(
        'layout-critic',
        {
          pages: [
            {
              path: '/',
              html_snippet: '<section class="hero"><h1>Good people doing honest work.</h1><p>Quote-first local services.</p><a class="cta-quote-hero">Get a quote</a></section>',
              mobile_notes: 'Hero CTA visibility on iPhone SE (375px). Sticky footer overlap check.',
            },
            {
              path: '/services',
              html_snippet: '<main class="services-wizard"><div class="step-indicator"/><div class="service-selector"/><div class="sticky-cta">Get Quote</div></main>',
              mobile_notes: 'Multi-step wizard: step progress indicator, CTA placement at each step, address autocomplete layout.',
            },
            {
              path: '/dashboard',
              html_snippet: '<main class="dashboard"><nav class="tabs"/><section class="tab-content"><div class="summary-cards"/></section></main>',
              mobile_notes: 'Admin dashboard tab density, card scannability on mobile.',
            },
          ],
        },
        'audit page layouts for visual hierarchy, WCAG AA accessibility, and mobile UX',
      ),
      ctx.callAgent(
        'admin-ux-designer',
        {
          pages: [
            {
              path: '/dashboard',
              audience: 'admin',
              notes: 'Dashboard tabs: Schedule, Overview, Receivables, Payables, Jobs, Reports. Focus: click-to-action efficiency, table scannability.',
            },
            {
              path: '/crew',
              audience: 'crew',
              notes: 'Crew portal: jobs, earnings, documents, schedule. Focus: mobile tap targets ≥44px, plain English, single-purpose screens.',
            },
            {
              path: '/',
              audience: 'public',
              notes: 'Marketing homepage with quote CTA. Focus: hero CTA above fold, social proof, suburb specificity.',
            },
          ],
        },
        'review admin, crew, and public pages against audience-specific UX rubrics',
      ),
    ]);

    if (layoutResult.status === 'fulfilled') {
      subAgentSummaries['layout-critic'] = layoutResult.value.summary;
      ctx.log('Layout Critic complete', { summary: layoutResult.value.summary.slice(0, 120) });
    } else {
      ctx.log('Layout Critic sub-call failed', { err: String(layoutResult.reason) });
      subAgentSummaries['layout-critic'] = 'Layout Critic unavailable this cycle.';
    }

    if (adminUxResult.status === 'fulfilled') {
      subAgentSummaries['admin-ux-designer'] = adminUxResult.value.summary;
      ctx.log('Admin UX Designer complete', { summary: adminUxResult.value.summary.slice(0, 120) });
    } else {
      ctx.log('Admin UX Designer sub-call failed', { err: String(adminUxResult.reason) });
      subAgentSummaries['admin-ux-designer'] = 'Admin UX Designer unavailable this cycle.';
    }

    // ── 4. Build audit prompt ─────────────────────────────────────────────

    const auditPrompt = [
      '## Design System Audit Context',
      '',
      buildAuditContext(),
      '',
      '## Current Component Snapshot',
      COMPONENT_SNAPSHOT,
      '',
      priorAudits && priorAudits.length > 0
        ? [
            '## Prior Audit Scores',
            (priorAudits as Array<Record<string, unknown>>).map((a) =>
              `${a.audit_date}: overall=${a.overall_score} | areas=${JSON.stringify(a.area_scores)}`,
            ).join('\n'),
          ].join('\n')
        : '## Prior Audit Scores\nNo prior audits — this is the first run.',
      '',
      openViolations && openViolations.length > 0
        ? [
            `## Open Violations (${openViolations.length})`,
            (openViolations as Array<Record<string, unknown>>).map(
              (v) => `[${v.priority}/${v.severity}] ${v.area} — ${v.title} (${v.component})`,
            ).join('\n'),
          ].join('\n')
        : '## Open Violations\nNone.',
      '',
      uxFindings && uxFindings.length > 0
        ? [
            `## Recent UX Intelligence Findings (${uxFindings.length})`,
            (uxFindings as Array<Record<string, unknown>>).map(
              (f) => `[${f.severity}] ${f.page_path} — ${f.title}`,
            ).join('\n'),
          ].join('\n')
        : '## Recent UX Findings\nNone.',
      '',
      `## Sub-Agent Findings This Cycle`,
      '',
      `### Layout Critic`,
      subAgentSummaries['layout-critic'] ?? 'No findings.',
      '',
      `### Admin UX Designer`,
      subAgentSummaries['admin-ux-designer'] ?? 'No findings.',
      '',
      historyText
        ? `## Historical Design Memory\n\n${historyText}`
        : '## Historical Design Memory\nNone.',
      '',
      'Audit all 8 areas and return the violations JSON.',
    ].join('\n');

    // ── 5. LLM audit ──────────────────────────────────────────────────────

    let areaScores: Record<string, number> = {};
    let violations: Violation[] = [];
    let quickWins: string[] = [];
    let consolidationCandidates: ConsolidationCandidate[] = [];
    let specDecisions: SpecDecision[] = [];
    let executiveSummary = '';

    try {
      const raw = await ctx.llm(auditPrompt, { system: AUDIT_SYSTEM });
      const parsed = JSON.parse(raw) as {
        area_scores: Record<string, number>;
        violations: Violation[];
        quick_wins: string[];
        consolidation_candidates: ConsolidationCandidate[];
        spec_decisions: SpecDecision[];
        executive_summary: string;
      };
      areaScores = parsed.area_scores ?? {};
      violations = parsed.violations ?? [];
      quickWins = parsed.quick_wins ?? [];
      consolidationCandidates = parsed.consolidation_candidates ?? [];
      specDecisions = parsed.spec_decisions ?? [];
      executiveSummary = parsed.executive_summary ?? '';
    } catch (err) {
      ctx.log('Audit LLM parse failed', { err: String(err) });
    }

    const overallScore = computeOverallScore(areaScores);
    const grade = scoreLabel(overallScore);
    const p0s = violations.filter((v) => v.priority === 'P0' || v.severity === 'critical');
    const p1Count = violations.filter((v) => v.priority === 'P1').length;
    const p2Count = violations.filter((v) => v.priority === 'P2').length;

    ctx.log('Audit scored', { overallScore, grade, violations: violations.length });

    // ── 6. Generate canonical design spec (first run or weekly refresh) ───

    let specMarkdown = '';
    const isFirstRun = !priorAudits || (priorAudits as Array<unknown>).length === 0;
    const isWeeklyRefresh = !isFirstRun && violations.filter((v) => v.priority === 'P0' || v.priority === 'P1').length > 0;

    if (isFirstRun || isWeeklyRefresh) {
      const specPrompt = [
        '## Design Token Constants',
        '',
        `Glass variants:\n${Object.entries(GLASS_VARIANTS).map(([k, v]) => `  ${k}: ${v}`).join('\n')}`,
        '',
        '## Audit Findings Summary',
        `Overall score: ${overallScore}/100 (${grade})`,
        '',
        `Area scores: ${JSON.stringify(areaScores, null, 2)}`,
        '',
        `Critical/High violations:\n${violations.filter((v) => v.severity === 'critical' || v.severity === 'high').map((v) => `- ${v.title}: ${v.proposed_fix}`).join('\n')}`,
        '',
        `Component consolidation candidates:\n${consolidationCandidates.map((c) => `- ${c.components.join(' + ')} → ${c.proposed_primitive}`).join('\n')}`,
        '',
        `Approved decisions:\n${specDecisions.map((d) => `- ${d.title}: ${d.rule}`).join('\n')}`,
        '',
        `Simplicity rules:\n${SIMPLICITY_RULES.map((r) => `- ${r}`).join('\n')}`,
        '',
        'Generate the canonical design system specification document.',
      ].join('\n');

      try {
        specMarkdown = await ctx.llm(specPrompt, { system: SPEC_SYSTEM });
      } catch {
        ctx.log('Spec generation failed — proceeding without spec update');
      }

      if (specMarkdown) {
        await ctx.memory.write({
          category: 'design',
          title: 'Design System Specification — Buds At Work',
          body: specMarkdown,
          tags: ['design-spec', 'canonical', 'design-system', now],
          agentScope: 'design-system',
          vaultPath: `design/design-system-spec.md`,
        });

        const inventoryMd = [
          '# Component Inventory — Buds At Work',
          '',
          `> Generated by Design Integrity Guardian on ${now}. Overall score: **${overallScore}/100** (${grade})`,
          '',
          '## Known Duplicates (pending consolidation)',
          '',
          ...KNOWN_DUPLICATES.map(
            (d) =>
              `### ${d.id}\n${d.description}\n\n` +
              `**Instances:**\n${d.instances.map((i) => `- \`${i.component}\` in [[${(i as Record<string, unknown>).file ?? ''}]]`).join('\n')}\n\n` +
              `**Resolution:** ${d.resolution}\n`,
          ),
          '',
          '## Glass Morphism Variants',
          '',
          ...Object.entries(GLASS_VARIANTS).map(
            ([key, val]) => `### ${key}\n\`\`\`\n${val}\n\`\`\`\n`,
          ),
        ].join('\n');

        await ctx.memory.write({
          category: 'design',
          title: 'Component Inventory — Buds At Work',
          body: inventoryMd,
          tags: ['component-inventory', 'design-system', now],
          agentScope: 'design-system',
          vaultPath: `design/component-inventory.md`,
        });
      }
    }

    // ── 7. Persist audit to Supabase ──────────────────────────────────────

    const { data: auditRow } = await ctx.supabase
      .from('design_audits')
      .insert({
        run_id: ctx.runId,
        audit_date: now,
        overall_score: overallScore,
        score_label: grade,
        area_scores: areaScores,
        executive_summary: executiveSummary,
        violation_count: violations.length,
        p0_count: p0s.length,
        p1_count: p1Count,
        quick_wins: quickWins,
      })
      .select('id')
      .single();

    const auditId = auditRow?.id ?? null;

    for (const v of violations) {
      await ctx.supabase.from('design_violations').insert({
        audit_id: auditId,
        run_id: ctx.runId,
        violation_id: v.id,
        area: v.area,
        title: v.title,
        severity: v.severity,
        priority: v.priority,
        component: v.component,
        violation_type: v.violation_type,
        description: v.description,
        proposed_fix: v.proposed_fix,
        affected_files: v.affected_files,
        effort: v.effort,
        backlinks: v.backlinks,
        status: 'open',
      });
    }

    for (const v of violations.filter((v) => v.severity === 'critical' || v.severity === 'high')) {
      await ctx.memory.write({
        category: 'design',
        title: `[${v.priority}] ${v.title}`,
        body: [
          `**Area:** ${v.area}  |  **Component:** \`${v.component}\`  |  **Type:** ${v.violation_type}`,
          '',
          v.description,
          '',
          '## Proposed Fix',
          v.proposed_fix,
          '',
          `**Effort:** ${v.effort}`,
          v.backlinks.length > 0 ? `\n${v.backlinks.join('  ')}` : '',
        ]
          .filter((l) => l !== undefined)
          .join('\n'),
        tags: ['design-violation', v.area, v.priority.toLowerCase(), now],
        agentScope: 'design-system',
        vaultPath: `design/violations/${now}-${v.id}.md`,
      });
    }

    // ── 8. Write integrity report ─────────────────────────────────────────
    // docs/design-integrity/latest-report.md — human-readable, report-only.
    // No UI changes are applied here. Design Developer tasks require approval.

    const priorScores = (priorAudits as Array<Record<string, unknown>> ?? [])
      .map((a) => `${a.audit_date}: ${a.overall_score}`)
      .join(' → ');

    const areaTable = AUDIT_AREAS.map((a) => {
      const score = areaScores[a.id] ?? 0;
      const color = scoreColor(score);
      const trend = priorAudits && (priorAudits as Array<Record<string, unknown>>).length > 0
        ? (() => {
            const prev = (priorAudits as Array<Record<string, unknown>>)[0]?.area_scores as Record<string, number> | undefined;
            const prevScore = prev?.[a.id];
            if (prevScore === undefined) return '';
            const diff = score - prevScore;
            return diff > 0 ? ` ↑${diff}` : diff < 0 ? ` ↓${Math.abs(diff)}` : ' →';
          })()
        : '';
      return `| ${a.label} | ${score}/100${trend} | ${a.weight * 100}% | ${color} |`;
    });

    const topQuickWin = quickWins[0] ?? 'No quick wins identified.';
    const recommendedNextAction = p0s.length > 0
      ? `Fix critical: ${p0s[0]!.title} — ${p0s[0]!.component}`
      : p1Count > 0
        ? `Address high-priority: ${violations.find((v) => v.priority === 'P1')?.title ?? 'review P1 violations'}`
        : topQuickWin;

    const reportMd = [
      `# Design Integrity Report — ${now}`,
      '',
      `> **This is a read-only audit report.** No UI changes have been applied.`,
      `> Implementation tasks have been queued for Design Developer and require human approval.`,
      '',
      '## Status Summary',
      '',
      '| Metric | Value |',
      '|--------|-------|',
      `| Design Score | **${overallScore}/100** — ${grade.toUpperCase()} |`,
      `| Critical Issues (P0) | ${p0s.length} |`,
      `| High Priority (P1) | ${p1Count} |`,
      `| Warnings (P2) | ${p2Count} |`,
      `| Total Violations | ${violations.length} |`,
      `| Quick Wins | ${quickWins.length} |`,
      `| Last Audit | ${now} |`,
      `| Recommended Next Action | ${recommendedNextAction} |`,
      priorScores ? `| Score Trend | ${priorScores} → ${overallScore} |` : '',
      '',
      '## Area Scores',
      '',
      '| Area | Score | Weight | Health |',
      '|------|-------|--------|--------|',
      ...areaTable,
      '',
      '## Executive Summary',
      '',
      executiveSummary || '_No summary generated._',
      '',
      '## Sub-Agent Findings',
      '',
      '### Layout Critic',
      subAgentSummaries['layout-critic'] ?? '_Not run._',
      '',
      '### Admin UX Designer',
      subAgentSummaries['admin-ux-designer'] ?? '_Not run._',
      '',
      '### UX Intelligence (from design_insights — last 30 days)',
      uxFindings && uxFindings.length > 0
        ? (uxFindings as Array<Record<string, unknown>>).map(
            (f) => `- [${f.severity}] \`${f.page_path}\` — ${f.title}`,
          ).join('\n')
        : '_No recent UX findings._',
      '',
      violations.length > 0
        ? [
            `## Violations (${violations.length} total)`,
            '',
            ...violations.slice(0, 15).map(
              (v) =>
                `### [${v.priority}] ${v.title}\n` +
                `**Component:** \`${v.component}\`  |  **Area:** ${v.area}  |  **Effort:** ${v.effort}\n\n` +
                v.description.slice(0, 400) +
                `\n\n**Proposed Fix:** ${v.proposed_fix.slice(0, 200)}\n`,
            ),
          ].join('\n')
        : '## Violations\n_None detected — system is compliant._',
      '',
      quickWins.length > 0
        ? [
            '## Quick Wins (< 30 min each)',
            '',
            ...quickWins.map((w) => `- ${w}`),
          ].join('\n')
        : '',
      '',
      consolidationCandidates.length > 0
        ? [
            '## Component Consolidation Candidates',
            '',
            ...consolidationCandidates.map(
              (c) =>
                `### ${c.components.join(' + ')}\n${c.description}\n**Proposed primitive:** \`${c.proposed_primitive}\``,
            ),
          ].join('\n')
        : '',
      '',
      '## Implementation Queue',
      '',
      '> Design Developer tasks have been proposed and are pending human approval.',
      '> No UI changes will be made until an operator approves each action in Mission Control.',
      '',
      p0s.length > 0
        ? [
            '### Critical Tasks (P0) — queued for Design Developer',
            ...p0s.map((v) => `- **${v.title}** (\`${v.component}\`) — ${v.effort}`),
          ].join('\n')
        : '### No P0 tasks this cycle.',
      '',
      violations.filter((v) => v.priority === 'P1').length > 0
        ? [
            '### High Priority Tasks (P1)',
            ...violations.filter((v) => v.priority === 'P1').map((v) => `- ${v.title} (\`${v.component}\`) — ${v.effort}`),
          ].join('\n')
        : '',
      '',
      '## Post-Deployment Verification',
      '',
      '> After any approved Design Developer task is applied:',
      '> Bud Observer will automatically detect the design_insights signal and verify the change',
      '> at its next observation cycle. No manual trigger required.',
      '',
      '## Backlinks',
      '',
      '- [[UX-Agent]]',
      '- [[Layout-Critic]]',
      '- [[Admin-UX-Designer]]',
      '- [[Design-Developer]]',
      '- [[Bud-Observer]]',
      '- [[src/app/ui/theme.ts]]',
      '- [[src/components/]]',
      '- [[Design System Specification — Buds At Work]]',
      '',
      `---`,
      `_Generated by Design Integrity & System Guardian · Run ID: ${ctx.runId} · ${now}_`,
    ]
      .filter((l) => l !== undefined)
      .join('\n');

    try {
      const reportDir = path.join(process.cwd(), 'docs', 'design-integrity');
      await fs.promises.mkdir(reportDir, { recursive: true });
      await fs.promises.writeFile(path.join(reportDir, 'latest-report.md'), reportMd, 'utf-8');
      ctx.log('Integrity report written', { path: 'docs/design-integrity/latest-report.md' });
    } catch (err) {
      ctx.log('Failed to write integrity report', { err: String(err) });
    }

    // Also write to Obsidian
    await ctx.memory.write({
      category: 'design',
      title: `Design Integrity Report — ${now}`,
      body: reportMd,
      tags: ['design-audit', 'integrity', 'weekly', grade, now],
      agentScope: 'design-system',
      vaultPath: `design/audits/${now}-design-integrity-report.md`,
    });

    // ── 9. Propose P0 actions + Design Developer tasks ────────────────────
    // All require human approval. No automatic UI changes.

    for (const v of p0s) {
      await ctx.proposeAction({
        action_type: 'design_fix_required',
        payload: {
          violation_id: v.id,
          area: v.area,
          component: v.component,
          proposed_fix: v.proposed_fix,
          affected_files: v.affected_files,
        },
        preview: `[P0 Design] ${v.title} — ${v.component}: ${v.proposed_fix.slice(0, 100)}`,
        requiresApproval: true,
        risk_level: 'medium',
      });
    }

    // Queue top P1 violations as Design Developer tasks (one proposal per P1)
    for (const v of violations.filter((v) => v.priority === 'P1').slice(0, 3)) {
      await ctx.proposeAction({
        action_type: 'design_developer_task',
        payload: {
          violation_id: v.id,
          title: v.title,
          component: v.component,
          area: v.area,
          proposed_fix: v.proposed_fix,
          affected_files: v.affected_files,
          effort: v.effort,
          agent_to_execute: 'design-developer',
        },
        preview: `[P1 → Design Developer] ${v.title}: ${v.proposed_fix.slice(0, 100)}`,
        requiresApproval: true,
        risk_level: 'low',
      });
    }

    // Register design debt signals with Bud Observer (non-blocking, fire-and-forget)
    if (p0s.length > 0 || p1Count > 0) {
      ctx.callAgent(
        'bud-observer',
        {
          signal_source: 'design-integrity-guardian',
          design_score: overallScore,
          p0_count: p0s.length,
          p1_count: p1Count,
          run_id: ctx.runId,
          top_violation: p0s[0]?.title ?? violations[0]?.title ?? null,
        },
        'verify design debt signals and register improvement opportunities',
      ).catch((err) => {
        ctx.log('Bud Observer notification skipped', { err: String(err) });
      });
    }

    // ── 10. Build Obsidian output ─────────────────────────────────────────

    const obsidianFindings: AgentFinding[] = violations.map(
      (v): AgentFinding => ({
        title: `[${v.priority}] ${v.title}`,
        summary:
          `**Area:** ${v.area}  |  **Component:** \`${v.component}\`  |  **Effort:** ${v.effort}`,
        severity: toFindingSeverity(v.severity),
        systems: v.affected_files,
        tags: ['design-audit', v.area, v.violation_type, v.priority.toLowerCase()],
        body: [
          `**Area:** ${v.area}  |  **Component:** \`${v.component}\``,
          `**Violation type:** ${v.violation_type}  |  **Effort:** ${v.effort}`,
          '',
          v.description,
          '',
          '## Proposed Fix',
          v.proposed_fix,
          '',
          v.backlinks.length > 0 ? `## Backlinks\n${v.backlinks.join('  \n')}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      }),
    );

    const obsidianTasks: AgentTask[] = [
      ...violations
        .filter((v) => v.priority === 'P0' || v.priority === 'P1')
        .map(
          (v): AgentTask => ({
            title: `[${v.priority}] Fix: ${v.title.slice(0, 80)}`,
            context:
              `Design Integrity Guardian (${now}) — **component:** \`${v.component}\`  |  ` +
              `**effort:** ${v.effort}  |  **area:** ${v.area}`,
            priority: toTaskPriority(v.priority),
            systems: v.affected_files,
            tags: ['design-fix', v.area],
            acceptanceCriteria: [
              v.proposed_fix,
              'Visual regression check: render on mobile (375px) and desktop (1440px)',
              'No new lint errors',
              `Area score for ${v.area} improves in next audit`,
              'Bud Observer verifies change at next observation cycle',
            ],
          }),
        ),
      ...quickWins.slice(0, 6).map(
        (win): AgentTask => ({
          title: win.slice(0, 80),
          context: `Quick win from Design Integrity audit ${ctx.runId} (${now}).`,
          priority: 'medium',
          tags: ['design-quick-win'],
          acceptanceCriteria: [win, 'No visual regressions'],
        }),
      ),
    ];

    const obsidianDecisions: AgentDecision[] = [
      ...consolidationCandidates.slice(0, 4).map(
        (c): AgentDecision => ({
          title: `Consolidate: ${c.components.join(' + ')} → ${c.proposed_primitive}`,
          context: `Design Integrity Guardian (${now}) identified near-duplicate components.`,
          rationale: c.description,
          consequences:
            `Creates unified primitive at ${c.proposed_primitive}. ` +
            'Reduces maintenance surface and enforces single-source styling.',
          status: 'proposed',
          impact: 'medium',
          systems: c.components,
          tags: ['design-consolidation', 'component-library'],
        }),
      ),
      ...specDecisions.slice(0, 4).map(
        (d): AgentDecision => ({
          title: d.title,
          context: `Design Integrity Guardian (${now}) — standardisation decision.`,
          rationale: d.rationale,
          consequences: `Rule: ${d.rule}`,
          status: 'accepted',
          impact: 'low',
          tags: ['design-standard', 'accepted'],
        }),
      ),
    ];

    const obsidianIssues: AgentIssue[] = violations
      .filter((v) => v.priority === 'P0')
      .slice(0, 6)
      .map(
        (v): AgentIssue => ({
          title: `[CRITICAL] ${v.title}`,
          description: v.description.slice(0, 600),
          impact: `${v.area} — effort: ${v.effort}`,
          severity: toIssueSeverity(v.severity),
          systems: v.affected_files,
          tags: ['design-critical', v.area],
        }),
      );

    // ── 11. Summary ───────────────────────────────────────────────────────

    const summary = [
      `Design Integrity audit complete — score ${overallScore}/100 (${grade}).`,
      `${violations.length} violations found: ${p0s.length} critical, ${p1Count} high, ${p2Count} warnings.`,
      `Sub-agents: Layout Critic (${layoutResult.status}), Admin UX Designer (${adminUxResult.status}).`,
      `${consolidationCandidates.length} consolidation candidates. Report at docs/design-integrity/latest-report.md.`,
      executiveSummary,
    ]
      .filter(Boolean)
      .join(' ');

    ctx.log('Design Integrity & System Guardian complete', {
      overallScore,
      grade,
      violations: violations.length,
      p0: p0s.length,
      p1: p1Count,
    });

    return {
      summary,
      output: {
        findings: obsidianFindings,
        tasks: obsidianTasks,
        decisions: obsidianDecisions,
        issues: obsidianIssues,
        design_audit: {
          run_date: now,
          overall_score: overallScore,
          score_label: grade,
          area_scores: areaScores,
          violation_count: violations.length,
          p0_count: p0s.length,
          p1_count: p1Count,
          p2_count: p2Count,
          consolidation_candidates: consolidationCandidates.length,
          quick_wins: quickWins,
          executive_summary: executiveSummary,
          sub_agents: subAgentSummaries,
          spec_updated: isFirstRun || isWeeklyRefresh,
          report_path: 'docs/design-integrity/latest-report.md',
        },
      },
    };
  },
};
