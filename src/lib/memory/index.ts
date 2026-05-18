/**
 * Public API for the Buds At Work memory system.
 *
 * Import from here in agent definitions and API routes.
 * Never import directly from sub-modules in application code.
 */

// Types
export type {
  MemoryCategory,
  MemorySource,
  MemoryStatus,
  MemoryDocument,
  MemorySearchOpts,
  MemorySearchResult,
  NewMemoryInput,
  MemoryContext,
  VaultFile,
  SyncStats,
  EmbeddingProvider,
  MemoryFrontmatter,
} from './types';

export { MEMORY_CATEGORIES } from './types';

// Config
export {
  CATEGORY_FOLDER,
  FRESHNESS_DECAY,
  FRESHNESS_STALE_THRESHOLD,
  FRESHNESS_READ_BOOST,
  DEDUP_HARD_THRESHOLD,
  DEDUP_SOFT_THRESHOLD,
  SEARCH_DEFAULT_THRESHOLD,
  SEARCH_DEFAULT_LIMIT,
} from './config';

// Context (agent injection)
export { buildMemoryContext, buildRetrievalContext } from './context';
export type { MemoryContextOpts, InjectedContext } from './context';

// Search
export { searchMemory, findRelated } from './search';

// Write
export { writeMemory, upsertMemory, archiveMemory, contentHash, deriveVaultPath } from './write';
export type { WriteResult } from './write';

// Freshness
export {
  computeFreshness,
  applyReadBoost,
  isStale,
  daysUntilStale,
  freshnessLabel,
  bulkRefreshFreshness,
} from './freshness';
export type { FreshnessLabel } from './freshness';

// Dedup
export { checkDuplicate, checkDuplicateInProcess, dedupSeverity } from './dedup';

// Embeddings
export { getEmbeddingProvider, embedDocument, prepareText, cosineSimilarity, buildEmbedText } from './embeddings';

// Summarization
export { condenseMemory, mergeMemories, maybeCondense } from './summarize';

// Frontmatter (useful for scripts)
export {
  splitFrontmatter,
  parseFrontmatter,
  serializeFrontmatter,
  buildNote,
  extractInlineTags,
  extractBacklinks,
} from './frontmatter';

// Vault (Node.js only — do not import from Edge runtime)
export { readVault, parseVaultFile, writeVaultFile, scaffoldVault, categoryFromPath, isMemoryPath } from './vault';

// Sync (Node.js only)
export { syncVault, exportAgentMemories } from './sync';

// Knowledge graph
export {
  buildDocumentGraph,
  buildFullGraph,
  buildGraphContext,
  exportVisGraph,
  exportNeighborhoodVis,
  RELATIONSHIP_COLORS,
  RELATIONSHIP_TYPES,
  CONFLICT_RELATIONSHIPS,
  CAUSAL_RELATIONSHIPS,
} from './graph';
export type {
  GraphNode,
  GraphEdge,
  GraphNeighborhood,
  GraphPath,
  DecisionContext,
  ContradictionResult,
  GraphCluster,
  VisGraph,
  GraphBuildResult,
  GraphContext,
} from './graph';
