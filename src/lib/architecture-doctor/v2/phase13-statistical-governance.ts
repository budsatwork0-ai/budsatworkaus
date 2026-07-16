import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { DetectorMigrationGovernanceDecision, RepositoryStateIdentity } from './migration-governance';
import type { Phase12ShadowExecutionRecord, Phase12ShadowHistory } from './phase12-shadow-runner';

export interface Phase13StatisticalGovernanceConfig {
  detectorId: string;
  rollingWindowSize: number;
  minimumComparableRuns: number;
  minimumRepositoryIdentities: number;
  targetParityPercentage: number;
  maximumDisagreementRate: number;
  maximumFailureRate: number;
  maximumDriftEvents: number;
}

export interface Phase13TrendPoint {
  runId: string;
  timestamp: string;
  repositoryIdentity: string;
  parityScore: number | null;
  rollingParityAverage: number | null;
  disagreementCount: number;
  falsePositiveCount: number;
  falseNegativeCount: number;
  failureCount: number;
  readinessConfidence: number;
}

export interface Phase13DetectorDriftEvent {
  runId: string;
  timestamp: string;
  kind: 'parity_regression' | 'new_unexplained_difference' | 'failure_regression' | 'finding_volume_shift';
  severity: 'low' | 'medium' | 'high';
  summary: string;
}

export interface Phase13StatisticalSummary {
  detectorId: string;
  generatedAt: string;
  totalRuns: number;
  comparableRuns: number;
  successfulShadowRuns: number;
  failedShadowRuns: number;
  parityVerifiedRuns: number;
  parityFailedRuns: number;
  parityPercentage: number;
  detectorDisagreementRate: number;
  falsePositiveCount: number;
  falseNegativeCount: number;
  confidenceTrend: Phase13TrendPoint[];
  rollingParityAverages: Phase13TrendPoint[];
  stabilityScore: number;
  readinessConfidence: number;
  repositoryDiversity: {
    uniqueRepositoryIdentities: number;
    dirtyStatesObserved: number;
    cleanStatesObserved: number;
    repositoryIdentityHistory: Array<{ runId: string; timestamp: string; repositoryState: RepositoryStateIdentity }>;
  };
  successFailureTrend: Array<{ runId: string; timestamp: string; status: 'success' | 'failure' | 'disabled'; failureCount: number }>;
  driftEvents: Phase13DetectorDriftEvent[];
  governanceRecommendation: Phase13GovernanceRecommendation;
  constitutionalGuarantees: {
    v1AuthoritativeForEveryRun: boolean;
    v2NeverAffectedAuthority: boolean;
    noDuplicateFindings: boolean;
    noAutomaticPromotion: true;
    explicitApprovalRequired: true;
  };
}

export interface Phase13GovernanceRecommendation {
  status: 'insufficient_evidence' | 'continue_shadow' | 'statistically_ready_for_review' | 'blocked_by_drift' | 'blocked_by_failures';
  replacementApproved: false;
  summary: string;
  blockers: string[];
  supportingEvidence: string[];
}

export interface Phase13ReadinessJustification {
  readyForGovernanceReview: boolean;
  replacementApproved: false;
  rationale: string;
  blockers: string[];
  evidence: string[];
}

export interface Phase13ArtifactSet {
  statisticalParityReport: string;
  trendHistory: string;
  readinessJustification: string;
  detectorDriftReport: string;
  governanceRecommendation: string;
}

export function defaultPhase13StatisticalGovernanceConfig(detectorId = 'cron-route-registration'): Phase13StatisticalGovernanceConfig {
  return {
    detectorId,
    rollingWindowSize: 3,
    minimumComparableRuns: 5,
    minimumRepositoryIdentities: 2,
    targetParityPercentage: 99,
    maximumDisagreementRate: 0,
    maximumFailureRate: 0,
    maximumDriftEvents: 0,
  };
}

export function evaluatePhase13StatisticalGovernance(input: {
  history: Phase12ShadowHistory;
  generatedAt: string;
  governanceDecision?: DetectorMigrationGovernanceDecision;
  config?: Partial<Phase13StatisticalGovernanceConfig>;
}): Phase13StatisticalSummary {
  const config = { ...defaultPhase13StatisticalGovernanceConfig(), ...input.config };
  const records = input.history.records
    .filter((record) => record.detectorId === config.detectorId)
    .slice()
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.runId.localeCompare(b.runId));
  const comparable = records.filter(isComparableRun);
  const parityVerifiedRuns = comparable.filter((record) => record.parityDecision === 'parity_verified').length;
  const parityFailedRuns = comparable.filter((record) => record.parityDecision !== 'parity_verified').length;
  const successfulShadowRuns = records.filter((record) => record.v2ExecutionStatus === 'succeeded').length;
  const failedShadowRuns = records.filter((record) => record.v2ExecutionStatus === 'failed' || (record.executionFailures ?? []).length > 0).length;
  const falsePositiveCount = sum(records.map(falsePositiveCountForRecord));
  const falseNegativeCount = sum(records.map(falseNegativeCountForRecord));
  const disagreementEvents = comparable.filter((record) =>
    record.parityDecision !== 'parity_verified'
    || (record.unexplainedDifferences ?? []).length > 0
    || falsePositiveCountForRecord(record) > 0
    || falseNegativeCountForRecord(record) > 0
  ).length;
  const confidenceTrend = buildTrend(records, config.rollingWindowSize);
  const driftEvents = detectDetectorDrift(records, confidenceTrend);
  const failureRate = records.length === 0 ? 0 : failedShadowRuns / records.length;
  const parityPercentage = comparable.length === 0 ? 0 : round((parityVerifiedRuns / comparable.length) * 100);
  const detectorDisagreementRate = comparable.length === 0 ? 0 : round(disagreementEvents / comparable.length);
  const stabilityScore = calculateStabilityScore({
    parityPercentage,
    detectorDisagreementRate,
    failureRate,
    driftEventCount: driftEvents.length,
  });
  const repositoryIdentityHistory = records.map((record) => ({
    runId: record.runId,
    timestamp: record.timestamp,
    repositoryState: record.repositoryState,
  }));
  const uniqueRepositoryIdentities = new Set(records.map(repositoryIdentityForRecord)).size;
  const dirtyStatesObserved = new Set(records.filter((record) => record.repositoryState?.dirty === true).map(repositoryIdentityForRecord)).size;
  const cleanStatesObserved = new Set(records.filter((record) => record.repositoryState?.dirty === false).map(repositoryIdentityForRecord)).size;
  const constitutionalGuarantees = {
    v1AuthoritativeForEveryRun: records.every((record) => record.authoritativeSource === 'v1'),
    v2NeverAffectedAuthority: records.every((record) => record.authoritativeSource === 'v1' && record.v2FindingsDoubleCounted === false),
    noDuplicateFindings: records.every((record) => record.v2FindingsDoubleCounted === false),
    noAutomaticPromotion: true as const,
    explicitApprovalRequired: true as const,
  };
  const readinessConfidence = calculateReadinessConfidence({
    comparableRuns: comparable.length,
    minimumComparableRuns: config.minimumComparableRuns,
    parityPercentage,
    targetParityPercentage: config.targetParityPercentage,
    stabilityScore,
    repositoryDiversity: uniqueRepositoryIdentities,
    minimumRepositoryIdentities: config.minimumRepositoryIdentities,
    failureRate,
    maximumFailureRate: config.maximumFailureRate,
    driftEventCount: driftEvents.length,
  });
  const successFailureTrend = records.map((record) => ({
    runId: record.runId,
    timestamp: record.timestamp,
    status: record.v2ExecutionStatus === 'disabled'
      ? 'disabled' as const
      : (record.executionFailures ?? []).length > 0 || record.v2ExecutionStatus === 'failed'
        ? 'failure' as const
        : 'success' as const,
    failureCount: (record.executionFailures ?? []).length,
  }));
  const governanceRecommendation = recommendGovernance({
    comparableRuns: comparable.length,
    uniqueRepositoryIdentities,
    parityPercentage,
    detectorDisagreementRate,
    failureRate,
    driftEvents,
    readinessConfidence,
    constitutionalGuarantees,
    config,
    governanceDecision: input.governanceDecision,
  });

  return {
    detectorId: config.detectorId,
    generatedAt: input.generatedAt,
    totalRuns: records.length,
    comparableRuns: comparable.length,
    successfulShadowRuns,
    failedShadowRuns,
    parityVerifiedRuns,
    parityFailedRuns,
    parityPercentage,
    detectorDisagreementRate,
    falsePositiveCount,
    falseNegativeCount,
    confidenceTrend,
    rollingParityAverages: confidenceTrend,
    stabilityScore,
    readinessConfidence,
    repositoryDiversity: {
      uniqueRepositoryIdentities,
      dirtyStatesObserved,
      cleanStatesObserved,
      repositoryIdentityHistory,
    },
    successFailureTrend,
    driftEvents,
    governanceRecommendation,
    constitutionalGuarantees,
  };
}

export function buildPhase13ReadinessJustification(summary: Phase13StatisticalSummary): Phase13ReadinessJustification {
  return {
    readyForGovernanceReview: summary.governanceRecommendation.status === 'statistically_ready_for_review',
    replacementApproved: false,
    rationale: summary.governanceRecommendation.summary,
    blockers: summary.governanceRecommendation.blockers,
    evidence: summary.governanceRecommendation.supportingEvidence,
  };
}

export async function writePhase13StatisticalGovernanceArtifacts(input: {
  outputDir: string;
  summary: Phase13StatisticalSummary;
}): Promise<Phase13ArtifactSet> {
  const statisticalParityReport = path.join(input.outputDir, 'architecture-doctor-phase13-cron-route-statistical-parity-report.md');
  const trendHistory = path.join(input.outputDir, 'architecture-doctor-phase13-cron-route-trend-history.json');
  const readinessJustification = path.join(input.outputDir, 'architecture-doctor-phase13-cron-route-readiness-justification.json');
  const detectorDriftReport = path.join(input.outputDir, 'architecture-doctor-phase13-cron-route-detector-drift-report.json');
  const governanceRecommendation = path.join(input.outputDir, 'architecture-doctor-phase13-cron-route-governance-recommendation.json');

  await writeFile(statisticalParityReport, renderPhase13StatisticalParityReport(input.summary), 'utf8');
  await writeFile(trendHistory, `${JSON.stringify({ version: 1, detectorId: input.summary.detectorId, points: input.summary.confidenceTrend }, null, 2)}\n`, 'utf8');
  await writeFile(readinessJustification, `${JSON.stringify(buildPhase13ReadinessJustification(input.summary), null, 2)}\n`, 'utf8');
  await writeFile(detectorDriftReport, `${JSON.stringify({ version: 1, detectorId: input.summary.detectorId, driftEvents: input.summary.driftEvents }, null, 2)}\n`, 'utf8');
  await writeFile(governanceRecommendation, `${JSON.stringify(input.summary.governanceRecommendation, null, 2)}\n`, 'utf8');

  return {
    statisticalParityReport,
    trendHistory,
    readinessJustification,
    detectorDriftReport,
    governanceRecommendation,
  };
}

export function renderPhase13StatisticalParityReport(summary: Phase13StatisticalSummary): string {
  return [
    '# Architecture Doctor Phase 13 Statistical Parity Report',
    '',
    `Generated: ${summary.generatedAt}`,
    `Detector: ${summary.detectorId}`,
    '',
    '## Authority',
    '',
    '- v1 decides.',
    '- v2 learns.',
    '- v1 health score remains authoritative.',
    '- v2 is shadow-only and excluded from health, enforcement, findings, reports, and CI decisions.',
    '- No automatic promotion has occurred.',
    '- Replacement requires explicit governance approval.',
    '',
    '## Statistical Summary',
    '',
    `- Total runs: ${summary.totalRuns}`,
    `- Comparable shadow runs: ${summary.comparableRuns}`,
    `- Parity percentage: ${summary.parityPercentage}%`,
    `- Detector disagreement rate: ${summary.detectorDisagreementRate}`,
    `- False positives: ${summary.falsePositiveCount}`,
    `- False negatives: ${summary.falseNegativeCount}`,
    `- Stability score: ${summary.stabilityScore}`,
    `- Readiness confidence: ${summary.readinessConfidence}`,
    `- Repository identities: ${summary.repositoryDiversity.uniqueRepositoryIdentities}`,
    `- Drift events: ${summary.driftEvents.length}`,
    '',
    '## Governance Recommendation',
    '',
    `- Status: ${summary.governanceRecommendation.status}`,
    `- Replacement approved: ${summary.governanceRecommendation.replacementApproved}`,
    `- Summary: ${summary.governanceRecommendation.summary}`,
    '',
    '## Blockers',
    '',
    ...(summary.governanceRecommendation.blockers.length > 0
      ? summary.governanceRecommendation.blockers.map((blocker) => `- ${blocker}`)
      : ['- No statistical blockers found; explicit governance approval is still required.']),
    '',
    '## Trend Data',
    '',
    '| Run | Repository | Parity | Rolling parity | Failures | Confidence |',
    '| --- | --- | ---: | ---: | ---: | ---: |',
    ...summary.confidenceTrend.map((point) =>
      `| ${point.runId} | ${point.repositoryIdentity} | ${formatNullable(point.parityScore)} | ${formatNullable(point.rollingParityAverage)} | ${point.failureCount} | ${point.readinessConfidence} |`
    ),
    '',
  ].join('\n');
}

function buildTrend(records: Phase12ShadowExecutionRecord[], windowSize: number): Phase13TrendPoint[] {
  const comparableScores: number[] = [];
  return records.map((record) => {
    const parityScore = parityScoreForRecord(record);
    if (parityScore !== null) comparableScores.push(parityScore);
    const rollingWindow = comparableScores.slice(Math.max(0, comparableScores.length - windowSize));
    const rollingParityAverage = rollingWindow.length === 0 ? null : round(sum(rollingWindow) / rollingWindow.length);
    const disagreementCount = (record.unexplainedDifferences ?? []).length + falsePositiveCountForRecord(record) + falseNegativeCountForRecord(record);
    const failureCount = (record.executionFailures ?? []).length + (record.v2ExecutionStatus === 'failed' ? 1 : 0);
    const readinessConfidence = calculatePointConfidence({ parityScore, rollingParityAverage, disagreementCount, failureCount });
    return {
      runId: record.runId,
      timestamp: record.timestamp,
      repositoryIdentity: repositoryIdentityForRecord(record),
      parityScore,
      rollingParityAverage,
      disagreementCount,
      falsePositiveCount: falsePositiveCountForRecord(record),
      falseNegativeCount: falseNegativeCountForRecord(record),
      failureCount,
      readinessConfidence,
    };
  });
}

function detectDetectorDrift(records: Phase12ShadowExecutionRecord[], trend: Phase13TrendPoint[]): Phase13DetectorDriftEvent[] {
  const events: Phase13DetectorDriftEvent[] = [];
  for (let index = 1; index < trend.length; index += 1) {
    const previous = trend[index - 1];
    const current = trend[index];
    const currentRecord = records.find((record) => record.runId === current.runId);
    if (!currentRecord) continue;
    if (previous.parityScore === 1 && current.parityScore === 0) {
      events.push({
        runId: current.runId,
        timestamp: current.timestamp,
        kind: 'parity_regression',
        severity: 'high',
        summary: 'Parity regressed after a previously verified comparable run.',
      });
    }
    if (current.disagreementCount > previous.disagreementCount && current.disagreementCount > 0) {
      events.push({
        runId: current.runId,
        timestamp: current.timestamp,
        kind: 'new_unexplained_difference',
        severity: 'high',
        summary: 'Unexplained detector disagreement increased.',
      });
    }
    if (previous.failureCount === 0 && current.failureCount > 0) {
      events.push({
        runId: current.runId,
        timestamp: current.timestamp,
        kind: 'failure_regression',
        severity: 'medium',
        summary: 'A shadow execution failure appeared after a clean run.',
      });
    }
    const previousRecord = records.find((record) => record.runId === previous.runId);
    if (previousRecord && Math.abs(currentRecord.v2FindingCount - previousRecord.v2FindingCount) > Math.max(2, previousRecord.v2FindingCount)) {
      events.push({
        runId: current.runId,
        timestamp: current.timestamp,
        kind: 'finding_volume_shift',
        severity: 'medium',
        summary: 'v2 finding volume shifted sharply relative to the prior run.',
      });
    }
  }
  return events;
}

function recommendGovernance(input: {
  comparableRuns: number;
  uniqueRepositoryIdentities: number;
  parityPercentage: number;
  detectorDisagreementRate: number;
  failureRate: number;
  driftEvents: Phase13DetectorDriftEvent[];
  readinessConfidence: number;
  constitutionalGuarantees: Phase13StatisticalSummary['constitutionalGuarantees'];
  config: Phase13StatisticalGovernanceConfig;
  governanceDecision?: DetectorMigrationGovernanceDecision;
}): Phase13GovernanceRecommendation {
  const blockers: string[] = [];
  const supportingEvidence: string[] = [];
  if (input.comparableRuns < input.config.minimumComparableRuns) {
    blockers.push(`Only ${input.comparableRuns} comparable run(s); ${input.config.minimumComparableRuns} required for statistical governance.`);
  } else {
    supportingEvidence.push(`${input.comparableRuns} comparable run(s) are available.`);
  }
  if (input.uniqueRepositoryIdentities < input.config.minimumRepositoryIdentities) {
    blockers.push(`Only ${input.uniqueRepositoryIdentities} repository state(s); ${input.config.minimumRepositoryIdentities} required.`);
  } else {
    supportingEvidence.push(`${input.uniqueRepositoryIdentities} repository state(s) are represented.`);
  }
  if (input.parityPercentage < input.config.targetParityPercentage) {
    blockers.push(`Parity percentage ${input.parityPercentage}% is below target ${input.config.targetParityPercentage}%.`);
  } else {
    supportingEvidence.push(`Parity percentage ${input.parityPercentage}% meets target.`);
  }
  if (input.detectorDisagreementRate > input.config.maximumDisagreementRate) {
    blockers.push(`Detector disagreement rate ${input.detectorDisagreementRate} exceeds maximum ${input.config.maximumDisagreementRate}.`);
  }
  if (input.failureRate > input.config.maximumFailureRate) {
    blockers.push(`Failure rate ${round(input.failureRate)} exceeds maximum ${input.config.maximumFailureRate}.`);
  }
  if (input.driftEvents.length > input.config.maximumDriftEvents) {
    blockers.push(`${input.driftEvents.length} detector drift event(s) exceed maximum ${input.config.maximumDriftEvents}.`);
  }
  if (!input.constitutionalGuarantees.v1AuthoritativeForEveryRun || !input.constitutionalGuarantees.noDuplicateFindings) {
    blockers.push('Constitutional authority guarantees were not preserved for every run.');
  }
  if (input.governanceDecision?.decision === 'approved_for_replacement') {
    blockers.push('Phase 13 records statistical readiness only; replacement approval must be handled by an explicit later governance phase.');
  }

  let status: Phase13GovernanceRecommendation['status'] = 'continue_shadow';
  if (input.comparableRuns === 0) status = 'insufficient_evidence';
  else if (input.failureRate > input.config.maximumFailureRate) status = 'blocked_by_failures';
  else if (input.driftEvents.length > input.config.maximumDriftEvents) status = 'blocked_by_drift';
  else if (blockers.length === 0 && input.readinessConfidence >= 0.95) status = 'statistically_ready_for_review';

  return {
    status,
    replacementApproved: false,
    summary: status === 'statistically_ready_for_review'
      ? 'Statistical evidence supports governance review, but does not approve replacement.'
      : 'Continue shadow execution until statistical evidence is sustained and blockers are resolved.',
    blockers,
    supportingEvidence,
  };
}

function isComparableRun(record: Phase12ShadowExecutionRecord): boolean {
  return record.v2ExecutionStatus === 'succeeded'
    && (record.parityDecision === 'parity_verified' || record.parityDecision === 'parity_failed' || record.parityDecision === 'comparison_failed');
}

function parityScoreForRecord(record: Phase12ShadowExecutionRecord): number | null {
  if (!isComparableRun(record)) return null;
  return record.parityDecision === 'parity_verified' ? 1 : 0;
}

function falsePositiveCountForRecord(record: Phase12ShadowExecutionRecord): number {
  return record.onlyV2DifferenceCount ?? (record.unexplainedDifferences ?? []).filter((difference) =>
    difference.reason.toLowerCase().includes('v2') && difference.reason.toLowerCase().includes('not in v1')
  ).length;
}

function falseNegativeCountForRecord(record: Phase12ShadowExecutionRecord): number {
  return record.onlyV1DifferenceCount ?? (record.unexplainedDifferences ?? []).filter((difference) =>
    difference.reason.toLowerCase().includes('v1') && difference.reason.toLowerCase().includes('not in v2')
  ).length;
}

function repositoryIdentityForRecord(record: Phase12ShadowExecutionRecord): string {
  return record.repositoryState?.identity
    ?? (record.repositoryState?.dirty
      ? `${record.repositoryState.commitSha}:dirty:${record.repositoryState.worktreeFingerprint ?? 'unknown'}`
      : `${record.repositoryState?.commitSha ?? 'unknown'}:clean`);
}

function calculateStabilityScore(input: {
  parityPercentage: number;
  detectorDisagreementRate: number;
  failureRate: number;
  driftEventCount: number;
}): number {
  const parityComponent = input.parityPercentage / 100;
  const disagreementPenalty = Math.min(1, input.detectorDisagreementRate);
  const failurePenalty = Math.min(1, input.failureRate);
  const driftPenalty = Math.min(1, input.driftEventCount * 0.2);
  return round(Math.max(0, parityComponent - disagreementPenalty * 0.35 - failurePenalty * 0.25 - driftPenalty));
}

function calculateReadinessConfidence(input: {
  comparableRuns: number;
  minimumComparableRuns: number;
  parityPercentage: number;
  targetParityPercentage: number;
  stabilityScore: number;
  repositoryDiversity: number;
  minimumRepositoryIdentities: number;
  failureRate: number;
  maximumFailureRate: number;
  driftEventCount: number;
}): number {
  const evidenceComponent = Math.min(1, input.comparableRuns / input.minimumComparableRuns);
  const parityComponent = Math.min(1, input.parityPercentage / input.targetParityPercentage);
  const diversityComponent = Math.min(1, input.repositoryDiversity / input.minimumRepositoryIdentities);
  const failureComponent = input.failureRate <= input.maximumFailureRate ? 1 : Math.max(0, 1 - input.failureRate);
  const driftComponent = input.driftEventCount === 0 ? 1 : Math.max(0, 1 - input.driftEventCount * 0.2);
  return round((evidenceComponent * 0.25) + (parityComponent * 0.25) + (input.stabilityScore * 0.2) + (diversityComponent * 0.15) + (failureComponent * 0.1) + (driftComponent * 0.05));
}

function calculatePointConfidence(input: {
  parityScore: number | null;
  rollingParityAverage: number | null;
  disagreementCount: number;
  failureCount: number;
}): number {
  if (input.parityScore === null) return 0;
  const base = input.rollingParityAverage ?? input.parityScore;
  const disagreementPenalty = Math.min(0.4, input.disagreementCount * 0.1);
  const failurePenalty = Math.min(0.4, input.failureCount * 0.2);
  return round(Math.max(0, base - disagreementPenalty - failurePenalty));
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function formatNullable(value: number | null): string {
  return value === null ? 'n/a' : String(value);
}
