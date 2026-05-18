/**
 * Duplicate memory detection.
 *
 * Before writing a new memory, check cosine similarity against existing
 * documents in the same category. Two thresholds:
 *
 *   similarity > DEDUP_HARD_THRESHOLD (0.95) → definite duplicate, skip
 *   similarity > DEDUP_SOFT_THRESHOLD (0.85) → likely duplicate, flag
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DedupResult, MemoryCategory } from './types';
import { embedDocument } from './embeddings';
import { DEDUP_HARD_THRESHOLD, DEDUP_SOFT_THRESHOLD, SEARCH_DEFAULT_THRESHOLD } from './config';

// ── Main dedup check ──────────────────────────────────────────────────────────

/**
 * Check if a memory with the given title + body already exists in Supabase.
 *
 * Uses pgvector cosine similarity — requires the embedding to be pre-computed
 * or computes it fresh. Returns { isDuplicate, similarity, existingId }.
 */
export async function checkDuplicate(
  supabase: SupabaseClient,
  title: string,
  body: string,
  category: MemoryCategory,
  embedding?: number[],
): Promise<DedupResult> {
  const vec = embedding ?? (await embedDocument(title, body));

  // Use Supabase pgvector to find nearest neighbour in same category
  const { data, error } = await supabase.rpc('search_memory', {
    query_embedding: vec,
    match_threshold: DEDUP_SOFT_THRESHOLD,
    match_count: 1,
    filter_category: category,
    filter_scope: null,
  });

  if (error || !data || data.length === 0) {
    return { isDuplicate: false, similarity: 0 };
  }

  const top = data[0] as { id: string; similarity: number };
  const sim  = top.similarity;

  return {
    isDuplicate: sim >= DEDUP_HARD_THRESHOLD,
    similarity:  sim,
    existingId:  top.id,
  };
}

// ── In-process dedup (for batch sync) ────────────────────────────────────────
// When syncing many vault files at once, doing one RPC per file is expensive.
// Instead, load all embeddings for a category once and check in-process.

import { cosineSimilarity } from './embeddings';

export interface InProcessCandidate {
  id: string;
  embedding: number[];
}

/**
 * Check a new embedding against a pre-loaded set of candidates.
 * Faster for bulk operations — avoids a round-trip per document.
 */
export function checkDuplicateInProcess(
  newEmbedding: number[],
  candidates: InProcessCandidate[],
): DedupResult {
  if (candidates.length === 0) return { isDuplicate: false, similarity: 0 };

  let bestSim = 0;
  let bestId  = '';

  for (const c of candidates) {
    const sim = cosineSimilarity(newEmbedding, c.embedding);
    if (sim > bestSim) {
      bestSim = sim;
      bestId  = c.id;
    }
  }

  return {
    isDuplicate: bestSim >= DEDUP_HARD_THRESHOLD,
    similarity:  bestSim,
    existingId:  bestId || undefined,
  };
}

// ── Duplicate report type ─────────────────────────────────────────────────────

export type DedupSeverity = 'hard' | 'soft' | 'none';

export function dedupSeverity(similarity: number): DedupSeverity {
  if (similarity >= DEDUP_HARD_THRESHOLD) return 'hard';
  if (similarity >= DEDUP_SOFT_THRESHOLD) return 'soft';
  return 'none';
}
