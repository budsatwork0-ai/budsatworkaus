/**
 * Semantic memory search with keyword fallback.
 *
 * Primary path: pgvector cosine similarity via Supabase RPC.
 * Fallback path: full-text ilike search when OPENAI_API_KEY is absent
 *   or embedding fails — keeps the system useful before key is configured.
 *
 * Also handles:
 *   - freshness boosting on read (updates freshness_score + logs the read)
 *   - agent-scoped filtering (global + agent-specific memories)
 *   - stale document filtering
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { MemorySearchOpts, MemorySearchResult } from './types';
import { embedDocument } from './embeddings';
import {
  SEARCH_DEFAULT_LIMIT,
  SEARCH_DEFAULT_THRESHOLD,
  SEARCH_MAX_LIMIT,
} from './config';
import { applyReadBoost } from './freshness';

// ── Semantic search ───────────────────────────────────────────────────────────

async function semanticSearch(
  supabase: SupabaseClient,
  query: string,
  opts: MemorySearchOpts,
): Promise<MemorySearchResult[]> {
  const embedding = await embedDocument(query, '');
  const limit     = Math.min(opts.limit ?? SEARCH_DEFAULT_LIMIT, SEARCH_MAX_LIMIT);
  const threshold = opts.threshold ?? SEARCH_DEFAULT_THRESHOLD;

  const { data, error } = await supabase.rpc('search_memory', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count:     limit,
    filter_category: opts.category ?? null,
    filter_scope:    opts.agentScope ?? null,
  });

  if (error) throw new Error(`Memory search failed: ${error.message}`);
  if (!data) return [];

  const rows = data as Array<{
    id: string;
    vault_path: string | null;
    category: string;
    title: string;
    body: string;
    tags: string[];
    agent_scope: string | null;
    source: string;
    freshness_score: number;
    similarity: number;
    created_at: string;
    updated_at: string;
  }>;

  return rows
    .filter((r) => opts.includeStale || r.freshness_score >= 0.3)
    .map((r) => ({
      id:              r.id,
      vault_path:      r.vault_path,
      category:        r.category as MemorySearchResult['category'],
      title:           r.title,
      body:            r.body,
      tags:            r.tags ?? [],
      agent_scope:     r.agent_scope,
      source:          r.source as MemorySearchResult['source'],
      content_hash:    '',
      freshness_score: r.freshness_score,
      vault_synced_at: null,
      status:          'active' as const,
      superseded_by:   null,
      created_at:      r.created_at,
      updated_at:      r.updated_at,
      similarity:      r.similarity,
    }));
}

// ── Keyword fallback (no embedding API key) ───────────────────────────────────

async function keywordFallback(
  supabase: SupabaseClient,
  query: string,
  opts: MemorySearchOpts,
): Promise<MemorySearchResult[]> {
  const limit = Math.min(opts.limit ?? SEARCH_DEFAULT_LIMIT, SEARCH_MAX_LIMIT);
  const words = query.split(/\s+/).filter(Boolean).slice(0, 8);
  const pattern = words.map((w) => `%${w}%`).join('');

  let q = supabase
    .from('memory_documents')
    .select('id, vault_path, category, title, body, tags, agent_scope, source, freshness_score, created_at, updated_at')
    .eq('status', 'active')
    .or(words.map((w) => `title.ilike.%${w}%,body.ilike.%${w}%`).join(','))
    .limit(limit);

  if (opts.category) q = q.eq('category', opts.category);
  if (!opts.includeStale) q = q.gte('freshness_score', 0.3);

  const { data, error } = await q;
  if (error || !data) return [];

  return data.map((r) => ({
    id:              r.id,
    vault_path:      r.vault_path,
    category:        r.category,
    title:           r.title,
    body:            r.body,
    tags:            r.tags ?? [],
    agent_scope:     r.agent_scope,
    source:          r.source,
    content_hash:    '',
    freshness_score: r.freshness_score,
    vault_synced_at: null,
    status:          'active' as const,
    superseded_by:   null,
    created_at:      r.created_at,
    updated_at:      r.updated_at,
    similarity:      0,
  }));
}

// ── Public search ─────────────────────────────────────────────────────────────

export interface SearchContext {
  supabase: SupabaseClient;
  /** Agent ID — for read log and scope filtering. */
  agentId?: string;
  runId?: string;
}

export async function searchMemory(
  query: string,
  opts: MemorySearchOpts,
  ctx: SearchContext,
): Promise<MemorySearchResult[]> {
  if (!query.trim()) return [];

  let results: MemorySearchResult[];

  // Try semantic search; fall back to keyword if no API key or embedding fails
  if (process.env.OPENAI_API_KEY) {
    try {
      results = await semanticSearch(ctx.supabase, query, opts);
    } catch {
      results = await keywordFallback(ctx.supabase, query, opts);
    }
  } else {
    results = await keywordFallback(ctx.supabase, query, opts);
  }

  if (results.length === 0) return results;

  // Async side-effects: boost freshness + log reads (fire-and-forget)
  void boostAndLog(ctx.supabase, results, query, ctx.agentId, ctx.runId);

  return results;
}

// ── Freshness boost + read log ────────────────────────────────────────────────

async function boostAndLog(
  supabase: SupabaseClient,
  results: MemorySearchResult[],
  query: string,
  agentId?: string,
  runId?: string,
): Promise<void> {
  const ids = results.map((r) => r.id);

  // Boost freshness for each returned document
  for (const r of results) {
    const boosted = applyReadBoost(r.freshness_score);
    if (boosted !== r.freshness_score) {
      await supabase
        .from('memory_documents')
        .update({ freshness_score: boosted })
        .eq('id', r.id);
    }
  }

  // Log reads for analytics
  if (agentId) {
    await supabase.from('memory_read_log').insert(
      results.map((r) => ({
        document_id: r.id,
        agent_id:    agentId,
        run_id:      runId ?? null,
        query:       query.slice(0, 500),
        similarity:  r.similarity,
      })),
    );
  }
}

// ── Find related documents ────────────────────────────────────────────────────

export async function findRelated(
  supabase: SupabaseClient,
  documentId: string,
  limit: number = 5,
): Promise<MemorySearchResult[]> {
  // Load the source document's embedding from the DB
  const { data: doc } = await supabase
    .from('memory_documents')
    .select('id, title, body, category, embedding')
    .eq('id', documentId)
    .single();

  if (!doc || !doc.embedding) return [];

  const { data, error } = await supabase.rpc('search_memory', {
    query_embedding: doc.embedding,
    match_threshold: 0.65,
    match_count:     limit + 1, // +1 to account for the document itself
    filter_category: null,
    filter_scope:    null,
  });

  if (error || !data) return [];

  return (data as Array<{ id: string } & Record<string, unknown>>)
    .filter((r) => r.id !== documentId)
    .slice(0, limit)
    .map((r) => ({
      id:              r.id as string,
      vault_path:      (r.vault_path as string) ?? null,
      category:        r.category as MemorySearchResult['category'],
      title:           r.title as string,
      body:            r.body as string,
      tags:            (r.tags as string[]) ?? [],
      agent_scope:     (r.agent_scope as string) ?? null,
      source:          (r.source as MemorySearchResult['source']),
      content_hash:    '',
      freshness_score: r.freshness_score as number,
      vault_synced_at: null,
      status:          'active' as const,
      superseded_by:   null,
      created_at:      r.created_at as string,
      updated_at:      r.updated_at as string,
      similarity:      r.similarity as number,
    }));
}
