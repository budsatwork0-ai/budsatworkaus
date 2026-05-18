/**
 * Public API for the knowledge graph module.
 *
 * Import from here in API routes and agent definitions.
 * Never import directly from sub-modules in application code.
 */

// Types
export type {
  RelationshipType,
  GraphNode,
  GraphEdge,
  GraphNeighbor,
  GraphNeighborhood,
  GraphPath,
  DecisionContext,
  ContradictionResult,
  GraphCluster,
  ExtractionResult,
  VisNode,
  VisLink,
  VisGraph,
  GraphBuildResult,
  GraphContext,
} from './types';

export { RELATIONSHIP_TYPES, CONFLICT_RELATIONSHIPS, CAUSAL_RELATIONSHIPS } from './types';

// Builder
export { buildDocumentGraph, buildFullGraph } from './builder';
export type { IncrementalBuildOpts, FullBuildOpts } from './builder';

// Traversal
export { getNeighborhood, findShortestPath, getCentralNodes, detectClusters, getDecisionChain } from './traversal';

// Edges
export {
  buildDeterministicEdges,
  deleteSystemEdges,
  rebuildAllDeterministicEdges,
} from './edges';

// Extraction
export {
  extractDocument,
  resolveExtractionEdges,
  detectContradiction,
  checkNewDocumentContradictions,
} from './extract';

// Context (agent injection)
export { buildGraphContext } from './context';
export type { GraphContextOpts } from './context';

// Visualization
export { exportVisGraph, exportNeighborhoodVis, RELATIONSHIP_COLORS } from './visualize';
