/**
 * Agent workspace read/write operations.
 *
 * Workspaces live inside the Obsidian vault at:
 *   ${OBSIDIAN_VAULT_PATH}/Agents/{WorkspaceFolder}/{Subfolder}/{filename}.md
 *
 * Every write produces a structured markdown file with YAML frontmatter.
 * The existing vault sync pipeline picks these files up automatically.
 *
 * Node.js only — do not import from Edge runtime.
 */

import fs from 'fs';
import path from 'path';
import type {
  WorkspaceConfig,
  AgentFinding,
  AgentTask,
  AgentDecision,
  AgentIssue,
  AgentReport,
  AgentRunLog,
} from './types';
import {
  WORKSPACES,
  WORKSPACE_SUBFOLDERS,
  AGENT_WORKSPACE_MAP,
} from './types';

// ── Vault root ────────────────────────────────────────────────────────────────

function vaultRoot(): string {
  const v = process.env.OBSIDIAN_VAULT_PATH;
  if (!v) throw new Error('OBSIDIAN_VAULT_PATH is not set');
  return v;
}

function agentsRoot(): string {
  return path.join(vaultRoot(), 'Agents');
}

function workspaceDir(workspaceFolder: string): string {
  return path.join(agentsRoot(), workspaceFolder);
}

function subfolderDir(workspaceFolder: string, subfolder: string): string {
  return path.join(workspaceDir(workspaceFolder), subfolder);
}

// ── Lookup helpers ────────────────────────────────────────────────────────────

export function getWorkspace(workspaceId: string): WorkspaceConfig {
  const ws = WORKSPACES.find((w) => w.id === workspaceId);
  if (!ws) throw new Error(`Unknown workspace: ${workspaceId}`);
  return ws;
}

export function getWorkspaceForAgent(agentId: string): WorkspaceConfig | null {
  const wsId = AGENT_WORKSPACE_MAP[agentId];
  if (!wsId) return null;
  return getWorkspace(wsId);
}

// ── Filename helpers ──────────────────────────────────────────────────────────

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function filename(prefix: string, title: string): string {
  return `${prefix}-${slugify(title)}.md`;
}

// ── YAML frontmatter builder ──────────────────────────────────────────────────

function fm(fields: Record<string, unknown>): string {
  const lines = ['---'];
  for (const [k, v] of Object.entries(fields)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) {
      if (v.length === 0) {
        lines.push(`${k}: []`);
      } else {
        lines.push(`${k}:`);
        for (const item of v) lines.push(`  - ${item}`);
      }
    } else {
      lines.push(`${k}: ${JSON.stringify(v)}`);
    }
  }
  lines.push('---', '');
  return lines.join('\n');
}

// ── Scaffold ──────────────────────────────────────────────────────────────────

export function scaffoldWorkspace(workspaceId: string): void {
  const ws = getWorkspace(workspaceId);
  const wsDir = workspaceDir(ws.folder);
  fs.mkdirSync(wsDir, { recursive: true });

  for (const sub of WORKSPACE_SUBFOLDERS) {
    const subDir = subfolderDir(ws.folder, sub);
    fs.mkdirSync(subDir, { recursive: true });
    const readmePath = path.join(subDir, 'README.md');
    if (!fs.existsSync(readmePath)) {
      fs.writeFileSync(readmePath, buildSubfolderReadme(ws, sub));
    }
  }

  const overviewPath = path.join(wsDir, 'README.md');
  if (!fs.existsSync(overviewPath)) {
    fs.writeFileSync(overviewPath, buildWorkspaceReadme(ws));
  }
}

export function scaffoldAllWorkspaces(): void {
  const agentsDir = agentsRoot();
  fs.mkdirSync(agentsDir, { recursive: true });

  const indexPath = path.join(agentsDir, 'README.md');
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, buildAgentsIndexReadme());
  }

  for (const ws of WORKSPACES) {
    scaffoldWorkspace(ws.id);
  }
}

// ── Writing documents ─────────────────────────────────────────────────────────

export function logFinding(workspaceId: string, finding: AgentFinding): string {
  const ws = getWorkspace(workspaceId);
  const dir = subfolderDir(ws.folder, 'Findings');
  fs.mkdirSync(dir, { recursive: true });

  const now = new Date().toISOString();
  const fname = filename(timestamp(), finding.title);
  const filePath = path.join(dir, fname);

  const related: string[] = [
    ...(finding.relatedDecisions ?? []).map((p) => `- [[${path.basename(p, '.md')}]]`),
    ...(finding.relatedIssues ?? []).map((p) => `- [[${path.basename(p, '.md')}]]`),
  ];

  const frontmatter = fm({
    type:      'finding',
    workspace: workspaceId,
    severity:  finding.severity,
    systems:   finding.systems ?? [],
    tags:      ['finding', workspaceId, ...(finding.tags ?? [])],
    run_id:    finding.runId ?? null,
    created:   now,
    related:   [...(finding.relatedDecisions ?? []), ...(finding.relatedIssues ?? [])],
  });

  const body =
    finding.body ??
    `## Summary\n${finding.summary}` +
    (finding.systems && finding.systems.length > 0
      ? `\n\n## Systems Affected\n${finding.systems.map((s) => `- [[${s}]]`).join('\n')}`
      : '') +
    (related.length > 0
      ? `\n\n## Related\n${related.join('\n')}`
      : '');

  const content = frontmatter + `# Finding: ${finding.title}\n\n${body}\n`;
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

export function logTask(workspaceId: string, task: AgentTask): string {
  const ws = getWorkspace(workspaceId);
  const dir = subfolderDir(ws.folder, 'Tasks');
  fs.mkdirSync(dir, { recursive: true });

  const now = new Date().toISOString();
  const fname = filename(timestamp(), task.title);
  const filePath = path.join(dir, fname);

  const frontmatter = fm({
    type:     'task',
    workspace: workspaceId,
    status:   task.status ?? 'open',
    priority: task.priority,
    systems:  task.systems ?? [],
    tags:     ['task', workspaceId, ...(task.tags ?? [])],
    run_id:   task.runId ?? null,
    created:  now,
    updated:  now,
  });

  const criteria = (task.acceptanceCriteria ?? [])
    .map((c) => `- [ ] ${c}`)
    .join('\n');

  const body =
    `## Context\n${task.context}` +
    (criteria ? `\n\n## Acceptance Criteria\n${criteria}` : '');

  const content = frontmatter + `# Task: ${task.title}\n\n${body}\n`;
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

export function logDecision(workspaceId: string, decision: AgentDecision): string {
  const ws = getWorkspace(workspaceId);
  const dir = subfolderDir(ws.folder, 'Decisions');
  fs.mkdirSync(dir, { recursive: true });

  const now = new Date().toISOString();
  const fname = filename(timestamp(), decision.title);
  const filePath = path.join(dir, fname);

  const frontmatter = fm({
    type:      'decision',
    workspace: workspaceId,
    status:    decision.status ?? 'proposed',
    impact:    decision.impact,
    systems:   decision.systems ?? [],
    tags:      ['decision', workspaceId, ...(decision.tags ?? [])],
    run_id:    decision.runId ?? null,
    created:   now,
  });

  const body =
    `## Context\n${decision.context}\n\n` +
    `## Rationale\n${decision.rationale}` +
    (decision.consequences ? `\n\n## Consequences\n${decision.consequences}` : '');

  const content = frontmatter + `# Decision: ${decision.title}\n\n${body}\n`;
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

export function openIssue(workspaceId: string, issue: AgentIssue): string {
  const ws = getWorkspace(workspaceId);
  const dir = subfolderDir(ws.folder, 'Active-Issues');
  fs.mkdirSync(dir, { recursive: true });

  const now = new Date().toISOString();
  const fname = filename(timestamp(), issue.title);
  const filePath = path.join(dir, fname);

  const frontmatter = fm({
    type:      'issue',
    workspace: workspaceId,
    status:    'open',
    severity:  issue.severity,
    systems:   issue.systems ?? [],
    tags:      ['issue', workspaceId, ...(issue.tags ?? [])],
    run_id:    issue.runId ?? null,
    created:   now,
  });

  const steps = (issue.stepsToReproduce ?? [])
    .map((s, i) => `${i + 1}. ${s}`)
    .join('\n');

  const body =
    `## Description\n${issue.description}` +
    (steps ? `\n\n## Steps to Reproduce\n${steps}` : '') +
    (issue.impact ? `\n\n## Impact\n${issue.impact}` : '');

  const content = frontmatter + `# Issue: ${issue.title}\n\n${body}\n`;
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

export function resolveIssue(
  workspaceId: string,
  issueFilename: string,
  resolution: string,
): void {
  const ws = getWorkspace(workspaceId);
  const activeDir   = subfolderDir(ws.folder, 'Active-Issues');
  const resolvedDir = subfolderDir(ws.folder, 'Resolved-Issues');
  fs.mkdirSync(resolvedDir, { recursive: true });

  const sourcePath = path.join(activeDir, issueFilename);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Issue not found: ${issueFilename}`);
  }

  let content = fs.readFileSync(sourcePath, 'utf8');
  const now = new Date().toISOString();

  // Update frontmatter status → resolved
  content = content
    .replace(/^status: "open"$/m, 'status: "resolved"')
    .replace(/^---\n/, `---\nresolved_at: "${now}"\nresolution: ${JSON.stringify(resolution)}\n`);

  const destPath = path.join(resolvedDir, issueFilename);
  fs.writeFileSync(destPath, content, 'utf8');
  fs.unlinkSync(sourcePath);
}

export function writeReport(report: AgentReport): string {
  const ws = getWorkspace(report.workspaceId);
  const dir = subfolderDir(ws.folder, 'Reports');
  fs.mkdirSync(dir, { recursive: true });

  const now = new Date().toISOString();
  const periodLabel = `${report.periodStart.slice(0, 10)}-to-${report.periodEnd.slice(0, 10)}`;
  const fname = `${timestamp()}-${report.period}-report-${periodLabel}.md`;
  const filePath = path.join(dir, fname);

  const frontmatter = fm({
    type:         'report',
    workspace:    report.workspaceId,
    period:       report.period,
    period_start: report.periodStart,
    period_end:   report.periodEnd,
    run_count:    report.runCount,
    tags:         ['report', report.workspaceId, report.period, ...(report.tags ?? [])],
    created:      now,
  });

  const content =
    frontmatter +
    `# ${capitalise(report.period)} Report: ${ws.label}\n` +
    `**Period:** ${report.periodStart.slice(0, 10)} → ${report.periodEnd.slice(0, 10)} | ` +
    `**Runs:** ${report.runCount}\n\n` +
    report.body + '\n';

  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

// ── Auto-log agent run ────────────────────────────────────────────────────────
// Called by runtime after every agent run. Fire-and-forget in production.

export function logAgentRun(log: AgentRunLog): void {
  const ws = WORKSPACES.find((w) => w.id === log.workspaceId);
  if (!ws) return;

  // Always write a compact run log entry to Findings
  const statusEmoji = log.status === 'succeeded' ? '✅' : log.status === 'needs_approval' ? '⏳' : '❌';
  const title = `Run ${log.agentId} — ${log.status}`;
  const duration = log.durationMs ? ` | ${(log.durationMs / 1000).toFixed(1)}s` : '';
  const cost = log.costCents ? ` | $${(log.costCents / 100).toFixed(4)}` : '';

  const summary =
    `${statusEmoji} **${log.agentId}** ${log.status}${duration}${cost}\n\n` +
    `${log.summary}\n\n` +
    `*Run ID: [[${log.runId}]]*`;

  try {
    scaffoldWorkspace(ws.id);
    logFinding(ws.id, {
      title,
      summary,
      severity: log.status === 'failed' ? 'warning' : 'info',
      tags:     ['run-log', log.agentId],
      runId:    log.runId,
    });

    // Log any structured findings from the agent's output
    for (const f of log.findings ?? []) logFinding(ws.id, { ...f, runId: log.runId });
    for (const t of log.tasks ?? []) logTask(ws.id, { ...t, runId: log.runId });
    for (const d of log.decisions ?? []) logDecision(ws.id, { ...d, runId: log.runId });
    for (const i of log.issues ?? []) openIssue(ws.id, { ...i, runId: log.runId });
  } catch {
    // Never fail the calling agent run due to workspace logging errors
  }
}

// ── Reading documents ─────────────────────────────────────────────────────────

export function getRecentFindings(workspaceId: string, limit = 20): string[] {
  const ws = getWorkspace(workspaceId);
  const dir = subfolderDir(ws.folder, 'Findings');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .sort()
    .reverse()
    .slice(0, limit)
    .map((f) => path.join(dir, f));
}

export function getActiveIssues(workspaceId: string): string[] {
  const ws = getWorkspace(workspaceId);
  const dir = subfolderDir(ws.folder, 'Active-Issues');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .sort()
    .map((f) => path.join(dir, f));
}

export function getLatestReportPath(workspaceId: string): string | null {
  const ws = getWorkspace(workspaceId);
  const dir = subfolderDir(ws.folder, 'Reports');
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .sort()
    .reverse();
  return files[0] ? path.join(dir, files[0]) : null;
}

export function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

// ── README templates ──────────────────────────────────────────────────────────

function buildAgentsIndexReadme(): string {
  const links = WORKSPACES.map((w) => `- [[${w.folder}/README|${w.label}]] — ${w.description}`).join('\n');
  return (
    fm({ type: 'index', title: 'Agent Workspaces', created: new Date().toISOString() }) +
    `# Agent Workspaces\n\nLiving operational intelligence — auto-generated by the Buds At Work agent system.\n\n## Workspaces\n\n${links}\n`
  );
}

function buildWorkspaceReadme(ws: WorkspaceConfig): string {
  const agents = ws.agentIds.map((a) => `- \`${a}\``).join('\n');
  return (
    fm({ type: 'workspace-overview', workspace: ws.id, created: new Date().toISOString() }) +
    `# ${ws.label}\n\n${ws.description}\n\n## Agents\n${agents}\n\n## Subfolders\n` +
    `- [[Findings/README|Findings]] — Observations and discoveries from agent runs\n` +
    `- [[Tasks/README|Tasks]] — Work items raised by agents\n` +
    `- [[Reports/README|Reports]] — Periodic summaries\n` +
    `- [[Decisions/README|Decisions]] — Architectural and operational decisions\n` +
    `- [[Active-Issues/README|Active Issues]] — Open issues being tracked\n` +
    `- [[Resolved-Issues/README|Resolved Issues]] — Closed issues with resolutions\n`
  );
}

const SUBFOLDER_DESCRIPTIONS: Record<string, { title: string; description: string }> = {
  Findings:         { title: 'Findings',        description: 'Observations, insights, and discoveries from agent runs. Auto-generated at runtime.' },
  Tasks:            { title: 'Tasks',            description: 'Work items raised by agents. Each task includes context and acceptance criteria.' },
  Reports:          { title: 'Reports',          description: 'Periodic summaries (daily/weekly/monthly). LLM-generated from run history and findings.' },
  Decisions:        { title: 'Decisions',        description: 'Architectural and operational decisions with rationale and consequences.' },
  'Active-Issues':  { title: 'Active Issues',    description: 'Open issues being tracked. Move to Resolved-Issues when closed.' },
  'Resolved-Issues':{ title: 'Resolved Issues',  description: 'Closed issues with resolution notes. Preserved for audit history.' },
};

function buildSubfolderReadme(ws: WorkspaceConfig, subfolder: string): string {
  const meta = SUBFOLDER_DESCRIPTIONS[subfolder] ?? { title: subfolder, description: '' };
  return (
    fm({ type: 'folder-index', workspace: ws.id, folder: subfolder, created: new Date().toISOString() }) +
    `# ${meta.title} — ${ws.label}\n\n${meta.description}\n`
  );
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
