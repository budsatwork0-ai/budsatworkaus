import { describe, expect, it } from 'vitest';
import {
  ModuleAnalyzerRegistry,
  renderSliceReport,
  runModuleAnalysisPipeline,
  type ModuleAnalysisResult,
  type ModuleAnalyzer,
  type SliceVerificationRun,
} from '@/lib/architecture-doctor/v2';

const TIMEPOINT = '2026-07-10T00:00:00.000Z';

describe('Architecture Doctor v2 generic module pipeline', () => {
  it('allows two analyzers to publish into one knowledge graph', async () => {
    const registry = new ModuleAnalyzerRegistry();
    registry.register(makeAnalyzer('alpha', makeAnalysis('alpha', '/api/shared')));
    registry.register(makeAnalyzer('beta', makeAnalysis('beta', '/api/beta')));

    const { knowledge } = await runModuleAnalysisPipeline({
      registry,
      verificationRun: makeRun(),
      timepoint: TIMEPOINT,
      reportLabel: 'Test Module Report',
    });

    expect(knowledge.nodes.some((node) => node.entityId === 'claim-alpha')).toBe(true);
    expect(knowledge.nodes.some((node) => node.entityId === 'claim-beta')).toBe(true);
    expect(knowledge.edges.some((edge) => edge.kind === 'renders_knowledge')).toBe(true);
  });

  it('deduplicates duplicate observations without duplicating knowledge nodes', async () => {
    const duplicateObservation = {
      id: 'observation-api-shared',
      assetKind: 'apiRoute' as const,
      route: '/api/shared',
      scope: 'test',
      provenance: provenance('repository_scan', 'shared scan'),
    };
    const registry = new ModuleAnalyzerRegistry();
    registry.register(makeAnalyzer('alpha', makeAnalysis('alpha', '/api/shared', { observation: duplicateObservation })));
    registry.register(makeAnalyzer('beta', makeAnalysis('beta', '/api/shared', { observation: duplicateObservation })));

    const { knowledge } = await runModuleAnalysisPipeline({
      registry,
      verificationRun: makeRun(),
      timepoint: TIMEPOINT,
    });

    expect(knowledge.nodes.filter((node) => node.id === 'node-observation-api-shared')).toHaveLength(1);
  });

  it('represents conflicting claims explicitly instead of overwriting them', async () => {
    const registry = new ModuleAnalyzerRegistry();
    registry.register(makeAnalyzer('supports', makeAnalysis('supports', '/api/conflict')));
    registry.register(makeAnalyzer('refutes', makeAnalysis('refutes', '/api/conflict', { evidenceSupports: false, claimStatus: 'refuted' })));

    const { knowledge } = await runModuleAnalysisPipeline({
      registry,
      verificationRun: makeRun(),
      timepoint: TIMEPOINT,
    });

    const claimNodes = knowledge.nodes.filter((node) => node.kind === 'Claim' && (node.data as { subject?: string }).subject === '/api/conflict');
    expect(claimNodes.map((node) => node.entityId).sort()).toEqual(['claim-refutes', 'claim-supports']);
    expect(knowledge.edges.some((edge) => edge.kind === 'supports_claim' && edge.to === 'node-claim-supports')).toBe(true);
    expect(knowledge.edges.some((edge) => edge.kind === 'refutes_claim' && edge.to === 'node-claim-refutes')).toBe(true);
  });

  it('keeps report traceability valid for merged analyzer knowledge', async () => {
    const registry = new ModuleAnalyzerRegistry();
    registry.register(makeAnalyzer('alpha', makeAnalysis('alpha', '/api/shared', { withFinding: true })));
    registry.register(makeAnalyzer('beta', makeAnalysis('beta', '/api/beta')));

    const { knowledge } = await runModuleAnalysisPipeline({
      registry,
      verificationRun: makeRun(),
      timepoint: TIMEPOINT,
    });

    const report = renderSliceReport(knowledge);
    expect(report.markdown).toContain('Report content is projected from `SliceKnowledgePublication` nodes and edges.');
    expect(report.markdown).toContain('finding-alpha');
  });

  it('rejects analyzer output that violates claim evidence invariants', async () => {
    const registry = new ModuleAnalyzerRegistry();
    const invalid = makeAnalysis('invalid', '/api/invalid');
    invalid.claims[0] = { ...invalid.claims[0], evidenceIds: [] };
    registry.register(makeAnalyzer('invalid', invalid));

    await expect(
      runModuleAnalysisPipeline({
        registry,
        verificationRun: makeRun(),
        timepoint: TIMEPOINT,
      }),
    ).rejects.toThrow(/has no evidence/);
  });
});

function makeAnalyzer(id: string, result: ModuleAnalysisResult): ModuleAnalyzer {
  return {
    id,
    analyze: () => result,
  };
}

function makeAnalysis(
  id: string,
  route: string,
  options: {
    observation?: ModuleAnalysisResult['observations'][number];
    evidenceSupports?: boolean;
    claimStatus?: ModuleAnalysisResult['claims'][number]['status'];
    withFinding?: boolean;
  } = {},
): ModuleAnalysisResult {
  const observation = options.observation ?? {
    id: `observation-${id}`,
    assetKind: 'apiRoute' as const,
    route,
    scope: 'test',
    provenance: provenance('repository_scan', `${id} scan`),
  };
  const evidence = {
    id: `evidence-${id}`,
    claimId: `claim-${id}`,
    route,
    kind: 'presence' as const,
    supports: options.evidenceSupports ?? true,
    observationIds: [observation.id],
    intentIds: [],
    confidence: 'High' as const,
    provenance: provenance('slice_reasoning', `${id} evidence`),
  };
  const claim = {
    id: `claim-${id}`,
    type: 'observed_api_route_declared' as const,
    status: options.claimStatus ?? 'supported',
    subject: route,
    predicate: `${id} claim for ${route}`,
    capabilityId: 'T01',
    capabilityName: 'Test Capability',
    scope: 'test',
    evidenceIds: [evidence.id],
    confidence: 'High' as const,
    provenance: provenance('slice_reasoning', `${id} claim`),
  };
  const finding = {
    id: `finding-${id}`,
    type: 'observed_route_unmapped_to_intent' as const,
    severity: 'low' as const,
    confidence: 'High' as const,
    capabilityId: 'T01',
    capabilityName: 'Test Capability',
    route,
    claimIds: [claim.id],
    evidenceIds: [evidence.id],
    mappingContext: {
      status: 'declared_capability' as const,
      capabilityId: 'T01',
      capabilityName: 'Test Capability',
      statement: 'Test finding affects declared test capability.',
    },
    risk: {
      dimension: 'architectural' as const,
      statement: 'Test architectural risk.',
    },
    recommendationId: `recommendation-${id}`,
    technicalExplanation: 'Test technical explanation.',
    businessImpact: 'Test business impact.',
    enforcementMode: 'advisory' as const,
  };
  return {
    analyzerId: id,
    capabilities: [{ id: 'T01', name: 'Test Capability' }],
    intents: [],
    observations: [observation],
    evidence: [evidence],
    claims: [claim],
    findings: options.withFinding ? [finding] : [],
    recommendations: options.withFinding
      ? [
          {
            id: `recommendation-${id}`,
            findingId: finding.id,
            summary: 'Test recommendation.',
            requiredDecision: 'Review test finding.',
            remediationPath: 'Resolve test finding.',
            verificationCriteria: 'Finding is absent in the next test run.',
            riskReduction: 'Reduces test risk.',
            confidence: 'High' as const,
          },
        ]
      : [],
  };
}

function provenance(sourceType: 'repository_scan' | 'slice_reasoning', method: string) {
  return {
    source: 'test',
    sourceType,
    method,
    timepoint: TIMEPOINT,
  };
}

function makeRun(): SliceVerificationRun {
  return {
    id: 'adv2-module-test',
    scope: 'test',
    capabilityId: 'T01',
    capabilityName: 'Test Capability',
    assetKind: 'apiRoute',
    mode: 'advisory',
    startedAt: TIMEPOINT,
    completedAt: TIMEPOINT,
    limitations: ['test only'],
  };
}
