/**
 * Autonomous report generation for agent workspaces.
 *
 * Uses Claude Haiku to synthesise a structured markdown report from:
 *   - Recent findings (last N vault files from Findings/)
 *   - Active issues (vault files from Active-Issues/)
 *   - Recent agent_runs from Supabase (run count, cost, status distribution)
 *
 * Reports are written back to the workspace's Reports/ subfolder.
 * They also land in memory_documents after the next vault sync.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentReport, ReportPeriod } from './types';
import {
  getWorkspace,
  getRecentFindings,
  getActiveIssues,
  writeReport,
  readFile,
} from './workspace';

const ANTHROPIC_API_KEY = () => process.env.ANTHROPIC_API_KEY!;
const MODEL = process.env.AGENT_DEFAULT_MODEL ?? 'claude-haiku-4-5-20251001';

// ── LLM call ──────────────────────────────────────────────────────────────────

async function callLLM(prompt: string, system: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key':    ANTHROPIC_API_KEY(),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { content: Array<{ type: string; text?: string }> };
  return json.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n').trim();
}

// ── Run history from Supabase ─────────────────────────────────────────────────

interface RunSummary {
  agentId: string;
  status:  string;
  summary: string;
  costCents: number;
  durationMs: number;
  createdAt: string;
}

async function fetchRunHistory(
  supabase: SupabaseClient,
  agentIds: string[],
  since: Date,
): Promise<RunSummary[]> {
  const { data } = await supabase
    .from('agent_runs')
    .select('agent_id, status, summary, cost_cents, duration_ms, created_at')
    .in('agent_id', agentIds)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(50);

  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    agentId:    r.agent_id as string,
    status:     r.status as string,
    summary:    (r.summary as string) ?? '',
    costCents:  (r.cost_cents as number) ?? 0,
    durationMs: (r.duration_ms as number) ?? 0,
    createdAt:  r.created_at as string,
  }));
}

// ── Report system prompt ──────────────────────────────────────────────────────

const REPORT_SYSTEM = `You are a senior operations analyst writing an autonomous intelligence report for "Buds At Work" — a local home services platform (cleaning, yard care, car detailing, window cleaning) serving Logan & South Brisbane.

Write a concise, structured markdown report. Sections required:
## Executive Summary
2-3 sentences on the period's most important findings.

## Key Findings
Bulleted list of the most significant discoveries, ranked by impact.

## Active Issues
Bulleted list of open issues that need attention, with severity.

## Performance
Run counts, success rates, cost summary.

## Decisions Made
Any architectural or operational decisions logged this period.

## Recommended Actions
Concrete next steps, each as a task checkbox.

## Next Period Focus
2-3 areas to prioritise in the next period.

Rules:
- Be specific and actionable. Reference system names (quote-builder, stripe, supabase, etc.).
- Flag anything that could impact revenue, customer satisfaction, or crew operations.
- Output only the markdown sections — no preamble, no fences.`;

// ── Main report generator ─────────────────────────────────────────────────────

export interface GenerateReportOpts {
  workspaceId: string;
  period?: ReportPeriod;
  supabase: SupabaseClient;
}

export async function generateReport(opts: GenerateReportOpts): Promise<string> {
  const { workspaceId, period = 'weekly', supabase } = opts;
  const ws = getWorkspace(workspaceId);

  const now = new Date();
  const periodDays = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;
  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

  // 1. Load recent findings (last 30 vault files)
  const findingPaths = getRecentFindings(workspaceId, 30);
  const findingTexts = findingPaths
    .slice(0, 15)  // cap at 15 to keep prompt manageable
    .map((p) => {
      try { return readFile(p).slice(0, 800); } catch { return ''; }
    })
    .filter(Boolean);

  // 2. Load active issues
  const issuePaths = getActiveIssues(workspaceId);
  const issueTexts = issuePaths
    .slice(0, 10)
    .map((p) => {
      try { return readFile(p).slice(0, 400); } catch { return ''; }
    })
    .filter(Boolean);

  // 3. Load run history from Supabase
  const runs = await fetchRunHistory(supabase, ws.agentIds, periodStart);
  const runCount = runs.length;
  const succeeded = runs.filter((r) => r.status === 'succeeded').length;
  const failed    = runs.filter((r) => r.status === 'failed').length;
  const totalCost = runs.reduce((sum, r) => sum + r.costCents, 0);

  const runStats =
    `${runCount} runs (${succeeded} succeeded, ${failed} failed) | ` +
    `Total cost: $${(totalCost / 100).toFixed(4)} AUD`;

  // 4. Build LLM prompt
  const findingsSection = findingTexts.length > 0
    ? `\n\n### Recent Findings (${findingTexts.length})\n\n${findingTexts.join('\n\n---\n\n')}`
    : '\n\n### Recent Findings\nNo findings logged this period.';

  const issuesSection = issueTexts.length > 0
    ? `\n\n### Active Issues (${issueTexts.length})\n\n${issueTexts.join('\n\n---\n\n')}`
    : '\n\n### Active Issues\nNo open issues.';

  const runSection = `\n\n### Run History\n${runStats}\n\nRecent summaries:\n` +
    runs.slice(0, 8).map((r) => `- [${r.status}] ${r.agentId}: ${r.summary.slice(0, 120)}`).join('\n');

  const prompt =
    `Workspace: ${ws.label}\nPeriod: ${period} (${periodStart.toISOString().slice(0, 10)} → ${now.toISOString().slice(0, 10)})\nAgents: ${ws.agentIds.join(', ')}` +
    findingsSection +
    issuesSection +
    runSection;

  // 5. Call LLM
  const body = await callLLM(prompt, REPORT_SYSTEM);

  // 6. Write to vault
  const report: AgentReport = {
    workspaceId,
    period,
    periodStart: periodStart.toISOString(),
    periodEnd:   now.toISOString(),
    runCount,
    body,
    tags: [period, 'auto-generated'],
  };

  return writeReport(report);
}

// ── Batch: generate reports for all workspaces ────────────────────────────────

export async function generateAllReports(
  supabase: SupabaseClient,
  period: ReportPeriod = 'weekly',
): Promise<Record<string, string>> {
  const { WORKSPACES } = await import('./types');
  const results: Record<string, string> = {};

  for (const ws of WORKSPACES) {
    try {
      results[ws.id] = await generateReport({ workspaceId: ws.id, period, supabase });
    } catch (err) {
      results[ws.id] = `error: ${(err as Error).message}`;
    }
  }

  return results;
}
