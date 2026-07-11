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

function evaluateQuality(records: Phase12ShadowExecutionRecord[], config = {}) {
  const history = { version: 1, records } satisfies Phase12ShadowHistory;
  return evaluatePhase14EvidenceQuality({
    history,
    phase13: phase13(records),
    generatedAt: GENERATED_AT,
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
