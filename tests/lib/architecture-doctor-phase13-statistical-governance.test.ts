import { mkdtemp, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createDetectorMigrationGovernanceDecision,
  evaluatePhase13StatisticalGovernance,
  runPhase12CronRouteShadowExecution,
  writePhase13StatisticalGovernanceArtifacts,
  REPOSITORY_IDENTITY_ALGORITHM_VERSION,
  type Phase12ShadowExecutionRecord,
  type Phase12ShadowHistory,
} from '@/lib/architecture-doctor/v2';
import type { ArchitectureInventory, AtlasSpec } from '@/lib/architecture-doctor/types';

const TIMEPOINT = '2026-07-13T00:00:00.000Z';
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('Architecture Doctor Phase 13 statistical parity governance', () => {
  it('calculates longitudinal parity, disagreement, false positive, and false negative metrics', () => {
    const summary = evaluatePhase13StatisticalGovernance({
      history: history([
        record('run-1', 'repo-a', { parityDecision: 'parity_verified' }),
        record('run-2', 'repo-b', {
          parityDecision: 'parity_failed',
          onlyV1DifferenceCount: 1,
          onlyV2DifferenceCount: 2,
          unexplainedDifferences: [{ key: 'x', reason: 'Detection exists in v2 but not in v1.' }],
        }),
      ]),
      generatedAt: TIMEPOINT,
      currentIdentityAlgorithmVersion: REPOSITORY_IDENTITY_ALGORITHM_VERSION,
      config: { minimumComparableRuns: 2, minimumRepositoryIdentities: 2 },
    });

    expect(summary.parityPercentage).toBe(50);
    expect(summary.detectorDisagreementRate).toBe(0.5);
    expect(summary.falsePositiveCount).toBe(2);
    expect(summary.falseNegativeCount).toBe(1);
    expect(summary.repositoryDiversity.uniqueRepositoryIdentities).toBe(2);
  });

  it('generates rolling parity averages and confidence trend data in timestamp order', () => {
    const summary = evaluatePhase13StatisticalGovernance({
      history: history([
        record('run-3', 'repo-c', { timestamp: '2026-07-13T00:03:00.000Z', parityDecision: 'parity_verified' }),
        record('run-1', 'repo-a', { timestamp: '2026-07-13T00:01:00.000Z', parityDecision: 'parity_verified' }),
        record('run-2', 'repo-b', { timestamp: '2026-07-13T00:02:00.000Z', parityDecision: 'parity_failed' }),
      ]),
      generatedAt: TIMEPOINT,
      currentIdentityAlgorithmVersion: REPOSITORY_IDENTITY_ALGORITHM_VERSION,
      config: { rollingWindowSize: 2, minimumComparableRuns: 3, minimumRepositoryIdentities: 2 },
    });

    expect(summary.confidenceTrend.map((point) => point.runId)).toEqual(['run-1', 'run-2', 'run-3']);
    expect(summary.confidenceTrend.map((point) => point.rollingParityAverage)).toEqual([1, 0.5, 0.5]);
    expect(summary.readinessConfidence).toBeGreaterThan(0);
  });

  it('handles repository diversity and repository identity history', () => {
    const summary = evaluatePhase13StatisticalGovernance({
      history: history([
        record('clean', 'sha-a:clean', { dirty: false }),
        record('dirty', 'sha-a:dirty:fingerprint', { dirty: true, worktreeFingerprint: 'fingerprint' }),
      ]),
      generatedAt: TIMEPOINT,
      currentIdentityAlgorithmVersion: REPOSITORY_IDENTITY_ALGORITHM_VERSION,
      config: { minimumComparableRuns: 2, minimumRepositoryIdentities: 2 },
    });

    expect(summary.repositoryDiversity.uniqueRepositoryIdentities).toBe(2);
    expect(summary.repositoryDiversity.cleanStatesObserved).toBe(1);
    expect(summary.repositoryDiversity.dirtyStatesObserved).toBe(1);
    expect(summary.repositoryDiversity.repositoryIdentityHistory.map((item) => item.runId)).toEqual(['clean', 'dirty']);
  });

  it('detects detector drift from parity regression, new differences, failures, and finding volume shifts', () => {
    const summary = evaluatePhase13StatisticalGovernance({
      history: history([
        record('baseline', 'repo-a', { parityDecision: 'parity_verified', v2FindingCount: 1 }),
        record('regression', 'repo-b', {
          parityDecision: 'parity_failed',
          v2FindingCount: 5,
          unexplainedDifferences: [{ key: 'missing', reason: 'Detection exists in v1 but not in v2.' }],
          executionFailures: [{
            stage: 'v2_shadow_execution',
            detector: 'cron-route-registration',
            timestamp: '2026-07-13T00:02:00.000Z',
            repositoryState: { commitSha: 'sha', dirty: false, identity: 'repo-b' },
            errorCategory: 'Error',
            sanitizedErrorSummary: 'failed',
            effectOnAuthority: 'No effect on authority.',
          }],
        }),
      ]),
      generatedAt: TIMEPOINT,
      currentIdentityAlgorithmVersion: REPOSITORY_IDENTITY_ALGORITHM_VERSION,
      config: { minimumComparableRuns: 2, minimumRepositoryIdentities: 2 },
    });

    expect(summary.driftEvents.map((event) => event.kind)).toEqual([
      'parity_regression',
      'new_unexplained_difference',
      'failure_regression',
      'finding_volume_shift',
    ]);
    expect(summary.governanceRecommendation.status).toBe('blocked_by_failures');
  });

  it('recommends statistical review without approving replacement when evidence is sustained', () => {
    const summary = evaluatePhase13StatisticalGovernance({
      history: history([
        record('run-1', 'repo-a'),
        record('run-2', 'repo-b'),
        record('run-3', 'repo-c'),
      ]),
      generatedAt: TIMEPOINT,
      currentIdentityAlgorithmVersion: REPOSITORY_IDENTITY_ALGORITHM_VERSION,
      config: { minimumComparableRuns: 3, minimumRepositoryIdentities: 2, targetParityPercentage: 99 },
    });

    expect(summary.governanceRecommendation.status).toBe('statistically_ready_for_review');
    expect(summary.governanceRecommendation.replacementApproved).toBe(false);
    expect(summary.constitutionalGuarantees.v1AuthoritativeForEveryRun).toBe(true);
    expect(summary.constitutionalGuarantees.noAutomaticPromotion).toBe(true);
  });

  it('keeps governance blocked by insufficient evidence and never treats approval as automatic', () => {
    const summary = evaluatePhase13StatisticalGovernance({
      history: history([record('run-1', 'repo-a')]),
      generatedAt: TIMEPOINT,
      currentIdentityAlgorithmVersion: REPOSITORY_IDENTITY_ALGORITHM_VERSION,
      governanceDecision: createDetectorMigrationGovernanceDecision({
        id: 'gov-approved',
        decision: 'approved_for_replacement',
        actor: 'test',
        rationale: 'test',
        timestamp: TIMEPOINT,
        detectorScope: 'detector:cron-route-registration',
        repositoryState: { commitSha: 'sha', dirty: false, identity: 'repo-a' },
        parityResultRef: 'test',
      }),
      config: { minimumComparableRuns: 3, minimumRepositoryIdentities: 2 },
    });

    expect(summary.governanceRecommendation.replacementApproved).toBe(false);
    expect(summary.governanceRecommendation.blockers).toContain('Phase 13 records statistical readiness only; replacement approval must be handled by an explicit later governance phase.');
  });

  it('is backward compatible with older Phase 12 records that do not carry difference counts', () => {
    const oldRecord = record('old', 'repo-a', {
      parityDecision: 'parity_failed',
      unexplainedDifferences: [
        { key: 'fp', reason: 'Detection exists in v2 but not in v1.' },
        { key: 'fn', reason: 'Detection exists in v1 but not in v2.' },
      ],
    });
    delete oldRecord.onlyV1DifferenceCount;
    delete oldRecord.onlyV2DifferenceCount;

    const summary = evaluatePhase13StatisticalGovernance({
      history: history([oldRecord]),
      generatedAt: TIMEPOINT,
      currentIdentityAlgorithmVersion: REPOSITORY_IDENTITY_ALGORITHM_VERSION,
      config: { minimumComparableRuns: 1, minimumRepositoryIdentities: 1 },
    });

    expect(summary.falsePositiveCount).toBe(1);
    expect(summary.falseNegativeCount).toBe(1);
  });

  it('writes the Phase 13 governance artifact set', async () => {
    const outputDir = await makeTempDir();
    const summary = evaluatePhase13StatisticalGovernance({
      history: history([record('run-1', 'repo-a'), record('run-2', 'repo-b')]),
      generatedAt: TIMEPOINT,
      currentIdentityAlgorithmVersion: REPOSITORY_IDENTITY_ALGORITHM_VERSION,
      config: { minimumComparableRuns: 2, minimumRepositoryIdentities: 2 },
    });

    const artifacts = await writePhase13StatisticalGovernanceArtifacts({ outputDir, summary });

    expect(readFileSync(artifacts.statisticalParityReport, 'utf8')).toContain('v1 decides.');
    expect(JSON.parse(readFileSync(artifacts.trendHistory, 'utf8')).points).toHaveLength(2);
    expect(JSON.parse(readFileSync(artifacts.governanceRecommendation, 'utf8')).replacementApproved).toBe(false);
  });

  it('keeps Phase 13 artifact generation isolated from authoritative v1 output', async () => {
    const outputDir = await makeTempDir();
    const result = await runPhase12CronRouteShadowExecution({
      rootDir: process.cwd(),
      outputDir,
      atlas: makeAtlas(),
      inventory: makeInventory(),
      now: new Date(TIMEPOINT),
      config: { executionMode: 'shadow_advisory', artifactOutputEnabled: true },
    });

    expect(result.authoritativeV1Findings).toHaveLength(2);
    expect(result.authoritativeHealthChanged).toBe(false);
    expect(result.artifacts.phase13StatisticalParityReport).toBeTruthy();
    expect(result.artifacts.phase13GovernanceRecommendation).toBeTruthy();
  });
});

describe('Architecture Doctor Phase 13 identity-algorithm-version comparability gate', () => {
  it('counts distinct current-version fingerprints toward diversity', () => {
    const summary = evaluatePhase13StatisticalGovernance({
      history: history([record('run-1', 'repo-a'), record('run-2', 'repo-b')]),
      generatedAt: TIMEPOINT,
      currentIdentityAlgorithmVersion: REPOSITORY_IDENTITY_ALGORITHM_VERSION,
      config: { minimumComparableRuns: 2, minimumRepositoryIdentities: 2 },
    });

    expect(summary.repositoryDiversity.uniqueRepositoryIdentities).toBe(2);
    expect(summary.repositoryDiversity.excludedByAlgorithmVersion).toBe(0);
  });

  it('does not let legacy (pre-field) fingerprints increase diversity', () => {
    const legacyOne = record('legacy-1', 'repo-a');
    delete legacyOne.repositoryState.identityAlgorithmVersion;
    const legacyTwo = record('legacy-2', 'repo-b');
    delete legacyTwo.repositoryState.identityAlgorithmVersion;

    const summary = evaluatePhase13StatisticalGovernance({
      history: history([legacyOne, legacyTwo]),
      generatedAt: TIMEPOINT,
      currentIdentityAlgorithmVersion: REPOSITORY_IDENTITY_ALGORITHM_VERSION,
      config: { minimumComparableRuns: 2, minimumRepositoryIdentities: 1 },
    });

    expect(summary.repositoryDiversity.uniqueRepositoryIdentities).toBe(0);
    expect(summary.repositoryDiversity.excludedByAlgorithmVersion).toBe(2);
  });

  it('does not let an unsupported-future fingerprint increase diversity', () => {
    const future = record('future-1', 'repo-a');
    future.repositoryState.identityAlgorithmVersion = REPOSITORY_IDENTITY_ALGORITHM_VERSION + 1;

    const summary = evaluatePhase13StatisticalGovernance({
      history: history([future, record('current-1', 'repo-b')]),
      generatedAt: TIMEPOINT,
      currentIdentityAlgorithmVersion: REPOSITORY_IDENTITY_ALGORITHM_VERSION,
      config: { minimumComparableRuns: 2, minimumRepositoryIdentities: 1 },
    });

    expect(summary.repositoryDiversity.uniqueRepositoryIdentities).toBe(1);
    expect(summary.repositoryDiversity.excludedByAlgorithmVersion).toBe(1);
  });

  it('does not crash on malformed identity algorithm version records', () => {
    const malformedVersions: unknown[] = [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 'two', null, {}];
    for (const version of malformedVersions) {
      const malformed = record('malformed-run', 'repo-a');
      (malformed.repositoryState as unknown as { identityAlgorithmVersion: unknown }).identityAlgorithmVersion = version;

      expect(() => evaluatePhase13StatisticalGovernance({
        history: history([malformed]),
        generatedAt: TIMEPOINT,
        currentIdentityAlgorithmVersion: REPOSITORY_IDENTITY_ALGORITHM_VERSION,
        config: { minimumComparableRuns: 1, minimumRepositoryIdentities: 1 },
      })).not.toThrow();
    }
  });

  it('never treats identical fingerprint strings across incompatible version classes as comparable', () => {
    const current = record('current-run', 'same-repo');
    const legacy = record('legacy-run', 'same-repo');
    delete legacy.repositoryState.identityAlgorithmVersion;

    const summary = evaluatePhase13StatisticalGovernance({
      history: history([current, legacy]),
      generatedAt: TIMEPOINT,
      currentIdentityAlgorithmVersion: REPOSITORY_IDENTITY_ALGORITHM_VERSION,
      config: { minimumComparableRuns: 2, minimumRepositoryIdentities: 1 },
    });

    // Both records share the identity string "same-repo", but only the current-version one
    // is eligible for diversity; the legacy record must not be silently merged with it, nor
    // counted as a second, distinct identity.
    expect(summary.repositoryDiversity.uniqueRepositoryIdentities).toBe(1);
    expect(summary.repositoryDiversity.excludedByAlgorithmVersion).toBe(1);
  });

  it('keeps mixed-version histories fully readable in repositoryIdentityHistory', () => {
    const current = record('current-run', 'repo-a');
    const legacy = record('legacy-run', 'repo-b');
    delete legacy.repositoryState.identityAlgorithmVersion;
    const future = record('future-run', 'repo-c');
    future.repositoryState.identityAlgorithmVersion = REPOSITORY_IDENTITY_ALGORITHM_VERSION + 1;
    const malformed = record('malformed-run', 'repo-d');
    (malformed.repositoryState as unknown as { identityAlgorithmVersion: unknown }).identityAlgorithmVersion = -1;

    const summary = evaluatePhase13StatisticalGovernance({
      history: history([current, legacy, future, malformed]),
      generatedAt: TIMEPOINT,
      currentIdentityAlgorithmVersion: REPOSITORY_IDENTITY_ALGORITHM_VERSION,
      config: { minimumComparableRuns: 4, minimumRepositoryIdentities: 1 },
    });

    expect(summary.totalRuns).toBe(4);
    expect(summary.repositoryDiversity.repositoryIdentityHistory).toHaveLength(4);
    const classByRunId = new Map(summary.repositoryDiversity.repositoryIdentityHistory.map((item) => [item.runId, item.identityVersionClass]));
    expect(classByRunId.get('current-run')).toBe('current');
    expect(classByRunId.get('legacy-run')).toBe('legacy');
    expect(classByRunId.get('future-run')).toBe('unsupported_future');
    expect(classByRunId.get('malformed-run')).toBe('malformed');
  });

  it('cannot improve readiness because of incompatible records, and never approves replacement', () => {
    const legacyRecords = Array.from({ length: 5 }, (_, index) => {
      const rec = record(`legacy-${index}`, `repo-${index}`);
      delete rec.repositoryState.identityAlgorithmVersion;
      return rec;
    });

    const summary = evaluatePhase13StatisticalGovernance({
      history: history(legacyRecords),
      generatedAt: TIMEPOINT,
      currentIdentityAlgorithmVersion: REPOSITORY_IDENTITY_ALGORITHM_VERSION,
      config: { minimumComparableRuns: 5, minimumRepositoryIdentities: 2, targetParityPercentage: 99 },
    });

    // Five comparable, parity-verified legacy records would have satisfied every threshold
    // under the old (ungated) diversity count; the gate must still block readiness because
    // none of them are current-version comparable evidence.
    expect(summary.repositoryDiversity.uniqueRepositoryIdentities).toBe(0);
    expect(summary.governanceRecommendation.status).not.toBe('statistically_ready_for_review');
    expect(summary.governanceRecommendation.replacementApproved).toBe(false);
  });

  it('keeps v1 authority guarantees intact alongside the comparability gate', () => {
    const summary = evaluatePhase13StatisticalGovernance({
      history: history([record('run-1', 'repo-a'), record('run-2', 'repo-b')]),
      generatedAt: TIMEPOINT,
      currentIdentityAlgorithmVersion: REPOSITORY_IDENTITY_ALGORITHM_VERSION,
      config: { minimumComparableRuns: 2, minimumRepositoryIdentities: 2 },
    });

    expect(summary.constitutionalGuarantees.v1AuthoritativeForEveryRun).toBe(true);
    expect(summary.constitutionalGuarantees.noAutomaticPromotion).toBe(true);
    expect(summary.governanceRecommendation.replacementApproved).toBe(false);
  });
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'phase13-stats-'));
  tempDirs.push(dir);
  return dir;
}

function history(records: Phase12ShadowExecutionRecord[]): Phase12ShadowHistory {
  return { version: 1, records };
}

function record(
  runId: string,
  repositoryIdentity: string,
  overrides: Partial<Phase12ShadowExecutionRecord & { dirty: boolean; worktreeFingerprint: string }> = {},
): Phase12ShadowExecutionRecord {
  const timestamp = overrides.timestamp ?? `2026-07-13T00:${runId.replace(/\D/g, '').padStart(2, '0') || '00'}:00.000Z`;
  return {
    runId,
    detectorId: 'cron-route-registration',
    repositoryState: {
      commitSha: repositoryIdentity.split(':')[0] || 'sha',
      dirty: overrides.dirty ?? false,
      worktreeFingerprint: overrides.worktreeFingerprint,
      identity: repositoryIdentity,
      identityAlgorithmVersion: REPOSITORY_IDENTITY_ALGORITHM_VERSION,
    },
    timestamp,
    v1ExecutionStatus: 'succeeded',
    v2ExecutionStatus: 'succeeded',
    parityDecision: overrides.parityDecision ?? 'parity_verified',
    explainedDifferences: [],
    unexplainedDifferences: overrides.unexplainedDifferences ?? [],
    executionFailures: overrides.executionFailures ?? [],
    authoritativeSource: 'v1',
    configurationSnapshot: {
      detectorId: 'cron-route-registration',
      shadowEnabled: true,
      executionMode: 'shadow_advisory',
      failurePolicy: 'isolate_and_continue',
      parityRecordingEnabled: true,
      artifactOutputEnabled: true,
      minimumSuccessfulRunsForReadiness: 3,
    },
    v1FindingCount: overrides.v1FindingCount ?? 1,
    v2FindingCount: overrides.v2FindingCount ?? 1,
    onlyV1DifferenceCount: overrides.onlyV1DifferenceCount ?? 0,
    onlyV2DifferenceCount: overrides.onlyV2DifferenceCount ?? 0,
    v2FindingsDoubleCounted: false,
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
