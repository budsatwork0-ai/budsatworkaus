#!/usr/bin/env npx tsx
/**
 * vault-log.ts — Claude Code Stop hook
 *
 * After Claude finishes a session, appends an implementation log entry to the
 * Obsidian vault at Dev/Dev Log YYYY-MM-DD.md.
 *
 * Extracts from the transcript:
 *   - Task: the first user message (the request)
 *   - Files changed: Edit/Write tool_use blocks
 *   - Summary: the last assistant text block
 *   - ADR signal: detects architectural decisions and cross-links vault-adr.ts
 *
 * stdin:  { hook_event_name, session_id, transcript_path, stop_hook_active }
 * stdout: silent — exit 0 always (must not block Claude Code)
 */

import fs from 'fs';
import path from 'path';

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

const VAULT    = process.env.OBSIDIAN_VAULT_PATH ?? path.join(process.cwd(), 'Buds At Work');
const DEV_DIR  = path.join(VAULT, 'Dev');
const MIN_CHARS = 80; // skip trivial responses shorter than this

// ── ADR signal keywords ───────────────────────────────────────────────────────
// If the transcript contains these, annotate the log entry with an ADR prompt.

const ADR_SIGNALS = [
  /\b(architectural decision|decided to use|switching to|migrating (from|to)|replacing|going to use|will use|chose to)\b/i,
  /\b(ADR|architecture|design pattern|trade.?off|we('ll| will) (use|adopt|keep|remove))\b/i,
];

// ── Types ─────────────────────────────────────────────────────────────────────

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; content: unknown }
  | { type: string };

interface Message {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

// ── Transcript parser ─────────────────────────────────────────────────────────

function parseTranscript(filePath: string): Message[] {
  let raw: string;
  try { raw = fs.readFileSync(filePath, 'utf-8').trim(); }
  catch { return []; }

  // Try JSON array
  if (raw.startsWith('[')) {
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? normalise(arr) : [];
    } catch { /* fall through to JSONL */ }
  }

  // JSONL — one object per line
  const msgs: Message[] = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      const obj = JSON.parse(t) as Record<string, unknown>;
      // Direct message
      if (obj.role) { msgs.push(obj as unknown as Message); continue; }
      // Wrapped: { message: { role, content } }
      const inner = obj.message as Record<string, unknown> | undefined;
      if (inner?.role) msgs.push(inner as unknown as Message);
    } catch { /* skip malformed */ }
  }
  return msgs;
}

function normalise(arr: unknown[]): Message[] {
  return arr.flatMap(item => {
    const obj = item as Record<string, unknown>;
    if (obj.role) return [obj as unknown as Message];
    const inner = obj.message as Record<string, unknown> | undefined;
    if (inner?.role) return [inner as unknown as Message];
    return [];
  });
}

// ── Content helpers ───────────────────────────────────────────────────────────

function textOf(content: string | ContentBlock[]): string {
  if (typeof content === 'string') return content;
  return content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map(b => b.text)
    .join('\n');
}

function editedFiles(messages: Message[]): string[] {
  const cwd  = process.cwd();
  const seen = new Set<string>();

  for (const msg of messages) {
    if (msg.role !== 'assistant' || typeof msg.content === 'string') continue;
    for (const block of msg.content) {
      if (block.type !== 'tool_use') continue;
      const b = block as { type: 'tool_use'; name: string; input: Record<string, unknown> };
      if (!['Edit', 'Write', 'NotebookEdit'].includes(b.name)) continue;
      const fp = b.input.file_path as string | undefined;
      if (!fp) continue;
      const rel = fp.startsWith(cwd) ? fp.slice(cwd.length + 1) : fp;
      seen.add(rel);
    }
  }

  return [...seen].sort();
}

// ── ADR detection ─────────────────────────────────────────────────────────────

function hasAdrSignal(text: string): boolean {
  return ADR_SIGNALS.some(r => r.test(text));
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function isoDate(d = new Date()): string {
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
}
function hhmm(d = new Date()): string { return d.toTimeString().slice(0, 5); }

// ── Write log entry ───────────────────────────────────────────────────────────

function writeLog(entry: string, dateStr: string): void {
  fs.mkdirSync(DEV_DIR, { recursive: true });
  const logPath = path.join(DEV_DIR, `Dev Log ${dateStr}.md`);

  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, `# Dev Log ${dateStr}\n\n`, 'utf-8');
  }

  fs.appendFileSync(logPath, entry, 'utf-8');
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  let raw = '';
  try { raw = fs.readFileSync('/dev/stdin', 'utf-8').trim(); } catch { return; }

  let input: { session_id?: string; transcript_path?: string } = {};
  try { input = JSON.parse(raw); } catch { return; }

  if (!input.transcript_path) return;
  if (!fs.existsSync(VAULT))  return;

  const msgs = parseTranscript(input.transcript_path);
  if (!msgs.length) return;

  // Task = first user message
  const firstUser = msgs.find(m => m.role === 'user');
  if (!firstUser) return;
  const task = textOf(firstUser.content).replace(/\n+/g, ' ').trim().slice(0, 300);

  // Summary = last assistant text
  const lastAsst = [...msgs].reverse().find(m => m.role === 'assistant');
  if (!lastAsst) return;
  const summary = textOf(lastAsst.content).trim().slice(0, 500);
  if (summary.length < MIN_CHARS) return; // trivial session

  const files  = editedFiles(msgs);
  const adr    = hasAdrSignal(summary) || hasAdrSignal(task);
  const sid    = (input.session_id ?? '').slice(0, 8);
  const now    = new Date();
  const date   = isoDate(now);
  const time   = hhmm(now);

  const lines: string[] = [
    `## [${time}] Session ${sid}`,
    '',
    `**Task:** ${task}`,
    '',
  ];

  if (files.length) {
    lines.push('**Files changed:**');
    for (const f of files.slice(0, 12)) lines.push(`- \`${f}\``);
    lines.push('');
  }

  lines.push('**Summary:**');
  // Wrap summary so it doesn't overflow Obsidian reading pane
  lines.push(summary);
  lines.push('');

  if (adr) {
    lines.push(
      '> **ADR signal detected.** Consider running `npx tsx scripts/vault-adr.ts` to record this decision formally.',
    );
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  writeLog(lines.join('\n'), date);
}

try { main(); }
catch { /* Never block Claude Code */ }
