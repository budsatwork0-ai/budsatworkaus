/**
 * Agent memory context factory.
 *
 * Creates the MemoryContext object injected into every AgentContext.
 * Agents call ctx.memory.search(...), ctx.memory.write(...), etc.
 *
 * All reads flow through freshness boosting + read logging.
 * All writes go through dedup guard + embedding generation.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { MemoryContext, MemoryDocument, MemorySearchOpts, MemorySearchResult, NewMemoryInput } from './types';
import { searchMemory, findRelated as findRelatedDocs } from './search';
import { writeMemory } from './write';
import { buildGraphContext } from './graph/context';

// ── Factory ───────────────────────────────────────────────────────────────────

export interface MemoryContextOpts {
  supabase: SupabaseClient;
  agentId: string;
  runId: string;
  /** Default agent scope applied to search + scoped to this agent's memories. */
  defaultScope?: string;
}

export function buildMemoryContext(opts: MemoryContextOpts): MemoryContext {
  const { supabase, agentId, runId } = opts;

  return {
    // ── search ──────────────────────────────────────────────────────────────
    async search(
      query: string,
      searchOpts: MemorySearchOpts = {},
    ): Promise<MemorySearchResult[]> {
      return searchMemory(
        query,
        {
          agentScope: agentId,
          ...searchOpts,
        },
        { supabase, agentId, runId },
      );
    },

    // ── recall ───────────────────────────────────────────────────────────────
    async recall(id: string): Promise<MemoryDocument | null> {
      const { data, error } = await supabase
        .from('memory_documents')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) return null;

      // Log the read
      void supabase.from('memory_read_log').insert({
        document_id: id,
        agent_id:    agentId,
        run_id:      runId,
        query:       `recall:${id}`,
        similarity:  null,
      });

      return data as MemoryDocument;
    },

    // ── write ────────────────────────────────────────────────────────────────
    async write(input: NewMemoryInput): Promise<MemoryDocument> {
      const result = await writeMemory(supabase, input, {
        agentId,
        status: 'pending',
      });

      if (!result.ok) {
        if (result.reason === 'duplicate') {
          // Return the existing document instead of throwing
          const { data } = await supabase
            .from('memory_documents')
            .select('*')
            .eq('id', result.existingId)
            .single();
          if (data) return data as MemoryDocument;
        }
        throw new Error(
          result.reason === 'error'
            ? result.message
            : `Memory write blocked: ${result.reason}`,
        );
      }

      return result.doc;
    },

    // ── findRelated ──────────────────────────────────────────────────────────
    async findRelated(id: string, limit: number = 5): Promise<MemorySearchResult[]> {
      return findRelatedDocs(supabase, id, limit);
    },

    // ── graph ────────────────────────────────────────────────────────────────
    graph: buildGraphContext({ supabase, agentId, runId }),
  };
}

// ── Retrieval context injection ───────────────────────────────────────────────
// Builds a context string for an agent's LLM prompt by pre-searching memory.
// Agents can call this themselves, or the runtime can inject it automatically.

export interface InjectedContext {
  text: string;
  sources: Array<{ id: string; title: string; similarity: number; freshness: number }>;
}

export async function buildRetrievalContext(
  memoryCtx: MemoryContext,
  query: string,
  opts: MemorySearchOpts & { maxTokens?: number } = {},
): Promise<InjectedContext> {
  const results = await memoryCtx.search(query, {
    limit:    opts.limit ?? 3,
    ...opts,
  });

  if (results.length === 0) {
    return { text: '', sources: [] };
  }

  const maxTokens = opts.maxTokens ?? 1500;
  const parts: string[] = [];
  let approxTokens = 0;

  for (const r of results) {
    const snippet = `[Memory: ${r.title} | ${r.category} | freshness ${r.freshness_score.toFixed(2)}]\n${r.body}`;
    const approxSnippetTokens = Math.ceil(snippet.length / 4);
    if (approxTokens + approxSnippetTokens > maxTokens) break;
    parts.push(snippet);
    approxTokens += approxSnippetTokens;
  }

  return {
    text: parts.join('\n\n---\n\n'),
    sources: results.map((r) => ({
      id:         r.id,
      title:      r.title,
      similarity: r.similarity,
      freshness:  r.freshness_score,
    })),
  };
}
