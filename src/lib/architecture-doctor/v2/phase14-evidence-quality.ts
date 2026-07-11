import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Phase13StatisticalSummary } from './phase13-statistical-governance';
import type { Phase12ShadowExecutionRecord, Phase12ShadowHistory } from './phase12-shadow-runner';

export interface Phase14EvidenceQualityConfig {
  detectorId: string;
  minimumIndependentRuns: number;
  minimumUniqueCommits: number;
  minimumUniqueRepositoryFingerprints: number;
  minimumObservationPeriodHours: number;
  maximumEvidenceAgeDays: number;
  requiredExecutionMode: 'shadow_advisory';
}

export type Phase14EvidenceDefectType =
  | 'duplicate_repository_state'
  | 'insufficient_repository_diversity'
  | 'insufficient_independent_runs'
  | 'configuration_mismatch'
  | 'legacy_record_missing_metrics'
  | 'malformed_history_record'
  | 'stale_evidence'
  | 'insufficient_observation_period'
  | 'incomplete_detector_execution'
  | 'repository_identity_fallback_used';

export interface Phase14EvidenceDefect {
  defectType: Phase14EvidenceDefectType;
  affectedRecordIds: string[];
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  explanation: string;
  readinessImpact: string;
  remediationRecommendation: string;
}

export interface Phase14EvidenceRecordAssessment {
  runId: string;
  timestamp?: string;
  comparable: boolean;
  independent: boolean;
  duplicateState: boolean;
  acceptedForReadiness: boolean;
  repositoryIdentity?: string;
  commitSha?: string;
  repositoryFingerprint?: string;
  cleanDirtyState: 'clean' | 'dirty' | 'unknown';
  configurationSignature?: string;
  metricsCompleteness: 'complete' | 'legacy_unknown_difference_counts' | 'malformed';
  rejectionReasons: string[];
  defects: Phase14EvidenceDefectType[];
}

export interface Phase14EvidenceIndependenceAssessment {
  totalRuns: number;
  comparableRuns: number;
  independentRuns: number;
  duplicateStateRuns: number;
  uniqueCommits: number;
  uniqueRepositoryFingerprints: number;
  cleanStateCount: number;
  dirtyStateCount: number;
  unknownStateCount: number;
  observationPeriodHours: number;
  oldestComparableEvidence?: string;
  newestComparableEvidence?: string;
  repositoryIdentityHistory: Array<{
    runId: string;
    repositoryIdentity?: string;
    commitSha?: string;
    repositoryFingerprint?: string;
    independent: boolean;
  }>;
}

export interface Phase14ReadinessDecision {
  status: 'continue_shadow' | 'needs_review';
  replacementApproved: false;
  readyForReplacement: false;
  readinessScore: number;
  blockers: string[];
  supportingEvidence: string[];
}

export interface Phase14GovernanceRecommendation {
  status: 'continue_shadow' | 'needs_review';
  replacementApproved: false;
  summary: string;
  blockers: string[];
  supportingEvidence: string[];
}

export interface Phase14EvidenceQualitySummary {
  detectorId: string;
  generatedAt: string;
  config: Phase14EvidenceQualityConfig;
  totalHistoricalRuns: number;
  comparableRuns: number;
  independentRuns: number;
  duplicateStateRuns: number;
  rejectedRecords: number;
  unknownOrMissingMetrics: number;
  uniqueCommits: number;
  uniqueRepositoryFingerprints: number;
  cleanStateCount: number;
  dirtyStateCount: number;
  unknownStateCount: number;
  evidenceQualityScore: number;
  assessments: Phase14EvidenceRecordAssessment[];
  independence: Phase14EvidenceIndependenceAssessment;
  defects: Phase14EvidenceDefect[];
  readinessDecision: Phase14ReadinessDecision;
  governanceRecommendation: Phase14GovernanceRecommendation;
  constitutionalGuarantees: {
    v1Authoritative: boolean;
    v2ShadowOnly: boolean;
    noDuplicateFindings: boolean;
    noAutomaticPromotion: true;
    replacementRequiresExplicitApproval: true;
  };
}

export interface Phase14ArtifactSet {
  evidenceQualityReport: string;
  evidenceAssessments: string;
  evidenceDefects: string;
  independenceSummary: string;
  readinessDecision: string;
  governanceRecommendation: string;
}

export function defaultPhase14EvidenceQualityConfig(detectorId = 'cron-route-registration'): Phase14EvidenceQualityConfig {
  return {
    detectorId,
    minimumIndependentRuns: 5,
    minimumUniqueCommits: 2,
    minimumUniqueRepositoryFingerprints: 3,
    minimumObservationPeriodHours: 24,
    maximumEvidenceAgeDays: 30,
    requiredExecutionMode: 'shadow_advisory',
  };
}

export function evaluatePhase14EvidenceQuality(input: {
  history: Phase12ShadowHistory | unknown;
  phase13: Phase13StatisticalSummary;
  generatedAt: string;
  config?: Partial<Phase14EvidenceQualityConfig>;
}): Phase14EvidenceQualitySummary {
  const config = { ...defaultPhase14EvidenceQualityConfig(input.phase13.detectorId), ...input.config };
  const rawRecords = Array.isArray((input.history as Phase12ShadowHistory | undefined)?.records)
    ? (input.history as Phase12ShadowHistory).records
    : [];
  const records = rawRecords
    .filter((record) => record?.detectorId === config.detectorId)
    .slice()
    .sort((a, b) => String(a.timestamp ?? '').localeCompare(String(b.timestamp ?? '')) || String(a.runId ?? '').localeCompare(String(b.runId ?? '')));
  const malformedHistory = !input.history || typeof input.history !== 'object' || !Array.isArray((input.history as Phase12ShadowHistory).records);
  const defects: Phase14EvidenceDefect[] = malformedHistory
    ? [defect('malformed_history_record', [], 'critical', 'History is missing or does not contain a records array.', 'Evidence quality cannot establish readiness.', 'Regenerate Phase 12 shadow history from controlled shadow executions.')]
    : [];
  const seenState = new Set<string>();
  const configSignatures = new Map<string, string[]>();
  const assessments = records.map((record) => assessRecord(record, config, seenState, configSignatures, defects));
  defects.push(...globalDefects(records, assessments, config, input.generatedAt));
  const comparable = assessments.filter((assessment) => assessment.comparable);
  const independent = assessments.filter((assessment) => assessment.independent);
  const uniqueCommits = new Set(comparable.map((assessment) => assessment.commitSha).filter(Boolean)).size;
  const uniqueRepositoryFingerprints = new Set(comparable.map((assessment) => assessment.repositoryFingerprint).filter(Boolean)).size;
  const cleanStateCount = comparable.filter((assessment) => assessment.cleanDirtyState === 'clean').length;
  const dirtyStateCount = comparable.filter((assessment) => assessment.cleanDirtyState === 'dirty').length;
  const unknownStateCount = comparable.filter((assessment) => assessment.cleanDirtyState === 'unknown').length;
  const comparableTimes = comparable.map((assessment) => Date.parse(assessment.timestamp ?? '')).filter(Number.isFinite).sort((a, b) => a - b);
  const observationPeriodHours = comparableTimes.length >= 2 ? round((comparableTimes[comparableTimes.length - 1] - comparableTimes[0]) / 36e5) : 0;
  const evidenceQualityScore = calculateEvidenceQualityScore({
    assessments,
    defects,
    independentRuns: independent.length,
    minimumIndependentRuns: config.minimumIndependentRuns,
    uniqueRepositoryFingerprints,
    minimumUniqueRepositoryFingerprints: config.minimumUniqueRepositoryFingerprints,
    observationPeriodHours,
    minimumObservationPeriodHours: config.minimumObservationPeriodHours,
  });
  const independence: Phase14EvidenceIndependenceAssessment = {
    totalRuns: assessments.length,
    comparableRuns: comparable.length,
    independentRuns: independent.length,
    duplicateStateRuns: assessments.filter((assessment) => assessment.duplicateState).length,
    uniqueCommits,
    uniqueRepositoryFingerprints,
    cleanStateCount,
    dirtyStateCount,
    unknownStateCount,
    observationPeriodHours,
    oldestComparableEvidence: comparableTimes[0] ? new Date(comparableTimes[0]).toISOString() : undefined,
    newestComparableEvidence: comparableTimes.length > 0 ? new Date(comparableTimes[comparableTimes.length - 1]).toISOString() : undefined,
    repositoryIdentityHistory: assessments.map((assessment) => ({
      runId: assessment.runId,
      repositoryIdentity: assessment.repositoryIdentity,
      commitSha: assessment.commitSha,
      repositoryFingerprint: assessment.repositoryFingerprint,
      independent: assessment.independent,
    })),
  };
  const readinessDecision = decideReadiness({
    phase13: input.phase13,
    defects,
    evidenceQualityScore,
    independence,
    config,
  });

  return {
    detectorId: config.detectorId,
    generatedAt: input.generatedAt,
    config,
    totalHistoricalRuns: assessments.length,
    comparableRuns: comparable.length,
    independentRuns: independent.length,
    duplicateStateRuns: independence.duplicateStateRuns,
    rejectedRecords: assessments.filter((assessment) => !assessment.acceptedForReadiness).length,
    unknownOrMissingMetrics: assessments.filter((assessment) => assessment.metricsCompleteness !== 'complete').length,
    uniqueCommits,
    uniqueRepositoryFingerprints,
    cleanStateCount,
    dirtyStateCount,
    unknownStateCount,
    evidenceQualityScore,
    assessments,
    independence,
    defects,
    readinessDecision,
    governanceRecommendation: {
      status: readinessDecision.status,
      replacementApproved: false,
      summary: readinessDecision.status === 'needs_review'
        ? 'Evidence quality is strong enough for human review, but replacement is not approved.'
        : 'Continue shadow execution until evidence is complete, independent, fresh, and diverse.',
      blockers: readinessDecision.blockers,
      supportingEvidence: readinessDecision.supportingEvidence,
    },
    constitutionalGuarantees: {
      v1Authoritative: records.every((record) => record.authoritativeSource === 'v1'),
      v2ShadowOnly: records.every((record) => record.authoritativeSource === 'v1'),
      noDuplicateFindings: records.every((record) => record.v2FindingsDoubleCounted === false),
      noAutomaticPromotion: true,
      replacementRequiresExplicitApproval: true,
    },
  };
}

export async function writePhase14EvidenceQualityArtifacts(input: {
  outputDir: string;
  summary: Phase14EvidenceQualitySummary;
}): Promise<Phase14ArtifactSet> {
  const evidenceQualityReport = path.join(input.outputDir, 'architecture-doctor-phase14-cron-route-evidence-quality-report.md');
  const evidenceAssessments = path.join(input.outputDir, 'architecture-doctor-phase14-cron-route-evidence-assessments.json');
  const evidenceDefects = path.join(input.outputDir, 'architecture-doctor-phase14-cron-route-evidence-defects.json');
  const independenceSummary = path.join(input.outputDir, 'architecture-doctor-phase14-cron-route-independence-summary.json');
  const readinessDecision = path.join(input.outputDir, 'architecture-doctor-phase14-cron-route-readiness-decision.json');
  const governanceRecommendation = path.join(input.outputDir, 'architecture-doctor-phase14-cron-route-governance-recommendation.json');

  await writeFile(evidenceQualityReport, renderPhase14EvidenceQualityReport(input.summary), 'utf8');
  await writeFile(evidenceAssessments, `${JSON.stringify({ version: 1, assessments: input.summary.assessments }, null, 2)}\n`, 'utf8');
  await writeFile(evidenceDefects, `${JSON.stringify({ version: 1, defects: input.summary.defects }, null, 2)}\n`, 'utf8');
  await writeFile(independenceSummary, `${JSON.stringify({ version: 1, independence: input.summary.independence }, null, 2)}\n`, 'utf8');
  await writeFile(readinessDecision, `${JSON.stringify(input.summary.readinessDecision, null, 2)}\n`, 'utf8');
  await writeFile(governanceRecommendation, `${JSON.stringify(input.summary.governanceRecommendation, null, 2)}\n`, 'utf8');

  return {
    evidenceQualityReport,
    evidenceAssessments,
    evidenceDefects,
    independenceSummary,
    readinessDecision,
    governanceRecommendation,
  };
}

export function renderPhase14EvidenceQualityReport(summary: Phase14EvidenceQualitySummary): string {
  return [
    '# Architecture Doctor Phase 14 Evidence Quality Report',
    '',
    `Generated: ${summary.generatedAt}`,
    `Detector: ${summary.detectorId}`,
    '',
    '## Authority',
    '',
    '- v1 decides.',
    '- v2 learns.',
    '- v1 remains the only authoritative detector.',
    '- Phase 12, Phase 13, and Phase 14 outputs are advisory only.',
    '- v2 evidence does not affect authoritative findings, health score, enforcement, reports, CI outcomes, process exit codes, or production behaviour.',
    '- No automatic promotion or replacement occurred.',
    '',
    '## Evidence Summary',
    '',
    `- Total historical runs: ${summary.totalHistoricalRuns}`,
    `- Comparable runs: ${summary.comparableRuns}`,
    `- Independent runs: ${summary.independentRuns}`,
    `- Duplicate-state runs: ${summary.duplicateStateRuns}`,
    `- Unique commits: ${summary.uniqueCommits}`,
    `- Unique fingerprints: ${summary.uniqueRepositoryFingerprints}`,
    `- Clean states: ${summary.cleanStateCount}`,
    `- Dirty states: ${summary.dirtyStateCount}`,
    `- Unknown states: ${summary.unknownStateCount}`,
    `- Unknown or missing metrics: ${summary.unknownOrMissingMetrics}`,
    `- Rejected records: ${summary.rejectedRecords}`,
    `- Evidence defects: ${summary.defects.length}`,
    `- Evidence quality score: ${summary.evidenceQualityScore}`,
    '',
    '## Readiness',
    '',
    `- Status: ${summary.readinessDecision.status}`,
    `- Replacement approved: ${summary.readinessDecision.replacementApproved}`,
    `- Ready for replacement: ${summary.readinessDecision.readyForReplacement}`,
    '',
    '## Blockers',
    '',
    ...(summary.readinessDecision.blockers.length > 0
      ? summary.readinessDecision.blockers.map((blocker) => `- ${blocker}`)
      : ['- No evidence-quality blockers found; explicit governance approval is still required.']),
    '',
    '## Defects',
    '',
    ...(summary.defects.length > 0
      ? summary.defects.map((item) => `- ${item.defectType}: ${item.explanation} Impact: ${item.readinessImpact}`)
      : ['- No defects detected.']),
    '',
    '## Why Replacement Is Not Yet Justified',
    '',
    '- Phase 14 is evidence governance only and cannot approve replacement.',
    '- Replacement requires a later explicit governance decision outside this advisory layer.',
    '',
  ].join('\n');
}

function assessRecord(
  record: Phase12ShadowExecutionRecord,
  config: Phase14EvidenceQualityConfig,
  seenState: Set<string>,
  configSignatures: Map<string, string[]>,
  defects: Phase14EvidenceDefect[],
): Phase14EvidenceRecordAssessment {
  const rejectionReasons: string[] = [];
  const recordDefects: Phase14EvidenceDefectType[] = [];
  const malformed = !record.runId || !record.timestamp || !record.repositoryState || !record.configurationSnapshot;
  const comparable = record.v2ExecutionStatus === 'succeeded'
    && (record.parityDecision === 'parity_verified' || record.parityDecision === 'parity_failed')
    && !malformed;
  const repositoryFingerprint = repositoryFingerprintForRecord(record);
  const stateKey = repositoryFingerprint ?? record.repositoryState?.identity ?? record.repositoryState?.commitSha ?? record.runId;
  const duplicateState = comparable && seenState.has(stateKey);
  if (comparable) seenState.add(stateKey);
  const signature = configurationSignature(record);
  if (signature && record.runId) {
    const signatureRecords = configSignatures.get(signature) ?? [];
    signatureRecords.push(record.runId);
    configSignatures.set(signature, signatureRecords);
  }
  const metricsCompleteness = malformed
    ? 'malformed'
    : record.onlyV1DifferenceCount === undefined || record.onlyV2DifferenceCount === undefined
      ? 'legacy_unknown_difference_counts'
      : 'complete';
  if (malformed) {
    recordDefects.push('malformed_history_record');
    rejectionReasons.push('record is missing required Phase 12 history fields');
    defects.push(defect('malformed_history_record', [record.runId ?? '<unknown>'], 'critical', 'History record is malformed or incomplete.', 'Record is rejected for readiness.', 'Regenerate the shadow run record with Phase 12 or later tooling.'));
  }
  if (!comparable) {
    recordDefects.push('incomplete_detector_execution');
    rejectionReasons.push('v2 shadow execution did not complete with a comparable parity decision');
    defects.push(defect('incomplete_detector_execution', [record.runId ?? '<unknown>'], 'high', 'Record did not complete comparable v1/v2 shadow execution.', 'Record cannot count as independent readiness evidence.', 'Run shadow advisory execution again after fixing the execution failure.'));
  }
  if (duplicateState) {
    recordDefects.push('duplicate_repository_state');
    rejectionReasons.push('repository fingerprint was already observed');
    defects.push(defect('duplicate_repository_state', [record.runId], 'medium', 'Run repeats an unchanged repository fingerprint.', 'Duplicate-state runs are tracked but do not count as independent evidence.', 'Collect evidence after a meaningfully different repository state.'));
  }
  if (record.configurationSnapshot?.executionMode !== config.requiredExecutionMode && comparable) {
    recordDefects.push('configuration_mismatch');
    rejectionReasons.push(`execution mode ${record.configurationSnapshot?.executionMode ?? 'unknown'} is not ${config.requiredExecutionMode}`);
    defects.push(defect('configuration_mismatch', [record.runId], 'high', 'Record uses an incompatible shadow execution configuration.', 'Record is not merged into readiness evidence.', 'Use a consistent shadow advisory configuration for comparable evidence.'));
  }
  if (metricsCompleteness === 'legacy_unknown_difference_counts') {
    recordDefects.push('legacy_record_missing_metrics');
    rejectionReasons.push('legacy record is missing explicit only-v1/only-v2 difference counts');
    defects.push(defect('legacy_record_missing_metrics', [record.runId], 'medium', 'Legacy record lacks explicit difference-count metrics.', 'Missing metrics are unknown and cannot increase readiness confidence.', 'Regenerate evidence with Phase 14-capable shadow records.'));
  }
  if (record.repositoryState?.fallbackIdentity) {
    recordDefects.push('repository_identity_fallback_used');
    rejectionReasons.push('repository identity used fallback metadata');
    defects.push(defect('repository_identity_fallback_used', [record.runId], 'medium', 'Git repository identity was unavailable and fallback identity was used.', 'Fallback identities are not strong independence evidence.', 'Run evidence collection in a Git checkout with commit and status metadata.'));
  }
  const independent = comparable
    && !duplicateState
    && metricsCompleteness === 'complete'
    && record.configurationSnapshot?.executionMode === config.requiredExecutionMode
    && !record.repositoryState?.fallbackIdentity;
  return {
    runId: record.runId ?? '<unknown>',
    timestamp: record.timestamp,
    comparable,
    independent,
    duplicateState,
    acceptedForReadiness: independent,
    repositoryIdentity: record.repositoryState?.identity,
    commitSha: record.repositoryState?.commitSha,
    repositoryFingerprint,
    cleanDirtyState: record.repositoryState?.dirty === true ? 'dirty' : record.repositoryState?.dirty === false ? 'clean' : 'unknown',
    configurationSignature: signature,
    metricsCompleteness,
    rejectionReasons,
    defects: recordDefects,
  };
}

function globalDefects(
  records: Phase12ShadowExecutionRecord[],
  assessments: Phase14EvidenceRecordAssessment[],
  config: Phase14EvidenceQualityConfig,
  generatedAt: string,
): Phase14EvidenceDefect[] {
  const defects: Phase14EvidenceDefect[] = [];
  const comparable = assessments.filter((assessment) => assessment.comparable);
  const independent = assessments.filter((assessment) => assessment.independent);
  const uniqueCommits = new Set(comparable.map((assessment) => assessment.commitSha).filter(Boolean)).size;
  const uniqueFingerprints = new Set(comparable.map((assessment) => assessment.repositoryFingerprint).filter(Boolean)).size;
  const signatures = new Map<string, string[]>();
  for (const assessment of comparable) {
    if (!assessment.configurationSignature) continue;
    signatures.set(assessment.configurationSignature, [...(signatures.get(assessment.configurationSignature) ?? []), assessment.runId]);
  }
  if (uniqueCommits < config.minimumUniqueCommits) {
    defects.push(defect('insufficient_repository_diversity', comparable.map((item) => item.runId), 'high', `Only ${uniqueCommits} unique commit(s) observed; ${config.minimumUniqueCommits} required.`, 'Repository diversity is insufficient for readiness.', 'Collect shadow evidence across more commits.'));
  }
  if (uniqueFingerprints < config.minimumUniqueRepositoryFingerprints) {
    defects.push(defect('insufficient_repository_diversity', comparable.map((item) => item.runId), 'high', `Only ${uniqueFingerprints} unique repository fingerprint(s) observed; ${config.minimumUniqueRepositoryFingerprints} required.`, 'Repository-state diversity is insufficient for readiness.', 'Collect evidence across distinct clean or dirty repository fingerprints.'));
  }
  if (independent.length < config.minimumIndependentRuns) {
    defects.push(defect('insufficient_independent_runs', independent.map((item) => item.runId), 'high', `Only ${independent.length} independent run(s) observed; ${config.minimumIndependentRuns} required.`, 'Independent evidence threshold is not met.', 'Collect more independent shadow advisory runs.'));
  }
  if (signatures.size > 1) {
    defects.push(defect('configuration_mismatch', Array.from(signatures.values()).flat(), 'high', 'Comparable records use multiple shadow configuration signatures.', 'Incompatible configurations cannot be merged into one readiness conclusion.', 'Segment evidence by configuration or rerun with one stable configuration.'));
  }
  const comparableTimes = comparable.map((assessment) => Date.parse(assessment.timestamp ?? '')).filter(Number.isFinite).sort((a, b) => a - b);
  const observationHours = comparableTimes.length >= 2 ? (comparableTimes[comparableTimes.length - 1] - comparableTimes[0]) / 36e5 : 0;
  if (observationHours < config.minimumObservationPeriodHours) {
    defects.push(defect('insufficient_observation_period', comparable.map((item) => item.runId), 'medium', `Comparable evidence spans ${round(observationHours)} hour(s); ${config.minimumObservationPeriodHours} required.`, 'Immediate repeated runs cannot establish longitudinal stability.', 'Collect evidence over a longer observation period.'));
  }
  const generatedMs = Date.parse(generatedAt);
  const stale = comparable.filter((assessment) => {
    const timestamp = Date.parse(assessment.timestamp ?? '');
    return Number.isFinite(timestamp) && Number.isFinite(generatedMs) && (generatedMs - timestamp) / 864e5 > config.maximumEvidenceAgeDays;
  });
  if (stale.length > 0) {
    defects.push(defect('stale_evidence', stale.map((item) => item.runId), 'medium', `${stale.length} comparable run(s) exceed the maximum evidence age.`, 'Stale evidence cannot establish current readiness.', 'Refresh shadow evidence with current repository state.'));
  }
  return defects;
}

function decideReadiness(input: {
  phase13: Phase13StatisticalSummary;
  defects: Phase14EvidenceDefect[];
  evidenceQualityScore: number;
  independence: Phase14EvidenceIndependenceAssessment;
  config: Phase14EvidenceQualityConfig;
}): Phase14ReadinessDecision {
  const blockers = input.defects
    .filter((item) => item.severity !== 'info' && item.severity !== 'low')
    .map((item) => `${item.defectType}: ${item.explanation}`);
  if (input.phase13.governanceRecommendation.status !== 'statistically_ready_for_review') {
    blockers.push(`Phase 13 recommendation is ${input.phase13.governanceRecommendation.status}.`);
  }
  blockers.push('Replacement requires explicit governance approval in a later phase; Phase 14 cannot approve replacement.');
  const status: Phase14ReadinessDecision['status'] = blockers.length <= 1 && input.evidenceQualityScore >= 0.95 ? 'needs_review' : 'continue_shadow';
  return {
    status,
    replacementApproved: false,
    readyForReplacement: false,
    readinessScore: input.evidenceQualityScore,
    blockers,
    supportingEvidence: [
      `${input.independence.independentRuns} independent run(s).`,
      `${input.independence.uniqueRepositoryFingerprints} unique repository fingerprint(s).`,
      `Phase 13 parity percentage is ${input.phase13.parityPercentage}%.`,
    ],
  };
}

function defect(
  defectType: Phase14EvidenceDefectType,
  affectedRecordIds: string[],
  severity: Phase14EvidenceDefect['severity'],
  explanation: string,
  readinessImpact: string,
  remediationRecommendation: string,
): Phase14EvidenceDefect {
  return { defectType, affectedRecordIds, severity, explanation, readinessImpact, remediationRecommendation };
}

function repositoryFingerprintForRecord(record: Phase12ShadowExecutionRecord): string | undefined {
  if (record.repositoryState?.worktreeFingerprint) return record.repositoryState.worktreeFingerprint;
  if (record.repositoryState?.identity) return record.repositoryState.identity;
  if (record.repositoryState?.commitSha && record.repositoryState.dirty === false) return `${record.repositoryState.commitSha}:clean`;
  return undefined;
}

function configurationSignature(record: Phase12ShadowExecutionRecord): string | undefined {
  if (!record.configurationSnapshot) return undefined;
  return JSON.stringify({
    detectorId: record.configurationSnapshot.detectorId,
    executionMode: record.configurationSnapshot.executionMode,
    failurePolicy: record.configurationSnapshot.failurePolicy,
    parityRecordingEnabled: record.configurationSnapshot.parityRecordingEnabled,
  });
}

function calculateEvidenceQualityScore(input: {
  assessments: Phase14EvidenceRecordAssessment[];
  defects: Phase14EvidenceDefect[];
  independentRuns: number;
  minimumIndependentRuns: number;
  uniqueRepositoryFingerprints: number;
  minimumUniqueRepositoryFingerprints: number;
  observationPeriodHours: number;
  minimumObservationPeriodHours: number;
}): number {
  const independentComponent = Math.min(1, input.independentRuns / input.minimumIndependentRuns);
  const diversityComponent = Math.min(1, input.uniqueRepositoryFingerprints / input.minimumUniqueRepositoryFingerprints);
  const periodComponent = Math.min(1, input.observationPeriodHours / input.minimumObservationPeriodHours);
  const completenessComponent = input.assessments.length === 0
    ? 0
    : input.assessments.filter((assessment) => assessment.metricsCompleteness === 'complete').length / input.assessments.length;
  const defectPenalty = Math.min(0.5, input.defects.filter((item) => item.severity === 'high' || item.severity === 'critical').length * 0.08);
  return round(Math.max(0, independentComponent * 0.3 + diversityComponent * 0.25 + periodComponent * 0.2 + completenessComponent * 0.25 - defectPenalty));
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
