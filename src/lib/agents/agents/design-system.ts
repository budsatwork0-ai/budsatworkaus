/**
 * Design System Agent — autonomous visual consistency auditor.
 *
 * Responsibilities:
 *   · Audit 8 areas of the Buds At Work design system
 *   · Score each area 0–100 (weighted overall consistency score)
 *   · Detect component duplication and glass morphism drift
 *   · Enforce Apple-inspired simplicity principles
 *   · Maintain sticky footer, typography, and CTA compliance
 *   · Generate prioritised refactor tasks
 *   · Store canonical design spec in Obsidian memory for recall by other agents
 *   · Track consistency trends across audit cycles
 *
 * Obsidian output (via logAgentRun → workspace.ts):
 *   · Findings  → Agents/Design-System-Agent/Findings/
 *   · Tasks     → Agents/Design-System-Agent/Tasks/
 *   · Reports   → Agents/Design-System-Agent/Reports/
 *   · Decisions → Agents/Design-System-Agent/Decisions/ (approved standards)
 *
 * Supabase output:
 *   · design_audits      — per-run score snapshots
 *   · design_violations  — individual violations
 *
 * Schedule: Saturday 6 AM AEST (weekly, post-week code review)
 */
import type { AgentDefinition, AgentContext, AgentRunResult } from '../types';
import type { AgentFinding, AgentTask, AgentIssue, AgentDecision } from '@/lib/memory/agents/types';
import { AUDIT_AREAS, buildAuditContext, computeOverallScore, scoreLabel, COMPONENT_STANDARDS } from '@/lib/design-system/rules';
import { KNOWN_DUPLICATES, SIMPLICITY_RULES, GLASS_VARIANTS } from '@/lib/design-system/tokens';

// Ensure COMPONENT_STANDARDS is referenced so the import is used
void COMPONENT_STANDARDS;

// ── LLM prompts ───────────────────────────────────────────────────────────────

const AUDIT_SYSTEM = `You are the Design System Agent for Buds At Work — a local home-services
platform with an Apple-inspired glass morphism UI (deep green brand, Geist Sans font, Tailwind v4).

You receive:
  · The full design audit rubric (8 areas, pass criteria, common violations)
  · A curated snapshot of key component source files
  · Historical audit memory (prior scores and findings)
  · Open design violations from Supabase
  · Recent deployment + UX findings (for cross-reference)

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
// Curated excerpts of key components for LLM context.
// These are manually maintained and updated when components change.

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
  name: 'Design System',
  description:
    'Audits 8 design system areas (glass morphism, typography, colors, duplication, spacing, CTAs, sticky footer, Apple simplicity). ' +
    'Scores consistency 0–100, generates refactor tasks, and maintains canonical design spec in Obsidian.',
  category: 'ops',
  autonomy: 'review',
  schedule: '0 6 * * 6', // Saturday 6 AM AEST

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const now = new Date().toISOString().slice(0, 10);
    ctx.log('Design System Agent starting', { date: now, runId: ctx.runId });

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
        .limit(15),
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

    // ── 3. Build audit prompt ─────────────────────────────────────────────

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
      historyText
        ? `## Historical Design Memory\n\n${historyText}`
        : '## Historical Design Memory\nNone.',
      '',
      'Audit all 8 areas and return the violations JSON.',
    ].join('\n');

    // ── 4. LLM audit ──────────────────────────────────────────────────────

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

    ctx.log('Audit scored', { overallScore, grade, violations: violations.length });

    // ── 5. Generate canonical design spec (first run or weekly refresh) ───

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

      // Write canonical spec to Obsidian
      if (specMarkdown) {
        await ctx.memory.write({
          category: 'design',
          title: 'Design System Specification — Buds At Work',
          body: specMarkdown,
          tags: ['design-spec', 'canonical', 'design-system', now],
          agentScope: 'design-system',
          vaultPath: `design/design-system-spec.md`,
        });

        // Component inventory document
        const inventoryMd = [
          '# Component Inventory — Buds At Work',
          '',
          `> Generated by Design System Agent on ${now}. Overall score: **${overallScore}/100** (${grade})`,
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

    // ── 6. Persist audit to Supabase ──────────────────────────────────────

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
        p0_count: violations.filter((v) => v.priority === 'P0').length,
        p1_count: violations.filter((v) => v.priority === 'P1').length,
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

    // Write high-signal violations to Obsidian memory for cross-agent recall
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

    // ── 7. Propose P0 actions ─────────────────────────────────────────────

    const p0s = violations.filter((v) => v.priority === 'P0' || v.severity === 'critical');
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
      });
    }

    // ── 8. Build Obsidian output ──────────────────────────────────────────

    // Score trend line for the report
    const priorScores = (priorAudits as Array<Record<string, unknown>> ?? [])
      .map((a) => `${a.audit_date}: ${a.overall_score}`)
      .join(' → ');

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

    // Tasks for P0/P1 violations + all quick wins
    const obsidianTasks: AgentTask[] = [
      ...violations
        .filter((v) => v.priority === 'P0' || v.priority === 'P1')
        .map(
          (v): AgentTask => ({
            title: `[${v.priority}] Fix: ${v.title.slice(0, 80)}`,
            context:
              `Design System audit (${now}) — **component:** \`${v.component}\`  |  ` +
              `**effort:** ${v.effort}  |  **area:** ${v.area}`,
            priority: toTaskPriority(v.priority),
            systems: v.affected_files,
            tags: ['design-fix', v.area],
            acceptanceCriteria: [
              v.proposed_fix,
              'Visual regression check: render on mobile (375px) and desktop (1440px)',
              'No new lint errors',
              `Area score for ${v.area} improves in next audit`,
            ],
          }),
        ),
      ...quickWins.slice(0, 6).map(
        (win): AgentTask => ({
          title: win.slice(0, 80),
          context: `Quick win from Design System audit ${ctx.runId} (${now}).`,
          priority: 'medium',
          tags: ['design-quick-win'],
          acceptanceCriteria: [win, 'No visual regressions'],
        }),
      ),
    ];

    // Consolidation candidates → Decisions
    const obsidianDecisions: AgentDecision[] = [
      ...consolidationCandidates.slice(0, 4).map(
        (c): AgentDecision => ({
          title: `Consolidate: ${c.components.join(' + ')} → ${c.proposed_primitive}`,
          context: `Design System audit (${now}) identified near-duplicate components.`,
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
          context: `Design System audit (${now}) — standardisation decision.`,
          rationale: d.rationale,
          consequences: `Rule: ${d.rule}`,
          status: 'accepted',
          impact: 'low',
          tags: ['design-standard', 'accepted'],
        }),
      ),
    ];

    // P0 violations + recurring issues → Active-Issues
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

    // ── 9. Build full report markdown ─────────────────────────────────────

    const areaTable = AUDIT_AREAS.map((a) => {
      const score = areaScores[a.id] ?? 0;
      const trend = priorAudits && (priorAudits as Array<Record<string, unknown>>).length > 0
        ? (() => {
            const prev = (priorAudits as Array<Record<string, unknown>>)[0]?.area_scores as Record<string, number> | undefined;
            const prevScore = prev?.[a.id];
            if (prevScore === undefined) return '';
            const diff = score - prevScore;
            return diff > 0 ? ` ↑${diff}` : diff < 0 ? ` ↓${Math.abs(diff)}` : ' →';
          })()
        : '';
      return `| ${a.label} | ${score}/100${trend} | ${a.weight * 100}% |`;
    });

    const reportMd = [
      `# Design System Audit — ${now}`,
      '',
      `> **Overall Score: ${overallScore}/100** — Grade: **${grade.toUpperCase()}**`,
      priorScores ? `> **Trend:** ${priorScores} → ${overallScore}` : '',
      '',
      '## Area Scores',
      '',
      '| Area | Score | Weight |',
      '|------|-------|--------|',
      ...areaTable,
      '',
      '## Executive Summary',
      '',
      executiveSummary || '_No summary generated._',
      '',
      violations.length > 0
        ? [
            `## Violations (${violations.length} total, ${p0s.length} critical)`,
            '',
            ...violations.slice(0, 12).map(
              (v) =>
                `### [${v.priority}] ${v.title}\n` +
                `**Component:** \`${v.component}\`  |  **Area:** ${v.area}  |  **Effort:** ${v.effort}\n\n` +
                v.description.slice(0, 400) +
                `\n\n**Fix:** ${v.proposed_fix.slice(0, 200)}\n`,
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
            '## Component Consolidation',
            '',
            ...consolidationCandidates.map(
              (c) =>
                `### ${c.components.join(' + ')}\n${c.description}\n**Proposed primitive:** \`${c.proposed_primitive}\``,
            ),
          ].join('\n')
        : '',
      '',
      '## Backlinks',
      '',
      '- [[UX-Agent]]',
      '- [[/services]]',
      '- [[src/app/ui/theme.ts]]',
      '- [[src/components/]]',
      '- [[Design System Specification — Buds At Work]]',
    ]
      .filter((l) => l !== undefined)
      .join('\n');

    // Write report to Obsidian
    await ctx.memory.write({
      category: 'design',
      title: `Design System Audit Report — ${now}`,
      body: reportMd,
      tags: ['design-audit', 'weekly', grade, now],
      agentScope: 'design-system',
      vaultPath: `design/audits/${now}-design-system-audit.md`,
    });

    // ── 10. Summary ───────────────────────────────────────────────────────

    const p1Count = violations.filter((v) => v.priority === 'P1').length;

    const summary = [
      `Design System audit complete — score ${overallScore}/100 (${grade}).`,
      `${violations.length} violations found: ${p0s.length} critical, ${p1Count} high.`,
      `${consolidationCandidates.length} consolidation candidates identified.`,
      executiveSummary,
    ]
      .filter(Boolean)
      .join(' ');

    ctx.log('Design System Agent complete', {
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
          consolidation_candidates: consolidationCandidates.length,
          quick_wins: quickWins,
          executive_summary: executiveSummary,
          spec_updated: isFirstRun || isWeeklyRefresh,
        },
      },
    };
  },
};
