import { mkdtemp, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  evaluatePhase13StatisticalGovernance,
  evaluatePhase14EvidenceQuality,
  runPhase12CronRouteShadowExecution,
  writePhase14EvidenceQualityArtifacts,
  REPOSITORY_IDENTITY_ALGORITHM_VERSION,
  type Phase12ShadowExecutionRecord,
  type Phase12ShadowHistory,
} from '@/lib/architecture-doctor/v2';
import type { ArchitectureInventory, AtlasSpec } from '@/lib/architecture-doctor/types';

const GENERATED_AT = '2026-07-20T00:00:00.000Z';
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('Architecture Doctor Phase 14 evidence quality governance', () => {
  it('marks repeated identical repository fingerprints as duplicate and non-independent', () => {
    const summary = evaluateQuality([
      record('run-1', { commitSha: 'a', fingerprint: 'same', timestamp: '2026-07-18T00:00:00.000Z' }),
      record('run-2', { commitSha: 'a', fingerprint: 'same', timestamp: '2026-07-19T00:00:00.000Z' }),
    ]);

    expect(summary.comparableRuns).toBe(2);
    expect(summary.independentRuns).toBe(1);
    expect(summary.duplicateStateRuns).toBe(1);
    expect(summary.defects.map((defect) => defect.defectType)).toContain('duplicate_repository_state');
  });

  it('does not let multiple runs on one commit satisfy repository diversity', () => {
    const summary = evaluateQuality([
      record('run-1', { commitSha: 'same-commit', fingerprint: 'fp-1', timestamp: '2026-07-17T00:00:00.000Z' }),
      record('run-2', { commitSha: 'same-commit', fingerprint: 'fp-2', timestamp: '2026-07-18T00:00:00.000Z' }),
      record('run-3', { commitSha: 'same-commit', fingerprint: 'fp-3', timestamp: '2026-07-19T00:00:00.000Z' }),
    ], { minimumUniqueCommits: 2, minimumIndependentRuns: 3, minimumUniqueRepositoryFingerprints: 3 });

    expect(summary.uniqueCommits).toBe(1);
    expect(summary.uniqueRepositoryFingerprints).toBe(3);
    expect(summary.defects.some((defect) => defect.explanation.includes('Only 1 unique commit'))).toBe(true);
  });

  it('treats dirty fingerprint changes as distinct repository states and counts clean versus dirty states', () => {
    const summary = evaluateQuality([
      record('clean', { commitSha: 'a', dirty: false, fingerprint: 'a:clean', timestamp: '2026-07-17T00:00:00.000Z' }),
      record('dirty-1', { commitSha: 'a', dirty: true, fingerprint: 'dirty-a', timestamp: '2026-07-18T00:00:00.000Z' }),
      record('dirty-2', { commitSha: 'a', dirty: true, fingerprint: 'dirty-b', timestamp: '2026-07-19T00:00:00.000Z' }),
    ], { minimumUniqueCommits: 1, minimumIndependentRuns: 3, minimumUniqueRepositoryFingerprints: 3 });

    expect(summary.cleanStateCount).toBe(1);
    expect(summary.dirtyStateCount).toBe(2);
    expect(summary.independentRuns).toBe(3);
  });

  it('represents legacy records with missing difference counts as unknown evidence', () => {
    const legacy = record('legacy', { commitSha: 'a', fingerprint: 'fp-a', timestamp: '2026-07-18T00:00:00.000Z' });
    delete legacy.onlyV1DifferenceCount;
    delete legacy.onlyV2DifferenceCount;

    const summary = evaluateQuality([legacy]);

    expect(summary.unknownOrMissingMetrics).toBe(1);
    expect(summary.assessments[0].metricsCompleteness).toBe('legacy_unknown_difference_counts');
    expect(summary.assessments[0].independent).toBe(false);
    expect(summary.defects.map((defect) => defect.defectType)).toContain('legacy_record_missing_metrics');
  });

  it('detects malformed history records without throwing', () => {
    const malformed = { detectorId: 'cron-route-registration', runId: '', timestamp: '' } as Phase12ShadowExecutionRecord;
    const summary = evaluatePhase14EvidenceQuality({
      history: { version: 1, records: [malformed] },
      phase13: phase13([malformed]),
      generatedAt: GENERATED_AT,
      currentIdentityAlgorithmVersion: REPOSITORY_IDENTITY_ALGORITHM_VERSION,
      config: { minimumIndependentRuns: 1, minimumUniqueCommits: 1, minimumUniqueRepositoryFingerprints: 1 },
    });

    expect(summary.rejectedRecords).toBe(1);
    expect(summary.defects.map((defect) => defect.defectType)).toContain('malformed_history_record');
  });

  it('detects configuration mismatches across comparable records', () => {
    const changed = record('changed', { commitSha: 'b', fingerprint: 'fp-b', timestamp: '2026-07-19T00:00:00.000Z' });
    changed.configurationSnapshot.parityRecordingEnabled = false;
    const summary = evaluateQuality([
      record('baseline', { commitSha: 'a', fingerprint: 'fp-a', timestamp: '2026-07-18T00:00:00.000Z' }),
      changed,
    ]);

    expect(summary.defects.map((defect) => defect.defectType)).toContain('configuration_mismatch');
    expect(summary.readinessDecision.status).toBe('continue_shadow');
  });

  it('detects stale evidence and insufficient observation period', () => {
    const summary = evaluateQuality([
      record('old-1', { commitSha: 'a', fingerprint: 'fp-a', timestamp: '2026-05-01T00:00:00.000Z' }),
      record('old-2', { commitSha: 'b', fingerprint: 'fp-b', timestamp: '2026-05-01T01:00:00.000Z' }),
    ], { maximumEvidenceAgeDays: 10, minimumObservationPeriodHours: 24 });

    expect(summary.defects.map((defect) => defect.defectType)).toContain('stale_evidence');
    expect(summary.defects.map((defect) => defect.defectType)).toContain('insufficient_observation_period');
  });

  it('detects incomplete detector executions and repository identity fallback usage', () => {
    const failed = record('failed', { commitSha: 'a', fingerprint: 'fp-a', timestamp: '2026-07-18T00:00:00.000Z' });
    failed.v2ExecutionStatus = 'failed';
    failed.parityDecision = 'not_run';
    const fallback = record('fallback', { commitSha: 'unknown', fingerprint: 'fallback:git-unavailable:test', timestamp: '2026-07-19T00:00:00.000Z' });
    fallback.repositoryState.fallbackIdentity = 'git-unavailable';

    const summary = evaluateQuality([failed, fallback]);

    expect(summary.defects.map((defect) => defect.defectType)).toContain('incomplete_detector_execution');
    expect(summary.defects.map((defect) => defect.defectType)).toContain('repository_identity_fallback_used');
    expect(summary.independentRuns).toBe(0);
  });

  it('calculates evidence quality and blocks readiness when evidence is defective', () => {
    const summary = evaluateQuality([
      record('run-1', { commitSha: 'a', fingerprint: 'fp-a', timestamp: '2026-07-18T00:00:00.000Z' }),
      record('run-2', { commitSha: 'b', fingerprint: 'fp-b', timestamp: '2026-07-19T00:00:00.000Z' }),
      record('run-3', { commitSha: 'c', fingerprint: 'fp-c', timestamp: '2026-07-20T00:00:00.000Z' }),
    ], { minimumIndependentRuns: 5, minimumUniqueCommits: 2, minimumUniqueRepositoryFingerprints: 3, minimumObservationPeriodHours: 24 });

    expect(summary.evidenceQualityScore).toBeLessThan(1);
    expect(summary.readinessDecision.status).toBe('continue_shadow');
    expect(summary.readinessDecision.replacementApproved).toBe(false);
    expect(summary.readinessDecision.blockers.some((blocker) => blocker.includes('insufficient_independent_runs'))).toBe(true);
  });

  it('can reach needs_review but still never approves replacement', () => {
    const summary = evaluateQuality([
      record('run-1', { commitSha: 'a', fingerprint: 'fp-a', timestamp: '2026-07-15T00:00:00.000Z' }),
      record('run-2', { commitSha: 'b', fingerprint: 'fp-b', timestamp: '2026-07-16T00:00:00.000Z' }),
      record('run-3', { commitSha: 'c', fingerprint: 'fp-c', timestamp: '2026-07-17T00:00:00.000Z' }),
    ], { minimumIndependentRuns: 3, minimumUniqueCommits: 2, minimumUniqueRepositoryFingerprints: 3, minimumObservationPeriodHours: 24 });

    expect(summary.readinessDecision.status).toBe('needs_review');
    expect(summary.readinessDecision.readyForReplacement).toBe(false);
    expect(summary.governanceRecommendation.replacementApproved).toBe(false);
  });

  it('writes Phase 14 artifacts', async () => {
    const outputDir = await makeTempDir();
    const summary = evaluateQuality([
      record('run-1', { commitSha: 'a', fingerprint: 'fp-a', timestamp: '2026-07-18T00:00:00.000Z' }),
      record('run-2', { commitSha: 'b', fingerprint: 'fp-b', timestamp: '2026-07-19T00:00:00.000Z' }),
    ]);

    const artifacts = await writePhase14EvidenceQualityArtifacts({ outputDir, summary });

    expect(readFileSync(artifacts.evidenceQualityReport, 'utf8')).toContain('v1 decides.');
    expect(JSON.parse(readFileSync(artifacts.evidenceAssessments, 'utf8')).assessments).toHaveLength(2);
    expect(JSON.parse(readFileSync(artifacts.readinessDecision, 'utf8')).replacementApproved).toBe(false);
  });

  it('keeps Phase 14 artifact generation isolated from authoritative v1 output', async () => {
    const outputDir = await makeTempDir();
    const result = await runPhase12CronRouteShadowExecution({
      rootDir: process.cwd(),
      outputDir,
      atlas: makeAtlas(),
      inventory: makeInventory(),
      now: new Date(GENERATED_AT),
      config: { executionMode: 'shadow_advisory', artifactOutputEnabled: true },
    });

    expect(result.authoritativeV1Findings).toHaveLength(2);
    expect(result.authoritativeHealthChanged).toBe(false);
    expect(result.artifacts.phase14EvidenceQualityReport).toBeTruthy();
    expect(result.artifacts.phase14GovernanceRecommendation).toBeTruthy();
  });
});

describe('Architecture Doctor Phase 14 identity-algorithm-version comparability gate', () => {
  it('keeps two current-version records comparable and both independent', () => {
    const summary = evaluateQuality([
      record('run-1', { commitSha: 'a', fingerprint: 'fp-a', timestamp: '2026-07-18T00:00:00.000Z' }),
      record('run-2', { commitSha: 'b', fingerprint: 'fp-b', timestamp: '2026-07-19T00:00:00.000Z' }),
    ], { minimumIndependentRuns: 2, minimumUniqueCommits: 2, minimumUniqueRepositoryFingerprints: 2 });

    expect(summary.assessments.every((assessment) => assessment.identityVersionClass === 'current')).toBe(true);
    expect(summary.independentRuns).toBe(2);
    expect(summary.uniqueRepositoryFingerprints).toBe(2);
  });

  it('does not treat a legacy record and a current-version record with an identical fingerprint string as comparable', () => {
    const current = record('current-run', { commitSha: 'a', fingerprint: 'same-fp', timestamp: '2026-07-18T00:00:00.000Z' });
    const legacy = record('legacy-run', { commitSha: 'a', fingerprint: 'same-fp', timestamp: '2026-07-19T00:00:00.000Z' });
    delete legacy.repositoryState.identityAlgorithmVersion;

    const summary = evaluateQuality([current, legacy], { minimumIndependentRuns: 1, minimumUniqueCommits: 1, minimumUniqueRepositoryFingerprints: 1 });

    const currentAssessment = summary.assessments.find((assessment) => assessment.runId === 'current-run')!;
    const legacyAssessment = summary.assessments.find((assessment) => assessment.runId === 'legacy-run')!;
    expect(currentAssessment.identityVersionClass).toBe('current');
    expect(legacyAssessment.identityVersionClass).toBe('legacy');
    // The identical fingerprint string must not mark the current-version record as a
    // duplicate of the legacy one, or vice versa.
    expect(currentAssessment.duplicateState).toBe(false);
    expect(currentAssessment.independent).toBe(true);
    expect(legacyAssessment.independent).toBe(false);
    expect(legacyAssessment.defects).toContain('incompatible_identity_algorithm_version');
  });

  it('fails closed for an unsupported-future identity algorithm version', () => {
    const future = record('future-run', { commitSha: 'a', fingerprint: 'fp-a', timestamp: '2026-07-18T00:00:00.000Z' });
    future.repositoryState.identityAlgorithmVersion = REPOSITORY_IDENTITY_ALGORITHM_VERSION + 1;

    const summary = evaluateQuality([future], { minimumIndependentRuns: 1, minimumUniqueCommits: 1, minimumUniqueRepositoryFingerprints: 1 });

    const assessment = summary.assessments[0];
    expect(assessment.identityVersionClass).toBe('unsupported_future');
    expect(assessment.independent).toBe(false);
    expect(assessment.acceptedForReadiness).toBe(false);
    expect(summary.defects.find((item) => item.defectType === 'incompatible_identity_algorithm_version')?.severity).toBe('high');
  });

  it('fails closed for malformed identity algorithm versions without throwing', () => {
    const malformedVersions: unknown[] = [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 'two', null, {}];
    for (const version of malformedVersions) {
      const malformed = record('malformed-run', { commitSha: 'a', fingerprint: 'fp-a', timestamp: '2026-07-18T00:00:00.000Z' });
      (malformed.repositoryState as unknown as { identityAlgorithmVersion: unknown }).identityAlgorithmVersion = version;

      let summary: ReturnType<typeof evaluateQuality> | undefined;
      expect(() => {
        summary = evaluateQuality([malformed], { minimumIndependentRuns: 1, minimumUniqueCommits: 1, minimumUniqueRepositoryFingerprints: 1 });
      }).not.toThrow();
      expect(summary!.assessments[0].identityVersionClass).toBe('malformed');
      expect(summary!.assessments[0].independent).toBe(false);
    }
  });

  it('loads legacy (pre-field) history without crashing and keeps it visible but non-independent', () => {
    const legacy = record('legacy-1', { commitSha: 'a', fingerprint: 'fp-a', timestamp: '2026-07-18T00:00:00.000Z' });
    delete legacy.repositoryState.identityAlgorithmVersion;

    const summary = evaluateQuality([legacy], { minimumIndependentRuns: 1, minimumUniqueCommits: 1, minimumUniqueRepositoryFingerprints: 1 });

    expect(summary.totalHistoricalRuns).toBe(1);
    expect(summary.assessments[0].identityVersionClass).toBe('legacy');
    expect(summary.assessments[0].independent).toBe(false);
    expect(summary.assessments[0].comparable).toBe(true);
  });

  it('does not let incompatible records increase independence', () => {
    const current = record('current-run', { commitSha: 'a', fingerprint: 'fp-a', timestamp: '2026-07-18T00:00:00.000Z' });
    const legacyOne = record('legacy-1', { commitSha: 'b', fingerprint: 'fp-b', timestamp: '2026-07-19T00:00:00.000Z' });
    delete legacyOne.repositoryState.identityAlgorithmVersion;
    const legacyTwo = record('legacy-2', { commitSha: 'c', fingerprint: 'fp-c', timestamp: '2026-07-20T00:00:00.000Z' });
    delete legacyTwo.repositoryState.identityAlgorithmVersion;

    const summary = evaluateQuality([current, legacyOne, legacyTwo], { minimumIndependentRuns: 1, minimumUniqueCommits: 1, minimumUniqueRepositoryFingerprints: 1 });

    expect(summary.independentRuns).toBe(1);
    expect(summary.totalHistoricalRuns).toBe(3);
  });

  it('does not let incompatible records increase repository diversity', () => {
    const current = record('current-run', { commitSha: 'a', fingerprint: 'fp-a', timestamp: '2026-07-18T00:00:00.000Z' });
    const legacyOne = record('legacy-1', { commitSha: 'b', fingerprint: 'fp-b', timestamp: '2026-07-19T00:00:00.000Z' });
    delete legacyOne.repositoryState.identityAlgorithmVersion;
    const legacyTwo = record('legacy-2', { commitSha: 'c', fingerprint: 'fp-c', timestamp: '2026-07-20T00:00:00.000Z' });
    delete legacyTwo.repositoryState.identityAlgorithmVersion;

    const summary = evaluateQuality(
      [current, legacyOne, legacyTwo],
      { minimumUniqueCommits: 3, minimumIndependentRuns: 1, minimumUniqueRepositoryFingerprints: 3 },
    );

    expect(summary.uniqueCommits).toBe(1);
    expect(summary.uniqueRepositoryFingerprints).toBe(1);
  });

  it('does not double-penalise a legacy record already flagged for missing metrics', () => {
    const legacy = record('legacy-1', { commitSha: 'a', fingerprint: 'fp-a', timestamp: '2026-07-18T00:00:00.000Z' });
    delete legacy.repositoryState.identityAlgorithmVersion;
    delete legacy.onlyV1DifferenceCount;
    delete legacy.onlyV2DifferenceCount;

    const summary = evaluateQuality([legacy], { minimumIndependentRuns: 1, minimumUniqueCommits: 1, minimumUniqueRepositoryFingerprints: 1 });

    expect(summary.defects.map((item) => item.defectType)).toContain('legacy_record_missing_metrics');
    const identityDefect = summary.defects.find((item) => item.defectType === 'incompatible_identity_algorithm_version');
    // The legacy identity-algorithm condition is already penalised structurally: the record
    // is excluded from independence and diversity (calculateEvidenceQualityScore's
    // independentComponent/diversityComponent), and separately from completenessComponent via
    // legacy_record_missing_metrics. Marking the new defect 'info' — excluded from the
    // high/critical-only defect penalty — means that same legacy condition is not scored a
    // third time via defectPenalty.
    expect(identityDefect?.severity).toBe('info');
    expect(['high', 'critical']).not.toContain(identityDefect?.severity);
  });

  it('gives unsupported_future and malformed a real (non-info) severity, unlike legacy', () => {
    const future = record('future-run', { commitSha: 'a', fingerprint: 'fp-a', timestamp: '2026-07-18T00:00:00.000Z' });
    future.repositoryState.identityAlgorithmVersion = REPOSITORY_IDENTITY_ALGORITHM_VERSION + 1;
    const malformed = record('malformed-run', { commitSha: 'b', fingerprint: 'fp-b', timestamp: '2026-07-19T00:00:00.000Z' });
    (malformed.repositoryState as unknown as { identityAlgorithmVersion: unknown }).identityAlgorithmVersion = -1;

    const summary = evaluateQuality([future, malformed], { minimumIndependentRuns: 1, minimumUniqueCommits: 1, minimumUniqueRepositoryFingerprints: 1 });

    const identityDefects = summary.defects.filter((item) => item.defectType === 'incompatible_identity_algorithm_version');
    expect(identityDefects).toHaveLength(2);
    expect(identityDefects.every((item) => item.severity === 'high')).toBe(true);
  });
});

function evaluateQuality(records: Phase12ShadowExecutionRecord[], config = {}) {
  const history = { version: 1, records } satisfies Phase12ShadowHistory;
  return evaluatePhase14EvidenceQuality({
    history,
    phase13: phase13(records),
    generatedAt: GENERATED_AT,
    currentIdentityAlgorithmVersion: REPOSITORY_IDENTITY_ALGORITHM_VERSION,
    config,
  });
}

function phase13(records: Phase12ShadowExecutionRecord[]) {
  return evaluatePhase13StatisticalGovernance({
    history: { version: 1, records },
    generatedAt: GENERATED_AT,
    config: {
      minimumComparableRuns: Math.max(1, records.filter((record) => record.v2ExecutionStatus === 'succeeded').length),
      minimumRepositoryIdentities: 1,
      targetParityPercentage: 99,
    },
  });
}

function record(
  runId: string,
  input: { commitSha: string; fingerprint: string; timestamp: string; dirty?: boolean },
): Phase12ShadowExecutionRecord {
  return {
    runId,
    detectorId: 'cron-route-registration',
    repositoryState: {
      commitSha: input.commitSha,
      dirty: input.dirty ?? false,
      worktreeFingerprint: input.fingerprint,
      identity: `${input.commitSha}:${input.dirty ? 'dirty' : 'clean'}:${input.fingerprint}`,
      identityAlgorithmVersion: REPOSITORY_IDENTITY_ALGORITHM_VERSION,
    },
    timestamp: input.timestamp,
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
      minimumSuccessfulRunsForReadiness: 3,
    },
    v1FindingCount: 1,
    v2FindingCount: 1,
    onlyV1DifferenceCount: 0,
    onlyV2DifferenceCount: 0,
    v2FindingsDoubleCounted: false,
  };
}

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'phase14-quality-'));
  tempDirs.push(dir);
  return dir;
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
