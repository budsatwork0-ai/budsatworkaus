import { describe, expect, it } from 'vitest';
import {
  CRON_ROUTE_UNRESOLVED_CAPABILITY_ID,
  ModuleAnalyzerRegistry,
  analyzeCronRouteRegistration,
  compareCronRouteV1V2,
  createCronRouteRegistrationAnalyzer,
  publishModuleKnowledge,
  renderSliceReport,
  runModuleAnalysisPipeline,
  type ModuleAnalysisResult,
  type SliceVerificationRun,
} from '@/lib/architecture-doctor/v2';
import type { ArchitectureInventory, AtlasSpec } from '@/lib/architecture-doctor/types';

const TIMEPOINT = '2026-07-11T00:00:00.000Z';

describe('Architecture Doctor v2 cron route registration analyzer', () => {
  it('runs the migrated detector through runModuleAnalysisPipeline', async () => {
    const registry = new ModuleAnalyzerRegistry();
    registry.register(createCronRouteRegistrationAnalyzer(makeInventory()));

    const { analyses, knowledge } = await runModuleAnalysisPipeline({
      registry,
      verificationRun: makeRun(),
      timepoint: TIMEPOINT,
      reportLabel: 'Cron Route Registration Report',
    });

    expect(analyses).toHaveLength(1);
    expect(analyses[0].findings.map((finding) => finding.type).sort()).toEqual(['cron_route_unregistered', 'cron_target_missing']);
    expect(knowledge.nodes.some((node) => node.entityId === 'finding-cron-route-unregistered-api-cron-unregistered')).toBe(true);
    expect(knowledge.nodes.some((node) => node.entityId === 'finding-cron-target-missing-api-cron-missing-api-cron-missing')).toBe(true);
  });

  it('backs every claim with concrete repository evidence', () => {
    const analysis = makeAnalysis();
    const evidenceIds = new Set(analysis.evidence.map((item) => item.id));

    for (const claim of analysis.claims) {
      expect(claim.evidenceIds.length).toBeGreaterThan(0);
      for (const evidenceId of claim.evidenceIds) expect(evidenceIds.has(evidenceId)).toBe(true);
    }
    for (const evidence of analysis.evidence) {
      expect(evidence.ruleId).toBeTruthy();
      expect(evidence.observedValue).toBeTruthy();
      expect(evidence.expectedValue).toBeTruthy();
      expect(evidence.provenance.timepoint).toBe(TIMEPOINT);
      expect(evidence.location?.precision).toBe('unavailable');
    }
  });

  it('adds required constitutional context to every finding', () => {
    const analysis = makeAnalysis();

    for (const finding of analysis.findings) {
      expect(finding.claimIds.length).toBeGreaterThan(0);
      expect(finding.evidenceIds.length).toBeGreaterThan(0);
      expect(finding.severity).toBeTruthy();
      expect(finding.confidence).toBeTruthy();
      expect(finding.risk.statement).toBeTruthy();
      expect(finding.recommendationId).toBeTruthy();
      expect(finding.mappingContext).toMatchObject({
        status: 'candidate_capability_unresolved',
        capabilityId: CRON_ROUTE_UNRESOLVED_CAPABILITY_ID,
      });
    }
  });

  it('keeps node and finding identities stable for repeated identical input', () => {
    const first = makeAnalysis();
    const second = makeAnalysis();
    const firstKnowledge = publishModuleKnowledge({ verificationRun: makeRun(), analyses: [first] });
    const secondKnowledge = publishModuleKnowledge({ verificationRun: makeRun(), analyses: [second] });

    expect(second.findings.map((finding) => finding.id)).toEqual(first.findings.map((finding) => finding.id));
    expect(secondKnowledge.nodes.map((node) => node.id)).toEqual(firstKnowledge.nodes.map((node) => node.id));
  });

  it('deduplicates repeated analyzer output in a single knowledge publication', () => {
    const analysis = makeAnalysis();
    const knowledge = publishModuleKnowledge({ verificationRun: makeRun(), analyses: [analysis, analysis] });

    expect(knowledge.nodes.filter((node) => node.entityId === 'observation-cron-route-candidate-api-cron-unregistered')).toHaveLength(1);
    expect(knowledge.nodes.filter((node) => node.entityId === 'finding-cron-route-unregistered-api-cron-unregistered')).toHaveLength(1);
  });

  it('records explained parity with the existing v1 detector', () => {
    const parity = compareCronRouteV1V2({
      atlas: makeAtlas(),
      inventory: makeInventory(),
      v2Analysis: makeAnalysis(),
    });

    expect(parity.passed).toBe(true);
    expect(parity.presentInBoth.map((item) => item.key).sort()).toEqual([
      'cron_route_unregistered:/api/cron/unregistered',
      'cron_target_missing:/api/cron/missing',
    ]);
    expect(parity.evidenceDifferences).toHaveLength(2);
    expect(parity.mappingDifferences).toHaveLength(2);
    expect(parity.unexplainedDifferences).toHaveLength(0);
  });

  it('fails parity when a v1/v2 detection difference is unexplained', () => {
    const incomplete: ModuleAnalysisResult = {
      ...makeAnalysis(),
      findings: makeAnalysis().findings.filter((finding) => finding.type !== 'cron_target_missing'),
      recommendations: makeAnalysis().recommendations.filter((recommendation) => !recommendation.findingId.startsWith('finding-cron-target-missing')),
    };

    const parity = compareCronRouteV1V2({
      atlas: makeAtlas(),
      inventory: makeInventory(),
      v2Analysis: incomplete,
    });

    expect(parity.passed).toBe(false);
    expect(parity.onlyV1.map((item) => item.key)).toContain('cron_target_missing:/api/cron/missing');
    expect(parity.unexplainedDifferences.map((item) => item.key)).toContain('cron_target_missing:/api/cron/missing');
  });

  it('renders reports only from knowledge publication traceability', () => {
    const knowledge = publishModuleKnowledge({ verificationRun: makeRun(), analyses: [makeAnalysis()] });
    const report = renderSliceReport(knowledge);

    expect(report.markdown).toContain('Report content is projected from `SliceKnowledgePublication` nodes and edges.');
    expect(report.markdown).toContain('finding-cron-route-unregistered-api-cron-unregistered');
    expect(report.markdown).toContain('finding-cron-target-missing-api-cron-missing-api-cron-missing');
  });
});

function makeAnalysis(): ModuleAnalysisResult {
  return analyzeCronRouteRegistration(makeInventory(), {
    verificationRun: makeRun(),
    timepoint: TIMEPOINT,
  });
}

function makeRun(): SliceVerificationRun {
  return {
    id: 'adv2-cron-route-test',
    scope: 'detector:cron-route-registration assetKind:cron',
    capabilityId: CRON_ROUTE_UNRESOLVED_CAPABILITY_ID,
    capabilityName: 'Unresolved Cron Route Ownership',
    assetKind: 'cron',
    mode: 'advisory',
    startedAt: TIMEPOINT,
    completedAt: TIMEPOINT,
    limitations: ['static repository inventory only', 'advisory parity migration only'],
  };
}

function makeAtlas(): AtlasSpec {
  return {
    sourcePath: 'test-atlas.md',
    capabilities: [],
  };
}

function makeInventory(): ArchitectureInventory {
  return {
    rootDir: '/repo',
    sourceFiles: [],
    pages: [],
    apiRoutes: ['/api/test'],
    agents: [],
    cronEntries: [{ path: '/api/cron/missing', routePath: '/api/cron/missing', schedule: '* * * * *' }],
    cronRouteCandidates: ['/api/cron/unregistered'],
    migrationTables: [],
    migrationViews: [],
    tableUsages: [],
    envVars: [],
    storageBuckets: [],
  };
}
