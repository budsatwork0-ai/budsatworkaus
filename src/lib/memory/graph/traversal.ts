/**
 * Graph traversal algorithms.
 *
 * All operations run against Supabase using SQL functions (recursive CTEs)
 * for shallow queries, and TypeScript BFS for deeper exploration.
 *
 * Exports:
 *   getNeighborhood  — BFS up to N hops from a node
 *   findShortestPath — shortest edge path between two nodes
 *   getCentralNodes  — highest-degree nodes (most connected)
 *   detectClusters   — community detection via tag/system co-occurrence
 *   getDecisionChain — ancestors → node → descendants through causal edges
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  GraphNode,
  GraphEdge,
  GraphNeighbor,
  GraphNeighborhood,
  GraphPath,
  GraphCluster,
  RelationshipType,
} from './types';
import { CAUSAL_RELATIONSHIPS } from './types';

// ── Load node ─────────────────────────────────────────────────────────────────

async function loadNode(supabase: SupabaseClient, id: string): Promise<GraphNode | null> {
  const { data } = await supabase
    .from('memory_documents')
    .select(`
      id, title, category, tags, freshness_score, source, vault_path, updated_at,
      memory_graph_extractions (
        importance_score, systems_mentioned, decision_rationale, problems_solved, keywords
      )
    `)
    .eq('id', id)
    .eq('status', 'active')
    .single();

  if (!data) return null;
  return rowToNode(data);
}

function rowToNode(row: Record<string, unknown>): GraphNode {
  const ext = (row.memory_graph_extractions as Record<string, unknown>[] | null)?.[0] ?? {};
  return {
    id:                row.id as string,
    title:             row.title as string,
    category:          row.category as string,
    tags:              (row.tags as string[]) ?? [],
    freshness_score:   row.freshness_score as number,
    source:            row.source as string,
    vault_path:        (row.vault_path as string) ?? null,
    updated_at:        row.updated_at as string,
    importance_score:  (ext.importance_score as number) ?? 0.5,
    systems_mentioned: (ext.systems_mentioned as string[]) ?? [],
    decision_rationale: (ext.decision_rationale as string) ?? undefined,
    problems_solved:   (ext.problems_solved as string[]) ?? undefined,
    keywords:          (ext.keywords as string[]) ?? undefined,
  };
}

// ── Neighborhood (BFS) ────────────────────────────────────────────────────────

export async function getNeighborhood(
  supabase: SupabaseClient,
  nodeId: string,
  depth: number = 2,
  relTypes?: RelationshipType[],
): Promise<GraphNeighborhood> {
  const root = await loadNode(supabase, nodeId);
  if (!root) {
    return { root: { id: nodeId, title: '', category: '', tags: [], freshness_score: 0, source: '', vault_path: null, updated_at: '', importance_score: 0, systems_mentioned: [] }, neighbors: [], edges: [], maxDepth: depth };
  }

  // Use SQL BFS function
  const { data: rows } = await supabase.rpc('graph_neighbors', {
    start_id:     nodeId,
    max_depth:    depth,
    rel_types:    relTypes ?? null,
    min_strength: 0.0,
  });

  if (!rows || rows.length === 0) {
    return { root, neighbors: [], edges: [], maxDepth: depth };
  }

  // Load full node data for each neighbor
  const neighborIds = (rows as Array<{ node_id: string; depth: number; path: string[]; relationship: string; strength: number }>)
    .filter((r) => r.node_id !== nodeId && r.depth > 0)
    .map((r) => r.node_id);

  const { data: nodeDocs } = await supabase
    .from('memory_documents')
    .select('id, title, category, tags, freshness_score, source, vault_path, updated_at')
    .in('id', neighborIds)
    .eq('status', 'active');

  const nodeMap = new Map<string, GraphNode>();
  for (const d of (nodeDocs ?? []) as Array<Record<string, unknown>>) {
    nodeMap.set(d.id as string, rowToNode(d));
  }

  const neighbors: GraphNeighbor[] = [];
  for (const r of rows as Array<{ node_id: string; depth: number; path: string[]; relationship: string; strength: number }>) {
    if (r.node_id === nodeId || r.depth === 0) continue;
    const node = nodeMap.get(r.node_id);
    if (!node) continue;
    neighbors.push({
      node,
      depth:        r.depth,
      path:         r.path,
      relationship: r.relationship as RelationshipType,
      strength:     r.strength,
    });
  }

  // Load edges connecting all nodes in this neighborhood
  const allIds = [nodeId, ...neighborIds];
  const { data: edgeRows } = await supabase
    .from('memory_edges')
    .select('*')
    .in('source_id', allIds)
    .in('target_id', allIds);

  const edges = (edgeRows ?? []) as GraphEdge[];

  return { root, neighbors, edges, maxDepth: depth };
}

// ── Shortest path ─────────────────────────────────────────────────────────────

export async function findShortestPath(
  supabase: SupabaseClient,
  fromId: string,
  toId: string,
  maxHops = 5,
): Promise<GraphPath | null> {
  const { data: rows } = await supabase.rpc('graph_shortest_path', {
    from_id:  fromId,
    to_id:    toId,
    max_hops: maxHops,
  });

  if (!rows || rows.length === 0) return null;

  const pathRow = (rows as Array<{ node_id: string; depth: number; relationship: string; path: string[] }>)[0];
  if (!pathRow) return null;

  const pathIds  = pathRow.path;
  const { data: nodeDocs } = await supabase
    .from('memory_documents')
    .select('id, title, category, tags, freshness_score, source, vault_path, updated_at')
    .in('id', pathIds);

  const nodeMap = new Map<string, GraphNode>();
  for (const d of (nodeDocs ?? []) as Array<Record<string, unknown>>) {
    nodeMap.set(d.id as string, rowToNode(d));
  }

  const nodes = pathIds.map((id) => nodeMap.get(id)).filter((n): n is GraphNode => !!n);

  // Load edges along the path
  const edges: GraphEdge[] = [];
  for (let i = 0; i < pathIds.length - 1; i++) {
    const { data: e } = await supabase
      .from('memory_edges')
      .select('*')
      .eq('source_id', pathIds[i])
      .eq('target_id', pathIds[i + 1])
      .limit(1)
      .single();
    if (e) edges.push(e as GraphEdge);
  }

  return { nodes, edges, length: pathIds.length - 1 };
}

// ── Central nodes ─────────────────────────────────────────────────────────────
// Nodes with the highest total edge count.

export async function getCentralNodes(
  supabase: SupabaseClient,
  limit = 10,
): Promise<GraphNode[]> {
  const { data } = await supabase
    .from('memory_documents')
    .select(`
      id, title, category, tags, freshness_score, source, vault_path, updated_at,
      memory_graph_extractions ( importance_score, systems_mentioned )
    `)
    .eq('status', 'active')
    .order('freshness_score', { ascending: false })
    .limit(200);

  if (!data || data.length === 0) return [];

  // Count edges per node
  const ids = (data as Array<Record<string, unknown>>).map((d) => d.id as string);
  const { data: edgeCounts } = await supabase
    .from('memory_edges')
    .select('source_id, target_id')
    .or(`source_id.in.(${ids.join(',')}),target_id.in.(${ids.join(',')})`);

  const degreeCounts = new Map<string, number>();
  for (const e of (edgeCounts ?? []) as Array<{ source_id: string; target_id: string }>) {
    degreeCounts.set(e.source_id, (degreeCounts.get(e.source_id) ?? 0) + 1);
    degreeCounts.set(e.target_id, (degreeCounts.get(e.target_id) ?? 0) + 1);
  }

  const nodes = (data as Array<Record<string, unknown>>)
    .map((d) => ({ ...rowToNode(d), degree: degreeCounts.get(d.id as string) ?? 0 }))
    .sort((a, b) => (b.degree ?? 0) - (a.degree ?? 0))
    .slice(0, limit);

  return nodes;
}

// ── Cluster detection ─────────────────────────────────────────────────────────
// Groups nodes by dominant tag + system co-occurrence.
// Simple but effective for vaults with < 1000 nodes.

export async function detectClusters(
  supabase: SupabaseClient,
): Promise<GraphCluster[]> {
  const { data } = await supabase
    .from('memory_documents')
    .select(`
      id, title, tags,
      memory_graph_extractions ( systems_mentioned, importance_score, keywords )
    `)
    .eq('status', 'active');

  if (!data || data.length === 0) return [];

  // Build a signature per document: top tag + top system
  const clusterMap = new Map<string, {
    nodeIds: string[];
    tags: string[];
    systems: string[];
    centroid: string;
    centroidImportance: number;
  }>();

  for (const d of data as Array<Record<string, unknown>>) {
    const tags    = (d.tags as string[]) ?? [];
    const ext     = (d.memory_graph_extractions as Record<string, unknown>[] | null)?.[0] ?? {};
    const systems = (ext.systems_mentioned as string[]) ?? [];
    const importance = (ext.importance_score as number) ?? 0.5;

    const clusterKey = tags[0] ?? systems[0] ?? (d as Record<string, unknown>).category ?? 'uncategorised';

    const cluster = clusterMap.get(clusterKey) ?? {
      nodeIds: [],
      tags:    [],
      systems: [],
      centroid: '',
      centroidImportance: -1,
    };

    cluster.nodeIds.push(d.id as string);
    cluster.tags.push(...tags);
    cluster.systems.push(...systems);

    if (importance > cluster.centroidImportance) {
      cluster.centroid = d.id as string;
      cluster.centroidImportance = importance;
    }

    clusterMap.set(clusterKey, cluster);
  }

  const clusters: GraphCluster[] = [];
  for (const [key, c] of clusterMap) {
    if (c.nodeIds.length === 0) continue;

    const tagFreq    = frequency(c.tags);
    const sysFreq    = frequency(c.systems);

    clusters.push({
      id:              key,
      label:           key.replace(/-/g, ' '),
      nodeIds:         c.nodeIds,
      centroidId:      c.centroid,
      dominantTags:    top(tagFreq, 3),
      dominantSystems: top(sysFreq, 3),
    });
  }

  return clusters.sort((a, b) => b.nodeIds.length - a.nodeIds.length);
}

function frequency(items: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) map.set(item, (map.get(item) ?? 0) + 1);
  return map;
}

function top(freq: Map<string, number>, n: number): string[] {
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}

// ── Decision chain ────────────────────────────────────────────────────────────
// Walk backwards (ancestors) and forwards (descendants) through causal edges.

export async function getDecisionChain(
  supabase: SupabaseClient,
  nodeId: string,
): Promise<{ ancestors: GraphNode[]; descendants: GraphNode[] }> {
  const causalTypes = CAUSAL_RELATIONSHIPS;

  // Ancestors: edges pointing TO this node
  const { data: inEdges } = await supabase
    .from('memory_edges')
    .select('source_id')
    .eq('target_id', nodeId)
    .in('relationship', causalTypes);

  const ancestorIds = (inEdges ?? []).map((e: Record<string, string>) => e.source_id);

  // Descendants: edges pointing FROM this node
  const { data: outEdges } = await supabase
    .from('memory_edges')
    .select('target_id')
    .eq('source_id', nodeId)
    .in('relationship', causalTypes);

  const descendantIds = (outEdges ?? []).map((e: Record<string, string>) => e.target_id);

  async function loadNodes(ids: string[]): Promise<GraphNode[]> {
    if (ids.length === 0) return [];
    const { data } = await supabase
      .from('memory_documents')
      .select('id, title, category, tags, freshness_score, source, vault_path, updated_at')
      .in('id', ids)
      .eq('status', 'active');
    return ((data ?? []) as Array<Record<string, unknown>>).map(rowToNode);
  }

  const [ancestors, descendants] = await Promise.all([
    loadNodes(ancestorIds),
    loadNodes(descendantIds),
  ]);

  return { ancestors, descendants };
}
