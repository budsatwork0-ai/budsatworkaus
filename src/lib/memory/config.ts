import type { MemoryCategory } from './types';

// ── Vault path ────────────────────────────────────────────────────────────────

/** Absolute path to the Obsidian vault root. Set OBSIDIAN_VAULT_PATH in .env.local. */
export function getVaultPath(): string {
  const p = process.env.OBSIDIAN_VAULT_PATH;
  if (!p) throw new Error('OBSIDIAN_VAULT_PATH env var is not set');
  return p;
}

// ── Category → vault subfolder ────────────────────────────────────────────────

export const CATEGORY_FOLDER: Record<MemoryCategory, string> = {
  ux:           'ux',
  admin:        'admin',
  deployments:  'deployments',
  bugs:         'bugs',
  architecture: 'architecture',
  design:       'design',
  sops:         'sops',
  analytics:    'analytics',
  pricing:      'pricing',
  customers:    'customers',
};

// ── Freshness decay rates ─────────────────────────────────────────────────────
// Represents the fraction of freshness retained per day of inactivity.
// Half-life = log(0.5) / log(rate) days.
// Deployments: ~9d half-life. Architecture: ~693d half-life.

export const FRESHNESS_DECAY: Record<MemoryCategory, number> = {
  deployments:  0.93,   // ~9d half-life — deployment notes go stale fast
  bugs:         0.95,   // ~13d
  analytics:    0.97,   // ~22d
  pricing:      0.98,   // ~34d
  customers:    0.98,   // ~34d
  ux:           0.99,   // ~69d
  admin:        0.99,   // ~69d
  sops:         0.995,  // ~138d
  architecture: 0.999,  // ~693d — architectural decisions outlast everything
  design:       0.999,  // ~693d
};

/** Documents with freshness below this threshold are considered stale. */
export const FRESHNESS_STALE_THRESHOLD = 0.3;

/** Each time an agent reads a memory, its freshness is nudged up by this amount. */
export const FRESHNESS_READ_BOOST = 0.05;

// ── Dedup thresholds ──────────────────────────────────────────────────────────

/** Cosine similarity above this = treat as a duplicate, skip write. */
export const DEDUP_HARD_THRESHOLD = 0.95;

/** Cosine similarity above this (but below hard) = flag for review. */
export const DEDUP_SOFT_THRESHOLD = 0.85;

// ── Embedding model ───────────────────────────────────────────────────────────

export const EMBEDDING_MODEL    = 'text-embedding-3-small';
export const EMBEDDING_DIMS     = 1536;
/** Max chars to embed. Longer texts are chunked/truncated before embedding. */
export const EMBEDDING_MAX_CHARS = 8000;

// ── Semantic search defaults ──────────────────────────────────────────────────

export const SEARCH_DEFAULT_THRESHOLD = 0.70;
export const SEARCH_DEFAULT_LIMIT     = 5;
export const SEARCH_MAX_LIMIT         = 20;

// ── Vault structure ───────────────────────────────────────────────────────────

/** Frontmatter delimiter used in Obsidian notes. */
export const FM_DELIMITER = '---';

/** Glob pattern to find all memory notes in the vault. */
export const VAULT_MEMORY_GLOB = '**/*.md';

/** Folders inside the vault that are NOT memory categories (skipped during sync). */
export const VAULT_SKIP_FOLDERS = ['.obsidian', '.trash', 'templates', 'attachments'];
