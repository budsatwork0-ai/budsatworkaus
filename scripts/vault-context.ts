#!/usr/bin/env npx tsx
/**
 * vault-context.ts — Claude Code UserPromptSubmit hook
 *
 * Retrieves relevant Obsidian vault context and injects it before Claude responds.
 * Runs on every user message. Fast filesystem-only search — no DB, no embeddings.
 * Target latency: < 600ms (mostly tsx cold-start).
 *
 * stdin:  { hook_event_name, session_id, transcript_path, cwd, user_query }
 * stdout: { continue: true, prompt_injection: "..." }
 */

import fs from 'fs';
import path from 'path';

// ── Env loading ───────────────────────────────────────────────────────────────
// Parse .env.local manually — faster than dotenv cold-start

function loadEnv() {
  try {
    const envFile = path.join(process.cwd(), '.env.local');
    const lines = fs.readFileSync(envFile, 'utf-8').split('\n');
    for (const line of lines) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
      }
    }
  } catch { /* .env.local optional */ }
}

loadEnv();

// ── Config ────────────────────────────────────────────────────────────────────

const VAULT = process.env.OBSIDIAN_VAULT_PATH ?? path.join(process.cwd(), 'Buds At Work');
const TOP_N = 4;
const MAX_INJECTION_CHARS = 3500;
const MAX_SNIPPET_CHARS   = 500;
const MIN_SCORE           = 0.0008;

const SKIP_DIRS = new Set(['.obsidian', '.trash', 'templates', 'attachments']);

// ── Stop words ────────────────────────────────────────────────────────────────

const STOP = new Set([
  'that','this','with','have','will','from','they','what','been','were','which',
  'their','your','when','into','more','than','also','some','make','like','need',
  'just','want','should','would','could','please','help','using','used','there',
  'then','about','after','before','where','here','these','those','them','being',
  'does','done','dont','each','file','line','code','page','show','want','going',
]);

// ── Category boosts ───────────────────────────────────────────────────────────
// If the user query matches a pattern, boost notes containing the path fragment.

const BOOSTS: Array<{ test: RegExp; fragment: string; factor: number }> = [
  { test: /\b(button|color|colour|style|theme|brand|glass|tailwind|modal|card|badge|visual|layout|design|ui|component|font|typography|spacing|icon|gradient)\b/i, fragment: 'Design System',  factor: 3 },
  { test: /\b(bug|fix|error|broken|issue|crash|fail|wrong|incorrect|regression|not working)\b/i,                                                                    fragment: 'Bug Tracker',    factor: 3 },
  { test: /\b(architecture|stack|deploy|vercel|supabase|api|route|migration|env|database|infrastructure|schema|webhook)\b/i,                                        fragment: 'Engineering',     factor: 2 },
  { test: /\b(checkout|payment|stripe|booking|quote|price|order|invoice)\b/i,                                                                                       fragment: 'Stripe Checkout', factor: 2.5 },
  { test: /\b(email|resend|notification|template|trigger)\b/i,                                                                                                      fragment: 'Email',           factor: 2 },
  { test: /\b(crew|staff|ndis|worker|participant|job|schedule|roster)\b/i,                                                                                          fragment: 'HR',              factor: 2 },
  { test: /\b(agent|foreman|automation|run|cron|trigger|llm|ai)\b/i,                                                                                                fragment: 'Agents',          factor: 2 },
  { test: /\b(sales|lead|pipeline|customer|client|revenue|finance|churn)\b/i,                                                                                       fragment: 'Sales',           factor: 2 },
  { test: /\b(quote|wizard|services|flow|step|form|booking|funnel)\b/i,                                                                                             fragment: 'Quote Flow',      factor: 2 },
  { test: /\b(sop|procedure|policy|standard|process|how to|steps when|refund|failed payment)\b/i,                                                                   fragment: 'SOPs',            factor: 2 },
  { test: /\b(product|feature|roadmap|sprint|story|backlog|priority)\b/i,                                                                                           fragment: 'Product',         factor: 1.5 },
];

// ── Tokenise ──────────────────────────────────────────────────────────────────

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP.has(w));
}

// ── Vault walker ──────────────────────────────────────────────────────────────

interface Note { rel: string; title: string; body: string; mtime: number }

function* walk(dir: string): Generator<Note> {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }

  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    if (e.name.startsWith('Untitled')) continue;

    const full = path.join(dir, e.name);

    if (e.isDirectory()) {
      yield* walk(full);
    } else if (e.isFile() && e.name.endsWith('.md')) {
      let raw: string, mtime: number;
      try {
        raw   = fs.readFileSync(full, 'utf-8');
        mtime = fs.statSync(full).mtimeMs;
      } catch { continue; }

      // Strip YAML frontmatter
      let body = raw;
      if (raw.startsWith('---')) {
        const end = raw.indexOf('\n---\n', 3);
        if (end !== -1) body = raw.slice(end + 5);
      }
      body = body.trim();
      if (body.length < 60) continue;

      const h1 = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
      const title = h1 ?? path.basename(e.name, '.md');
      const rel   = path.relative(VAULT, full).replace(/\\/g, '/');

      yield { rel, title, body, mtime };
    }
  }
}

// ── Score ─────────────────────────────────────────────────────────────────────

function score(note: Note, terms: string[], rawQuery: string): number {
  const lower = note.body.toLowerCase();
  const words = Math.max(lower.split(/\s+/).length, 1);

  // TF: normalised term frequency
  let tf = 0;
  for (const t of terms) {
    tf += (lower.split(t).length - 1) / words;
  }

  // Title bonus
  const titleLower = note.title.toLowerCase();
  for (const t of terms) {
    if (titleLower.includes(t)) tf += 0.08;
  }

  // Recency: 1.0 for brand-new → 0.7 at 180 days
  const ageDays = (Date.now() - note.mtime) / 86_400_000;
  const recency = Math.max(0.7, 1 - ageDays / 360);

  // Category boost from query signal
  let boost = 1;
  for (const b of BOOSTS) {
    if (b.test.test(rawQuery) && note.rel.includes(b.fragment)) {
      boost = Math.max(boost, b.factor);
    }
  }

  return tf * recency * boost;
}

// ── Extract best snippet ──────────────────────────────────────────────────────

function snippet(body: string, terms: string[], max: number): string {
  // Split into semantic chunks (headings or double-newlines)
  const chunks = body
    .split(/\n(?=#{1,3}\s)/)
    .flatMap(s => s.split(/\n\n+/))
    .map(s => s.trim())
    .filter(s => s.length > 25);

  if (!chunks.length) return body.slice(0, max);

  const scored = chunks.map(c => ({
    text:  c,
    score: terms.reduce((n, t) => n + (c.toLowerCase().split(t).length - 1), 0),
  }));
  scored.sort((a, b) => b.score - a.score);

  let out = '';
  for (const c of scored) {
    if (out.length >= max) break;
    out += (out ? '\n\n' : '') + c.text.slice(0, max - out.length);
  }
  return out || body.slice(0, max);
}

// ── Format injection ──────────────────────────────────────────────────────────

function format(hits: Array<{ note: Note; snip: string }>): string {
  const lines: string[] = [
    '<vault_context>',
    'Relevant knowledge from the Obsidian vault. Reference these when they apply:',
    '',
  ];

  for (const { note, snip } of hits) {
    lines.push(`### ${note.title}`);
    lines.push(`*${note.rel}*`);
    lines.push('');
    lines.push(snip);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  lines.push('</vault_context>');
  return lines.join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  let raw = '';
  try { raw = fs.readFileSync('/dev/stdin', 'utf-8').trim(); }
  catch { /* stdin unavailable */ }

  let input: { user_query?: string } = {};
  try { input = JSON.parse(raw); } catch { /* malformed */ }

  const query = input.user_query ?? '';

  const noop = JSON.stringify({ continue: true });

  if (!query || query.length < 4 || !fs.existsSync(VAULT)) {
    process.stdout.write(noop);
    return;
  }

  const terms = tokenise(query);
  if (!terms.length) { process.stdout.write(noop); return; }

  // Score all vault notes
  const results: Array<{ note: Note; sc: number }> = [];
  for (const note of walk(VAULT)) {
    const s = score(note, terms, query);
    if (s >= MIN_SCORE) results.push({ note, sc: s });
  }

  if (!results.length) { process.stdout.write(noop); return; }

  results.sort((a, b) => b.sc - a.sc);
  const top = results.slice(0, TOP_N);

  const hits = top.map(({ note }) => ({
    note,
    snip: snippet(note.body, terms, MAX_SNIPPET_CHARS),
  }));

  let context = format(hits);
  if (context.length > MAX_INJECTION_CHARS) {
    context = context.slice(0, MAX_INJECTION_CHARS) + '\n...\n</vault_context>';
  }

  process.stdout.write(JSON.stringify({ continue: true, prompt_injection: context }));
}

try { main(); }
catch { process.stdout.write(JSON.stringify({ continue: true })); }
