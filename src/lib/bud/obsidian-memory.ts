/**
 * Bud Obsidian memory adapter.
 * Extends the base workspace system with Bud-specific memory categories.
 *
 * Memory structure:
 *   ${OBSIDIAN_VAULT_PATH}/Bud/
 *     00-core/        — operational rules, pricing philosophy
 *     01-architecture/ — ADRs
 *     02-agents/       — per-agent patterns, repair history
 *     03-memory/       — recurring failures, successful fixes
 *     04-roadmap/      — planned changes
 *     05-runs/         — deployment and run learnings
 *     06-context/      — operational context
 *
 * Node.js only — do not import from Edge runtime.
 */

import fs from 'fs';
import path from 'path';

function vaultRoot(): string {
  const v = process.env.OBSIDIAN_VAULT_PATH;
  if (!v) throw new Error('OBSIDIAN_VAULT_PATH is not set');
  return v;
}

function budRoot(): string {
  return path.join(vaultRoot(), 'Bud');
}

function categoryDir(category: string): string {
  return path.join(budRoot(), category);
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function isoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoTs(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

// ── Read ──────────────────────────────────────────────────────────────────────

export function readNote(relativePath: string): string | null {
  const full = path.join(budRoot(), relativePath);
  try {
    return fs.readFileSync(full, 'utf8');
  } catch {
    return null;
  }
}

// ── Write / append ────────────────────────────────────────────────────────────

export function writeNote(relativePath: string, content: string): void {
  const full = path.join(budRoot(), relativePath);
  ensureDir(path.dirname(full));
  fs.writeFileSync(full, content, 'utf8');
}

export function appendToNote(relativePath: string, content: string): void {
  const full = path.join(budRoot(), relativePath);
  ensureDir(path.dirname(full));
  if (fs.existsSync(full)) {
    fs.appendFileSync(full, `\n${content}`, 'utf8');
  } else {
    fs.writeFileSync(full, content, 'utf8');
  }
}

// ── Deployment learnings ──────────────────────────────────────────────────────

export function writeDeploymentLearning(
  deployment: { url: string; status: string; agent: string; deploymentId?: string },
  lessons: string[],
): void {
  const dir = categoryDir('05-runs');
  ensureDir(dir);
  const file = path.join(dir, `${isoDate()}-deployment.md`);

  const frontmatter = [
    '---',
    `date: ${isoDate()}`,
    `agent: ${deployment.agent}`,
    `status: ${deployment.status}`,
    `url: "${deployment.url}"`,
    deployment.deploymentId ? `deployment_id: "${deployment.deploymentId}"` : null,
    '---',
  ].filter(Boolean).join('\n');

  const body = [
    `# Deployment Learning — ${isoDate()}`,
    '',
    `**Agent:** ${deployment.agent}`,
    `**Status:** ${deployment.status}`,
    `**URL:** ${deployment.url}`,
    '',
    '## Lessons',
    ...lessons.map((l) => `- ${l}`),
    '',
    `*Written by Bud at ${new Date().toISOString()}*`,
  ].join('\n');

  const content = `${frontmatter}\n\n${body}`;

  if (fs.existsSync(file)) {
    fs.appendFileSync(file, `\n\n---\n\n${body}`, 'utf8');
  } else {
    fs.writeFileSync(file, content, 'utf8');
  }
}

// ── Repair patterns ───────────────────────────────────────────────────────────

export function writeRepairPattern(
  failure: { agent: string; error: string; run_id?: string },
  fix: string,
): void {
  const dir = categoryDir('02-agents');
  ensureDir(dir);
  const safe = failure.agent.replace(/[^a-z0-9-]/g, '-');
  const file = path.join(dir, `${safe}-patterns.md`);

  const entry = [
    `## ${isoDate()} — ${failure.error.slice(0, 60)}`,
    '',
    `**Agent:** ${failure.agent}`,
    failure.run_id ? `**Run ID:** ${failure.run_id}` : null,
    `**Error:** ${failure.error}`,
    `**Fix applied:** ${fix}`,
    '',
    `*Recorded by Bud*`,
  ].filter(Boolean).join('\n');

  if (fs.existsSync(file)) {
    fs.appendFileSync(file, `\n\n${entry}`, 'utf8');
  } else {
    const header = [
      '---',
      `agent: ${failure.agent}`,
      'category: repair-patterns',
      '---',
      '',
      `# ${failure.agent} — Repair Patterns`,
      '',
    ].join('\n');
    fs.writeFileSync(file, header + entry, 'utf8');
  }
}

// ── Architectural decisions ───────────────────────────────────────────────────

export function writeArchitecturalDecision(decision: {
  title: string;
  context: string;
  choice: string;
  consequences: string;
  agent?: string;
}): void {
  const dir = categoryDir('01-architecture');
  ensureDir(dir);
  const slug = decision.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  const file = path.join(dir, `ADR-${isoDate()}-${slug}.md`);

  const content = [
    '---',
    `date: ${isoDate()}`,
    `title: "${decision.title}"`,
    decision.agent ? `author: ${decision.agent}` : 'author: bud',
    'status: accepted',
    '---',
    '',
    `# ADR: ${decision.title}`,
    '',
    '## Context',
    decision.context,
    '',
    '## Decision',
    decision.choice,
    '',
    '## Consequences',
    decision.consequences,
    '',
    `*Written by Bud at ${new Date().toISOString()}*`,
  ].join('\n');

  fs.writeFileSync(file, content, 'utf8');
}

// ── Operational insight ───────────────────────────────────────────────────────

export function writeOperationalInsight(insight: {
  title: string;
  body: string;
  category: string;
  severity?: string;
}): void {
  const dir = categoryDir('06-context');
  ensureDir(dir);
  const file = path.join(dir, `${isoTs()}-insight.md`);

  const content = [
    '---',
    `date: ${isoDate()}`,
    `category: ${insight.category}`,
    `severity: ${insight.severity ?? 'info'}`,
    '---',
    '',
    `# ${insight.title}`,
    '',
    insight.body,
    '',
    `*Recorded by Bud at ${new Date().toISOString()}*`,
  ].join('\n');

  fs.writeFileSync(file, content, 'utf8');
}
