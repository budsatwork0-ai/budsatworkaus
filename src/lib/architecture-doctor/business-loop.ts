import type { AtlasSpec, ArchitectureInventory, BusinessLoopCheck, BusinessLoopStage, CapabilitySpec } from './types';

const STAGES: BusinessLoopStage[] = ['realityEvent', 'capturedData', 'decisionAction', 'outcomeClosure', 'learningEvidence'];

export function analyzeBusinessLoops(atlas: AtlasSpec, inventory: ArchitectureInventory): BusinessLoopCheck[] {
  const discoveredTables = new Set([...inventory.migrationTables, ...inventory.migrationViews, ...inventory.tableUsages]);

  return atlas.capabilities.map((capability) => ({
    capabilityId: capability.id,
    capabilityName: capability.name,
    stages: Object.fromEntries(
      STAGES.map((stage) => [stage, evaluateStage(stage, capability, discoveredTables)]),
    ) as BusinessLoopCheck['stages'],
  }));
}

function evaluateStage(stage: BusinessLoopStage, capability: CapabilitySpec, discoveredTables: Set<string>) {
  const evidence: string[] = [];

  if (stage === 'realityEvent') {
    evidence.push(...capability.apiRoutes.filter((route) => route.startsWith('/api/')));
    evidence.push(...capability.cronWorkers.filter((worker) => worker.length > 0));
  }

  if (stage === 'capturedData') {
    evidence.push(...capability.tables.filter((table) => discoveredTables.has(table)).map((table) => `table:${table}`));
  }

  if (stage === 'decisionAction') {
    evidence.push(...capability.agents.map((agent) => `agent:${agent}`));
    evidence.push(...capability.apiRoutes.filter((route) => /approve|assign|status|checkout|complete|run|publish|send/.test(route)));
  }

  if (stage === 'outcomeClosure') {
    evidence.push(...capability.apiRoutes.filter((route) => /complete|approve|checkout|status|assign|success|capture|publish/.test(route)));
    evidence.push(...capability.tables.filter((table) => /orders|payments|reviews|feedback|contributions|tasks|decisions/.test(table)));
  }

  if (stage === 'learningEvidence') {
    evidence.push(...capability.tables.filter((table) => /learning|evidence|analytics|memory|agent|executive|review|metrics/.test(table)));
    evidence.push(...capability.agents.map((agent) => `agent:${agent}`));
  }

  return {
    status: evidence.length > 0 ? ('present' as const) : ('unknown' as const),
    evidence: evidence.slice(0, 8),
  };
}
