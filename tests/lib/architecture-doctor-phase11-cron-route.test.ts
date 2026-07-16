import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  adaptV1CronDriftFindingsToCanonicalDetections,
  analyzeCronRouteRegistration,
  compareCronRouteV1V2,
  createDetectorMigrationGovernanceDecision,
  evaluateReplacementReadiness,
  runCronRouteShadowExecution,
  runPhase11CronRouteMigrationGate,
  type ModuleAnalysisResult,
  type SliceVerificationRun,
} from '@/lib/architecture-doctor/v2';
import type { ArchitectureInventory, AtlasSpec, DriftFinding } from '@/lib/architecture-doctor/types';

const TIMEPOINT = '2026-07-11T00:00:00.000Z';

describe('Architecture Doctor Phase 11 cron route migration gate', () => {
  it('runs the real-inventory runner through both v1 and v2 without making v2 authoritative', async () => {
    const rootDir = await makeRepoFixture();
    const result = await runPhase11CronRouteMigrationGate({
      rootDir,
      atlasPath: path.join(rootDir, 'atlas.md'),
      actor: 'test actor',
      rationale: 'test rationale',
      now: new Date(TIMEPOINT),
    });

    expect(result.v1CronFindings.map((finding) => finding.type).sort()).toEqual(['cron_route_unregistered', 'cron_target_missing']);
    expect(result.v2Analyses.flatMap((analysis) => analysis.findings.map((finding) => finding.type)).sort()).toEqual([
      'cron_route_unregistered',
      'cron_target_missing',
    ]);
    expect(result.parity.overallDecision).toBe('parity_verified');
    expect(result.governanceDecision.decision).toBe('needs_review');
    expect(result.readiness.ready).toBe(false);
    expect(result.v2Report.markdown).toContain('Phase 11 is advisory-only; v1 remains authoritative.');
  });

  it('keeps parity identity independent from display messages and isolates the temporary v1 adapter', () => {
    const findings: DriftFinding[] = [
      {
        type: 'cron_route_unregistered',
        severity: 'medium',
        confidence: 'confirmed',
        assetKind: 'cron',
        asset: '/api/cron/unregistered',
        message: 'First display message.',
      },
    ];
    const changedMessage = [{ ...findings[0], message: 'Different display message.' }];

    const first = adaptV1CronDriftFindingsToCanonicalDetections(findings);
    const second = adaptV1CronDriftFindingsToCanonicalDetections(changedMessage);

    expect(first[0].key).toBe(second[0].key);
    expect(first[0].ruleId).toBe('cron.route.registered');
    expect(first[0].subject).toBe('/api/cron/unregistered');
    expect(first[0].legacyMessage).toBe('First display message.');
  });

  it('fails parity when an unexplained detection difference exists', () => {
    const analysis = analyzeCronRouteRegistration(makeInventory(), { verificationRun: makeRun(), timepoint: TIMEPOINT });
    const incomplete: ModuleAnalysisResult = {
      ...analysis,
      findings: analysis.findings.filter((finding) => finding.type !== 'cron_target_missing'),
      recommendations: analysis.recommendations.filter((item) => !item.findingId.includes('cron-target-missing')),
    };

    const parity = compareCronRouteV1V2({
      atlas: makeAtlas(),
      inventory: makeInventory(),
      v2Analysis: incomplete,
      analysisRunId: makeRun().id,
      repositoryState: 'abc123',
      executedAt: TIMEPOINT,
    });

    expect(parity.overallDecision).toBe('parity_failed');
    expect(parity.unexplainedDifferences.map((item) => item.key)).toContain('cron_target_missing:/api/cron/missing');
  });

  it('distinguishes v2 execution failure from detection mismatch', async () => {
    const shadow = await runCronRouteShadowExecution({
      atlas: makeAtlas(),
      inventory: makeInventory(),
      verificationRun: makeRun(),
      timepoint: TIMEPOINT,
      repositoryState: 'abc123',
      v2Enabled: true,
      runV2: async () => {
        throw new Error('v2 unavailable');
      },
    });

    expect(shadow.executionFailure?.phase).toBe('v2_execution');
    expect(shadow.parity).toBeUndefined();
    expect(shadow.authoritativeV1Findings).toHaveLength(2);
  });

  it('repeated execution against stable inventory is deterministic', () => {
    const first = analyzeCronRouteRegistration(makeInventory(), { verificationRun: makeRun(), timepoint: TIMEPOINT });
    const second = analyzeCronRouteRegistration(makeInventory(), { verificationRun: makeRun(), timepoint: TIMEPOINT });
    const firstParity = compareCronRouteV1V2({ atlas: makeAtlas(), inventory: makeInventory(), v2Analysis: first });
    const secondParity = compareCronRouteV1V2({ atlas: makeAtlas(), inventory: makeInventory(), v2Analysis: second });

    expect(second.findings).toEqual(first.findings);
    expect(secondParity).toEqual(firstParity);
  });

  it('requires governance actor, rationale, scope, timestamp, repository state, and parity reference', () => {
    expect(() =>
      createDetectorMigrationGovernanceDecision({
        id: 'decision-1',
        decision: 'needs_review',
        actor: '',
        rationale: 'Review required.',
        timestamp: TIMEPOINT,
        detectorScope: 'detector:cron-route-registration',
        repositoryState: { commitSha: 'abc123' },
        parityResultRef: 'parity-1',
      }),
    ).toThrow(/actor/);
  });

  it('fails replacement readiness whenever a required condition is absent', () => {
    const readiness = evaluateReplacementReadiness({
      detectorScope: 'detector:cron-route-registration',
      repositoryState: { commitSha: 'abc123' },
      parityResultRef: 'parity-1',
      parity: { unexplainedDifferences: [] },
      deterministic: true,
      constitutionalInvariantsSatisfied: true,
      downstreamCompatibilityDocumented: false,
      shadowExecutionCompleted: false,
      rollbackDefined: false,
      governanceDecision: createDetectorMigrationGovernanceDecision({
        id: 'decision-1',
        decision: 'needs_review',
        actor: 'test actor',
        rationale: 'Review required.',
        timestamp: TIMEPOINT,
        detectorScope: 'detector:cron-route-registration',
        repositoryState: { commitSha: 'abc123' },
        parityResultRef: 'parity-1',
      }),
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.map((blocker) => blocker.requirement)).toEqual([
      'downstream_report_and_consumer_compatibility_documented',
      'shadow_execution_completed_successfully',
      'rollback_behaviour_defined',
      'explicit_governance_decision_approves_replacement',
    ]);
  });

  it('keeps shadow execution authoritative on v1, avoids double counting, and allows disabling v2', async () => {
    const enabled = await runCronRouteShadowExecution({
      atlas: makeAtlas(),
      inventory: makeInventory(),
      verificationRun: makeRun(),
      timepoint: TIMEPOINT,
      repositoryState: 'abc123',
      v2Enabled: true,
    });
    const disabled = await runCronRouteShadowExecution({
      atlas: makeAtlas(),
      inventory: makeInventory(),
      verificationRun: makeRun(),
      timepoint: TIMEPOINT,
      repositoryState: 'abc123',
      v2Enabled: false,
    });

    expect(enabled.v1Authoritative).toBe(true);
    expect(enabled.aggregateHealthFindingCount).toBe(enabled.authoritativeV1Findings.length);
    expect(enabled.aggregateHealthFindingCount).toBe(2);
    expect(disabled.authoritativeV1Findings).toEqual(enabled.authoritativeV1Findings);
    expect(disabled.v2Analyses).toEqual([]);
    expect(disabled.parity).toBeUndefined();
  });
});

async function makeRepoFixture(): Promise<string> {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'phase11-cron-'));
  await mkdir(path.join(rootDir, 'src/app/api/cron/unregistered'), { recursive: true });
  await writeFile(path.join(rootDir, 'src/app/api/cron/unregistered/route.ts'), 'export async function GET() { return Response.json({ ok: true }); }\n');
  await writeFile(path.join(rootDir, 'vercel.json'), `${JSON.stringify({ crons: [{ path: '/api/cron/missing', schedule: '* * * * *' }] })}\n`);
  await writeFile(path.join(rootDir, 'atlas.md'), '### C01 - Test Capability\n\n| Owner | Test |\n| API routes | none |\n');
  return rootDir;
}

function makeRun(): SliceVerificationRun {
  return {
    id: 'adv2-phase11-test',
    scope: 'detector:cron-route-registration assetKind:cron phase:11',
    capabilityId: 'UNRESOLVED_CRON_ROUTE_OWNERSHIP',
    capabilityName: 'Unresolved Cron Route Ownership',
    assetKind: 'cron',
    mode: 'advisory',
    startedAt: TIMEPOINT,
    completedAt: TIMEPOINT,
    limitations: ['Phase 11 is advisory-only; v1 remains authoritative.'],
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
