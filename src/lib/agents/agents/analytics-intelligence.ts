/**
 * Analytics Intelligence Agent — autonomous multi-source analytics synthesis.
 *
 * Data sources (in priority order):
 *   1. PostHog Data API    — funnel stages, abandonment, CTA CTR, rage clicks
 *   2. Internal Supabase   — visitor_events, analytics_sessions, page_views
 *   3. design_insights     — cross-reference with UX findings (ux-intelligence)
 *   4. admin_optimization  — admin bottleneck signals
 *   5. github_events       — deployment correlation (traffic dips after deploy?)
 *
 * Obsidian output (via logAgentRun workspace):
 *   · Reports   → Agents/Analytics-Agent/Reports/
 *   · Findings  → Agents/Analytics-Agent/Findings/
 *   · Tasks     → Agents/Analytics-Agent/Tasks/
 *
 * Supabase output:
 *   · analytics_reports    — periodic report snapshots
 *   · analytics_findings   — individual findings (queryable by agent/system)
 *
 * Schedule: Wednesday 7 AM AEST (mid-week so it covers Mon–Tue traffic)
 */
import type { AgentDefinition, AgentContext, AgentRunResult } from '../types';
import type { AgentFinding, AgentTask, AgentIssue } from '@/lib/memory/agents/types';
import {
  isPostHogConfigured,
  getQuoteFunnel,
  getAbandonmentBreakdown,
  getCtaPerformance,
  getEventTrend,
  getMobileDropOffCount,
  getSessionRecordingSummary,
} from '@/lib/analytics/providers/posthog-api';

// ── LLM prompts ───────────────────────────────────────────────────────────────

const ANALYSIS_SYSTEM = `You are the Analytics Intelligence Agent for Buds At Work — a local
home-services platform (cleaning, yard care, car detailing, window cleaning, laundry, NDIS)
serving Logan & South Brisbane.

You receive a structured analytics snapshot covering:
  · Quote funnel performance (PostHog)
  · CTA click-through rates (PostHog)
  · Abandonment patterns (PostHog)
  · Rage-click session counts (PostHog/Clarity)
  · Internal session + event data (Supabase)
  · Admin workflow signals
  · Mobile drop-off counts
  · Recent deployment history (for correlation)
  · Prior UX Intelligence findings (for cross-referencing)

Return strict JSON only — no prose, no fences:

{
  "findings": [
    {
      "id": "unique-kebab-slug",
      "title": "Concise finding title",
      "category": "funnel" | "cta" | "rage-click" | "admin-bottleneck" | "mobile" | "drop-off" | "deployment-impact",
      "severity": "low" | "medium" | "high" | "critical",
      "priority": "P0" | "P1" | "P2" | "P3",
      "metric": "e.g. 43% step-2 abandonment, 2.1% CTA CTR",
      "body": "Detailed markdown. What the data shows, why it matters for revenue/ops, what is likely causing it.",
      "proposed_action": {
        "what": "Specific fix or experiment to run",
        "where": "Component, page, or workflow affected",
        "expected_impact": "Quantified or qualified expected improvement"
      },
      "affected_systems": ["/services", "Quote Wizard", "Admin Dashboard"],
      "backlinks": ["[[UX-Agent]]", "[[Quote Wizard]]", "[[/services]]"],
      "correlates_with_deployment": false,
      "deployment_note": "If correlates_with_deployment, what changed"
    }
  ],
  "funnel_health": {
    "overall_conversion_rate": number,
    "weakest_step": number,
    "weakest_step_dropout_pct": number,
    "recommendation": "1 sentence on the highest-leverage funnel change"
  },
  "cta_health": {
    "weakest_cta": "cta_id or 'none'",
    "weakest_ctr_pct": number,
    "strongest_cta": "cta_id or 'none'",
    "recommendation": "1 sentence"
  },
  "mobile_health": {
    "drop_off_count": number,
    "rage_click_sessions": number,
    "recommendation": "1 sentence"
  },
  "deployment_correlation": {
    "detected": boolean,
    "description": "null or brief description of the suspected correlation"
  },
  "executive_summary": "3–4 sentences: most critical finding, biggest funnel leak, top recommendation, and whether deployment risk is detected."
}

Priority rules:
  P0 = Critical: direct revenue loss, complete funnel blockage, or post-deploy regression
  P1 = High: significant abandonment spike, rage clicks on CTA, admin workflow >2min avg
  P2 = Medium: noticeable friction with workaround available
  P3 = Low: polish / optimisation

Output only the JSON object.`;

const TREND_SYSTEM = `You are the Analytics Intelligence Agent comparing the current analytics
snapshot to historical memory from prior weeks. Given the current report and retrieved
historical patterns, identify:

1. Improving metrics (positive trends)
2. Degrading metrics (negative trends — flag if P1 or worse)
3. Persistent patterns that have appeared in 2+ consecutive reports

Return strict JSON only:

{
  "trends": [
    {
      "metric": "metric name",
      "direction": "improving" | "degrading" | "stable",
      "magnitude": "small" | "medium" | "large",
      "description": "1 sentence with the actual numbers",
      "is_persistent": boolean,
      "weeks_observed": number
    }
  ],
  "regression_alerts": [
    "Plain-text alert description for any metric that has newly degraded vs prior period"
  ],
  "trend_summary": "2 sentences summarising overall trajectory."
}

Output only the JSON object.`;

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnalyticsFinding {
  id: string;
  title: string;
  category: string;
  severity: string;
  priority: string;
  metric: string;
  body: string;
  proposed_action: { what: string; where: string; expected_impact: string };
  affected_systems: string[];
  backlinks: string[];
  correlates_with_deployment: boolean;
  deployment_note?: string;
}

interface TrendResult {
  trends: Array<{
    metric: string;
    direction: string;
    magnitude: string;
    description: string;
    is_persistent: boolean;
    weeks_observed: number;
  }>;
  regression_alerts: string[];
  trend_summary: string;
}

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

function buildFindingBody(f: AnalyticsFinding): string {
  const lines = [
    `**Category:** ${f.category}  |  **Metric:** ${f.metric}`,
    `**Affected systems:** ${f.affected_systems.join(', ')}`,
    '',
    f.body,
    '',
    '## Proposed Action',
    `**What:** ${f.proposed_action.what}`,
    `**Where:** ${f.proposed_action.where}`,
    `**Expected impact:** ${f.proposed_action.expected_impact}`,
  ];

  if (f.correlates_with_deployment && f.deployment_note) {
    lines.push('', '## Deployment Correlation', f.deployment_note);
  }

  if (f.backlinks.length > 0) {
    lines.push('', '## Backlinks', f.backlinks.join('  \n'));
  }

  return lines.join('\n');
}

// ── Agent definition ──────────────────────────────────────────────────────────

export const analyticsIntelligenceAgent: AgentDefinition = {
  id: 'analytics-intelligence',
  name: 'Analytics Intelligence',
  description:
    'Multi-source analytics synthesis: PostHog funnels, Clarity rage clicks, internal sessions. ' +
    'Detects quote abandonment, weak CTAs, admin bottlenecks, mobile drop-offs, and deployment regressions. ' +
    'Stores findings in Obsidian with UX and deployment backlinks.',
  category: 'ops',
  autonomy: 'review',
  schedule: '0 7 * * 3', // Wednesday 7 AM AEST

  schema_dependencies: [
    'visitor_events', 'analytics_sessions', 'github_events',
    'design_insights', 'admin_optimization_findings', 'analytics_reports', 'analytics_findings',
  ],
  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const now = new Date().toISOString().slice(0, 10);
    const LOOKBACK_DAYS = 14;

    ctx.log('Analytics Intelligence Agent starting', { date: now, lookback: LOOKBACK_DAYS });

    // ── 1. Fetch PostHog data (skip gracefully if not configured) ─────────

    const phStatus = isPostHogConfigured();
    ctx.log('PostHog status', phStatus);

    let funnelSteps = null;
    let abandonmentBreakdown = null;
    let ctaPerformance = null;
    let quoteSubmitTrend = null;
    let mobileDropOffs = 0;
    let sessionRecordings = null;

    if (phStatus.available) {
      try {
        [funnelSteps, abandonmentBreakdown, ctaPerformance, quoteSubmitTrend, mobileDropOffs, sessionRecordings] =
          await Promise.allSettled([
            getQuoteFunnel(LOOKBACK_DAYS),
            getAbandonmentBreakdown(LOOKBACK_DAYS),
            getCtaPerformance(LOOKBACK_DAYS),
            getEventTrend('quote_submitted', LOOKBACK_DAYS),
            getMobileDropOffCount(LOOKBACK_DAYS),
            getSessionRecordingSummary(7),
          ]).then((results) =>
            results.map((r) => (r.status === 'fulfilled' ? r.value : null)),
          ) as [typeof funnelSteps, typeof abandonmentBreakdown, typeof ctaPerformance, typeof quoteSubmitTrend, number, typeof sessionRecordings];
      } catch (err) {
        ctx.log('PostHog fetch failed', { err: String(err) });
      }
    }

    // ── 2. Fetch internal Supabase analytics ─────────────────────────────

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const [
      { data: visitorEvents },
      { data: recentSessions },
      { data: recentDeployments },
      { data: designInsights },
      { data: adminFindings },
    ] = await Promise.all([
      ctx.supabase
        .from('visitor_events')
        .select('event_name, event_data, created_at')
        .gte('created_at', fourteenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(500),
      ctx.supabase
        .from('analytics_sessions')
        .select('device_type, pages_visited, session_duration_s, bounce, created_at')
        .gte('created_at', sevenDaysAgo)
        .limit(1000),
      ctx.supabase
        .from('github_events')
        .select('event_type, action, metadata, created_at')
        .eq('event_type', 'deployment_status')
        .gte('created_at', fourteenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(20),
      ctx.supabase
        .from('design_insights')
        .select('page_path, insight_type, title, severity, created_at')
        .gte('created_at', fourteenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(20),
      ctx.supabase
        .from('admin_optimization_findings')
        .select('title, friction_score, category, status, created_at')
        .in('status', ['new', 'reviewing'])
        .order('friction_score', { ascending: false })
        .limit(10),
    ]);

    // ── 3. Compute internal metrics ───────────────────────────────────────

    const sessions = recentSessions ?? [];
    const totalSessions = sessions.length;
    const mobileSessions = sessions.filter(
      (s) => (s as Record<string, unknown>).device_type === 'mobile',
    ).length;
    const bouncedSessions = sessions.filter((s) => (s as Record<string, unknown>).bounce).length;
    const mobileBouncePct =
      mobileSessions > 0
        ? Math.round(
            (sessions.filter(
              (s) =>
                (s as Record<string, unknown>).device_type === 'mobile' &&
                (s as Record<string, unknown>).bounce,
            ).length /
              mobileSessions) *
              100,
          )
        : 0;

    const eventCounts: Record<string, number> = {};
    for (const e of visitorEvents ?? []) {
      const name = (e as Record<string, unknown>).event_name as string;
      eventCounts[name] = (eventCounts[name] ?? 0) + 1;
    }

    // ── 4. Semantic memory recall — prior analytics patterns ──────────────

    const historicalMemory = await ctx.memory.search(
      'analytics funnel abandonment CTA conversion mobile drop-off rage click admin bottleneck',
      { category: 'analytics', agentScope: 'analytics-intelligence', threshold: 0.60, limit: 8 },
    );

    const historyText = historicalMemory
      .map(
        (m) =>
          `**${m.title}** (${new Date(m.created_at).toISOString().slice(0, 10)}, sim ${m.similarity.toFixed(2)})\n` +
          m.body.slice(0, 400),
      )
      .join('\n\n');

    // Also cross-reference UX findings
    const uxMemory = await ctx.memory.search(
      'UX friction quoting flow CTA mobile sticky footer abandonment',
      { category: 'ux', threshold: 0.65, limit: 6 },
    );
    const uxCrossRef = uxMemory
      .map((m) => `- [[UX]] **${m.title}**: ${m.body.slice(0, 200)}`)
      .join('\n');

    // ── 5. Build analytics snapshot for LLM ──────────────────────────────

    const snapshot = {
      period: `Last ${LOOKBACK_DAYS} days (ending ${now})`,
      posthog_available: phStatus.available,
      funnel: funnelSteps
        ? (funnelSteps as Array<Record<string, unknown>>).map((s) => ({
            step: s.name,
            count: s.count,
            conversion_rate: s.conversion_rate,
            dropout: s.dropout_count,
          }))
        : 'not available',
      abandonment_breakdown: abandonmentBreakdown ?? 'not available',
      cta_performance: ctaPerformance
        ? (ctaPerformance as Array<Record<string, unknown>>).slice(0, 10)
        : 'not available',
      quote_submit_trend: quoteSubmitTrend
        ? {
            total: (quoteSubmitTrend as { total: number }).total,
            trend: (quoteSubmitTrend as { data: Array<{ date: string; count: number }> }).data.slice(-7),
          }
        : 'not available',
      mobile_drop_offs_posthog: mobileDropOffs,
      session_recordings: sessionRecordings ?? 'not available',
      internal_sessions: {
        total: totalSessions,
        mobile_count: mobileSessions,
        mobile_bounce_pct: mobileBouncePct,
        overall_bounce_pct: totalSessions > 0 ? Math.round((bouncedSessions / totalSessions) * 100) : 0,
      },
      internal_event_counts: eventCounts,
      recent_deployments: (recentDeployments ?? []).slice(0, 5).map((d) => ({
        action: (d as Record<string, unknown>).action,
        created_at: (d as Record<string, unknown>).created_at,
        metadata: (d as Record<string, unknown>).metadata,
      })),
      open_ux_findings: (designInsights ?? []).map((i) => ({
        page: (i as Record<string, unknown>).page_path,
        type: (i as Record<string, unknown>).insight_type,
        title: (i as Record<string, unknown>).title,
        severity: (i as Record<string, unknown>).severity,
      })),
      open_admin_bottlenecks: (adminFindings ?? []).map((f) => ({
        title: (f as Record<string, unknown>).title,
        friction_score: (f as Record<string, unknown>).friction_score,
        category: (f as Record<string, unknown>).category,
      })),
    };

    const analysisPrompt = [
      '## Analytics Snapshot',
      JSON.stringify(snapshot, null, 2),
      '',
      historyText
        ? `## Historical Memory (${historicalMemory.length} entries)\n\n${historyText}`
        : '## Historical Memory\nNo prior analytics memories found.',
      '',
      uxCrossRef
        ? `## Cross-Reference: Open UX Findings\n\n${uxCrossRef}`
        : '## Cross-Reference: Open UX Findings\nNone in last 14 days.',
      '',
      'Analyse the snapshot and return the findings JSON.',
    ].join('\n');

    // ── 6. LLM analysis ───────────────────────────────────────────────────

    let findings: AnalyticsFinding[] = [];
    let funnelHealth: Record<string, unknown> = {};
    let ctaHealth: Record<string, unknown> = {};
    let mobileHealth: Record<string, unknown> = {};
    let deploymentCorrelation: { detected: boolean; description: string | null } = { detected: false, description: null };
    let executiveSummary = '';

    try {
      const raw = await ctx.llm(analysisPrompt, { system: ANALYSIS_SYSTEM });
      const parsed = JSON.parse(raw) as {
        findings: AnalyticsFinding[];
        funnel_health: Record<string, unknown>;
        cta_health: Record<string, unknown>;
        mobile_health: Record<string, unknown>;
        deployment_correlation: { detected: boolean; description: string | null };
        executive_summary: string;
      };
      findings = parsed.findings ?? [];
      funnelHealth = parsed.funnel_health ?? {};
      ctaHealth = parsed.cta_health ?? {};
      mobileHealth = parsed.mobile_health ?? {};
      deploymentCorrelation = parsed.deployment_correlation ?? { detected: false, description: null };
      executiveSummary = parsed.executive_summary ?? '';
    } catch (err) {
      ctx.log('Analysis LLM parse failed', { err: String(err) });
    }

    // ── 7. Trend analysis against historical memory ───────────────────────

    let trendResult: TrendResult = { trends: [], regression_alerts: [], trend_summary: '' };

    if (historicalMemory.length > 0) {
      const trendPrompt = [
        '## Current Report',
        JSON.stringify(
          {
            findings: findings.map((f) => ({ id: f.id, metric: f.metric, severity: f.severity, priority: f.priority })),
            funnel_health: funnelHealth,
            cta_health: ctaHealth,
            mobile_health: mobileHealth,
          },
          null,
          2,
        ),
        '',
        `## Historical Reports (${historicalMemory.length} entries)`,
        historyText,
      ].join('\n');

      try {
        const trendRaw = await ctx.llm(trendPrompt, { system: TREND_SYSTEM });
        trendResult = JSON.parse(trendRaw) as TrendResult;
      } catch {
        ctx.log('Trend LLM parse failed — proceeding without trend analysis');
      }
    }

    // ── 8. Persist to analytics_reports and analytics_findings ───────────

    const { data: reportRow } = await ctx.supabase
      .from('analytics_reports')
      .insert({
        run_id: ctx.runId,
        period_days: LOOKBACK_DAYS,
        period_end: now,
        executive_summary: executiveSummary,
        funnel_health: funnelHealth,
        cta_health: ctaHealth,
        mobile_health: mobileHealth,
        deployment_correlation: deploymentCorrelation,
        trend_summary: trendResult.trend_summary,
        regression_alerts: trendResult.regression_alerts,
        posthog_available: phStatus.available,
      })
      .select('id')
      .single();

    const reportId = reportRow?.id ?? null;

    let dbFindingsInserted = 0;
    for (const f of findings) {
      await ctx.supabase.from('analytics_findings').insert({
        report_id: reportId,
        run_id: ctx.runId,
        finding_id: f.id,
        category: f.category,
        title: f.title,
        severity: f.severity,
        priority: f.priority,
        metric: f.metric,
        body: f.body,
        proposed_action: f.proposed_action,
        affected_systems: f.affected_systems,
        backlinks: f.backlinks,
        correlates_with_deployment: f.correlates_with_deployment,
        deployment_note: f.deployment_note ?? null,
      });
      dbFindingsInserted += 1;

      // Write high-signal findings to Obsidian memory
      if (f.severity === 'critical' || f.severity === 'high') {
        await ctx.memory.write({
          category: 'analytics',
          title: `[${f.priority}] ${f.title}`,
          body: [
            buildFindingBody(f),
            '',
            `**Period:** ${now} (last ${LOOKBACK_DAYS}d)`,
            `**Metric:** ${f.metric}`,
          ].join('\n'),
          tags: ['analytics-intelligence', f.category, f.priority.toLowerCase(), now],
          agentScope: 'analytics-intelligence',
          vaultPath: `analytics/${now}-${f.id}.md`,
        });
      }
    }

    // ── 9. Propose P0 actions ─────────────────────────────────────────────

    const p0s = findings.filter((f) => f.priority === 'P0' || f.severity === 'critical');
    for (const f of p0s) {
      await ctx.proposeAction({
        action_type: 'analytics_fix_required',
        payload: {
          finding_id: f.id,
          category: f.category,
          metric: f.metric,
          affected_systems: f.affected_systems,
          proposed_action: f.proposed_action,
          correlates_with_deployment: f.correlates_with_deployment,
        },
        preview: `[P0 Analytics] ${f.title} — ${f.metric} — ${f.proposed_action.what}`,
        requiresApproval: true,
      });
    }

    // Flag deployment regression for immediate review
    if (deploymentCorrelation.detected) {
      await ctx.proposeAction({
        action_type: 'deployment_regression_detected',
        payload: {
          description: deploymentCorrelation.description,
          run_id: ctx.runId,
          period_end: now,
        },
        preview: `[Regression] Deployment correlation detected: ${deploymentCorrelation.description}`,
        requiresApproval: true,
      });
    }

    // ── 10. Build Obsidian output ─────────────────────────────────────────

    const obsidianFindings: AgentFinding[] = findings.map(
      (f): AgentFinding => ({
        title: `[${f.priority}] ${f.title}`,
        summary:
          `**Category:** ${f.category}  |  **Metric:** ${f.metric}` +
          (f.correlates_with_deployment ? '  |  ⚠ DEPLOYMENT CORRELATION' : ''),
        severity: toFindingSeverity(f.severity),
        systems: f.affected_systems,
        tags: ['analytics-intelligence', f.category, f.priority.toLowerCase()],
        body: buildFindingBody(f),
      }),
    );

    const obsidianTasks: AgentTask[] = [
      // P0/P1 actions as tasks
      ...findings
        .filter((f) => f.priority === 'P0' || f.priority === 'P1')
        .map(
          (f): AgentTask => ({
            title: `[${f.priority}] ${f.proposed_action.what.slice(0, 80)}`,
            context: `Analytics Intelligence (${now}) — **metric:** ${f.metric} | **impact:** ${f.proposed_action.expected_impact}`,
            priority: toTaskPriority(f.priority),
            systems: f.affected_systems,
            tags: ['analytics-task', f.category],
            acceptanceCriteria: [
              f.proposed_action.what,
              `Where: ${f.proposed_action.where}`,
              `Verify: ${f.proposed_action.expected_impact}`,
            ],
          }),
        ),
      // Trend regression alerts as tasks
      ...(trendResult.regression_alerts ?? []).map(
        (alert): AgentTask => ({
          title: `[REGRESSION] ${alert.slice(0, 80)}`,
          context: `Analytics trend regression detected in run ${ctx.runId} (${now}).`,
          priority: 'high',
          tags: ['analytics-regression'],
          acceptanceCriteria: ['Investigate root cause', 'Verify metrics return to baseline', 'Document resolution'],
        }),
      ),
    ];

    // Deployment regression + recurring P0 findings → Active-Issues
    const obsidianIssues: AgentIssue[] = [
      ...(deploymentCorrelation.detected
        ? [
            {
              title: `[REGRESSION] Deployment Impact Detected — ${now}`,
              description: deploymentCorrelation.description ?? 'Deployment correlated with metric degradation.',
              impact: 'Possible conversion regression following recent deploy.',
              severity: 'high' as const,
              systems: ['deployment', '/services'],
              tags: ['analytics-regression', 'deployment'],
            },
          ]
        : []),
      ...findings
        .filter((f) => f.priority === 'P0')
        .slice(0, 6)
        .map(
          (f): AgentIssue => ({
            title: `[P0] ${f.title}`,
            description: f.body.slice(0, 600),
            impact: `${f.metric} — ${f.proposed_action.expected_impact}`,
            severity: toIssueSeverity(f.severity),
            systems: f.affected_systems,
            tags: ['analytics-critical', f.category],
          }),
        ),
    ];

    // ── 11. Build Obsidian report document ────────────────────────────────

    const reportMd = [
      `# Analytics Intelligence Report — ${now}`,
      '',
      `> **Period:** Last ${LOOKBACK_DAYS} days  |  **PostHog:** ${phStatus.available ? '✓ connected' : '✗ not configured (internal data only)'}`,
      '',
      `## Executive Summary`,
      '',
      executiveSummary || '_No summary generated._',
      '',
      '## Funnel Health',
      '',
      '| Metric | Value |',
      '|--------|-------|',
      `| Overall conversion rate | ${funnelHealth.overall_conversion_rate ?? 'N/A'}% |`,
      `| Weakest step | Step ${funnelHealth.weakest_step ?? 'N/A'} (${funnelHealth.weakest_step_dropout_pct ?? 'N/A'}% dropout) |`,
      `| Recommendation | ${funnelHealth.recommendation ?? 'N/A'} |`,
      '',
      '## CTA Health',
      '',
      `- **Weakest CTA:** ${ctaHealth.weakest_cta ?? 'N/A'} (${ctaHealth.weakest_ctr_pct ?? 'N/A'}% CTR)`,
      `- **Strongest CTA:** ${ctaHealth.strongest_cta ?? 'N/A'}`,
      `- **Recommendation:** ${ctaHealth.recommendation ?? 'N/A'}`,
      '',
      '## Mobile Health',
      '',
      `- **Drop-offs:** ${mobileHealth.drop_off_count ?? 'N/A'}`,
      `- **Rage-click sessions:** ${mobileHealth.rage_click_sessions ?? 'N/A'}`,
      `- **Recommendation:** ${mobileHealth.recommendation ?? 'N/A'}`,
      '',
      deploymentCorrelation.detected
        ? `## ⚠ Deployment Correlation\n\n${deploymentCorrelation.description}\n`
        : '',
      '## Findings',
      '',
      ...findings.map(
        (f) =>
          `### [${f.priority}] ${f.title}\n` +
          `**Metric:** ${f.metric}  |  **Category:** ${f.category}  |  **Severity:** ${f.severity}\n\n` +
          f.body.slice(0, 500) +
          '\n',
      ),
      trendResult.trends.length > 0
        ? [
            '## Trend Analysis',
            '',
            trendResult.trend_summary,
            '',
            trendResult.trends
              .map(
                (t) =>
                  `- **${t.metric}:** ${t.direction} (${t.magnitude}) — ${t.description}` +
                  (t.is_persistent ? ` _(${t.weeks_observed}w persistent)_` : ''),
              )
              .join('\n'),
          ].join('\n')
        : '',
      '',
      '## Backlinks',
      '',
      '- [[UX-Agent]]',
      '- [[Quote Wizard]]',
      '- [[Admin Dashboard]]',
      '- [[/services]]',
      '- [[Dev/Deployments]]',
    ]
      .filter((l) => l !== undefined)
      .join('\n');

    // Write the full report to Obsidian memory
    await ctx.memory.write({
      category: 'analytics',
      title: `Analytics Intelligence Report — ${now}`,
      body: reportMd,
      tags: ['analytics-report', 'weekly', now],
      agentScope: 'analytics-intelligence',
      vaultPath: `analytics/reports/${now}-analytics-intelligence.md`,
    });

    // ── 12. Summary ───────────────────────────────────────────────────────

    const p0Count = findings.filter((f) => f.priority === 'P0').length;
    const p1Count = findings.filter((f) => f.priority === 'P1').length;
    const regressionCount = trendResult.regression_alerts?.length ?? 0;

    const summary = [
      `Analytics Intelligence complete — ${findings.length} findings (P0: ${p0Count}, P1: ${p1Count}).`,
      deploymentCorrelation.detected ? 'Deployment regression detected — proposed action queued.' : '',
      regressionCount > 0 ? `${regressionCount} trend regressions flagged.` : '',
      executiveSummary,
    ]
      .filter(Boolean)
      .join(' ');

    ctx.log('Analytics Intelligence complete', {
      findings: findings.length,
      p0: p0Count,
      p1: p1Count,
      dbInserted: dbFindingsInserted,
      regressions: regressionCount,
    });

    return {
      summary,
      output: {
        findings: obsidianFindings,
        tasks: obsidianTasks,
        issues: obsidianIssues,
        analytics_report: {
          run_date: now,
          period_days: LOOKBACK_DAYS,
          posthog_available: phStatus.available,
          total_findings: findings.length,
          p0_count: p0Count,
          p1_count: p1Count,
          funnel_health: funnelHealth,
          cta_health: ctaHealth,
          mobile_health: mobileHealth,
          deployment_correlation: deploymentCorrelation,
          executive_summary: executiveSummary,
          trend_summary: trendResult.trend_summary,
          regression_alerts: trendResult.regression_alerts,
        },
      },
    };
  },
};
