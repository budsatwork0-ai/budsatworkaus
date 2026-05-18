/**
 * Obsidian frontmatter parser and serializer.
 *
 * Handles the YAML subset we use in memory notes:
 *   - string values (plain, single-quoted, double-quoted)
 *   - numbers and floats
 *   - booleans (true/false)
 *   - null / empty values
 *   - inline arrays: [a, b, c]
 *   - ISO date strings
 *
 * We do NOT need a full YAML parser because we control what we write.
 */

import { FM_DELIMITER } from './config';
import type { MemoryFrontmatter } from './types';

// ── Parse ─────────────────────────────────────────────────────────────────────

/** Split a markdown file into { frontmatter raw string, body }. */
export function splitFrontmatter(raw: string): { fmRaw: string; body: string } {
  const normalized = raw.replace(/\r\n/g, '\n');
  if (!normalized.startsWith(FM_DELIMITER + '\n')) {
    return { fmRaw: '', body: normalized };
  }
  const end = normalized.indexOf('\n' + FM_DELIMITER, FM_DELIMITER.length);
  if (end === -1) {
    return { fmRaw: '', body: normalized };
  }
  const fmRaw  = normalized.slice(FM_DELIMITER.length + 1, end);
  const body   = normalized.slice(end + FM_DELIMITER.length + 2).trim();
  return { fmRaw, body };
}

/** Parse raw frontmatter YAML string into a plain object. */
export function parseFrontmatter(fmRaw: string): Partial<MemoryFrontmatter> {
  if (!fmRaw.trim()) return {};
  const result: Record<string, unknown> = {};

  for (const line of fmRaw.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const raw = line.slice(colonIdx + 1).trim();

    if (!key || key.startsWith('#')) continue;

    result[key] = parseYamlValue(raw);
  }

  return result as Partial<MemoryFrontmatter>;
}

function parseYamlValue(raw: string): unknown {
  if (raw === '' || raw === 'null' || raw === '~') return null;
  if (raw === 'true')  return true;
  if (raw === 'false') return false;

  // Inline array: [item1, item2]
  if (raw.startsWith('[') && raw.endsWith(']')) {
    const inner = raw.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((s) => parseYamlScalar(s.trim()));
  }

  return parseYamlScalar(raw);
}

function parseYamlScalar(raw: string): unknown {
  if (!raw || raw === 'null' || raw === '~') return null;

  // Quoted strings
  if ((raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }

  // Numbers
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);

  return raw;
}

// ── Serialize ─────────────────────────────────────────────────────────────────

/** Serialize a MemoryFrontmatter object back to a YAML block (without delimiters). */
export function serializeFrontmatter(fm: Partial<MemoryFrontmatter>): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(fm)) {
    if (value === undefined) continue;
    lines.push(`${key}: ${serializeYamlValue(value)}`);
  }

  return lines.join('\n');
}

function serializeYamlValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map((v) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes(':') ? `"${s}"` : s;
    });
    return `[${items.join(', ')}]`;
  }

  if (typeof value === 'string') {
    // Quote if contains special YAML characters
    if (/[:#\[\]{}&*!|>'"%@`]/.test(value) || value.trim() !== value) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  }

  return JSON.stringify(value);
}

// ── Build full note ────────────────────────────────────────────────────────────

/** Wrap serialized frontmatter and body into a complete Obsidian note. */
export function buildNote(fm: Partial<MemoryFrontmatter>, body: string): string {
  const fmBlock = serializeFrontmatter(fm);
  return `${FM_DELIMITER}\n${fmBlock}\n${FM_DELIMITER}\n\n${body.trim()}\n`;
}

// ── Inline tag extraction ─────────────────────────────────────────────────────

/** Extract #hashtags from the body (not inside code blocks or URLs). */
export function extractInlineTags(body: string): string[] {
  const tags = new Set<string>();
  // Remove code blocks first to avoid false positives
  const stripped = body.replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, '');
  for (const match of stripped.matchAll(/#([a-zA-Z0-9_-]+)/g)) {
    tags.add(match[1].toLowerCase());
  }
  return [...tags];
}

// ── Backlink extraction ───────────────────────────────────────────────────────

/** Extract [[WikiLink]] targets from the body. */
export function extractBacklinks(body: string): string[] {
  const links = new Set<string>();
  for (const match of body.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
    links.add(match[1].trim());
  }
  return [...links];
}
