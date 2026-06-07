/**
 * Schema Guard
 *
 * Validates proposed patch file content against src/types/database.ts —
 * the authoritative generated Supabase types — before any branch is created.
 *
 * Why this matters: createServiceClient() returns SupabaseClient<Database>.
 * Any .from('table') call whose table is absent from Database.public.Tables
 * resolves to `never`, producing "not assignable to parameter of type 'never'"
 * or "Property X does not exist on type 'never'" at tsc time.
 * CI catches this, but only after a ~90s build. This guard catches it in-process
 * before the branch is ever written.
 *
 * Fail-open contract: if database.ts cannot be read or parsed, loadLocalSchema()
 * returns an empty Map and scanPatch() returns no violations. A missing or
 * unreadable schema never blocks a patch — CI remains the source of truth.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

/** table name → set of column names from its Row type */
export type SchemaMap = Map<string, Set<string>>;

export interface SchemaViolation {
  file: string;
  table: string;
  column?: string;
  /** Human-readable message suitable for a corrective prompt */
  message: string;
}

// ── Schema extraction ─────────────────────────────────────────────────────────

/**
 * Given source text and the index of an opening `{`, return the content
 * between that brace and its matching closing `}`, tracking nesting and
 * string literals. Returns null if no matching close is found.
 */
function extractBlock(src: string, openIdx: number): { content: string; end: number } | null {
  let depth = 0;
  let i = openIdx;
  let inStr = false;
  let strChar = '';

  while (i < src.length) {
    const ch = src[i];
    if (inStr) {
      if (ch === strChar && src[i - 1] !== '\\') inStr = false;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      inStr = true;
      strChar = ch;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) return { content: src.slice(openIdx + 1, i), end: i };
    }
    i++;
  }
  return null;
}

/**
 * Parse src/types/database.ts and return a map of tableName → Set<columnName>.
 * Only reads Database.public.Tables — views, functions, and enums are excluded.
 *
 * Algorithm:
 *   1. Locate `Tables: {` and extract its block.
 *   2. Within that block, iterate `identifierName: {` patterns (table entries).
 *   3. Within each table block, locate `Row: {` and extract column names.
 *
 * After processing each table block, the regex cursor jumps past its closing
 * brace to avoid re-matching internal `Row: {`, `Insert: {`, etc.
 */
export function extractSchema(src: string): SchemaMap {
  const schema = new Map<string, Set<string>>();

  // 1. Find Tables: { and extract its block
  const tablesRe = /\bTables\s*:\s*\{/;
  const tablesMatch = tablesRe.exec(src);
  if (!tablesMatch) return schema;

  const tablesOpenIdx = src.indexOf('{', tablesMatch.index + 'Tables'.length);
  if (tablesOpenIdx === -1) return schema;

  const tablesBlock = extractBlock(src, tablesOpenIdx);
  if (!tablesBlock) return schema;

  const tablesContent = tablesBlock.content;

  // 2. Iterate top-level table entries: `tableName: {`
  const tableEntryRe = /\b([a-z_][a-z0-9_]*)\s*:\s*\{/gi;
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tableEntryRe.exec(tablesContent)) !== null) {
    const tableName = tableMatch[1];
    // Skip TypeScript keywords that can appear at this level
    if (tableName === 'Row' || tableName === 'Insert' || tableName === 'Update' || tableName === 'Relationships') {
      continue;
    }

    const tableOpenIdx = tablesContent.indexOf('{', tableMatch.index + tableMatch[0].length - 1);
    if (tableOpenIdx === -1) continue;

    const tableBlock = extractBlock(tablesContent, tableOpenIdx);
    if (!tableBlock) continue;

    // Jump regex cursor past this table's block to avoid matching its internals
    tableEntryRe.lastIndex = tableBlock.end + 1;

    // 3. Find Row: { within the table block and extract column names
    const rowRe = /\bRow\s*:\s*\{/;
    const rowMatch = rowRe.exec(tableBlock.content);
    if (!rowMatch) continue;

    const rowOpenIdx = tableBlock.content.indexOf('{', rowMatch.index + 'Row'.length);
    if (rowOpenIdx === -1) continue;

    const rowBlock = extractBlock(tableBlock.content, rowOpenIdx);
    if (!rowBlock) continue;

    // Column names: `columnName:` at the top level of the Row block
    const colRe = /\b([a-z_][a-z0-9_]*)\s*:/gi;
    const columns = new Set<string>();
    let colMatch: RegExpExecArray | null;
    while ((colMatch = colRe.exec(rowBlock.content)) !== null) {
      columns.add(colMatch[1]);
    }

    schema.set(tableName, columns);
  }

  return schema;
}

/**
 * Load the schema from the repo's generated types file.
 * Returns an empty Map on any read or parse failure (fail-open).
 */
export function loadLocalSchema(): SchemaMap {
  try {
    const src = readFileSync(
      path.join(process.cwd(), 'src/types/database.ts'),
      'utf-8',
    );
    return extractSchema(src);
  } catch {
    return new Map();
  }
}

// ── Patch content scanner ─────────────────────────────────────────────────────

interface SupabaseRef {
  table: string;
  operation: 'from' | 'insert' | 'update' | 'select';
  /** Column names extracted from the operation. Empty for bare .from() calls. */
  columns: string[];
  line: number;
}

/** Return the 1-based line number of byte offset `pos` in `src`. */
function lineAt(src: string, pos: number): number {
  let n = 1;
  for (let i = 0; i < pos; i++) {
    if (src[i] === '\n') n++;
  }
  return n;
}

/**
 * Extract the string literal starting at `src[quoteIdx]` (the opening quote).
 * Returns null for template literals with expressions, multi-line strings,
 * or any other form that can't be statically determined.
 */
function extractStringLiteral(src: string, quoteIdx: number): string | null {
  const q = src[quoteIdx];
  if (q !== '"' && q !== "'" && q !== '`') return null;
  let i = quoteIdx + 1;
  let result = '';
  while (i < src.length) {
    const ch = src[i];
    if (ch === q) return result;
    if (ch === '\n') return null;     // multi-line
    if (ch === '$' && src[i + 1] === '{') return null; // template expression
    if (ch === '\\') { i += 2; continue; }
    result += ch;
    i++;
  }
  return null;
}

/**
 * Find the closing char from `startIdx` (the character AFTER the opener),
 * respecting nested pairs and string literals.
 */
function findClosing(
  src: string,
  startIdx: number,
  open: string,
  close: string,
): number | null {
  let depth = 1;
  let i = startIdx;
  let inStr = false;
  let strCh = '';
  while (i < src.length) {
    const ch = src[i];
    if (inStr) {
      if (ch === strCh && src[i - 1] !== '\\') inStr = false;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      inStr = true;
      strCh = ch;
    } else if (ch === open) {
      depth++;
    } else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return null;
}

/**
 * Extract simple identifier keys from an object literal body.
 * Skips computed keys (`[expr]`), spread (`...`), and method shorthand.
 * Returns lowercase key names.
 */
function extractObjectKeys(inner: string): string[] {
  const keys: string[] = [];
  // Match `identifierName:` at start-of-token, not after `.`
  const re = /(?:^|[,\s{])([a-z_][a-z0-9_]*)\s*:/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null) {
    keys.push(m[1].toLowerCase());
  }
  return keys;
}

/**
 * Scan patch content and return all Supabase table/column references we can
 * statically determine. Only handles string-literal table names and simple
 * object literals — dynamic expressions are silently skipped.
 */
function extractSupabaseRefs(content: string): SupabaseRef[] {
  const refs: SupabaseRef[] = [];

  // ── .from('table') ──────────────────────────────────────────────────────────
  const fromRe = /\.from\s*\(\s*(['"`])/g;
  let m: RegExpExecArray | null;
  while ((m = fromRe.exec(content)) !== null) {
    const quoteIdx = m.index + m[0].length - 1;
    const table = extractStringLiteral(content, quoteIdx);
    if (table) {
      refs.push({ table, operation: 'from', columns: [], line: lineAt(content, m.index) });
    }
  }

  // ── .insert({ or .insert([{ ─────────────────────────────────────────────────
  // Handles both single-object and array forms.
  const insertRe = /\.insert\s*\(\s*(?:\[\s*)?\{/g;
  while ((m = insertRe.exec(content)) !== null) {
    const braceIdx = content.lastIndexOf('{', m.index + m[0].length - 1);
    const closeIdx = findClosing(content, braceIdx + 1, '{', '}');
    if (closeIdx === null) continue;
    const inner = content.slice(braceIdx + 1, closeIdx);
    const keys = extractObjectKeys(inner);
    if (keys.length === 0) continue;

    // Associate with the nearest preceding .from() call
    const priorFrom = [...refs].reverse().find(r => r.operation === 'from');
    if (priorFrom) {
      refs.push({ table: priorFrom.table, operation: 'insert', columns: keys, line: lineAt(content, m.index) });
    }
  }

  // ── .update({ ───────────────────────────────────────────────────────────────
  const updateRe = /\.update\s*\(\s*\{/g;
  while ((m = updateRe.exec(content)) !== null) {
    const braceIdx = content.lastIndexOf('{', m.index + m[0].length - 1);
    const closeIdx = findClosing(content, braceIdx + 1, '{', '}');
    if (closeIdx === null) continue;
    const inner = content.slice(braceIdx + 1, closeIdx);
    const keys = extractObjectKeys(inner);
    if (keys.length === 0) continue;

    const priorFrom = [...refs].reverse().find(r => r.operation === 'from');
    if (priorFrom) {
      refs.push({ table: priorFrom.table, operation: 'update', columns: keys, line: lineAt(content, m.index) });
    }
  }

  // ── .select('col1, col2') ───────────────────────────────────────────────────
  // Only validates simple bare-word comma-separated lists. Skips '*', joins,
  // dot-notation, and anything with parentheses.
  const selectRe = /\.select\s*\(\s*(['"`])/g;
  while ((m = selectRe.exec(content)) !== null) {
    const quoteIdx = m.index + m[0].length - 1;
    const sel = extractStringLiteral(content, quoteIdx);
    if (!sel || sel === '*' || /[.(]/.test(sel)) continue;

    const cols = sel
      .split(',')
      .map(c => c.trim().split(/\s/)[0])
      .filter(c => /^[a-z_][a-z0-9_]*$/i.test(c));
    if (cols.length === 0) continue;

    const priorFrom = [...refs].reverse().find(r => r.operation === 'from');
    if (priorFrom) {
      refs.push({ table: priorFrom.table, operation: 'select', columns: cols, line: lineAt(content, m.index) });
    }
  }

  return refs;
}

/**
 * Scan a single patch file's content against the schema and return any
 * violations found. Returns an empty array when:
 *   - schema is empty (fail-open)
 *   - no Supabase calls are detected
 *   - all references are valid
 */
export function scanPatch(file: string, content: string, schema: SchemaMap): SchemaViolation[] {
  if (schema.size === 0) return [];

  const refs = extractSupabaseRefs(content);
  const violations: SchemaViolation[] = [];
  const seenUnknownTables = new Set<string>();

  for (const ref of refs) {
    if (ref.operation === 'from') {
      if (!schema.has(ref.table) && !seenUnknownTables.has(ref.table)) {
        seenUnknownTables.add(ref.table);
        violations.push({
          file,
          table: ref.table,
          message:
            `Unknown table \`${ref.table}\` (line ${ref.line}). ` +
            `\`createServiceClient()\` is typed against \`Database\` — only these tables exist: ` +
            `${[...schema.keys()].sort().join(', ')}.`,
        });
      }
      continue;
    }

    // Column validation only applies to tables that exist in the schema
    const tableColumns = schema.get(ref.table);
    if (!tableColumns) continue; // unknown table already flagged above

    for (const col of ref.columns) {
      if (!tableColumns.has(col)) {
        violations.push({
          file,
          table: ref.table,
          column: col,
          message:
            `Column \`${col}\` does not exist on table \`${ref.table}\` (line ${ref.line}). ` +
            `Known columns: ${[...tableColumns].sort().join(', ')}.`,
        });
      }
    }
  }

  return violations;
}

/**
 * Run scanPatch across all patches in a set.
 * Returns a flat list of all violations, deduplicated by (file, table, column).
 */
export function scanAllPatches(
  patches: ReadonlyArray<{ file: string; content: string }>,
  schema: SchemaMap,
): SchemaViolation[] {
  const seen = new Set<string>();
  const all: SchemaViolation[] = [];

  for (const patch of patches) {
    for (const v of scanPatch(patch.file, patch.content, schema)) {
      const key = `${v.file}:${v.table}:${v.column ?? ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        all.push(v);
      }
    }
  }

  return all;
}
