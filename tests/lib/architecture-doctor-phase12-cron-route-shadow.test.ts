import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import {
  analyzeCronRouteRegistration,
  createDetectorMigrationGovernanceDecision,
  evaluatePhase12ShadowReadiness,
  readRepositoryStateIdentity,
  runPhase12CronRouteShadowExecution,
  type ModuleAnalysisResult,
  type Phase12ShadowExecutionRecord,
  type Phase12ShadowHistory,
  type SliceKnowledgePublication,
  type SliceVerificationRun,
} from '@/lib/architecture-doctor/v2';
import { detectPhaseOneDrift } from '@/lib/architecture-doctor/reporter';
import type { ArchitectureInventory, AtlasSpec } from '@/lib/architecture-doctor/types';

const execFileAsync = promisify(execFile);
const TIMEPOINT = '2026-07-12T00:00:00.000Z';
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('Architecture Doctor Phase 12 cron route shadow execution', () => {
  it('keeps shadow-disabled execution behaviourally identical to v1 cron detection', async () => {
    const result = await runPhase12CronRouteShadowExecution({
      rootDir: process.cwd(),
      atlas: makeAtlas(),
      inventory: makeInventory(),
      now: new Date(TIMEPOINT),
      config: { executionMode: 'disabled' },
    });
    const v1 = detectPhaseOneDrift(makeAtlas(), makeInventory()).filter((finding) =>
      finding.type === 'cron_route_unregistered' || finding.type === 'cron_target_missing'
    );

    expect(result.authoritativeV1Findings).toEqual(v1);
    expect(result.record.v2ExecutionStatus).toBe('disabled');
    expect(result.record.v2FindingCount).toBe(0);
    expect(result.artifacts).toEqual({});
  });

  it('preserves v1 authority and excludes v2 findings from aggregate authority', async () => {
    const result = await runPhase12CronRouteShadowExecution({
      rootDir: process.cwd(),
      atlas: makeAtlas(),
      inventory: makeInventory(),
      now: new Date(TIMEPOINT),
      config: { executionMode: 'shadow_advisory' },
    });

    expect(result.record.authoritativeSource).toBe('v1');
    expect(result.record.v1FindingCount).toBe(2);
    expect(result.record.v2FindingCount).toBe(2);
    expect(result.record.v2FindingsDoubleCounted).toBe(false);
    expect(result.authoritativeHealthChanged).toBe(false);
    expect(result.record.parityDecision).toBe('parity_verified');
  });

  it('isolates a v2 analyzer exception from v1 output', async () => {
    const result = await runPhase12CronRouteShadowExecution({
      rootDir: process.cwd(),
      atlas: makeAtlas(),
      inventory: makeInventory(),
      now: new Date(TIMEPOINT),
      config: { executionMode: 'shadow_advisory' },
      runV2: async () => {
        throw new Error('shadow analyzer failed');
      },
    });

    expect(result.authoritativeV1Findings).toHaveLength(2);
    expect(result.record.v2ExecutionStatus).toBe('failed');
    expect(result.record.executionFailures[0]).toMatchObject({
      stage: 'v2_shadow_execution',
      detector: 'cron-route-registration',
    });
    expect(result.record.executionFailures[0].effectOnAuthority).toContain('No effect on authority');
  });

  it('isolates a parity comparator exception from v1 output', async () => {
    const result = await runPhase12CronRouteShadowExecution({
      rootDir: process.cwd(),
      atlas: makeAtlas(),
      inventory: makeInventory(),
      now: new Date(TIMEPOINT),
      config: { executionMode: 'shadow_advisory' },
      compareParity: () => {
        throw new Error('comparator unavailable');
      },
    });

    expect(result.authoritativeV1Findings).toHaveLength(2);
    expect(result.record.parityDecision).toBe('comparison_failed');
    expect(result.record.executionFailures.map((failure) => failure.stage)).toContain('parity_comparison');
  });

  it('isolates an artifact write failure from v1 output', async () => {
    const outputDir = await makeTempDir('phase12-artifacts-');
    const result = await runPhase12CronRouteShadowExecution({
      rootDir: process.cwd(),
      outputDir,
      atlas: makeAtlas(),
      inventory: makeInventory(),
      now: new Date(TIMEPOINT),
      config: { executionMode: 'shadow_advisory', artifactOutputEnabled: true },
      writeArtifacts: async () => {
        throw new Error('disk unavailable');
      },
    });

    expect(result.authoritativeV1Findings).toHaveLength(2);
    expect(result.artifactFailures).toHaveLength(1);
    expect(result.record.executionFailures.map((failure) => failure.stage)).toContain('artifact_persistence');
  });

  it('keeps execution failures and detection differences separate', async () => {
    const incomplete = analyzeCronRouteRegistration(makeInventory(), { verificationRun: makeRun(), timepoint: TIMEPOINT });
    const withoutOneFinding: ModuleAnalysisResult = {
      ...incomplete,
      findings: incomplete.findings.filter((finding) => finding.type !== 'cron_target_missing'),
    };

    const result = await runPhase12CronRouteShadowExecution({
      rootDir: process.cwd(),
      atlas: makeAtlas(),
      inventory: makeInventory(),
      now: new Date(TIMEPOINT),
      config: { executionMode: 'shadow_advisory' },
      runV2: async () => ({
        analyses: [withoutOneFinding],
        knowledge: makeKnowledge(),
      }),
    });

    expect(result.record.executionFailures).toHaveLength(0);
    expect(result.record.unexplainedDifferences.map((item) => item.key)).toContain('cron_target_missing:/api/cron/missing');
  });

  it('distinguishes clean and dirty repository identity with a deterministic dirty fingerprint', async () => {
    const rootDir = await makeGitRepo();
    const clean = await readRepositoryStateIdentity(rootDir);
    // Only paths Architecture Doctor's analyzers actually read (src/**, scripts/**,
    // supabase/migrations/**, vercel.json) are relevant to repository identity.
    await mkdir(path.join(rootDir, 'src'), { recursive: true });
    await writeFile(path.join(rootDir, 'src', 'dirty.txt'), 'dirty\n');
    const dirtyOne = await readRepositoryStateIdentity(rootDir);
    const dirtyTwo = await readRepositoryStateIdentity(rootDir);

    expect(clean.dirty).toBe(false);
    expect(dirtyOne.dirty).toBe(true);
    expect(dirtyOne.identity).not.toBe(clean.identity);
    expect(dirtyTwo.worktreeFingerprint).toBe(dirtyOne.worktreeFingerprint);
  });

  it('appends shadow history without semantic overwriting', async () => {
    const outputDir = await makeTempDir('phase12-history-');
    await runPhase12CronRouteShadowExecution({
      rootDir: process.cwd(),
      outputDir,
      atlas: makeAtlas(),
      inventory: makeInventory(),
      now: new Date('2026-07-12T00:00:00.000Z'),
      config: { executionMode: 'shadow_advisory', artifactOutputEnabled: true },
    });
    const second = await runPhase12CronRouteShadowExecution({
      rootDir: process.cwd(),
      outputDir,
      atlas: makeAtlas(),
      inventory: makeInventory(),
      now: new Date('2026-07-12T00:01:00.000Z'),
      config: { executionMode: 'shadow_advisory', artifactOutputEnabled: true },
    });

    expect(second.history.records).toHaveLength(2);
    expect(second.history.records.map((record) => record.runId)).toEqual([
      'adv2-phase12-cron-shadow-2026-07-12T00-00-00-000Z',
      'adv2-phase12-cron-shadow-2026-07-12T00-01-00-000Z',
    ]);
  });

  it('keeps readiness blocked below the successful-run threshold', () => {
    const readiness = evaluatePhase12ShadowReadiness(makeReadinessInput([makeRecord('one', 'repo-a')], 2));

    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.map((blocker) => blocker.reason)).toContain('Only 1 successful shadow run(s) exist; 2 required.');
  });

  it('keeps readiness blocked when successful runs cover only one repository state', () => {
    const readiness = evaluatePhase12ShadowReadiness(makeReadinessInput([
      makeRecord('one', 'repo-a'),
      makeRecord('two', 'repo-a'),
    ], 2));

    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.map((blocker) => blocker.reason)).toContain('Successful shadow runs do not cover more than one repository state.');
  });

  it('keeps readiness blocked by unexplained differences and v2 failures', () => {
    const withDifference = makeRecord('one', 'repo-a');
    withDifference.unexplainedDifferences = [{ key: 'cron_target_missing:/api/cron/missing', reason: 'Detection exists in v1 but not in v2.' }];
    const withFailure = makeRecord('two', 'repo-b');
    withFailure.executionFailures = [{
      stage: 'v2_shadow_execution',
      detector: 'cron-route-registration',
      timestamp: TIMEPOINT,
      repositoryState: { commitSha: 'abc', dirty: false, identity: 'repo-b' },
      errorCategory: 'Error',
      sanitizedErrorSummary: 'failed',
      effectOnAuthority: 'No effect on authority.',
    }];
    const readiness = evaluatePhase12ShadowReadiness(makeReadinessInput([withDifference, withFailure], 2));

    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.map((blocker) => blocker.reason)).toContain('At least one shadow run has unresolved unexplained differences.');
    expect(readiness.blockers.map((blocker) => blocker.reason)).toContain('At least one shadow run has an unresolved v2 execution failure.');
  });

  it('does not automatically grant replacement approval after thresholds are met', () => {
    const readiness = evaluatePhase12ShadowReadiness(makeReadinessInput([
      makeRecord('one', 'repo-a'),
      makeRecord('two', 'repo-b'),
    ], 2));

    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.map((blocker) => blocker.requirement)).toContain('explicit_governance_decision_approves_replacement');
  });
});

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function makeGitRepo(): Promise<string> {
  const rootDir = await makeTempDir('phase12-git-');
  await execFileAsync('git', ['init'], { cwd: rootDir });
  await writeFile(path.join(rootDir, 'tracked.txt'), 'tracked\n');
  await execFileAsync('git', ['add', '.'], { cwd: rootDir });
  await execFileAsync('git', ['-c', 'user.email=test@example.com', '-c', 'user.name=Test User', 'commit', '-m', 'initial'], { cwd: rootDir });
  return rootDir;
}

function makeRun(): SliceVerificationRun {
  return {
    id: 'adv2-phase12-test',
    scope: 'detector:cron-route-registration assetKind:cron phase:12',
    capabilityId: 'UNRESOLVED_CRON_ROUTE_OWNERSHIP',
    capabilityName: 'Unresolved Cron Route Ownership',
    assetKind: 'cron',
    mode: 'advisory',
    startedAt: TIMEPOINT,
    completedAt: TIMEPOINT,
    limitations: ['Phase 12 is shadow-only; v1 remains authoritative.'],
  };
}

function makeKnowledge(): SliceKnowledgePublication {
  return {
    verificationRun: makeRun(),
    nodes: [],
    edges: [],
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

function makeRecord(runId: string, repositoryIdentity: string): Phase12ShadowExecutionRecord {
  return {
    runId,
    detectorId: 'cron-route-registration',
    repositoryState: { commitSha: 'abc', dirty: false, identity: repositoryIdentity },
    timestamp: TIMEPOINT,
    v1ExecutionStatus: 'succeeded',
    v2ExecutionStatus: 'succeeded',
    parityDecision: 'parity_verified',
    explainedDifferences: [],
    unexplainedDifferences: [],
    executionFailures: [],
    authoritativeSource: 'v1',
    configurationSnapshot: {
      detectorId: 'cron-route-registration',
      shadowEnabled: true,
      executionMode: 'shadow_advisory',
      failurePolicy: 'isolate_and_continue',
      parityRecordingEnabled: true,
      artifactOutputEnabled: true,
      minimumSuccessfulRunsForReadiness: 2,
    },
    v1FindingCount: 2,
    v2FindingCount: 2,
    v2FindingsDoubleCounted: false,
  };
}

function makeReadinessInput(records: Phase12ShadowExecutionRecord[], minimumSuccessfulRuns: number) {
  const history: Phase12ShadowHistory = { version: 1, records };
  return {
    detectorScope: 'detector:cron-route-registration assetKind:cron phase:12',
    repositoryState: { commitSha: 'abc', dirty: false, identity: 'repo-current' },
    parityResultRef: 'phase12-shadow:test',
    history,
    minimumSuccessfulRuns,
    downstreamCompatibilityDocumented: true,
    rollbackDefined: true,
    governanceDecision: createDetectorMigrationGovernanceDecision({
      id: 'phase12-governance-test',
      decision: 'needs_review',
      actor: 'test actor',
      rationale: 'test rationale',
      timestamp: TIMEPOINT,
      detectorScope: 'detector:cron-route-registration assetKind:cron phase:12',
      repositoryState: { commitSha: 'abc', dirty: false, identity: 'repo-current' },
      parityResultRef: 'phase12-shadow:test',
    }),
  };
}
