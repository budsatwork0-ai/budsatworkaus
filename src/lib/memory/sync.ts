/**
 * Vault → Supabase sync orchestrator.
 *
 * Reads all .md files from the Obsidian vault, computes embeddings, and
 * upserts records into memory_documents. Idempotent — skips files whose
 * content hash hasn't changed since the last sync.
 *
 * Flow:
 *   1. Walk vault filesystem
 *   2. Parse frontmatter + body
 *   3. Batch-generate embeddings (dedup-aware)
 *   4. Upsert to Supabase
 *   5. Freshen scores for all unchanged records
 *   6. Return sync stats
 *
 * Run locally via: npx tsx scripts/memory-sync.ts
 * Or trigger via POST /api/memory/sync (admin-only).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { SyncStats, MemoryCategory } from './types';
import { readVault, categoryFromPath } from './vault';
import { getEmbeddingProvider } from './embeddings';
import { upsertMemory } from './write';
import { bulkRefreshFreshness } from './freshness';
import { MEMORY_CATEGORIES } from './types';

function adminSupabase() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing for memory sync');
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── Full vault sync ───────────────────────────────────────────────────────────

export interface SyncOpts {
  /** Only sync files in this category folder. */
  category?: MemoryCategory;
  /** Recompute embeddings even for unchanged content. Default false. */
  forceReembed?: boolean;
  /** Skip dedup checks during bulk import. Default false. */
  skipDedup?: boolean;
  /** Supabase client — uses admin client if omitted. */
  supabase?: SupabaseClient;
}

export async function syncVault(opts: SyncOpts = {}): Promise<SyncStats> {
  const t0       = Date.now();
  const supabase = opts.supabase ?? adminSupabase();
  const provider = getEmbeddingProvider();
  const stats: SyncStats = { scanned: 0, inserted: 0, updated: 0, skipped: 0, errors: [], durationMs: 0 };

  // 1. Read vault files
  const files = readVault({ category: opts.category, skipArchived: false });
  stats.scanned = files.length;

  if (files.length === 0) {
    stats.durationMs = Date.now() - t0;
    return stats;
  }

  // 2. Batch-embed all files
  const embedTexts = files.map((f) => `${f.title}\n\n${f.body}`);
  let embeddings: number[][] = [];

  if (process.env.OPENAI_API_KEY) {
    try {
      embeddings = await provider.embedBatch(embedTexts);
    } catch (err) {
      stats.errors.push(`Batch embedding failed: ${(err as Error).message}. Syncing without vectors.`);
      embeddings = files.map(() => []);
    }
  } else {
    embeddings = files.map(() => []);
  }

  // 3. Upsert each file
  for (let i = 0; i < files.length; i++) {
    const file      = files[i];
    const embedding = embeddings[i] ?? [];
    const category  = categoryFromPath(file.relativePath) as MemoryCategory;
    if (!category) continue;

    // Merge frontmatter tags + inline tags, deduplicated
    const fmTags   = Array.isArray(file.frontmatter.tags) ? file.frontmatter.tags : [];
    const allTags  = [...new Set([...fmTags, ...file.inlineTags])];

    try {
      const outcome = await upsertMemory(supabase, {
        vaultPath:   file.relativePath,
        category,
        title:       file.title,
        body:        file.body,
        tags:        allTags,
        agentScope:  file.frontmatter.agent_scope ?? null,
        source:      'human',
        embedding,
        frontmatter: file.frontmatter as Record<string, unknown>,
      });

      if (outcome === 'inserted') stats.inserted++;
      else if (outcome === 'updated') stats.updated++;
      else stats.skipped++;
    } catch (err) {
      stats.errors.push(`${file.relativePath}: ${(err as Error).message}`);
    }
  }

  // 4. Refresh freshness scores for all active records
  await refreshAllFreshness(supabase);

  stats.durationMs = Date.now() - t0;
  return stats;
}

// ── Freshness refresh ─────────────────────────────────────────────────────────

async function refreshAllFreshness(
  supabase: SupabaseClient,
): Promise<void> {
  const { data } = await supabase
    .from('memory_documents')
    .select('id, category, updated_at, freshness_score')
    .eq('status', 'active');

  if (!data || data.length === 0) return;

  const updates = bulkRefreshFreshness(
    data as Array<{ id: string; category: MemoryCategory; updated_at: string; freshness_score: number }>,
  );

  // Batch update in chunks of 50 to avoid payload limits
  const CHUNK = 50;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const chunk = updates.slice(i, i + CHUNK);
    for (const u of chunk) {
      await supabase
        .from('memory_documents')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ freshness_score: u.freshness_score } as any)
        .eq('id', u.id);
    }
  }
}

// ── Export agent-written memories back to vault ───────────────────────────────
// Promotes 'pending' agent memories to the vault filesystem + marks active.

export async function exportAgentMemories(opts: SyncOpts = {}): Promise<{
  exported: number;
  errors: string[];
}> {
  const supabase = opts.supabase ?? adminSupabase();

  const { data: pending } = await supabase
    .from('memory_documents')
    .select('id, vault_path, category, title, body, frontmatter, tags, source, freshness_score')
    .eq('status', 'pending')
    .eq('source', 'agent')
    .limit(100);

  if (!pending || pending.length === 0) return { exported: 0, errors: [] };

  const { writeVaultFile } = await import('./vault');
  const { buildNote } = await import('./frontmatter');

  let exported = 0;
  const errors: string[] = [];

  for (const doc of pending) {
    try {
      const fm = {
        ...(doc.frontmatter as Record<string, unknown>),
        memory_id:   doc.id,
        category:    doc.category,
        tags:        doc.tags,
        source:      doc.source,
        freshness:   doc.freshness_score,
        status:      'active' as const,
      };

      const content = buildNote(fm, doc.body);
      writeVaultFile(doc.vault_path, content);

      await supabase
        .from('memory_documents')
        .update({ status: 'active', vault_synced_at: new Date().toISOString() })
        .eq('id', doc.id);

      exported++;
    } catch (err) {
      errors.push(`${doc.vault_path}: ${(err as Error).message}`);
    }
  }

  return { exported, errors };
}
