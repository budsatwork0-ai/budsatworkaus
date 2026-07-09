import type { AtlasSpec, ArchitectureInventory, CapabilitySpec, SourceIndex } from './types';
import { capabilityForAgent, capabilityForRoute, capabilityForTable } from './capability-manifest';
import { logicalAliasesForPhysicalTable } from './table-aliases';

export function buildSourceIndex(atlas: AtlasSpec, inventory: ArchitectureInventory): SourceIndex {
  return {
    tables: unique(withLogicalTableAliases([...inventory.migrationTables, ...inventory.migrationViews, ...inventory.tableUsages])),
    routes: inventory.apiRoutes,
    pages: inventory.pages,
    agents: inventory.agents,
    storageBuckets: inventory.storageBuckets,
    envVars: inventory.envVars,
    cronRouteTargets: unique(inventory.cronEntries.map((entry) => entry.routePath)),
    atlasApiPatterns: unique(atlas.capabilities.flatMap((capability) => capability.apiRoutes)),
    atlasPagePatterns: unique(atlas.capabilities.flatMap((capability) => capability.uiPages)),
    atlasAgents: unique(atlas.capabilities.flatMap((capability) => capability.agents)),
    atlasTables: unique(atlas.capabilities.flatMap((capability) => capability.tables)),
  };
}

function withLogicalTableAliases(tables: string[]): string[] {
  return tables.flatMap((table) => [table, ...logicalAliasesForPhysicalTable(table)]);
}

export function findCapabilityForAsset(
  atlas: AtlasSpec,
  kind: 'apiRoute' | 'page' | 'agent' | 'table',
  asset: string,
): CapabilitySpec | undefined {
  return atlas.capabilities.find((capability) => {
    if (kind === 'apiRoute') return capability.apiRoutes.some((pattern) => matchesPattern(pattern, asset));
    if (kind === 'page') return capability.uiPages.some((pattern) => matchesPattern(pattern, asset));
    if (kind === 'agent') return capability.agents.includes(asset);
    return capability.tables.includes(asset);
  }) ?? findManifestCapability(atlas, kind, asset);
}

function findManifestCapability(atlas: AtlasSpec, kind: 'apiRoute' | 'page' | 'agent' | 'table', asset: string): CapabilitySpec | undefined {
  const capabilityId =
    kind === 'apiRoute' || kind === 'page'
      ? capabilityForRoute(asset)
      : kind === 'agent'
        ? capabilityForAgent(asset)
        : capabilityForTable(asset);
  return atlas.capabilities.find((capability) => capability.id === capabilityId);
}

export function matchesPattern(pattern: string, value: string): boolean {
  if (pattern === value) return true;
  if (!pattern.includes('*')) return false;
  const escaped = pattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${escaped}$`).test(value);
}

export function normalizeAtlasRoutePattern(value: string): string {
  return value.split('?')[0].replace(/\/$/, '') || '/';
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}
