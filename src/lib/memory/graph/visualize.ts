/**
 * Knowledge graph visualization export.
 *
 * Outputs D3 force-graph compatible data:
 *   { nodes, links, clusters, stats }
 *
 * Nodes carry size (degree), importance, freshness, and cluster assignment.
 * Links carry type and strength.
 * Clusters are tag/system co-occurrence groups from traversal.detectClusters().
 *
 * Color coding by relationship type (for the frontend to consume):
 *   backlink    — #6366f1 (indigo)
 *   semantic    — #8b5cf6 (violet)
 *   tag_shared  — #06b6d4 (cyan)
 *   depends_on  — #f59e0b (amber)
 *   implements  — #10b981 (emerald)
 *   contradicts — #ef4444 (red)
 *   supersedes  — #f97316 (orange)
 *   caused_by   — #dc2626 (dark red)
 *   informs     — #3b82f6 (blue)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { VisGraph, VisNode, VisLink, GraphCluster } from './types';
import { detectClusters } from './traversal';

export const RELATIONSHIP_COLORS: Record<string, string> = {
  backlink:   '#6366f1',
  semantic:   '#8b5cf6',
  tag_shared: '#06b6d4',
  depends_on: '#f59e0b',
  implements: '#10b981',
  contradicts: '#ef4444',
  supersedes: '#f97316',
  caused_by:  '#dc2626',
  informs:    '#3b82f6',
};

// ── Full graph export ─────────────────────────────────────────────────────────

export async function exportVisGraph(supabase: SupabaseClient): Promise<VisGraph> {
  // Load all active documents + extraction metadata
  const { data: docs } = await supabase
    .from('memory_documents')
    .select(`
      id, title, category, tags, freshness_score, source, vault_path, updated_at,
      memory_graph_extractions ( importance_score, systems_mentioned )
    `)
    .eq('status', 'active');

  // Load all edges
  const { data: edgeRows } = await supabase
    .from('memory_edges')
    .select('id, source_id, target_id, relationship, strength, metadata');

  if (!docs || docs.length === 0) {
    return { nodes: [], links: [], clusters: [], stats: { nodeCount: 0, edgeCount: 0, clusterCount: 0, avgDegree: 0, mostConnected: [], contradictions: 0 } };
  }

  // Build degree map
  const degreeMap = new Map<string, number>();
  for (const d of docs as Array<{ id: string }>) degreeMap.set(d.id, 0);
  for (const e of (edgeRows ?? []) as Array<{ source_id: string; target_id: string }>) {
    degreeMap.set(e.source_id, (degreeMap.get(e.source_id) ?? 0) + 1);
    degreeMap.set(e.target_id, (degreeMap.get(e.target_id) ?? 0) + 1);
  }

  // Build cluster assignment map
  const clusters = await detectClusters(supabase);
  const clusterOf = new Map<string, string>();
  for (const c of clusters) {
    for (const id of c.nodeIds) clusterOf.set(id, c.id);
  }

  // Build VisNodes
  const nodes: VisNode[] = (docs as Array<Record<string, unknown>>).map((d) => {
    const ext = (d.memory_graph_extractions as Record<string, unknown>[] | null)?.[0] ?? {};
    const degree = degreeMap.get(d.id as string) ?? 0;
    return {
      id:         d.id as string,
      label:      d.title as string,
      category:   d.category as string,
      size:       Math.max(4, Math.min(24, 4 + degree * 1.5)),
      importance: (ext.importance_score as number) ?? 0.5,
      freshness:  d.freshness_score as number,
      cluster:    clusterOf.get(d.id as string) ?? (d.category as string),
      systems:    (ext.systems_mentioned as string[]) ?? [],
      vaultPath:  (d.vault_path as string) ?? null,
    };
  });

  // Build VisLinks — only include edges where both nodes are active
  const activeIds = new Set(nodes.map((n) => n.id));
  const links: VisLink[] = (edgeRows ?? [] as Array<Record<string, unknown>>)
    .filter((e: Record<string, unknown>) => activeIds.has(e.source_id as string) && activeIds.has(e.target_id as string))
    .map((e: Record<string, unknown>) => ({
      source:   e.source_id as string,
      target:   e.target_id as string,
      type:     e.relationship as VisLink['type'],
      strength: e.strength as number,
    }));

  // Stats
  const degrees         = [...degreeMap.values()];
  const avgDegree       = degrees.length > 0 ? degrees.reduce((a, b) => a + b, 0) / degrees.length : 0;
  const contradictions  = links.filter((l) => l.type === 'contradicts').length;
  const mostConnected   = nodes
    .map((n) => ({ id: n.id, title: n.label, degree: degreeMap.get(n.id) ?? 0 }))
    .sort((a, b) => b.degree - a.degree)
    .slice(0, 5);

  return {
    nodes,
    links,
    clusters,
    stats: {
      nodeCount:    nodes.length,
      edgeCount:    links.length,
      clusterCount: clusters.length,
      avgDegree:    Math.round(avgDegree * 10) / 10,
      mostConnected,
      contradictions,
    },
  };
}

// ── Subgraph export (neighborhood) ───────────────────────────────────────────

export async function exportNeighborhoodVis(
  supabase: SupabaseClient,
  nodeId: string,
  depth = 2,
): Promise<VisGraph> {
  const { data: bfsRows } = await supabase.rpc('graph_neighbors', {
    start_id:     nodeId,
    max_depth:    depth,
    rel_types:    null,
    min_strength: 0.0,
  });

  if (!bfsRows || bfsRows.length === 0) {
    return { nodes: [], links: [], clusters: [], stats: { nodeCount: 0, edgeCount: 0, clusterCount: 0, avgDegree: 0, mostConnected: [], contradictions: 0 } };
  }

  const allIds = [...new Set((bfsRows as Array<{ node_id: string }>).map((r) => r.node_id))];

  const { data: docs } = await supabase
    .from('memory_documents')
    .select('id, title, category, tags, freshness_score, source, vault_path, memory_graph_extractions ( importance_score, systems_mentioned )')
    .in('id', allIds)
    .eq('status', 'active');

  const { data: edgeRows } = await supabase
    .from('memory_edges')
    .select('id, source_id, target_id, relationship, strength, metadata')
    .in('source_id', allIds)
    .in('target_id', allIds);

  const activeIds = new Set(allIds);
  const degreeMap = new Map<string, number>();
  for (const id of allIds) degreeMap.set(id, 0);
  for (const e of (edgeRows ?? []) as Array<{ source_id: string; target_id: string }>) {
    if (activeIds.has(e.source_id)) degreeMap.set(e.source_id, (degreeMap.get(e.source_id) ?? 0) + 1);
    if (activeIds.has(e.target_id)) degreeMap.set(e.target_id, (degreeMap.get(e.target_id) ?? 0) + 1);
  }

  const nodes: VisNode[] = ((docs ?? []) as Array<Record<string, unknown>>).map((d) => {
    const ext = (d.memory_graph_extractions as Record<string, unknown>[] | null)?.[0] ?? {};
    const degree = degreeMap.get(d.id as string) ?? 0;
    return {
      id:         d.id as string,
      label:      d.title as string,
      category:   d.category as string,
      size:       d.id === nodeId ? 20 : Math.max(4, Math.min(18, 4 + degree * 1.5)),
      importance: (ext.importance_score as number) ?? 0.5,
      freshness:  d.freshness_score as number,
      cluster:    d.category as string,
      systems:    (ext.systems_mentioned as string[]) ?? [],
      vaultPath:  (d.vault_path as string) ?? null,
    };
  });

  const links: VisLink[] = ((edgeRows ?? []) as Array<Record<string, unknown>>).map((e) => ({
    source:   e.source_id as string,
    target:   e.target_id as string,
    type:     e.relationship as VisLink['type'],
    strength: e.strength as number,
  }));

  return {
    nodes,
    links,
    clusters: [],
    stats: {
      nodeCount:    nodes.length,
      edgeCount:    links.length,
      clusterCount: 0,
      avgDegree:    links.length > 0 && nodes.length > 0 ? Math.round((links.length * 2 / nodes.length) * 10) / 10 : 0,
      mostConnected: nodes.map((n) => ({ id: n.id, title: n.label, degree: degreeMap.get(n.id) ?? 0 })).sort((a, b) => b.degree - a.degree).slice(0, 3),
      contradictions: links.filter((l) => l.type === 'contradicts').length,
    },
  };
}
