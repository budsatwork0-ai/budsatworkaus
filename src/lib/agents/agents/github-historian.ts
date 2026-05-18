/**
 * GitHub Historian Agent — weekly synthesis of implementation history.
 *
 * Sources:
 *   · memory_documents (categories: deployments, bugs, architecture, design)
 *     — written by the webhook handler as PRs / pushes / deployments arrive
 *   · github_events table — raw delivery log incl. ADR flags and deploy failures
 *   · agent_runs — to cross-reference what automation changes coincide with code changes
 *
 * Produces:
 *   · Implementation timeline (what shipped and when)
 *   · Architecture evolution summary (architectural + database changes)
 *   · Bug fix audit (recurring bugs, regression signals)
 *   · Rollback readiness assessment (recent failures, recovery time)
 *   · ADR flag resolution (outstanding architectural decisions needing docs)
 *
 * Obsidian output (via logAgentRun):
 *   · Findings  → Agents/Meta-Agent/Findings/   (and Dev/ folder via memory writes)
 *   · Tasks     → Agents/Meta-Agent/Tasks/       (ADR updates, doc tasks)
 *   · Issues    → Agents/Meta-Agent/Active-Issues/ (recurring failures, regressions)
 */
import type { AgentDefinition, AgentContext, AgentRunResult } from '../types';
import type { AgentFinding, AgentTask, AgentIssue } from '@/lib/memory/agents/types';
import { formatDeploymentNote } from '@/lib/github/formatter';

// ── LLM prompts ───────────────────────────────────────────────────────────────

const TIMELINE_SYSTEM = `You are the GitHub Historian for Buds At Work — a local home services
platform. You receive a week's worth of GitHub activity (PRs, commits, deployments) and produce
a structured implementation intelligence report. Return strict JSON only:

{
  "timeline": [
    {
      "date": "YYYY-MM-DD",
      "type": "feature" | "bug-fix" | "architecture" | "database" | "agent" | "ui" | "config",
      "title": "Concise title",
      "summary": "1-2 sentence description of what changed and why it matters",
      "systems": ["affected-system"],
      "is_notable": boolean,
      "backlinks": ["[[page-or-system]]"]
    }
  ],
  "architecture_changes": [
    {
      "title": "Architectural change title",
      "impact": "low" | "medium" | "high",
      "needs_adr": boolean,
      "adr_note": "If needs_adr, what the ADR should capture",
      "affected_systems": ["..."]
    }
  ],
  "bug_patterns": [
    {
      "pattern": "Description of recurring bug category",
      "occurrences": number,
      "affected_areas": ["..."],
      "recommendation": "How to prevent recurrence"
    }
  ],
  "deployment_health": {
    "total_deployments": number,
    "success_count": number,
    "failure_count": number,
    "avg_recovery_description": "e.g. same-day, next-day, or no failures",
    "rollback_readiness": "good" | "moderate" | "poor",
    "rollback_note": "1 sentence on rollback state"
  },
  "executive_summary": "3-4 sentences: what shipped, notable architecture changes, deployment health, and key recommendation."
}

Output only the JSON object. No prose, no fences.`;

const ADR_SYSTEM = `You are a senior architect reviewing flagged architectural changes for Buds At Work.
Given a list of recently merged PRs and pushes that touched architectural components, decide which
ones need an Architectural Decision Record (ADR).

For each item that needs an ADR, produce a draft ADR in markdown following this format:
# ADR-NNNN: [Title]

**Date:** YYYY-MM-DD
**Status:** proposed

## Context
[Why this decision was needed]

## Decision
[What was decided]

## Consequences
[Trade-offs and implications]

Return strict JSON:
{
  "adrs": [
    {
      "title": "...",
      "needs_adr": boolean,
      "draft": "full markdown ADR content",
      "related_prs": [number],
      "affected_systems": ["..."]
    }
  ]
}

Output only the JSON object. No prose, no fences.`;

// ── Agent ─────────────────────────────────────────────────────────────────────

export const githubHistorianAgent: AgentDefinition = {
  id: 'github-historian',
  name: 'GitHub Historian',
  description:
    'Weekly synthesis of GitHub activity into implementation timelines, architecture evolution, ' +
    'bug patterns, and rollback readiness. Writes to Obsidian Dev/ via memory.',
  category: 'ops',
  autonomy: 'review',
  schedule: '0 6 * * 5', // Friday 6 am AEST

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const now    = new Date().toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    ctx.log('GitHub Historian starting', { date: now });

    // ── 1. Pull week's GitHub activity from memory ────────────────────────

    const [prMemory, deployMemory, archMemory, bugMemory] = await Promise.all([
      ctx.memory.search('pull request merged feature bug fix', {
        category: 'deployments', agentScope: 'github-historian', threshold: 0.6, limit: 20,
      }),
      ctx.memory.search('deployment production success failure', {
        category: 'deployments', agentScope: 'github-historian', threshold: 0.6, limit: 10,
      }),
      ctx.memory.search('architectural change database migration schema', {
        category: 'architecture', agentScope: 'github-historian', threshold: 0.6, limit: 10,
      }),
      ctx.memory.search('bug fix error regression hotfix', {
        category: 'bugs', agentScope: 'github-historian', threshold: 0.6, limit: 10,
      }),
    ]);

    // ── 2. Pull raw events from Supabase ──────────────────────────────────

    const [{ data: githubEvents }, { data: adrFlags }, { data: deployFailures }] =
      await Promise.all([
        ctx.supabase
          .from('github_events')
          .select('event_type, action, repo, metadata, created_at')
          .gte('created_at', sevenDaysAgo)
          .in('event_type', ['pull_request', 'push', 'deployment_status', 'release'])
          .order('created_at', { ascending: false })
          .limit(50),

        ctx.supabase
          .from('github_events')
          .select('metadata, created_at')
          .eq('event_type', 'adr_flag')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(20),

        ctx.supabase
          .from('github_events')
          .select('metadata, created_at')
          .eq('event_type', 'deployment_failure')
          .gte('created_at', sevenDaysAgo)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

    // ── 3. Count stats for deployment health ─────────────────────────────

    const events = (githubEvents ?? []) as Array<Record<string, unknown>>;
    const deployEvents = events.filter((e) => e.event_type === 'deployment_status');
    const successCount  = deployEvents.filter((e) => e.action === 'success').length;
    const failureCount  = (deployFailures ?? []).length;

    // ── 4. Build LLM prompt ───────────────────────────────────────────────

    const allMemorySnippets = [
      ...prMemory,
      ...deployMemory,
      ...archMemory,
      ...bugMemory,
    ]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 30);

    const memoryContext = allMemorySnippets
      .map((m) => `[${m.created_at.slice(0, 10)}] **${m.title}** (${m.category})\n${m.body.slice(0, 300)}`)
      .join('\n\n---\n\n');

    const eventContext = events
      .slice(0, 20)
      .map((e) => `[${(e.created_at as string).slice(0, 10)}] ${e.event_type}/${e.action}: ${e.repo}`)
      .join('\n');

    const timelinePrompt = [
      `Period: ${sevenDaysAgo.slice(0, 10)} → ${now}`,
      `Repo: budsatwork`,
      '',
      `### GitHub Events (${events.length} this week)\n${eventContext || 'None'}`,
      '',
      `### Memory Documents (${allMemorySnippets.length} entries)\n\n${memoryContext || 'None'}`,
      '',
      `### Deployment Stats\nSuccessful: ${successCount} | Failed: ${failureCount}`,
      '',
      'Produce the implementation timeline JSON.',
    ].join('\n');

    let timeline: {
      timeline: Array<{
        date: string; type: string; title: string; summary: string;
        systems: string[]; is_notable: boolean; backlinks: string[];
      }>;
      architecture_changes: Array<{
        title: string; impact: string; needs_adr: boolean;
        adr_note: string; affected_systems: string[];
      }>;
      bug_patterns: Array<{
        pattern: string; occurrences: number;
        affected_areas: string[]; recommendation: string;
      }>;
      deployment_health: {
        total_deployments: number; success_count: number; failure_count: number;
        avg_recovery_description: string; rollback_readiness: string; rollback_note: string;
      };
      executive_summary: string;
    } = {
      timeline: [],
      architecture_changes: [],
      bug_patterns: [],
      deployment_health: {
        total_deployments: deployEvents.length,
        success_count: successCount,
        failure_count: failureCount,
        avg_recovery_description: failureCount === 0 ? 'no failures' : 'unknown',
        rollback_readiness: failureCount === 0 ? 'good' : 'moderate',
        rollback_note: 'Based on recent deployment history.',
      },
      executive_summary: '',
    };

    try {
      const raw = await ctx.llm(timelinePrompt, { system: TIMELINE_SYSTEM });
      timeline = JSON.parse(raw);
    } catch {
      ctx.log('Timeline parse failed — continuing with empty timeline');
    }

    // ── 5. ADR draft generation ───────────────────────────────────────────

    interface AdrDraft {
      title: string;
      needs_adr: boolean;
      draft: string;
      related_prs: number[];
      affected_systems: string[];
    }

    let adrDrafts: AdrDraft[] = [];

    const pendingAdrFlags = (adrFlags ?? []) as Array<Record<string, unknown>>;
    const archChangesNeedingAdr = timeline.architecture_changes.filter((c) => c.needs_adr);

    if (pendingAdrFlags.length > 0 || archChangesNeedingAdr.length > 0) {
      const adrPrompt = [
        'Pending ADR flags (from merged PRs):',
        JSON.stringify(pendingAdrFlags.map((f) => f.metadata).slice(0, 5), null, 2),
        '',
        'Architecture changes needing ADR (from this week):',
        JSON.stringify(archChangesNeedingAdr, null, 2),
        '',
        'Current ADR count: see Dev/ADR-Index.md. Next ADR number should increment from latest.',
        'Produce ADR drafts JSON.',
      ].join('\n');

      try {
        const adrRaw = await ctx.llm(adrPrompt, { system: ADR_SYSTEM });
        const parsed = JSON.parse(adrRaw) as { adrs: AdrDraft[] };
        adrDrafts = parsed.adrs ?? [];
      } catch {
        ctx.log('ADR draft parse failed');
      }
    }

    // ── 6. Write timeline + ADR drafts to memory ─────────────────────────

    // Implementation timeline note
    const timelineBody = buildTimelineNote(timeline, now);
    await ctx.memory.write({
      category:   'deployments',
      title:      `Implementation Timeline: week of ${now}`,
      body:       timelineBody,
      tags:       ['implementation-timeline', 'weekly', 'github'],
      agentScope: 'github-historian',
      vaultPath:  `Dev/Journal/${now}-weekly-timeline.md`,
      source:     'agent',
    });

    // ADR drafts → architecture folder
    for (const adr of adrDrafts.filter((a) => a.needs_adr)) {
      await ctx.memory.write({
        category:   'architecture',
        title:      `ADR Draft: ${adr.title}`,
        body:       `> [!note] Draft ADR — awaiting review and numbering.\n\n${adr.draft}`,
        tags:       ['adr', 'draft', 'needs-review'],
        agentScope: 'github-historian',
        vaultPath:  `Dev/ADR-Drafts/${now}-draft-${slugify(adr.title)}.md`,
        source:     'agent',
      });

      // Mark the ADR flags as addressed
      if (adr.related_prs?.length) {
        for (const prNum of adr.related_prs) {
          await ctx.supabase
            .from('github_events')
            .update({ status: 'processed' })
            .eq('event_type', 'adr_flag')
            .contains('metadata', { pr_number: prNum });
        }
      }
    }

    // ── 7. Deployment failure note if needed ──────────────────────────────

    const recentFailures = (deployFailures ?? []) as Array<Record<string, unknown>>;
    for (const failure of recentFailures.slice(0, 3)) {
      const meta = (failure.metadata as Record<string, string>) ?? {};
      const failureNote = formatDeploymentNote({
        environment: meta.environment ?? 'unknown',
        state:       'failure',
        sha:         meta.sha ?? 'unknown',
        branch:      meta.branch ?? 'unknown',
        url:         meta.url ?? '',
        description: meta.description ?? '',
        timestamp:   failure.created_at as string,
        repo:        'budsatwork',
      });
      await ctx.memory.write({
        category:   'deployments',
        title:      failureNote.title,
        body:       failureNote.body,
        tags:       ['deployment', 'failure', 'rollback'],
        agentScope: 'github-historian',
        vaultPath:  failureNote.vaultPath,
        source:     'agent',
      });
    }

    // ── 8. Build Obsidian-structured output ───────────────────────────────

    const obsidianFindings: AgentFinding[] = [
      // Notable timeline entries → findings
      ...timeline.timeline
        .filter((e) => e.is_notable)
        .map(
          (e): AgentFinding => ({
            title:    `[${e.type}] ${e.title}`,
            summary:  e.summary,
            severity: e.type === 'bug-fix' ? 'warning' : 'info',
            systems:  e.systems,
            tags:     ['github', e.type, 'notable'],
            body:
              `**Date:** ${e.date}  |  **Type:** ${e.type}\n\n${e.summary}\n\n` +
              (e.backlinks.length > 0 ? `**Backlinks:** ${e.backlinks.join('  ')}` : ''),
          }),
        ),
      // Bug patterns → findings
      ...timeline.bug_patterns.map(
        (b): AgentFinding => ({
          title:    `Bug pattern: ${b.pattern}`,
          summary:  `${b.occurrences} occurrence(s). ${b.recommendation}`,
          severity: b.occurrences >= 3 ? 'critical' : 'warning',
          systems:  b.affected_areas,
          tags:     ['bug-pattern', 'github', 'recurring'],
          body:
            `**Pattern:** ${b.pattern}\n**Occurrences:** ${b.occurrences}\n` +
            `**Areas:** ${b.affected_areas.join(', ')}\n\n**Recommendation:** ${b.recommendation}`,
        }),
      ),
    ];

    // ADR tasks
    const adrTasks: AgentTask[] = adrDrafts
      .filter((a) => a.needs_adr)
      .map(
        (a): AgentTask => ({
          title:    `Review & number ADR draft: ${a.title}`,
          context:  `Draft generated by GitHub Historian on ${now}. Affects: ${a.affected_systems.join(', ')}.`,
          priority: 'high',
          tags:     ['adr', 'github', 'architecture'],
          acceptanceCriteria: [
            `Assign next ADR number from [[Dev/ADR-Index]]`,
            `Move draft from Dev/ADR-Drafts/ to Dev/ADR-NNNN-<slug>.md`,
            `Update [[Dev/ADR-Index]] table`,
            `Change status from "proposed" to "accepted" once reviewed`,
          ],
          systems: a.affected_systems,
        }),
      );

    // Deployment failure issues
    const failureIssues: AgentIssue[] = recentFailures.slice(0, 3).map((f) => {
      const meta = (f.metadata as Record<string, string>) ?? {};
      return {
        title:       `Deployment failure: ${meta.environment ?? 'unknown'} — ${(meta.sha ?? '').slice(0, 7)}`,
        description: `Deployment to ${meta.environment} failed at SHA ${meta.sha}. Branch: ${meta.branch}.`,
        impact:      'Production deployment failed — verify rollback and investigate root cause.',
        severity:    'critical' as const,
        systems:     ['ci-cd', meta.environment ?? 'unknown'],
        tags:        ['deployment-failure', 'rollback', 'github'],
        stepsToReproduce: [
          `Check Vercel dashboard for deployment ${(meta.sha ?? '').slice(0, 7)}`,
          'Review build logs for error',
          `Determine if rollback to previous SHA is needed`,
          'Update [[Dev/Deployments]] with resolution',
        ],
      };
    });

    const obsidianTasks: AgentTask[] = [
      ...adrTasks,
      // Rollback doc task if recent failure
      ...(recentFailures.length > 0
        ? [{
            title:    'Update rollback runbook after deployment failures',
            context:  `${recentFailures.length} deployment failure(s) this week. Rollback readiness: ${timeline.deployment_health.rollback_readiness}.`,
            priority: 'high' as const,
            tags:     ['rollback', 'operations', 'github'],
            acceptanceCriteria: [
              'Document the failure cause in [[Dev/Deployments]]',
              'Update rollback steps if the process changed',
              'Confirm Vercel instant rollback is configured',
            ],
          }]
        : []),
    ];

    // ── 9. Summary ────────────────────────────────────────────────────────

    const notableCount   = timeline.timeline.filter((e) => e.is_notable).length;
    const adrDraftCount  = adrDrafts.filter((a) => a.needs_adr).length;
    const bugPatterns    = timeline.bug_patterns.length;

    const summary = [
      `GitHub Historian: ${timeline.timeline.length} events this week, ${notableCount} notable.`,
      `Deployments: ${successCount} success / ${failureCount} failure. Rollback readiness: ${timeline.deployment_health.rollback_readiness}.`,
      `${adrDraftCount} ADR draft(s) generated. ${bugPatterns} bug pattern(s) detected.`,
      timeline.executive_summary || '',
    ]
      .filter(Boolean)
      .join(' ');

    return {
      summary,
      output: {
        findings: obsidianFindings,
        tasks:    obsidianTasks,
        issues:   [...failureIssues],
        github_history: {
          run_date:           now,
          events_processed:   events.length,
          notable_changes:    notableCount,
          adr_drafts:         adrDraftCount,
          bug_patterns:       bugPatterns,
          deployment_health:  timeline.deployment_health,
          timeline:           timeline.timeline,
          architecture_changes: timeline.architecture_changes,
          executive_summary:  timeline.executive_summary,
        },
      },
    };
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 60);
}

function buildTimelineNote(
  timeline: {
    timeline: Array<{
      date: string; type: string; title: string; summary: string;
      systems: string[]; is_notable: boolean;
    }>;
    deployment_health: {
      success_count: number; failure_count: number;
      rollback_readiness: string; rollback_note: string;
    };
    executive_summary: string;
  },
  date: string,
): string {
  const grouped: Record<string, typeof timeline.timeline> = {};
  for (const entry of timeline.timeline) {
    grouped[entry.date] = grouped[entry.date] ?? [];
    grouped[entry.date].push(entry);
  }

  const typeEmoji: Record<string, string> = {
    'feature': '🟢', 'bug-fix': '🔴', 'architecture': '🏛️',
    'database': '🗄️', 'agent': '🤖', 'ui': '🎨',
    'config': '⚙️', 'docs': '📄', 'chore': '🔧',
  };

  const timelineLines: string[] = [];
  for (const [d, entries] of Object.entries(grouped).sort().reverse()) {
    timelineLines.push(`### ${d}`);
    for (const e of entries) {
      const emoji = typeEmoji[e.type] ?? '•';
      const notable = e.is_notable ? ' ⭐' : '';
      timelineLines.push(`- ${emoji}${notable} **${e.title}** — ${e.summary}`);
      if (e.systems.length) timelineLines.push(`  *Systems:* ${e.systems.join(', ')}`);
    }
    timelineLines.push('');
  }

  const dh = timeline.deployment_health;

  return [
    `---`,
    `type: implementation-timeline`,
    `week: "${date}"`,
    `tags:`,
    `  - implementation-timeline`,
    `  - weekly`,
    `  - github`,
    `created: "${new Date().toISOString()}"`,
    `---`,
    '',
    `# Implementation Timeline — week of ${date}`,
    '',
    timeline.executive_summary || '',
    '',
    '## Deployment Health',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Successful deployments | ${dh.success_count} |`,
    `| Failed deployments | ${dh.failure_count} |`,
    `| Rollback readiness | ${dh.rollback_readiness} |`,
    `| Note | ${dh.rollback_note} |`,
    '',
    '## Changes This Week',
    '',
    timelineLines.join('\n'),
    '',
    '## Backlinks',
    '[[Dev/ADR-Index]]  [[Dev/Bug Tracker]]  [[Dev/Deployments]]',
    '',
    `*Auto-generated by [[github-historian]] on ${date}*`,
  ].join('\n');
}
