/**
 * Agent-facing GraphContext.
 *
 * Injected into every AgentContext via ctx.memory.graph.
 * Agents use this to:
 *   - understand WHY decisions were made
 *   - discover what systems are connected
 *   - check for contradictions before writing
 *   - navigate architectural dependencies
 *   - get LLM-ready decision context strings
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  GraphContext,
  GraphNeighborhood,
  DecisionContext,
  ContradictionResult,
  GraphPath,
  GraphCluster,
  GraphNode,
} from './types';
import {
  getNeighborhood,
  findShortestPath,
  getCentralNodes,
  detectClusters,
  getDecisionChain,
} from './traversal';
import { checkNewDocumentContradictions } from './extract';
import { searchMemory } from '../search';
import { embedDocument } from '../embeddings';

// ── Factory ───────────────────────────────────────────────────────────────────

export interface GraphContextOpts {
  supabase: SupabaseClient;
  agentId: string;
  runId: string;
}

export function buildGraphContext(opts: GraphContextOpts): GraphContext {
  const { supabase, agentId } = opts;

  return {
    // ── neighborhood ────────────────────────────────────────────────────────
    async neighborhood(id: string, depth = 2): Promise<GraphNeighborhood> {
      return getNeighborhood(supabase, id, depth);
    },

    // ── decisionContext ──────────────────────────────────────────────────────
    async decisionContext(query: string): Promise<DecisionContext> {
      // 1. Find the most relevant document for this query
      const searchResults = await searchMemory(
        query,
        { limit: 1, threshold: 0.65 },
        { supabase, agentId },
      );

      if (searchResults.length === 0) {
        return {
          primary:         null,
          antecedents:     [],
          descendants:     [],
          conflicts:       [],
          systemsInvolved: [],
          contextText:     '',
        };
      }

      const primary = searchResults[0];

      // 2. Get extraction metadata
      const { data: ext } = await supabase
        .from('memory_graph_extractions')
        .select('*')
        .eq('document_id', primary.id)
        .single();

      const primaryNode: GraphNode = {
        id:                primary.id,
        title:             primary.title,
        category:          primary.category,
        tags:              primary.tags,
        freshness_score:   primary.freshness_score,
        source:            primary.source,
        vault_path:        primary.vault_path,
        updated_at:        primary.updated_at,
        importance_score:  (ext?.importance_score as number) ?? 0.5,
        systems_mentioned: (ext?.systems_mentioned as string[]) ?? [],
        decision_rationale: ext?.decision_rationale as string | undefined,
        problems_solved:   ext?.problems_solved as string[] | undefined,
        keywords:          ext?.keywords as string[] | undefined,
      };

      // 3. Get ancestors and descendants through causal edges
      const { ancestors, descendants } = await getDecisionChain(supabase, primary.id);

      // 4. Load contradiction edges
      const { data: contradictEdges } = await supabase
        .from('memory_edges')
        .select('target_id, metadata')
        .eq('source_id', primary.id)
        .eq('relationship', 'contradicts');

      const conflicts: DecisionContext['conflicts'] = [];
      for (const edge of (contradictEdges ?? []) as Array<{ target_id: string; metadata: Record<string, unknown> }>) {
        const { data: conflictDoc } = await supabase
          .from('memory_documents')
          .select('id, title, category, tags, freshness_score, source, vault_path, updated_at')
          .eq('id', edge.target_id)
          .single();

        if (conflictDoc) {
          conflicts.push({
            node: {
              id:                conflictDoc.id as string,
              title:             conflictDoc.title as string,
              category:          conflictDoc.category as string,
              tags:              (conflictDoc.tags as string[]) ?? [],
              freshness_score:   conflictDoc.freshness_score as number,
              source:            conflictDoc.source as string,
              vault_path:        (conflictDoc.vault_path as string) ?? null,
              updated_at:        conflictDoc.updated_at as string,
              importance_score:  0.5,
              systems_mentioned: [],
            },
            explanation: (edge.metadata.explanation as string) ?? '',
            severity:    (edge.metadata.severity as 'minor' | 'major') ?? 'minor',
          });
        }
      }

      // 5. Collect all systems mentioned across the context
      const allSystems = new Set<string>([
        ...(primaryNode.systems_mentioned),
        ...ancestors.flatMap((n) => n.systems_mentioned),
        ...descendants.flatMap((n) => n.systems_mentioned),
      ]);

      // 6. Build LLM-injectable context text
      const contextText = buildContextText(primaryNode, ancestors, descendants, conflicts);

      return {
        primary:         primaryNode,
        antecedents:     ancestors,
        descendants,
        conflicts,
        systemsInvolved: [...allSystems],
        contextText,
      };
    },

    // ── contradictions ───────────────────────────────────────────────────────
    async contradictions(title: string, body: string): Promise<ContradictionResult[]> {
      let embedding: number[] = [];
      try {
        embedding = await embedDocument(title, body);
      } catch {
        return [];
      }

      const checks = await checkNewDocumentContradictions(
        supabase,
        { id: '', title, body, embedding },
        0.80,
      );

      return checks.map((c) => ({
        existingDocId: c.docId,
        existingTitle: c.title,
        contradicts:   c.contradicts,
        severity:      c.severity,
        explanation:   c.explanation,
        similarity:    0,
      }));
    },

    // ── path ─────────────────────────────────────────────────────────────────
    async path(fromId: string, toId: string): Promise<GraphPath | null> {
      return findShortestPath(supabase, fromId, toId);
    },

    // ── clusters ─────────────────────────────────────────────────────────────
    async clusters(): Promise<GraphCluster[]> {
      return detectClusters(supabase);
    },

    // ── centralNodes ─────────────────────────────────────────────────────────
    async centralNodes(limit = 10): Promise<GraphNode[]> {
      return getCentralNodes(supabase, limit);
    },
  };
}

// ── Context text builder ──────────────────────────────────────────────────────
// Formats decision context into a concise LLM prompt snippet.

function buildContextText(
  primary: GraphNode,
  antecedents: GraphNode[],
  descendants: GraphNode[],
  conflicts: DecisionContext['conflicts'],
): string {
  const parts: string[] = [];

  parts.push(`[Knowledge: ${primary.title} | ${primary.category} | freshness ${primary.freshness_score.toFixed(2)}]`);

  if (primary.decision_rationale) {
    parts.push(`Rationale: ${primary.decision_rationale}`);
  }

  if (antecedents.length > 0) {
    parts.push(`Informed by: ${antecedents.map((n) => n.title).join(', ')}`);
  }

  if (descendants.length > 0) {
    parts.push(`Implemented by: ${descendants.map((n) => n.title).join(', ')}`);
  }

  if (primary.systems_mentioned.length > 0) {
    parts.push(`Systems: ${primary.systems_mentioned.join(', ')}`);
  }

  if (conflicts.length > 0) {
    parts.push(
      `⚠ Conflicts with: ${conflicts.map((c) => `${c.node.title} (${c.severity}: ${c.explanation})`).join('; ')}`,
    );
  }

  return parts.join('\n');
}
