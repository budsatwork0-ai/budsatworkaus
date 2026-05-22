#!/usr/bin/env npx tsx
/**
 * vault-convention.ts — Convention capture CLI
 *
 * Run after correcting an AI mistake to permanently record the rule:
 *   npx tsx scripts/vault-convention.ts
 *   npx tsx scripts/vault-convention.ts --title "..." --rule "..." --category design
 *
 * Writes to:
 *   1. CLAUDE.md           — always-loaded anti-patterns section
 *   2. Buds At Work/Dev/Conventions/{slug}.md  — vault note (injected by vault-context.ts)
 *   3. POST /api/pipeline/conventions           — Continuous Learning Loop dashboard
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

// ── Config ─────────────────────────────────────────────────────────────────────

const ROOT         = process.cwd();
const CLAUDE_MD    = path.join(ROOT, 'CLAUDE.md');
const VAULT_DIR    = path.join(ROOT, 'Buds At Work', 'Dev', 'Conventions');
const APP_URL      = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

const CATEGORIES   = ['design', 'import', 'pattern', 'agent', 'other'] as const;
type Category      = typeof CATEGORIES[number];

// ── CLI arg parsing ────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const get  = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : null;
  };
  return {
    title:    get('--title'),
    rule:     get('--rule'),
    category: get('--category') as Category | null,
    wrong:    get('--wrong'),
    correct:  get('--correct'),
  };
}

// ── Interactive prompt ─────────────────────────────────────────────────────────

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function gather() {
  const argv = parseArgs();
  const rl   = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n\x1b[35m■ Convention capture\x1b[0m  — saves to CLAUDE.md, vault, and dashboard\n');

  const title    = argv.title    ?? await prompt(rl, '  Rule title (short, e.g. "glass is a className string"):  ');
  const rule     = argv.rule     ?? await prompt(rl, '  Rule body (the full rule to enforce):  ');
  const catInput = argv.category ?? await prompt(rl, `  Category [${CATEGORIES.join('|')}] (default: pattern):  `);
  const category: Category = (CATEGORIES.includes(catInput as Category) ? catInput : 'pattern') as Category;
  const wrong    = argv.wrong    ?? await prompt(rl, '  Wrong example (optional, press enter to skip):  ');
  const correct  = argv.correct  ?? await prompt(rl, '  Correct example (optional, press enter to skip):  ');

  rl.close();

  if (!title || !rule) {
    console.error('\x1b[31m  ✗ title and rule are required\x1b[0m\n');
    process.exit(1);
  }

  return { title, rule, category, wrong: wrong || null, correct: correct || null };
}

// ── Slug ───────────────────────────────────────────────────────────────────────

function slug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
}

// ── 1. Write to CLAUDE.md ─────────────────────────────────────────────────────

function appendToCLAUDEMd(entry: { title: string; rule: string; category: string; wrong: string | null; correct: string | null }) {
  const block: string[] = [`\n### ${entry.title}`, entry.rule];
  if (entry.wrong || entry.correct) {
    block.push('```');
    if (entry.wrong)   block.push(`// Wrong:   ${entry.wrong}`);
    if (entry.correct) block.push(`// Correct: ${entry.correct}`);
    block.push('```');
  }
  block.push(`*Category: ${entry.category}*\n`);

  const content = block.join('\n');

  if (!fs.existsSync(CLAUDE_MD)) {
    fs.writeFileSync(CLAUDE_MD, `# Buds At Work — Claude Code Rules\n\n## Anti-patterns\n${content}`, 'utf-8');
    return;
  }

  const existing = fs.readFileSync(CLAUDE_MD, 'utf-8');

  // Append before "## Before changing" section if present, otherwise at end
  const insertMarker = '## Before changing';
  if (existing.includes(insertMarker)) {
    const idx = existing.indexOf(insertMarker);
    fs.writeFileSync(CLAUDE_MD, existing.slice(0, idx) + content + existing.slice(idx), 'utf-8');
  } else {
    fs.appendFileSync(CLAUDE_MD, content, 'utf-8');
  }
}

// ── 2. Write vault note ────────────────────────────────────────────────────────

function writeVaultNote(entry: { title: string; rule: string; category: string; wrong: string | null; correct: string | null }) {
  fs.mkdirSync(VAULT_DIR, { recursive: true });

  const filename = `${slug(entry.title)}.md`;
  const filepath  = path.join(VAULT_DIR, filename);
  const date      = new Date().toISOString().slice(0, 10);

  const lines: string[] = [
    `# ${entry.title}`,
    '',
    `> Convention captured ${date} via vault-convention.ts`,
    '',
    `**Category:** ${entry.category}  `,
    `**Severity:** error`,
    '',
    '## Rule',
    '',
    entry.rule,
    '',
  ];

  if (entry.wrong || entry.correct) {
    lines.push('## Examples', '');
    if (entry.wrong)   lines.push('**Wrong:**', '```', entry.wrong, '```', '');
    if (entry.correct) lines.push('**Correct:**', '```', entry.correct, '```', '');
  }

  lines.push('## Related', '- [[Design System]]', '- [[Engineering]]', '');

  fs.writeFileSync(filepath, lines.join('\n'), 'utf-8');
  return path.relative(ROOT, filepath);
}

// ── 3. POST to API ─────────────────────────────────────────────────────────────

async function postToAPI(entry: { title: string; rule: string; category: string; wrong: string | null; correct: string | null }) {
  try {
    const res = await fetch(`${APP_URL}/api/pipeline/conventions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: entry.title,
        rule: entry.rule,
        category: entry.category,
        source: 'manual',
        severity: 'error',
        example_wrong: entry.wrong,
        example_correct: entry.correct,
      }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const entry = await gather();

  // 1. CLAUDE.md
  appendToCLAUDEMd(entry);
  console.log(`\n  \x1b[32m✓\x1b[0m CLAUDE.md updated`);

  // 2. Vault note
  const vaultPath = writeVaultNote(entry);
  console.log(`  \x1b[32m✓\x1b[0m Vault note: ${vaultPath}`);

  // 3. API (best-effort)
  const apiOk = await postToAPI(entry);
  if (apiOk) {
    console.log(`  \x1b[32m✓\x1b[0m Dashboard: posted to Continuous Learning Loop`);
  } else {
    console.log(`  \x1b[33m○\x1b[0m Dashboard: server not reachable (will appear next time the migration runs)`);
  }

  console.log(`\n  \x1b[35m■\x1b[0m Convention "${entry.title}" recorded. Claude will follow it from the next session.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
