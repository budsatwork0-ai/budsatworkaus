/**
 * Admin Optimization Agent — autonomous operational intelligence for the
 * Buds At Work admin surface.
 *
 * Responsibilities:
 *  · Improve scheduling UX (landscape-first run-sheet view, minimal clicks)
 *  · Surface and reduce repetitive admin tasks (automation candidates)
 *  · Improve crew onboarding workflows (applicant → active timeline)
 *  · Simplify quote management (pipeline visibility, time-to-decision)
 *  · Map and score workflow friction across all admin surfaces
 *
 * Obsidian output (via logAgentRun → workspace.ts):
 *  · Findings  → Agents/Admin-Agent/Findings/   (friction maps, workflow diagrams)
 *  · Tasks     → Agents/Admin-Agent/Tasks/       (redesign + automation tasks)
 *  · Issues    → Agents/Admin-Agent/Active-Issues/ (recurring pain points)
 *
 * Supabase output:
 *  · admin_optimization_findings table
 *  · Proposed actions for critical (score ≥ 16) friction items
 *
 * Design philosophy applied to proposals:
 *  landscape-first layouts · operational clarity · low visual noise ·
 *  rapid scanning · minimal clicks
 */
import type { AgentDefinition, AgentContext, AgentRunResult } from '../types';
import type { AgentFinding, AgentTask, AgentIssue } from '@/lib/memory/agents/types';

// ── Friction scoring ──────────────────────────────────────────────────────────
//
//   clicks × 2  +  context_switches × 3  +  manual_steps × 2  +  error_prone × 3
//   Range: 0–20 · Low: 0–4 · Medium: 5–9 · High: 10–15 · Critical: 16+

export interface FrictionScore {
  clicks: number;           // taps/clicks to complete the workflow
  context_switches: number; // navigations away from the originating page
  manual_steps: number;     // steps that could be automated
  error_prone: number;      // 0=no  1=sometimes  2=often
  total: number;
  band: 'low' | 'medium' | 'high' | 'critical';
}

function scoreFriction(
  clicks: number,
  context_switches: number,
  manual_steps: number,
  error_prone: number,
): FrictionScore {
  const total = clicks * 2 + context_switches * 3 + manual_steps * 2 + error_prone * 3;
  const band: FrictionScore['band'] =
    total >= 16 ? 'critical' : total >= 10 ? 'high' : total >= 5 ? 'medium' : 'low';
  return { clicks, context_switches, manual_steps, error_prone, total, band };
}

// ── Focus areas ───────────────────────────────────────────────────────────────

const FOCUS_AREAS = [
  {
    id: 'scheduling-ux',
    label: 'Scheduling UX',
    pages: ['/dashboard', '/dashboard/schedule'],
    workflow: 'Admin builds daily run sheet → assigns crew → confirms jobs → monitors',
    designGoal: 'Landscape-first run-sheet with drag-assign, one-click crew swap, weather-aware flags.',
    rubric: `
      Current scheduling flow: admin navigates to dashboard → opens jobs tab → finds unassigned jobs →
      opens crew panel → cross-references availability → manually assigns → saves each.
      Analyse: click count to assign a single job, context switches required, whether crew
      availability is visible without leaving the job row, time-zone/date ambiguity, whether the
      run-sheet view supports landscape scanning (time on X-axis, crew on Y), drag-to-assign
      affordance, bulk assignment for recurring jobs, weather-impact warnings inline.`,
  },
  {
    id: 'quote-management',
    label: 'Quote Management',
    pages: ['/dashboard/quotes', '/dashboard/orders'],
    workflow: 'New quote → triage → price → send → follow-up → accept → convert to order',
    designGoal: 'Single-pane pipeline with inline editing, status colour-coding, one-click follow-up.',
    rubric: `
      Analyse: how many clicks to move a quote from "new" to "sent", whether the admin can see
      customer notes + suburb + service + estimated value in one row without expanding, follow-up
      scheduling friction, bulk accept/decline, time-to-decision visibility (how long each quote
      has been in its current status), NDIS flag visibility, agent_triaged_at surfacing so admin
      knows what the AI already did, quote-to-order conversion trigger friction.`,
  },
  {
    id: 'crew-onboarding',
    label: 'Crew Onboarding',
    pages: ['/dashboard/crew', '/dashboard/crew/applicants'],
    workflow: 'Application → review → interview → police check → document upload → activate',
    designGoal: 'Checklist-style progress tracker with stage gating; document status at a glance.',
    rubric: `
      Analyse: steps between applicant submission and crew activation, document collection
      friction (what gets uploaded vs chased manually), police check tracking (manual vs
      integrated), comms touchpoints (how many separate actions to send stage-change messages),
      whether the pipeline view shows completeness percentage per applicant, time-in-stage
      visibility, NDIS worker registration tracking alongside standard onboarding.`,
  },
  {
    id: 'repetitive-tasks',
    label: 'Repetitive Task Identification',
    pages: ['/dashboard', '/dashboard/automations'],
    workflow: 'Daily admin → identify repeated manual actions → propose automation recipes',
    designGoal: 'Every recurring task with >3 instances/week should have a one-click automation.',
    rubric: `
      Analyse which admin actions recur most in job management (reschedule notifications,
      follow-up emails, end-of-day summaries, payable reconciliation, weekly crew availability
      checks). Score each by: frequency per week, time cost per instance, error rate, and
      automation feasibility. Compare against the automations already enabled in site_settings
      (lapsed_win_back, scheduling_cron, etc.) to find gaps. Generate automation proposals
      with estimated weekly time savings.`,
  },
  {
    id: 'operational-dashboard',
    label: 'Operational Dashboard Clarity',
    pages: ['/dashboard', '/dashboard/reports', '/dashboard/agents'],
    workflow: 'Admin opens dashboard → orients → takes action in < 3 clicks',
    designGoal: 'No KPI card takes more than 2 seconds to interpret; every card leads to one action.',
    rubric: `
      Analyse: KPI card information density (is the delta vs last period shown?), whether the
      most-urgent item (overdue jobs, unanswered quotes, failed agent runs) is surfaced above the
      fold, tab organisation (too many tabs vs too few), agent approval queue visibility from
      the main dashboard without navigating away, financial summary completeness (receivables +
      payables + net in one view), report export friction (PDF/CSV in one click).`,
  },
] as const;

type FocusAreaId = (typeof FOCUS_AREAS)[number]['id'];

// ── LLM system prompts ────────────────────────────────────────────────────────

const ANALYSIS_SYSTEM = `You are the Admin Optimization Agent for Buds At Work — a local home
services business (cleaning, yard care, car detailing, window cleaning, laundry) in Logan &
South Brisbane. You analyse internal admin workflows and produce structured optimization findings.

Design philosophy to apply in every proposal:
  • landscape-first layouts — time/status on X-axis, entities on Y-axis
  • operational clarity — one glance = full context, no drilling required
  • low visual noise — remove decorative UI, favour data density
  • rapid scanning — colour-coded status badges, bold deltas, compact rows
  • minimal clicks — ≤3 clicks from dashboard to any action

For the given focus area, analyse the workflow using the rubric and any operational data provided.
Return strict JSON only:

{
  "findings": [
    {
      "id": "unique-kebab-slug",
      "title": "Concise finding title",
      "friction_score": {
        "clicks": number,
        "context_switches": number,
        "manual_steps": number,
        "error_prone": number
      },
      "severity": "low" | "medium" | "high" | "critical",
      "priority": "P0" | "P1" | "P2" | "P3",
      "category": "scheduling" | "quoting" | "onboarding" | "automation" | "dashboard" | "reporting" | "comms",
      "affected_pages": ["..."],
      "current_flow": "Step-by-step description of the painful current workflow",
      "proposed_flow": "Step-by-step description of the optimised workflow",
      "workflow_diagram": "Mermaid flowchart string (graph LR or TD). Escape quotes as \\\".",
      "body": "Detailed markdown analysis including pain points, data evidence, and design rationale",
      "proposed_change": {
        "what": "What should change",
        "where": "Specific page, component, or API endpoint",
        "design_pattern": "Specific UI pattern (e.g. inline edit, drag-assign, kanban column)",
        "clicks_saved": number,
        "estimated_time_saved_min_per_week": number
      },
      "automation_candidate": boolean,
      "automation_recipe": "If automatable, describe the trigger → action → outcome",
      "is_recurring": boolean,
      "recurrence_note": "If seen before, reference prior instance",
      "backlinks": ["[[/dashboard]]", "[[Quote Pipeline]]"]
    }
  ],
  "workflow_summary": "1–2 sentences on the dominant friction theme in this area.",
  "quick_wins": ["Actionable one-liner tasks completable in < 2 hours each"],
  "automation_candidates": ["High-value repetitive tasks suitable for automation recipes"]
}

Priority rules:
  P0 = Critical: blocks daily operations or costs > 30 min/day
  P1 = High: significant friction > 10 min/day or recurring errors
  P2 = Medium: annoying but workable, < 10 min/day
  P3 = Low: polish — nice-to-have

Output only the JSON object. No prose, no fences.`;

const SYNTHESIS_SYSTEM = `You are synthesising admin optimization findings for Buds At Work across
5 operational focus areas. Produce a cross-area operational intelligence report. Return strict JSON:

{
  "friction_map": [
    {
      "workflow": "Name of workflow",
      "current_click_count": number,
      "target_click_count": number,
      "friction_score": number,
      "band": "low" | "medium" | "high" | "critical",
      "top_fix": "Single highest-impact change"
    }
  ],
  "automation_shortlist": [
    {
      "task": "Task name",
      "frequency_per_week": number,
      "minutes_per_instance": number,
      "weekly_minutes_saved": number,
      "trigger": "What triggers it",
      "action": "What it does",
      "feasibility": "trivial" | "moderate" | "complex"
    }
  ],
  "redesign_priorities": [
    {
      "priority": "P0" | "P1" | "P2" | "P3",
      "component": "Page or component to redesign",
      "pattern": "Recommended UI pattern",
      "rationale": "Why this pattern fits the design philosophy"
    }
  ],
  "executive_summary": "3–4 sentences: top friction sources, highest-ROI automation, and lead redesign recommendation."
}

Output only the JSON object. No prose, no fences.`;

// ── Types ─────────────────────────────────────────────────────────────────────

interface AreaFinding {
  id: string;
  title: string;
  friction_score: { clicks: number; context_switches: number; manual_steps: number; error_prone: number };
  severity: string;
  priority: string;
  category: string;
  affected_pages: string[];
  current_flow: string;
  proposed_flow: string;
  workflow_diagram: string;
  body: string;
  proposed_change: {
    what: string;
    where: string;
    design_pattern: string;
    clicks_saved: number;
    estimated_time_saved_min_per_week: number;
  };
  automation_candidate: boolean;
  automation_recipe: string;
  is_recurring: boolean;
  recurrence_note: string;
  backlinks: string[];
}

interface AreaResult {
  areaId: FocusAreaId;
  findings: AreaFinding[];
  workflow_summary: string;
  quick_wins: string[];
  automation_candidates: string[];
}

interface SynthesisResult {
  friction_map: Array<{
    workflow: string;
    current_click_count: number;
    target_click_count: number;
    friction_score: number;
    band: string;
    top_fix: string;
  }>;
  automation_shortlist: Array<{
    task: string;
    frequency_per_week: number;
    minutes_per_instance: number;
    weekly_minutes_saved: number;
    trigger: string;
    action: string;
    feasibility: string;
  }>;
  redesign_priorities: Array<{
    priority: string;
    component: string;
    pattern: string;
    rationale: string;
  }>;
  executive_summary: string;
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

function bandToFindingSeverity(band: string): 'critical' | 'warning' | 'info' {
  if (band === 'critical') return 'critical';
  if (band === 'high') return 'warning';
  return 'info';
}

// ── Agent ─────────────────────────────────────────────────────────────────────

export const adminOptimizationAgent: AgentDefinition = {
  id: 'admin-optimization',
  name: 'Admin Optimization',
  description:
    'Operational intelligence for the admin surface: friction scoring, workflow mapping, ' +
    'automation candidates, and landscape-first redesign proposals. Stores findings in Obsidian.',
  category: 'ops',
  autonomy: 'review',
  schedule: '0 7 * * 3', // Wednesday 7 am AEST

  schema_dependencies: ['quotes', 'orders', 'agent_runs', 'applicants', 'admin_optimization_findings'],
  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const now = new Date().toISOString().slice(0, 10);
    ctx.log('Admin Optimization Agent starting', { date: now, runId: ctx.runId });

    // ── 1. Gather operational metrics from Supabase ───────────────────────

    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo  = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { data: quoteStats },
      { data: jobStats },
      { data: agentRunStats },
      { data: recentApplicants },
      { data: recentOrders },
    ] = await Promise.all([
      // Quote pipeline shape
      ctx.supabase
        .from('quotes')
        .select('id, status, created_at, agent_triaged_at, agent_estimate_aud')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(100),

      // Job scheduling gaps (jobs == orders in the live schema)
      ctx.supabase
        .from('orders')
        .select('id, status, service_type, assigned_crew_id, created_at')
        .gte('created_at', fourteenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(100),

      // Agent automation health
      ctx.supabase
        .from('agent_runs')
        .select('agent_id, status, cost_cents, duration_ms, created_at')
        .gte('created_at', fourteenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(50),

      // Onboarding pipeline
      ctx.supabase
        .from('applicants')
        .select('id, status, created_at, updated_at')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(30),

      // Order completion
      ctx.supabase
        .from('orders')
        .select('id, status, service_type, created_at')
        .gte('created_at', fourteenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    // Compute quick operational stats for LLM context
    const quotes = (quoteStats ?? []) as Array<Record<string, unknown>>;
    const jobs   = (jobStats ?? []) as Array<Record<string, unknown>>;
    const runs   = (agentRunStats ?? []) as Array<Record<string, unknown>>;

    const quotePipelineStats = {
      total: quotes.length,
      by_status: countBy(quotes, 'status'),
      pct_triaged: quotes.length > 0
        ? Math.round((quotes.filter((q) => q.agent_triaged_at).length / quotes.length) * 100)
        : 0,
      avg_estimate_aud: avg(quotes.map((q) => Number(q.agent_estimate_aud ?? 0)).filter((n) => n > 0)),
    };

    const jobSchedulingStats = {
      total: jobs.length,
      by_status: countBy(jobs, 'status'),
      unassigned: jobs.filter((j) => !j.assigned_crew_id).length,
      by_service: countBy(jobs, 'service_type'),
    };

    const agentHealthStats = {
      total_runs: runs.length,
      succeeded: runs.filter((r) => r.status === 'succeeded').length,
      failed: runs.filter((r) => r.status === 'failed').length,
      by_agent: countBy(runs, 'agent_id'),
    };

    const applicants = (recentApplicants ?? []) as Array<Record<string, unknown>>;
    const onboardingStats = {
      total: applicants.length,
      by_status: countBy(applicants, 'status'),
      avg_days_in_pipeline: avgDaysInPipeline(applicants),
    };

    const orders = (recentOrders ?? []) as Array<Record<string, unknown>>;
    const orderStats = {
      total: orders.length,
      by_status: countBy(orders, 'status'),
    };

    const operationalData = {
      quotes: quotePipelineStats,
      jobs: jobSchedulingStats,
      agent_health: agentHealthStats,
      onboarding: onboardingStats,
      orders: orderStats,
    };

    ctx.log('Operational metrics gathered', operationalData);

    // ── 2. Semantic memory recall per focus area ──────────────────────────

    const memoryByArea: Record<string, string[]> = {};
    for (const area of FOCUS_AREAS) {
      const results = await ctx.memory.search(
        `Admin workflow pain point: ${area.label} — ${area.rubric.trim().slice(0, 120)}`,
        { category: 'admin', agentScope: 'admin-optimization', threshold: 0.65, limit: 5 },
      );
      memoryByArea[area.id] = results.map(
        (r) =>
          `**${r.title}** (similarity ${r.similarity.toFixed(2)})\n` +
          r.body.slice(0, 350),
      );
    }

    // ── 3. Analyse each focus area in parallel ────────────────────────────

    const areaResults: AreaResult[] = await Promise.all(
      FOCUS_AREAS.map(async (area): Promise<AreaResult> => {
        const historicalMemory = memoryByArea[area.id] ?? [];

        // Pick the slice of operational data relevant to this area
        const relevantData =
          area.id === 'scheduling-ux'         ? { jobs: jobSchedulingStats } :
          area.id === 'quote-management'      ? { quotes: quotePipelineStats, orders: orderStats } :
          area.id === 'crew-onboarding'       ? { onboarding: onboardingStats } :
          area.id === 'repetitive-tasks'      ? { agent_health: agentHealthStats, jobs: jobSchedulingStats } :
          /* operational-dashboard */           operationalData;

        const prompt = [
          `Focus area: ${area.label}`,
          `Affected pages: ${area.pages.join(', ')}`,
          `Workflow: ${area.workflow}`,
          `Design goal: ${area.designGoal}`,
          `Rubric: ${area.rubric.trim()}`,
          '',
          `### Operational Data (last 14–30 days)\n\`\`\`json\n${JSON.stringify(relevantData, null, 2)}\n\`\`\``,
          '',
          historicalMemory.length > 0
            ? `### Historical Admin Memory (${historicalMemory.length} entries)\n\n${historicalMemory.join('\n\n')}`
            : '### Historical Memory\nNo prior entries for this area.',
          '',
          'Analyse and return the JSON findings object.',
        ].join('\n');

        const raw = await ctx.llm(prompt, { system: ANALYSIS_SYSTEM });

        try {
          const parsed = JSON.parse(raw) as {
            findings: AreaFinding[];
            workflow_summary: string;
            quick_wins: string[];
            automation_candidates: string[];
          };
          return {
            areaId: area.id,
            findings: parsed.findings ?? [],
            workflow_summary: parsed.workflow_summary ?? '',
            quick_wins: parsed.quick_wins ?? [],
            automation_candidates: parsed.automation_candidates ?? [],
          };
        } catch {
          ctx.log(`Parse failed for area ${area.id}`, { rawHead: raw.slice(0, 300) });
          return { areaId: area.id, findings: [], workflow_summary: '', quick_wins: [], automation_candidates: [] };
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
          finding_count: r.findings.length,
          workflow_summary: r.workflow_summary,
          automation_candidates: r.automation_candidates,
          friction_scores: r.findings.map((f) => ({
            title: f.title,
            priority: f.priority,
            score_total:
              f.friction_score.clicks * 2 +
              f.friction_score.context_switches * 3 +
              f.friction_score.manual_steps * 2 +
              f.friction_score.error_prone * 3,
            clicks_saved: f.proposed_change.clicks_saved,
            time_saved: f.proposed_change.estimated_time_saved_min_per_week,
          })),
        })),
        null,
        2,
      ),
      '',
      'Operational data snapshot:',
      JSON.stringify(operationalData, null, 2),
    ].join('\n');

    let synthesis: SynthesisResult = {
      friction_map: [],
      automation_shortlist: [],
      redesign_priorities: [],
      executive_summary: '',
    };

    try {
      const synthRaw = await ctx.llm(synthPrompt, { system: SYNTHESIS_SYSTEM });
      synthesis = JSON.parse(synthRaw) as SynthesisResult;
    } catch {
      ctx.log('Synthesis parse failed — continuing with area findings');
    }

    // ── 5. Persist findings ───────────────────────────────────────────────

    for (const f of allFindings) {
      const fs = scoreFriction(
        f.friction_score.clicks,
        f.friction_score.context_switches,
        f.friction_score.manual_steps,
        f.friction_score.error_prone,
      );

      // Supabase persistence
      await ctx.supabase.from('admin_optimization_findings').insert({
        agent_id: 'admin-optimization',
        run_id: ctx.runId,
        focus_area: f.areaId,
        page_path: f.affected_pages[0] ?? '/dashboard',
        category: f.category,
        title: f.title,
        body: f.body,
        severity: f.severity,
        priority: f.priority,
        friction_total: fs.total,
        friction_band: fs.band,
        clicks_saved: f.proposed_change.clicks_saved,
        time_saved_min_week: f.proposed_change.estimated_time_saved_min_per_week,
        automation_candidate: f.automation_candidate,
        automation_recipe: f.automation_recipe || null,
        proposed_change: f.proposed_change,
        workflow_diagram: f.workflow_diagram || null,
        is_recurring: f.is_recurring,
        evidence: {
          current_flow: f.current_flow,
          proposed_flow: f.proposed_flow,
          backlinks: f.backlinks,
          affected_pages: f.affected_pages,
        },
      });

      // Write high-friction findings to Obsidian memory for future recall
      if (fs.band === 'critical' || fs.band === 'high') {
        await ctx.memory.write({
          category: 'admin',
          title: `[${f.priority}] Admin friction: ${f.title}`,
          body: [
            f.body,
            '',
            `**Friction score:** ${fs.total}/20 (${fs.band}) — ${fs.clicks} clicks, ${fs.context_switches} context switches`,
            `**Time cost:** ~${f.proposed_change.estimated_time_saved_min_per_week} min/week to fix`,
            `**Proposed change:** ${f.proposed_change.what} (${f.proposed_change.design_pattern})`,
            f.automation_candidate ? `\n**Automation recipe:** ${f.automation_recipe}` : '',
            f.is_recurring ? `\n**Recurring.** ${f.recurrence_note}` : '',
            f.backlinks.length > 0 ? `\n${f.backlinks.join('  ')}` : '',
          ]
            .filter((l) => l !== '')
            .join('\n'),
          tags: ['admin-optimization', f.category, f.areaId, f.priority.toLowerCase(), fs.band],
          agentScope: 'admin-optimization',
          vaultPath: `admin/${now}-admin-opt-${f.id}.md`,
        });
      }
    }

    // ── 6. Propose actions for P0 / critical friction ─────────────────────

    const criticals = allFindings.filter(
      (f) =>
        f.priority === 'P0' ||
        scoreFriction(
          f.friction_score.clicks,
          f.friction_score.context_switches,
          f.friction_score.manual_steps,
          f.friction_score.error_prone,
        ).band === 'critical',
    );

    for (const f of criticals) {
      await ctx.proposeAction({
        action_type: 'admin_workflow_fix',
        payload: {
          finding_id: f.id,
          title: f.title,
          area: f.areaId,
          affected_pages: f.affected_pages,
          proposed_change: f.proposed_change,
          automation_candidate: f.automation_candidate,
          automation_recipe: f.automation_recipe,
          friction_score: f.friction_score,
        },
        preview: `[P0 Admin Fix] ${f.title} — saves ~${f.proposed_change.clicks_saved} clicks, ` +
                 `~${f.proposed_change.estimated_time_saved_min_per_week} min/week`,
        requiresApproval: true,
      });
    }

    // ── 7. Build Obsidian-structured output ───────────────────────────────

    const obsidianFindings: AgentFinding[] = areaResults.flatMap((areaResult) => {
      const area = FOCUS_AREAS.find((a) => a.id === areaResult.areaId)!;
      return areaResult.findings.map(
        (f): AgentFinding => ({
          title: `[${f.priority}] ${f.title}`,
          summary:
            `**Area:** ${area.label}` +
            ` | **Friction:** ${f.friction_score.clicks * 2 + f.friction_score.context_switches * 3 + f.friction_score.manual_steps * 2 + f.friction_score.error_prone * 3}/20` +
            ` | **Saves:** ${f.proposed_change.clicks_saved} clicks, ${f.proposed_change.estimated_time_saved_min_per_week} min/wk` +
            (f.automation_candidate ? ' | **Auto-candidate**' : ''),
          severity: bandToFindingSeverity(
            scoreFriction(
              f.friction_score.clicks,
              f.friction_score.context_switches,
              f.friction_score.manual_steps,
              f.friction_score.error_prone,
            ).band,
          ),
          systems: f.affected_pages,
          tags: [
            'admin-optimization',
            f.category,
            areaResult.areaId,
            f.priority.toLowerCase(),
            ...(f.automation_candidate ? ['automation-candidate'] : []),
            ...(f.is_recurring ? ['recurring'] : ['new-finding']),
          ],
          body: buildFindingBody(f, area.label),
        }),
      );
    });

    // Quick-win tasks
    const quickWinTasks: AgentTask[] = areaResults.flatMap((areaResult) =>
      areaResult.quick_wins.slice(0, 3).map(
        (win): AgentTask => ({
          title: win.slice(0, 80),
          context: `Quick win from Admin Optimization (run ${ctx.runId}) in area **${areaResult.areaId}**.`,
          priority: 'medium',
          systems: [areaResult.areaId],
          tags: ['admin-quick-win', areaResult.areaId],
          acceptanceCriteria: [
            win,
            'Verified by admin user on real device',
            'Click count confirmed ≤ target',
          ],
        }),
      ),
    );

    // Automation shortlist tasks
    const automationTasks: AgentTask[] = synthesis.automation_shortlist
      .filter((a) => a.feasibility === 'trivial' || a.feasibility === 'moderate')
      .slice(0, 6)
      .map(
        (a): AgentTask => ({
          title: `Automate: ${a.task}`,
          context:
            `Saves ~${a.weekly_minutes_saved} min/week (${a.frequency_per_week}× @ ${a.minutes_per_instance} min each).\n` +
            `**Trigger:** ${a.trigger}\n**Action:** ${a.action}\n**Feasibility:** ${a.feasibility}`,
          priority: a.weekly_minutes_saved >= 60 ? 'high' : 'medium',
          tags: ['automation', 'admin-optimization', a.feasibility],
          acceptanceCriteria: [
            `Trigger: ${a.trigger}`,
            `Action: ${a.action}`,
            'Add automation recipe to /dashboard/automations',
            `Confirm ${a.weekly_minutes_saved} min/week saved after 2 weeks`,
          ],
        }),
      );

    // Redesign tasks for P0/P1
    const redesignTasks: AgentTask[] = synthesis.redesign_priorities
      .filter((r) => r.priority === 'P0' || r.priority === 'P1')
      .map(
        (r): AgentTask => ({
          title: `[${r.priority}] Redesign: ${r.component}`,
          context: `Pattern: **${r.pattern}**\nRationale: ${r.rationale}`,
          priority: toTaskPriority(r.priority),
          tags: ['admin-redesign', r.priority.toLowerCase()],
          acceptanceCriteria: [
            `Implement ${r.pattern} on ${r.component}`,
            'Click-to-action count ≤ 3',
            'Landscape layout verified at 1280px+ width',
            'Tested with real admin user',
          ],
        }),
      );

    const obsidianTasks: AgentTask[] = [...redesignTasks, ...automationTasks, ...quickWinTasks];

    // Recurring / P0 as active issues
    const obsidianIssues: AgentIssue[] = allFindings
      .filter((f) => f.is_recurring || f.priority === 'P0')
      .slice(0, 10)
      .map(
        (f): AgentIssue => ({
          title: `${f.title}${f.is_recurring ? ' [RECURRING]' : ' [CRITICAL]'}`,
          description: f.body.slice(0, 700),
          impact:
            `Priority ${f.priority} — saves ${f.proposed_change.clicks_saved} clicks, ` +
            `~${f.proposed_change.estimated_time_saved_min_per_week} min/week`,
          severity: toIssueSeverity(f.severity),
          systems: f.affected_pages,
          tags: ['admin-issue', f.is_recurring ? 'recurring' : 'critical', f.areaId],
          stepsToReproduce: [
            `Navigate to ${f.affected_pages[0] ?? '/dashboard'}`,
            f.current_flow.split('\n')[0] ?? 'Attempt workflow',
            `Observe friction: ${f.proposed_change.where}`,
          ],
        }),
      );

    // ── 8. Summary ─────────────────────────────────────────────────────────

    const totalFindings = allFindings.length;
    const p0Count = allFindings.filter((f) => f.priority === 'P0').length;
    const p1Count = allFindings.filter((f) => f.priority === 'P1').length;
    const recurringCount = allFindings.filter((f) => f.is_recurring).length;
    const automationCount = allFindings.filter((f) => f.automation_candidate).length;
    const totalTimeSaved = allFindings.reduce(
      (sum, f) => sum + (f.proposed_change.estimated_time_saved_min_per_week ?? 0),
      0,
    );

    const summary = [
      `Admin optimization audit complete — ${totalFindings} findings across ${FOCUS_AREAS.length} focus areas.`,
      `P0: ${p0Count}, P1: ${p1Count}, recurring: ${recurringCount}.`,
      `${automationCount} automation candidates found. Total estimated time saving: ~${totalTimeSaved} min/week.`,
      synthesis.executive_summary || '',
    ]
      .filter(Boolean)
      .join(' ');

    ctx.log('Admin Optimization complete', {
      total: totalFindings,
      p0: p0Count,
      automationCandidates: automationCount,
      totalTimeSaved,
    });

    return {
      summary,
      output: {
        findings: obsidianFindings,
        tasks: obsidianTasks,
        issues: obsidianIssues,
        admin_optimization: {
          run_date: now,
          total_findings: totalFindings,
          p0_count: p0Count,
          recurring_count: recurringCount,
          automation_candidates: automationCount,
          total_time_saved_min_week: totalTimeSaved,
          friction_map: synthesis.friction_map,
          automation_shortlist: synthesis.automation_shortlist,
          redesign_priorities: synthesis.redesign_priorities,
          executive_summary: synthesis.executive_summary,
          operational_snapshot: operationalData,
          area_summaries: areaResults.map((r) => ({
            area: r.areaId,
            finding_count: r.findings.length,
            workflow_summary: r.workflow_summary,
            automation_candidates: r.automation_candidates,
          })),
        },
      },
    };
  },
};

// ── Body builder ──────────────────────────────────────────────────────────────

function buildFindingBody(f: AreaFinding, areaLabel: string): string {
  const fs = scoreFriction(
    f.friction_score.clicks,
    f.friction_score.context_switches,
    f.friction_score.manual_steps,
    f.friction_score.error_prone,
  );

  const lines: string[] = [
    `**Area:** ${areaLabel}  |  **Category:** ${f.category}  |  **Friction:** ${fs.total}/20 (${fs.band})`,
    `**Affected pages:** ${f.affected_pages.join(', ')}`,
    '',
    f.body,
    '',
    '## Current Flow',
    f.current_flow,
    '',
    '## Proposed Flow',
    f.proposed_flow,
  ];

  if (f.workflow_diagram) {
    lines.push(
      '',
      '## Workflow Diagram',
      '```mermaid',
      f.workflow_diagram,
      '```',
    );
  }

  lines.push(
    '',
    '## Proposed Change',
    `**What:** ${f.proposed_change.what}`,
    `**Where:** ${f.proposed_change.where}`,
    `**UI pattern:** ${f.proposed_change.design_pattern}`,
    `**Clicks saved:** ${f.proposed_change.clicks_saved}`,
    `**Time saved:** ~${f.proposed_change.estimated_time_saved_min_per_week} min/week`,
  );

  if (f.automation_candidate && f.automation_recipe) {
    lines.push('', '## Automation Recipe', f.automation_recipe);
  }

  if (f.is_recurring) {
    lines.push('', '## Recurrence', f.recurrence_note);
  }

  if (f.backlinks.length > 0) {
    lines.push('', '## Backlinks', f.backlinks.join('  \n'));
  }

  return lines.join('\n');
}

// ── Stat helpers ──────────────────────────────────────────────────────────────

function countBy(rows: Array<Record<string, unknown>>, key: string): Record<string, number> {
  const map: Record<string, number> = {};
  for (const row of rows) {
    const val = String(row[key] ?? 'unknown');
    map[val] = (map[val] ?? 0) + 1;
  }
  return map;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function avgDaysInPipeline(rows: Array<Record<string, unknown>>): number {
  const deltas = rows
    .map((r) => {
      const created = new Date(r.created_at as string).getTime();
      const updated = new Date((r.updated_at ?? r.created_at) as string).getTime();
      return (updated - created) / 86_400_000;
    })
    .filter((d) => d >= 0);
  return Math.round(avg(deltas));
}
