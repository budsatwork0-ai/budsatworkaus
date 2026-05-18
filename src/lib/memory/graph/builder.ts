/**
 * Graph build orchestration.
 *
 * Two modes:
 *   full       — rebuild all edges from scratch for all active documents
 *   incremental — rebuild edges for a single document (called on write/update)
 *
 * Pipeline per document:
 *   1. Delete existing system edges
 *   2. Build deterministic edges (backlinks, tags, semantic)
 *   3. LLM extraction (if enabled and not already done)
 *   4. Resolve LLM edges (depends_on, implements)
 *   5. Contradiction detection for high-similarity pairs
 *
 * LLM extraction is opt-in (controlled by `runLLM` flag) because it's
 * expensive. Run it on initial index or when body changes significantly.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { GraphBuildResult } from './types';
import { buildDeterministicEdges, deleteSystemEdges } from './edges';
import { extractDocument, resolveExtractionEdges, checkNewDocumentContradictions } from './extract';
import { extractBacklinks } from '../frontmatter';

// ── Admin Supabase client ─────────────────────────────────────────────────────

function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing for graph builder');
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── Incremental build (one document) ─────────────────────────────────────────

export interface IncrementalBuildOpts {
  documentId: string;
  /** If true, re-run LLM extraction even if extraction record exists. */
  runLLM?: boolean;
  /** If true, check for contradictions against similar documents. */
  checkContradictions?: boolean;
  supabase?: SupabaseClient;
}

export async function buildDocumentGraph(opts: IncrementalBuildOpts): Promise<{
  edges: number;
  llmExtracted: boolean;
  contradictions: number;
}> {
  const supabase = opts.supabase ?? adminClient();

  // Load the document
  const { data: doc } = await supabase
    .from('memory_documents')
    .select('id, title, body, tags, frontmatter, embedding')
    .eq('id', opts.documentId)
    .single();

  if (!doc) throw new Error(`Document ${opts.documentId} not found`);

  const backlinks = extractBacklinks((doc.body as string) ?? '');
  const embedding = Array.isArray(doc.embedding) ? (doc.embedding as number[]) : [];

  // 1. Delete existing system edges
  await deleteSystemEdges(supabase, opts.documentId);

  // 2. Deterministic edges
  const edgeStats = await buildDeterministicEdges(supabase, {
    id:        opts.documentId,
    tags:      (doc.tags as string[]) ?? [],
    backlinks,
    embedding,
  });
  let edgeCount = edgeStats.backlinks + edgeStats.tagShared + edgeStats.semantic;

  // 3. LLM extraction
  let llmExtracted = false;
  if (opts.runLLM !== false) {
    const { data: existing } = await supabase
      .from('memory_graph_extractions')
      .select('document_id')
      .eq('document_id', opts.documentId)
      .single();

    if (!existing || opts.runLLM === true) {
      const result = await extractDocument(
        supabase,
        opts.documentId,
        doc.title as string,
        doc.body as string,
      );
      const resolved = await resolveExtractionEdges(supabase, opts.documentId, result);
      edgeCount += resolved;
      llmExtracted = true;
    }
  }

  // 4. Contradiction detection
  let contradictions = 0;
  if (opts.checkContradictions && embedding.length > 0) {
    const checks = await checkNewDocumentContradictions(supabase, {
      id:        opts.documentId,
      title:     doc.title as string,
      body:      doc.body as string,
      embedding,
    });
    contradictions = checks.filter((c) => c.contradicts).length;
  }

  return { edges: edgeCount, llmExtracted, contradictions };
}

// ── Full graph rebuild ────────────────────────────────────────────────────────

export interface FullBuildOpts {
  /** Run LLM extraction for documents that don't have it yet. Default true. */
  runLLM?: boolean;
  /** Run contradiction checks. Default false (expensive). */
  checkContradictions?: boolean;
  supabase?: SupabaseClient;
}

export async function buildFullGraph(opts: FullBuildOpts = {}): Promise<GraphBuildResult> {
  const t0       = Date.now();
  const supabase = opts.supabase ?? adminClient();
  const result: GraphBuildResult = {
    nodesProcessed:     0,
    edgesCreated:       0,
    edgesUpdated:       0,
    extractionsRun:     0,
    contradictionsFound: 0,
    durationMs:         0,
    errors:             [],
  };

  // Load all active documents
  const { data: docs } = await supabase
    .from('memory_documents')
    .select('id')
    .eq('status', 'active');

  if (!docs || docs.length === 0) {
    result.durationMs = Date.now() - t0;
    return result;
  }

  for (const { id } of docs as Array<{ id: string }>) {
    try {
      const r = await buildDocumentGraph({
        documentId:         id,
        runLLM:             opts.runLLM ?? true,
        checkContradictions: opts.checkContradictions ?? false,
        supabase,
      });

      result.nodesProcessed++;
      result.edgesCreated      += r.edges;
      if (r.llmExtracted)      result.extractionsRun++;
      result.contradictionsFound += r.contradictions;
    } catch (err) {
      result.errors.push(`${id}: ${(err as Error).message}`);
    }
  }

  result.durationMs = Date.now() - t0;
  return result;
}
