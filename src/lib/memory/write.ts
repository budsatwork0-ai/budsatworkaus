/**
 * Memory write layer.
 *
 * Persists a new memory document to Supabase with:
 *   1. Dedup check — aborts or flags if too similar to existing doc
 *   2. Embedding generation
 *   3. Freshness initialised to 1.0
 *   4. Vault path derivation
 *
 * Agent-written memories start with status='pending' and are promoted
 * to 'active' when the vault sync confirms them, or when an admin
 * reviews them via /api/memory/write.
 */

import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MemoryDocument, NewMemoryInput } from './types';
import { embedDocument } from './embeddings';
import { checkDuplicate } from './dedup';
import { CATEGORY_FOLDER } from './config';

// ── Content hash ──────────────────────────────────────────────────────────────

export function contentHash(title: string, body: string): string {
  return createHash('sha256')
    .update(title + '\n' + body)
    .digest('hex')
    .slice(0, 16);
}

// ── Vault path derivation ─────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 64);
}

export function deriveVaultPath(
  category: NewMemoryInput['category'],
  title: string,
): string {
  const folder = CATEGORY_FOLDER[category];
  const slug   = slugify(title);
  const ts     = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `${folder}/${ts}-${slug}.md`;
}

// ── Write result ──────────────────────────────────────────────────────────────

export type WriteResult =
  | { ok: true;  doc: MemoryDocument }
  | { ok: false; reason: 'duplicate'; existingId: string; similarity: number }
  | { ok: false; reason: 'error'; message: string };

// ── Write ─────────────────────────────────────────────────────────────────────

export async function writeMemory(
  supabase: SupabaseClient,
  input: NewMemoryInput,
  opts: {
    /** If true, write even if a soft duplicate is detected. Default false. */
    allowSoftDuplicate?: boolean;
    /** Override the default 'pending' status for agent writes. */
    status?: 'active' | 'pending';
    /** Agent ID — used to tag source and log. */
    agentId?: string;
  } = {},
): Promise<WriteResult> {
  const { category, title, body } = input;

  // 1. Generate embedding
  let embedding: number[];
  try {
    embedding = await embedDocument(title, body);
  } catch (err) {
    // Embedding failure is non-fatal — write without vector; search will use keyword fallback
    embedding = [];
    console.warn('[memory/write] embedding failed, writing without vector:', err);
  }

  // 2. Dedup check
  if (embedding.length > 0) {
    const dedup = await checkDuplicate(supabase, title, body, category, embedding);
    if (dedup.isDuplicate && dedup.existingId) {
      return { ok: false, reason: 'duplicate', existingId: dedup.existingId, similarity: dedup.similarity };
    }
    if (!opts.allowSoftDuplicate && dedup.similarity >= 0.85 && dedup.existingId) {
      return { ok: false, reason: 'duplicate', existingId: dedup.existingId, similarity: dedup.similarity };
    }
  }

  // 3. Derive vault path
  const vaultPath = input.vaultPath ?? deriveVaultPath(category, title);
  const hash      = contentHash(title, body);
  const tags      = input.tags ?? [];
  const source    = input.source ?? (opts.agentId ? 'agent' : 'human');
  const status    = opts.status ?? (source === 'agent' ? 'pending' : 'active');

  // 4. Insert
  const row: Record<string, unknown> = {
    vault_path:      vaultPath,
    category,
    title,
    body,
    frontmatter:     {},
    tags,
    agent_scope:     input.agentScope ?? null,
    source,
    content_hash:    hash,
    freshness_score: 1.0,
    status,
  };
  if (embedding.length > 0) {
    row.embedding = `[${embedding.join(',')}]`;
  }

  const { data, error } = await supabase
    .from('memory_documents')
    .insert(row)
    .select()
    .single();

  if (error || !data) {
    const duplicateVaultPath =
      error?.code === '23505' ||
      error?.message?.includes('memory_documents_vault_path_key') ||
      error?.message?.toLowerCase().includes('duplicate key');

    if (duplicateVaultPath) {
      const { data: upserted, error: upsertError } = await supabase
        .from('memory_documents')
        .upsert(row, { onConflict: 'vault_path' })
        .select()
        .single();

      if (!upsertError && upserted) {
        return { ok: true, doc: upserted as MemoryDocument };
      }

      return { ok: false, reason: 'error', message: upsertError?.message ?? 'Vault path upsert failed' };
    }

    return { ok: false, reason: 'error', message: error?.message ?? 'Insert failed' };
  }

  return { ok: true, doc: data as MemoryDocument };
}

// ── Upsert (used by sync) ─────────────────────────────────────────────────────

/**
 * Insert or update a memory document identified by vault_path.
 * Only updates the DB record if content_hash differs (avoids unnecessary rewrites).
 * Returns 'inserted' | 'updated' | 'skipped'.
 */
export async function upsertMemory(
  supabase: SupabaseClient,
  input: {
    vaultPath: string;
    category: NewMemoryInput['category'];
    title: string;
    body: string;
    tags: string[];
    agentScope: string | null;
    source: 'human' | 'import';
    embedding: number[];
    frontmatter: Record<string, unknown>;
  },
): Promise<'inserted' | 'updated' | 'skipped'> {
  const hash = contentHash(input.title, input.body);

  // Check existing record
  const { data: existing } = await supabase
    .from('memory_documents')
    .select('id, content_hash')
    .eq('vault_path', input.vaultPath)
    .single();

  if (existing && existing.content_hash === hash) {
    return 'skipped';
  }

  const row: Record<string, unknown> = {
    vault_path:      input.vaultPath,
    category:        input.category,
    title:           input.title,
    body:            input.body,
    frontmatter:     input.frontmatter,
    tags:            input.tags,
    agent_scope:     input.agentScope,
    source:          input.source,
    content_hash:    hash,
    freshness_score: 1.0,
    vault_synced_at: new Date().toISOString(),
    status:          'active',
  };
  if (input.embedding.length > 0) {
    row.embedding = `[${input.embedding.join(',')}]`;
  }

  const { error } = await supabase
    .from('memory_documents')
    .upsert(row, { onConflict: 'vault_path' });

  if (error) throw new Error(`upsertMemory: ${error.message}`);

  return existing ? 'updated' : 'inserted';
}

// ── Archive ───────────────────────────────────────────────────────────────────

export async function archiveMemory(
  supabase: SupabaseClient,
  id: string,
  supersededBy?: string,
): Promise<void> {
  const update: Record<string, unknown> = { status: 'archived' };
  if (supersededBy) update.superseded_by = supersededBy;
  await supabase.from('memory_documents').update(update).eq('id', id);
}
