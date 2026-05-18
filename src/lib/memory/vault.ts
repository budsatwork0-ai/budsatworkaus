/**
 * Obsidian vault reader.
 *
 * Walks the vault filesystem, parses .md files, and returns structured
 * VaultFile objects. Only runs in Node.js (sync scripts, local API routes).
 * Never imported by Edge runtime code.
 */

import fs from 'fs';
import path from 'path';
import type { MemoryCategory } from './types';
import type { VaultFile } from './types';
import {
  splitFrontmatter,
  parseFrontmatter,
  extractInlineTags,
  extractBacklinks,
} from './frontmatter';
import { CATEGORY_FOLDER, VAULT_SKIP_FOLDERS, getVaultPath } from './config';
import { MEMORY_CATEGORIES } from './types';

// ── Vault walker ──────────────────────────────────────────────────────────────

/** Walk a directory recursively, yielding absolute paths to .md files. */
function* walkMd(dir: string): Generator<string> {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (VAULT_SKIP_FOLDERS.includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkMd(full);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      yield full;
    }
  }
}

// ── Parse a single file ───────────────────────────────────────────────────────

/** Parse a vault .md file into a VaultFile. Returns null if the file is malformed. */
export function parseVaultFile(absolutePath: string, vaultRoot: string): VaultFile | null {
  let raw: string;
  try {
    raw = fs.readFileSync(absolutePath, 'utf-8');
  } catch {
    return null;
  }

  const relativePath = path.relative(vaultRoot, absolutePath).replace(/\\/g, '/');
  const { fmRaw, body } = splitFrontmatter(raw);
  const frontmatter    = parseFrontmatter(fmRaw);
  const inlineTags     = extractInlineTags(body);
  const backlinks      = extractBacklinks(body);

  // Title: first H1 in body, or filename stem
  const h1Match = body.match(/^#\s+(.+)$/m);
  const title   =
    h1Match?.[1]?.trim() ??
    path.basename(absolutePath, '.md').replace(/[-_]/g, ' ');

  return {
    relativePath,
    title,
    body,
    frontmatter,
    inlineTags,
    backlinks,
    raw,
  };
}

// ── Derive category from path ─────────────────────────────────────────────────

/** Infer the memory category from a file's relative vault path. */
export function categoryFromPath(relativePath: string): MemoryCategory | null {
  const topFolder = relativePath.split('/')[0];
  const entry = Object.entries(CATEGORY_FOLDER).find(([, folder]) => folder === topFolder);
  return entry ? (entry[0] as MemoryCategory) : null;
}

/** Return true if a relative path belongs to a recognised memory category folder. */
export function isMemoryPath(relativePath: string): boolean {
  return categoryFromPath(relativePath) !== null;
}

// ── Read vault ────────────────────────────────────────────────────────────────

export interface ReadVaultOpts {
  /** Only include files from this category folder. */
  category?: MemoryCategory;
  /** Skip files whose frontmatter.status is 'archived'. Default false. */
  skipArchived?: boolean;
}

/**
 * Read all memory .md files from the vault, returning parsed VaultFile objects.
 * Skips files outside the memory category folders and non-.md files.
 */
export function readVault(opts: ReadVaultOpts = {}): VaultFile[] {
  const vaultRoot = getVaultPath();
  const files: VaultFile[] = [];

  if (!fs.existsSync(vaultRoot)) {
    throw new Error(`Vault not found at ${vaultRoot}. Set OBSIDIAN_VAULT_PATH correctly.`);
  }

  for (const absPath of walkMd(vaultRoot)) {
    const relativePath = path.relative(vaultRoot, absPath).replace(/\\/g, '/');

    // Only process files inside recognised category folders
    const cat = categoryFromPath(relativePath);
    if (!cat) continue;
    if (opts.category && cat !== opts.category) continue;

    const file = parseVaultFile(absPath, vaultRoot);
    if (!file) continue;

    if (opts.skipArchived && file.frontmatter.status === 'archived') continue;

    files.push(file);
  }

  return files;
}

// ── Write vault ───────────────────────────────────────────────────────────────

/**
 * Write a memory note back to the vault.
 * Creates parent directories if they don't exist.
 */
export function writeVaultFile(relativePath: string, content: string): void {
  const vaultRoot  = getVaultPath();
  const absPath    = path.join(vaultRoot, relativePath);
  const dir        = path.dirname(absPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(absPath, content, 'utf-8');
}

/**
 * Delete a memory note from the vault (moves to .trash).
 * Safe — does not permanently delete.
 */
export function trashVaultFile(relativePath: string): void {
  const vaultRoot = getVaultPath();
  const absPath   = path.join(vaultRoot, relativePath);
  const trashDir  = path.join(vaultRoot, '.trash');
  const trashPath = path.join(trashDir, path.basename(relativePath));

  if (!fs.existsSync(absPath)) return;
  if (!fs.existsSync(trashDir)) fs.mkdirSync(trashDir, { recursive: true });

  fs.renameSync(absPath, trashPath);
}

// ── Scaffold vault structure ──────────────────────────────────────────────────

/**
 * Create the standard folder structure inside the vault if not already present.
 * Safe to call multiple times.
 */
export function scaffoldVault(): string[] {
  const vaultRoot = getVaultPath();
  const created: string[] = [];

  for (const cat of MEMORY_CATEGORIES) {
    const dir = path.join(vaultRoot, CATEGORY_FOLDER[cat]);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      created.push(dir);
    }
  }

  return created;
}
