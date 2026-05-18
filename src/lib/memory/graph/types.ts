/**
 * Knowledge graph types for the Buds At Work memory system.
 *
 * Nodes  = memory_documents
 * Edges  = memory_edges (typed, weighted, directional)
 * The graph connects UI systems, workflows, decisions, bugs, deployments,
 * analytics insights, and agent findings into a navigable knowledge map.
 */

// ── Relationship types ────────────────────────────────────────────────────────

export const RELATIONSHIP_TYPES = [
  'backlink',    // explicit [[wikilink]] in note body
  'tag_shared',  // share ≥1 tag (strength = Jaccard similarity)
  'semantic',    // embedding cosine similarity > threshold
  'depends_on',  // A architecturally depends on B
  'implements',  // A implements something described in B
  'contradicts', // LLM-detected conflicting facts
  'supersedes',  // A replaces/overrules B
  'caused_by',   // A (bug/incident) was caused by decision B
  'informs',     // A's findings informed decision B
] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

// Edges that indicate a problem / conflict — shown in red in the visualizer
export const CONFLICT_RELATIONSHIPS: RelationshipType[] = ['contradicts', 'caused_by'];

// Edges that flow forward through time or causality
export const CAUSAL_RELATIONSHIPS: RelationshipType[] = ['depends_on', 'implements', 'supersedes', 'caused_by', 'informs'];

// ── Core graph types ──────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  title: string;
  category: string;
  tags: string[];
  freshness_score: number;
  source: string;
  vault_path: string | null;
  updated_at: string;
  // From memory_graph_extractions
  importance_score: number;
  systems_mentioned: string[];
  decision_rationale?: string;
  problems_solved?: string[];
  keywords?: string[];
  // Computed during traversal
  degree?: number;
  cluster?: string;
}

export interface GraphEdge {
  id: string;
  source_id: string;
  target_id: string;
  relationship: RelationshipType;
  strength: number;
  metadata: Record<string, unknown>;
  extracted_by: string;
  extracted_at: string;
}

// ── Traversal results ─────────────────────────────────────────────────────────

export interface GraphNeighbor {
  node: GraphNode;
  depth: number;
  path: string[];
  relationship: RelationshipType;
  strength: number;
}

export interface GraphNeighborhood {
  root: GraphNode;
  neighbors: GraphNeighbor[];
  edges: GraphEdge[];
  maxDepth: number;
}

export interface GraphPath {
  nodes: GraphNode[];
  edges: GraphEdge[];
  length: number;
}

// ── Decision context ──────────────────────────────────────────────────────────
// What agents receive when asking "what do I need to know about X?"

export interface DecisionContext {
  /** The most relevant document found for the query. */
  primary: GraphNode | null;
  /** Documents that informed or led to the primary decision. */
  antecedents: GraphNode[];
  /** Documents that implemented or built on the primary decision. */
  descendants: GraphNode[];
  /** Contradictions or conflicts involving the primary document. */
  conflicts: Array<{ node: GraphNode; explanation: string; severity: 'minor' | 'major' }>;
  /** All systems mentioned across the context set. */
  systemsInvolved: string[];
  /** Plain-text prompt context string ready for LLM injection. */
  contextText: string;
}

// ── Contradiction result ──────────────────────────────────────────────────────

export interface ContradictionResult {
  existingDocId: string;
  existingTitle: string;
  contradicts: boolean;
  severity: 'minor' | 'major';
  explanation: string;
  similarity: number;
}

// ── Clusters ──────────────────────────────────────────────────────────────────

export interface GraphCluster {
  id: string;
  label: string;
  nodeIds: string[];
  /** Centroid: the most central node in this cluster. */
  centroidId: string;
  /** Dominant tags in this cluster. */
  dominantTags: string[];
  /** Dominant systems in this cluster. */
  dominantSystems: string[];
}

// ── LLM extraction result ─────────────────────────────────────────────────────

export interface ExtractionResult {
  documentId: string;
  systemsMentioned: string[];
  decisionRationale: string;
  problemsSolved: string[];
  dependsOnRaw: string[];
  implementsRaw: string[];
  keywords: string[];
  importanceScore: number;
}

// ── Visualization (D3 / force-graph compatible) ───────────────────────────────

export interface VisNode {
  id: string;
  label: string;
  category: string;
  size: number;           // proportional to degree
  importance: number;     // 0–1 from extraction
  freshness: number;      // 0–1
  cluster: string;        // for color grouping
  systems: string[];
  vaultPath: string | null;
}

export interface VisLink {
  source: string;
  target: string;
  type: RelationshipType;
  strength: number;
  label?: string;
}

export interface VisGraph {
  nodes: VisNode[];
  links: VisLink[];
  clusters: GraphCluster[];
  stats: {
    nodeCount: number;
    edgeCount: number;
    clusterCount: number;
    avgDegree: number;
    mostConnected: Array<{ id: string; title: string; degree: number }>;
    contradictions: number;
  };
}

// ── Build result ──────────────────────────────────────────────────────────────

export interface GraphBuildResult {
  nodesProcessed: number;
  edgesCreated: number;
  edgesUpdated: number;
  extractionsRun: number;
  contradictionsFound: number;
  durationMs: number;
  errors: string[];
}

// ── Agent-facing graph context ────────────────────────────────────────────────

export interface GraphContext {
  /** BFS neighborhood around a node. */
  neighborhood(id: string, depth?: number): Promise<GraphNeighborhood>;
  /** Retrieve decision context for a query — why, what, who depends. */
  decisionContext(query: string): Promise<DecisionContext>;
  /** Check if a proposed new memory contradicts existing knowledge. */
  contradictions(title: string, body: string): Promise<ContradictionResult[]>;
  /** Shortest path between two nodes. */
  path(fromId: string, toId: string): Promise<GraphPath | null>;
  /** Topic clusters across the full graph. */
  clusters(): Promise<GraphCluster[]>;
  /** Most-connected nodes (architectural importance). */
  centralNodes(limit?: number): Promise<GraphNode[]>;
}
