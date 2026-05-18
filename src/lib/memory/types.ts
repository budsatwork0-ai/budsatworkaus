/**
 * Typed memory interfaces for the Buds At Work Obsidian-native memory system.
 *
 * Architecture:
 *   Obsidian vault (filesystem) ←→ Supabase memory_documents (vector DB)
 *                                          ↕
 *                              Agent runtime (read + write)
 */

// ── Categories ────────────────────────────────────────────────────────────────

export const MEMORY_CATEGORIES = [
  'ux',
  'admin',
  'deployments',
  'bugs',
  'architecture',
  'design',
  'sops',
  'analytics',
  'pricing',
  'customers',
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

// ── Source labels ─────────────────────────────────────────────────────────────

export type MemorySource = 'human' | 'agent' | 'deployment' | 'analytics' | 'import';

// ── Status ────────────────────────────────────────────────────────────────────

export type MemoryStatus = 'active' | 'archived' | 'pending';

// ── Frontmatter ───────────────────────────────────────────────────────────────
// The YAML block that appears at the top of every Obsidian memory note.

export interface MemoryFrontmatter {
  memory_id: string;
  category: MemoryCategory;
  tags: string[];
  agent_scope: string | null;
  source: MemorySource;
  created: string;       // ISO 8601
  updated: string;       // ISO 8601
  freshness: number;     // 0.0–1.0
  status: MemoryStatus;
  superseded_by: string | null;
  backlinks: string[];   // [[note-titles]]
}

// ── Core document ─────────────────────────────────────────────────────────────

export interface MemoryDocument {
  id: string;
  vault_path: string | null;
  category: MemoryCategory;
  title: string;
  body: string;
  frontmatter: Partial<MemoryFrontmatter>;
  tags: string[];
  agent_scope: string | null;
  source: MemorySource;
  content_hash: string;
  freshness_score: number;
  vault_synced_at: string | null;
  status: MemoryStatus;
  superseded_by: string | null;
  created_at: string;
  updated_at: string;
}

// ── Search ────────────────────────────────────────────────────────────────────

export interface MemorySearchOpts {
  category?: MemoryCategory;
  /** Agent ID — returns global memories + that agent's scoped memories. */
  agentScope?: string;
  /** Cosine similarity threshold (0–1). Default 0.70. */
  threshold?: number;
  /** Max results. Default 5. */
  limit?: number;
  /** Include documents with freshness_score < 0.3. Default false. */
  includeStale?: boolean;
}

export interface MemorySearchResult extends Omit<MemoryDocument, 'frontmatter'> {
  similarity: number;
}

// ── Write ─────────────────────────────────────────────────────────────────────

export interface NewMemoryInput {
  category: MemoryCategory;
  title: string;
  body: string;
  tags?: string[];
  agentScope?: string | null;
  source?: MemorySource;
  /** Hint vault path (relative). Auto-derived from category/title if omitted. */
  vaultPath?: string;
}

// ── Vault file ────────────────────────────────────────────────────────────────
// Represents a parsed .md file from the Obsidian filesystem.

export interface VaultFile {
  /** Relative path from vault root, e.g. "ux/quote-friction.md" */
  relativePath: string;
  title: string;
  body: string;
  frontmatter: Partial<MemoryFrontmatter>;
  /** Inline #tags extracted from body */
  inlineTags: string[];
  /** [[Backlink]] targets extracted from body */
  backlinks: string[];
  /** raw file content including frontmatter block */
  raw: string;
}

// ── Sync ──────────────────────────────────────────────────────────────────────

export interface SyncStats {
  scanned: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
  durationMs: number;
}

// ── Agent memory context ──────────────────────────────────────────────────────
// Injected into every AgentContext so agents can read and write memory.

export interface MemoryContext {
  /** Semantic + keyword search across the vault. */
  search(query: string, opts?: MemorySearchOpts): Promise<MemorySearchResult[]>;
  /** Retrieve a specific document by ID. */
  recall(id: string): Promise<MemoryDocument | null>;
  /** Write a new memory. Checks for duplicates before persisting. */
  write(memory: NewMemoryInput): Promise<MemoryDocument>;
  /** Find semantically similar documents to an existing one. */
  findRelated(id: string, limit?: number): Promise<MemorySearchResult[]>;
  /** Knowledge graph traversal, decision context, and contradiction detection. */
  graph: import('./graph/types').GraphContext;
}

// ── Dedup ─────────────────────────────────────────────────────────────────────

export interface DedupResult {
  isDuplicate: boolean;
  /** Cosine similarity to the closest match (0 if none found). */
  similarity: number;
  /** ID of the closest existing document, if any. */
  existingId?: string;
}

// ── Embedding provider ────────────────────────────────────────────────────────

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  dimensions: number;
}
