/**
 * Deterministic edge building for the knowledge graph.
 *
 * Three classes of edges, in order of confidence:
 *   1. Backlink edges   — explicit [[wikilink]] → highest confidence
 *   2. Tag-shared edges — Jaccard similarity of tag sets
 *   3. Semantic edges   — embedding cosine similarity above a threshold
 *
 * These require no LLM and run on every graph build / document write.
 * LLM-extracted edges (depends_on, implements, etc.) live in extract.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { GraphEdge, RelationshipType } from './types';
import { cosineSimilarity } from '../embeddings';

// ── Thresholds ─────────────────────────────────────────────────────────────────

/** Embedding similarity above this creates a 'semantic' edge. */
const SEMANTIC_THRESHOLD = 0.75;

/** Tag Jaccard above this creates a 'tag_shared' edge. */
const TAG_JACCARD_THRESHOLD = 0.2;

// ── Upsert helper ─────────────────────────────────────────────────────────────

async function upsertEdge(
  supabase: SupabaseClient,
  sourceId: string,
  targetId: string,
  relationship: RelationshipType,
  strength: number,
  metadata: Record<string, unknown> = {},
  extractedBy = 'system',
): Promise<'created' | 'updated'> {
  const { data: existing } = await supabase
    .from('memory_edges')
    .select('id, strength')
    .eq('source_id', sourceId)
    .eq('target_id', targetId)
    .eq('relationship', relationship)
    .single();

  if (existing) {
    if (Math.abs(existing.strength - strength) > 0.01) {
      await supabase
        .from('memory_edges')
        .update({ strength, metadata, extracted_at: new Date().toISOString() })
        .eq('id', existing.id);
    }
    return 'updated';
  }

  await supabase.from('memory_edges').insert({
    source_id:    sourceId,
    target_id:    targetId,
    relationship,
    strength,
    metadata,
    extracted_by: extractedBy,
  });
  return 'created';
}

// ── Backlink edges ─────────────────────────────────────────────────────────────
// An [[wikilink]] in document A pointing to note title B creates a directed
// backlink edge A → B.

export async function buildBacklinkEdges(
  supabase: SupabaseClient,
  documentId: string,
  backlinkTitles: string[],
): Promise<number> {
  if (backlinkTitles.length === 0) return 0;

  // Resolve [[titles]] to document IDs
  const { data: targets } = await supabase
    .from('memory_documents')
    .select('id, title')
    .in('title', backlinkTitles)
    .eq('status', 'active');

  if (!targets || targets.length === 0) return 0;

  let count = 0;
  for (const t of targets) {
    if (t.id === documentId) continue;
    await upsertEdge(supabase, documentId, t.id, 'backlink', 1.0, {
      linked_title: t.title,
    });
    count++;
  }
  return count;
}

// ── Tag-shared edges ──────────────────────────────────────────────────────────
// For every document, compare its tags against all others.
// Jaccard(A, B) = |A∩B| / |A∪B|

export async function buildTagEdges(
  supabase: SupabaseClient,
  documentId: string,
  tags: string[],
): Promise<number> {
  if (tags.length === 0) return 0;

  // Load all other active documents that share at least one tag
  const { data: candidates } = await supabase
    .from('memory_documents')
    .select('id, tags')
    .neq('id', documentId)
    .eq('status', 'active')
    .overlaps('tags', tags);

  if (!candidates || candidates.length === 0) return 0;

  const tagSetA = new Set(tags);
  let count = 0;

  for (const c of candidates) {
    const tagSetB = new Set<string>(c.tags as string[]);
    const intersection = [...tagSetA].filter((t) => tagSetB.has(t));
    const union        = new Set([...tagSetA, ...tagSetB]);
    const jaccard      = intersection.length / union.size;

    if (jaccard < TAG_JACCARD_THRESHOLD) continue;

    await upsertEdge(supabase, documentId, c.id, 'tag_shared', jaccard, {
      shared_tags: intersection,
      jaccard,
    });
    count++;
  }
  return count;
}

// ── Semantic edges ────────────────────────────────────────────────────────────
// Load embeddings for all active documents; create edges where cosine
// similarity exceeds SEMANTIC_THRESHOLD. Runs in-memory for small vaults.
// For large vaults (> 500 docs), use the pgvector search_memory RPC instead.

export async function buildSemanticEdges(
  supabase: SupabaseClient,
  documentId: string,
  embedding: number[],
): Promise<number> {
  if (embedding.length === 0) return 0;

  // Use existing search_memory RPC — returns docs above threshold ordered by similarity
  const { data: results } = await supabase.rpc('search_memory', {
    query_embedding: embedding,
    match_threshold: SEMANTIC_THRESHOLD,
    match_count:     20,
    filter_category: null,
    filter_scope:    null,
  });

  if (!results || results.length === 0) return 0;

  let count = 0;
  for (const r of results as Array<{ id: string; similarity: number }>) {
    if (r.id === documentId) continue;
    await upsertEdge(supabase, documentId, r.id, 'semantic', r.similarity, {
      cosine_similarity: r.similarity,
    });
    count++;
  }
  return count;
}

// ── Build all deterministic edges for one document ────────────────────────────

export interface DeterministicEdgeStats {
  backlinks: number;
  tagShared: number;
  semantic: number;
}

export async function buildDeterministicEdges(
  supabase: SupabaseClient,
  doc: {
    id: string;
    tags: string[];
    backlinks: string[];   // [[wikilink]] titles parsed from body
    embedding: number[];
  },
): Promise<DeterministicEdgeStats> {
  const [backlinks, tagShared, semantic] = await Promise.all([
    buildBacklinkEdges(supabase, doc.id, doc.backlinks),
    buildTagEdges(supabase, doc.id, doc.tags),
    buildSemanticEdges(supabase, doc.id, doc.embedding),
  ]);
  return { backlinks, tagShared, semantic };
}

// ── Delete stale edges for a document ────────────────────────────────────────

export async function deleteSystemEdges(
  supabase: SupabaseClient,
  documentId: string,
): Promise<void> {
  await supabase
    .from('memory_edges')
    .delete()
    .eq('source_id', documentId)
    .eq('extracted_by', 'system');
}

// ── Batch rebuild for all active documents ────────────────────────────────────

export async function rebuildAllDeterministicEdges(
  supabase: SupabaseClient,
): Promise<{ processed: number; edges: number }> {
  const { data: docs } = await supabase
    .from('memory_documents')
    .select('id, tags, frontmatter, embedding')
    .eq('status', 'active');

  if (!docs || docs.length === 0) return { processed: 0, edges: 0 };

  let processed = 0;
  let totalEdges = 0;

  for (const doc of docs) {
    const frontmatter = (doc.frontmatter as Record<string, unknown>) ?? {};
    const backlinks   = Array.isArray(frontmatter.backlinks)
      ? (frontmatter.backlinks as string[])
      : [];
    const embedding   = Array.isArray(doc.embedding) ? (doc.embedding as number[]) : [];

    await deleteSystemEdges(supabase, doc.id);
    const stats = await buildDeterministicEdges(supabase, {
      id:        doc.id,
      tags:      (doc.tags as string[]) ?? [],
      backlinks,
      embedding,
    });

    totalEdges += stats.backlinks + stats.tagShared + stats.semantic;
    processed++;
  }

  return { processed, edges: totalEdges };
}
