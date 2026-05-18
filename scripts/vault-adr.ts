#!/usr/bin/env npx tsx
/**
 * vault-adr.ts — Architectural Decision Record creator
 *
 * Records a formal ADR (Architectural Decision Record) to the Obsidian vault.
 * ADRs live at: Dev/ADR-NNNN-<slug>.md
 * A running index is maintained at: Dev/ADR-Index.md
 *
 * Usage:
 *   npx tsx scripts/vault-adr.ts
 *     → interactive prompt (reads from stdin)
 *
 *   npx tsx scripts/vault-adr.ts --title "..." --decision "..." [--context "..."] [--consequences "..."] [--status accepted]
 *     → non-interactive
 *
 *   echo '{"title":"...","decision":"..."}' | npx tsx scripts/vault-adr.ts
 *     → JSON stdin (used by vault-log.ts when signalling ADR)
 *
 * Statuses: proposed | accepted | rejected | superseded | deprecated
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

// ── Env ───────────────────────────────────────────────────────────────────────

function loadEnv() {
  try {
    const lines = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8').split('\n');
    for (const line of lines) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  } catch { /* optional */ }
}

loadEnv();

// ── Config ────────────────────────────────────────────────────────────────────

const VAULT   = process.env.OBSIDIAN_VAULT_PATH ?? path.join(process.cwd(), 'Buds At Work');
const DEV_DIR = path.join(VAULT, 'Dev');
const INDEX   = path.join(DEV_DIR, 'ADR-Index.md');

// ── Types ─────────────────────────────────────────────────────────────────────

type AdrStatus = 'proposed' | 'accepted' | 'rejected' | 'superseded' | 'deprecated';

interface AdrInput {
  title: string;
  decision: string;
  context?: string;
  consequences?: string;
  status?: AdrStatus;
  supersedes?: string; // ADR number, e.g. "0012"
  tags?: string[];
}

// ── Slug ──────────────────────────────────────────────────────────────────────

function localDate(d = new Date()): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

// ── Next ADR number ───────────────────────────────────────────────────────────

function nextAdrNumber(): string {
  fs.mkdirSync(DEV_DIR, { recursive: true });

  const existing = fs.readdirSync(DEV_DIR)
    .filter(f => /^ADR-\d{4}/.test(f))
    .map(f => parseInt(f.slice(4, 8), 10))
    .filter(n => !isNaN(n));

  const max = existing.length ? Math.max(...existing) : 0;
  return String(max + 1).padStart(4, '0');
}

// ── Write ADR ─────────────────────────────────────────────────────────────────

function writeAdr(input: AdrInput): string {
  const num    = nextAdrNumber();
  const slug   = slugify(input.title);
  const fname  = `ADR-${num}-${slug}.md`;
  const fpath  = path.join(DEV_DIR, fname);
  const date   = localDate();
  const status = input.status ?? 'accepted';
  const tags   = ['adr', status, ...(input.tags ?? [])];

  const frontmatter = [
    '---',
    `adr: "${num}"`,
    `title: ${JSON.stringify(input.title)}`,
    `date: "${date}"`,
    `status: "${status}"`,
    `tags: [${tags.map(t => JSON.stringify(t)).join(', ')}]`,
    ...(input.supersedes ? [`supersedes: "ADR-${input.supersedes}"`, `superseded_by: null`] : []),
    '---',
    '',
  ].join('\n');

  const statusBadge: Record<AdrStatus, string> = {
    proposed:   '🔵 Proposed',
    accepted:   '✅ Accepted',
    rejected:   '❌ Rejected',
    superseded: '🔁 Superseded',
    deprecated: '⚠️ Deprecated',
  };

  const sections: string[] = [
    `# ADR-${num}: ${input.title}`,
    '',
    `**Date:** ${date}  `,
    `**Status:** ${statusBadge[status]}`,
    '',
  ];

  if (input.supersedes) {
    sections.push(`**Supersedes:** [[ADR-${input.supersedes}]]`, '');
  }

  sections.push(
    '## Context',
    '',
    input.context?.trim() || '_No context provided._',
    '',
    '## Decision',
    '',
    input.decision.trim(),
    '',
    '## Consequences',
    '',
    input.consequences?.trim() || '_No consequences documented yet._',
    '',
    '## Related',
    '',
    `- [[Dev Log ${date}]]`,
    '',
  );

  fs.writeFileSync(fpath, frontmatter + sections.join('\n'), 'utf-8');

  // Update index
  updateIndex(num, input.title, status, date, fname);

  return fpath;
}

// ── Update ADR index ──────────────────────────────────────────────────────────

function updateIndex(num: string, title: string, status: AdrStatus, date: string, fname: string): void {
  const row = `| [[${fname.replace('.md', '')}\\|ADR-${num}]] | ${title} | ${status} | ${date} |`;

  if (!fs.existsSync(INDEX)) {
    const header = [
      '# ADR Index',
      '',
      'All Architectural Decision Records for Buds At Work.',
      '',
      '| # | Title | Status | Date |',
      '|---|-------|--------|------|',
      row,
      '',
    ].join('\n');
    fs.writeFileSync(INDEX, header, 'utf-8');
    return;
  }

  // Append before the trailing blank line, or just append
  let content = fs.readFileSync(INDEX, 'utf-8');
  if (content.includes('|---|')) {
    // Find last table row and insert after it
    const lines = content.split('\n');
    const lastRow = lines.reduce((last, line, i) => line.startsWith('| [[') ? i : last, -1);
    if (lastRow !== -1) {
      lines.splice(lastRow + 1, 0, row);
      content = lines.join('\n');
    } else {
      content += row + '\n';
    }
  } else {
    content += row + '\n';
  }

  fs.writeFileSync(INDEX, content, 'utf-8');
}

// ── Interactive prompt ────────────────────────────────────────────────────────

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  return new Promise(resolve => {
    rl.question(question, answer => { rl.close(); resolve(answer.trim()); });
  });
}

async function interactive(): Promise<AdrInput> {
  process.stderr.write('\n📝 New Architectural Decision Record\n\n');

  const title        = await prompt('Title: ');
  const context      = await prompt('Context (why this decision was needed): ');
  const decision     = await prompt('Decision (what was decided): ');
  const consequences = await prompt('Consequences (trade-offs, risks): ');
  const statusRaw    = await prompt('Status [accepted/proposed/rejected/superseded]: ');
  const supersedes   = await prompt('Supersedes ADR # (leave blank if none): ');

  const status = (['accepted','proposed','rejected','superseded','deprecated'].includes(statusRaw)
    ? statusRaw
    : 'accepted') as AdrStatus;

  return {
    title,
    context,
    decision,
    consequences,
    status,
    supersedes: supersedes || undefined,
  };
}

// ── CLI arg parser ────────────────────────────────────────────────────────────

function parseArgs(): Partial<AdrInput> | null {
  const args = process.argv.slice(2);
  if (!args.length) return null;

  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const title = get('--title');
  if (!title) return null;

  return {
    title,
    decision:     get('--decision') ?? '',
    context:      get('--context'),
    consequences: get('--consequences'),
    status:       (get('--status') ?? 'accepted') as AdrStatus,
    supersedes:   get('--supersedes'),
  };
}

// ── JSON stdin ────────────────────────────────────────────────────────────────

function tryReadJsonStdin(): Partial<AdrInput> | null {
  // Only read stdin if it's not a TTY (piped input)
  if (process.stdin.isTTY) return null;

  try {
    const raw = fs.readFileSync('/dev/stdin', 'utf-8').trim();
    if (!raw || !raw.startsWith('{')) return null;
    return JSON.parse(raw) as Partial<AdrInput>;
  } catch { return null; }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(VAULT)) {
    console.error(`Vault not found at ${VAULT}. Set OBSIDIAN_VAULT_PATH in .env.local`);
    process.exit(1);
  }

  let input: AdrInput | null = null;

  // Priority: CLI args > JSON stdin > interactive
  const fromArgs = parseArgs();
  if (fromArgs?.title && fromArgs.decision) {
    input = fromArgs as AdrInput;
  } else {
    const fromStdin = tryReadJsonStdin();
    if (fromStdin?.title && fromStdin.decision) {
      input = fromStdin as AdrInput;
    }
  }

  if (!input) {
    input = await interactive();
  }

  if (!input.title || !input.decision) {
    console.error('Title and decision are required.');
    process.exit(1);
  }

  const filePath = writeAdr(input);
  const relPath  = path.relative(process.cwd(), filePath);

  console.log(`\n✅ ADR created: ${relPath}`);
  console.log(`   Index updated: ${path.relative(process.cwd(), INDEX)}`);
  console.log(`\nOpen in Obsidian to link related notes and add more context.\n`);
}

main().catch(err => {
  console.error('vault-adr error:', err.message);
  process.exit(1);
});
