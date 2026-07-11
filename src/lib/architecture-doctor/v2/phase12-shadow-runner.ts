import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { detectPhaseOneDrift } from '../reporter';
import type { ArchitectureHealthReport, ArchitectureInventory, AtlasSpec, DriftFinding } from '../types';
import {
  CRON_ROUTE_ANALYZER_ID,
  CRON_ROUTE_UNRESOLVED_CAPABILITY_ID,
  CRON_ROUTE_UNRESOLVED_CAPABILITY_NAME,
  createCronRouteRegistrationAnalyzer,
} from './cron-route-analyzer';
import type { CronRouteParityReport } from './cron-route-parity';
import { compareCronRouteV1V2 } from './cron-route-parity';
import type { SliceKnowledgePublication, SliceVerificationRun } from './domain';
import type { DetectorMigrationGovernanceDecision, DetectorReplacementReadiness, RepositoryStateIdentity } from './migration-governance';
import { createDetectorMigrationGovernanceDecision } from './migration-governance';
import { publishModuleKnowledge } from './module-knowledge';
import type { ModuleAnalysisResult } from './module-analyzer';
import { evaluatePhase13StatisticalGovernance, writePhase13StatisticalGovernanceArtifacts } from './phase13-statistical-governance';
import { evaluatePhase14EvidenceQuality, writePhase14EvidenceQualityArtifacts } from './phase14-evidence-quality';
import { renderSliceReport } from './report';
import { ModuleAnalyzerRegistry } from './registry';

const execFileAsync = promisify(execFile);

export const PHASE12_CRON_DETECTOR_ID = 'cron-route-registration';

export type CronShadowExecutionMode = 'disabled' | 'shadow_advisory';
export type CronShadowFailurePolicy = 'isolate_and_continue';
export type CronShadowFailureStage =
  | 'v1_execution'
  | 'v2_shadow_execution'
  | 'parity_comparison'
  | 'artifact_persistence'
  | 'knowledge_publication';

export interface CronRouteShadowConfig {
  detectorId: typeof PHASE12_CRON_DETECTOR_ID;
  shadowEnabled: boolean;
  executionMode: CronShadowExecutionMode;
  failurePolicy: CronShadowFailurePolicy;
  parityRecordingEnabled: boolean;
  artifactOutputEnabled: boolean;
  minimumSuccessfulRunsForReadiness: number;
}

export interface ShadowExecutionFailure {
  stage: CronShadowFailureStage;
  detector: string;
  timestamp: string;
  repositoryState: RepositoryStateIdentity;
  errorCategory: string;
  sanitizedErrorSummary: string;
  effectOnAuthority: string;
}

export interface Phase12ShadowExecutionRecord {
  runId: string;
  detectorId: string;
  repositoryState: RepositoryStateIdentity;
  timestamp: string;
  v1ExecutionStatus: 'succeeded' | 'failed';
  v2ExecutionStatus: 'disabled' | 'succeeded' | 'failed';
  parityDecision: 'not_run' | CronRouteParityReport['overallDecision'] | 'comparison_failed';
  explainedDifferences: CronRouteParityReport['intentionalDifferences'];
  unexplainedDifferences: CronRouteParityReport['unexplainedDifferences'];
  executionFailures: ShadowExecutionFailure[];
  authoritativeSource: 'v1';
  configurationSnapshot: CronRouteShadowConfig;
  v1FindingCount: number;
  v2FindingCount: number;
  onlyV1DifferenceCount?: number;
  onlyV2DifferenceCount?: number;
  v2FindingsDoubleCounted: false;
}

export interface Phase12ShadowHistory {
  version: 1;
  records: Phase12ShadowExecutionRecord[];
}

export interface Phase12ShadowRunResult {
  config: CronRouteShadowConfig;
  repositoryState: RepositoryStateIdentity;
  record: Phase12ShadowExecutionRecord;
  authoritativeV1Findings: DriftFinding[];
  v2Analyses: ModuleAnalysisResult[];
  v2Knowledge?: SliceKnowledgePublication;
  parity?: CronRouteParityReport;
  readiness: DetectorReplacementReadiness;
  governanceDecision: DetectorMigrationGovernanceDecision;
  history: Phase12ShadowHistory;
  artifacts: {
    latestShadowExecutionJson?: string;
    shadowHistoryJson?: string;
    migrationReadinessJson?: string;
    knowledgeBackedShadowReport?: string;
    governanceRecordJson?: string;
    phase13StatisticalParityReport?: string;
    phase13TrendHistory?: string;
    phase13ReadinessJustification?: string;
    phase13DetectorDriftReport?: string;
    phase13GovernanceRecommendation?: string;
    phase14EvidenceQualityReport?: string;
    phase14EvidenceAssessments?: string;
    phase14EvidenceDefects?: string;
    phase14IndependenceSummary?: string;
    phase14ReadinessDecision?: string;
    phase14GovernanceRecommendation?: string;
  };
  artifactFailures: ShadowExecutionFailure[];
  authoritativeHealthChanged: false;
}

export function defaultCronRouteShadowConfig(): CronRouteShadowConfig {
  return {
    detectorId: PHASE12_CRON_DETECTOR_ID,
    shadowEnabled: false,
    executionMode: 'disabled',
    failurePolicy: 'isolate_and_continue',
    parityRecordingEnabled: true,
    artifactOutputEnabled: false,
    minimumSuccessfulRunsForReadiness: 3,
  };
}

export function normalizeCronRouteShadowConfig(input?: Partial<CronRouteShadowConfig>): CronRouteShadowConfig {
  const base = defaultCronRouteShadowConfig();
  const config = {
    ...base,
    ...Object.fromEntries(Object.entries(input ?? {}).filter(([, value]) => value !== undefined)),
  } as CronRouteShadowConfig;
  if (config.detectorId !== PHASE12_CRON_DETECTOR_ID) {
    throw new Error(`Unsupported shadow detector ${config.detectorId}. Phase 12 only supports ${PHASE12_CRON_DETECTOR_ID}.`);
  }
  if (!['disabled', 'shadow_advisory'].includes(config.executionMode)) {
    throw new Error(`Unsupported cron shadow execution mode ${config.executionMode}.`);
  }
  if (config.executionMode === 'disabled') config.shadowEnabled = false;
  if (config.executionMode === 'shadow_advisory') config.shadowEnabled = true;
  if (config.failurePolicy !== 'isolate_and_continue') {
    throw new Error(`Unsupported cron shadow failure policy ${config.failurePolicy}.`);
  }
  return config;
}

export async function runPhase12CronRouteShadowExecution(input: {
  rootDir: string;
  outputDir?: string;
  atlas: AtlasSpec;
  inventory: ArchitectureInventory;
  authoritativeReport?: ArchitectureHealthReport;
  config?: Partial<CronRouteShadowConfig>;
  now?: Date;
  runV2?: () => Promise<{ analyses: ModuleAnalysisResult[]; knowledge: SliceKnowledgePublication }>;
  compareParity?: (analysis: ModuleAnalysisResult) => CronRouteParityReport;
  writeArtifacts?: (artifacts: Phase12ArtifactWriteSet) => Promise<Phase12WrittenArtifacts>;
}): Promise<Phase12ShadowRunResult> {
  const config = normalizeCronRouteShadowConfig(input.config);
  const timestamp = (input.now ?? new Date()).toISOString();
  const repositoryState = await readRepositoryStateIdentity(input.rootDir);
  const verificationRun = phase12VerificationRun(timestamp);
  const failures: ShadowExecutionFailure[] = [];
  const authoritativeV1Findings = runV1CronDetector(input.atlas, input.inventory, timestamp, repositoryState, failures);
  let v2Analyses: ModuleAnalysisResult[] = [];
  let v2Knowledge: SliceKnowledgePublication | undefined;
  let parity: CronRouteParityReport | undefined;
  let v2ExecutionStatus: Phase12ShadowExecutionRecord['v2ExecutionStatus'] = 'disabled';
  let parityDecision: Phase12ShadowExecutionRecord['parityDecision'] = 'not_run';

  if (config.shadowEnabled && config.executionMode === 'shadow_advisory') {
    try {
      const v2 = input.runV2
        ? await input.runV2()
        : await runDefaultV2(input.inventory, verificationRun, timestamp);
      v2Analyses = v2.analyses;
      v2Knowledge = v2.knowledge;
      v2ExecutionStatus = 'succeeded';
    } catch (error) {
      v2ExecutionStatus = 'failed';
      failures.push(createFailure(error instanceof ShadowStageError ? error.stage : 'v2_shadow_execution', timestamp, repositoryState, error));
    }

    if (v2ExecutionStatus === 'succeeded' && config.parityRecordingEnabled) {
      try {
        const v2Analysis = v2Analyses.find((analysis) => analysis.analyzerId === CRON_ROUTE_ANALYZER_ID) ?? v2Analyses[0];
        if (!v2Analysis) throw new Error('No cron route v2 analysis was produced.');
        parity = input.compareParity
          ? input.compareParity(v2Analysis)
          : compareCronRouteV1V2({
            atlas: input.atlas,
            inventory: input.inventory,
            v2Analysis,
            analysisRunId: verificationRun.id,
            repositoryState: repositoryState.identity,
            executedAt: timestamp,
          });
        parityDecision = parity.overallDecision;
      } catch (error) {
        parityDecision = 'comparison_failed';
        failures.push(createFailure('parity_comparison', timestamp, repositoryState, error));
      }
    }
  }

  const v2FindingCount = v2Analyses.flatMap((analysis) => analysis.findings).length;
  const record: Phase12ShadowExecutionRecord = {
    runId: `adv2-phase12-cron-shadow-${timestamp.replace(/\W+/g, '-').replace(/-$/g, '')}`,
    detectorId: PHASE12_CRON_DETECTOR_ID,
    repositoryState,
    timestamp,
    v1ExecutionStatus: failures.some((failure) => failure.stage === 'v1_execution') ? 'failed' : 'succeeded',
    v2ExecutionStatus,
    parityDecision,
    explainedDifferences: parity?.intentionalDifferences ?? [],
    unexplainedDifferences: parity?.unexplainedDifferences ?? [],
    executionFailures: [...failures],
    authoritativeSource: 'v1',
    configurationSnapshot: config,
    v1FindingCount: authoritativeV1Findings.length,
    v2FindingCount,
    onlyV1DifferenceCount: parity?.onlyV1.length,
    onlyV2DifferenceCount: parity?.onlyV2.length,
    v2FindingsDoubleCounted: false,
  };

  const existingHistory = await readShadowHistory(defaultHistoryPath(input.rootDir, input.outputDir));
  const history = appendShadowHistory(existingHistory, record);
  const governanceDecision = createDetectorMigrationGovernanceDecision({
    id: `phase12-cron-route-governance-${record.runId}`,
    decision: 'needs_review',
    actor: 'Architecture Doctor Phase 12 Shadow Runner',
    rationale: 'Controlled shadow execution evidence requires explicit review before any replacement can be considered.',
    timestamp,
    detectorScope: verificationRun.scope,
    repositoryState,
    parityResultRef: `phase12-cron-route-shadow:${record.runId}`,
  });
  const statisticalGovernance = evaluatePhase13StatisticalGovernance({
    history,
    generatedAt: timestamp,
    governanceDecision,
    config: { detectorId: PHASE12_CRON_DETECTOR_ID },
  });
  const evidenceQuality = evaluatePhase14EvidenceQuality({
    history,
    phase13: statisticalGovernance,
    generatedAt: timestamp,
    config: { detectorId: PHASE12_CRON_DETECTOR_ID },
  });
  const readiness = evaluatePhase12ShadowReadiness({
    detectorScope: verificationRun.scope,
    repositoryState,
    parityResultRef: `phase12-cron-route-shadow:${record.runId}`,
    history,
    minimumSuccessfulRuns: config.minimumSuccessfulRunsForReadiness,
    downstreamCompatibilityDocumented: true,
    rollbackDefined: true,
    governanceDecision,
  });

  const artifactFailures: ShadowExecutionFailure[] = [];
  let artifacts: Phase12ShadowRunResult['artifacts'] = {};
  if (config.artifactOutputEnabled && input.outputDir) {
    try {
      artifacts = input.writeArtifacts
        ? await input.writeArtifacts({ rootDir: input.rootDir, outputDir: input.outputDir, record, history, readiness, governanceDecision, v2Knowledge })
        : await writePhase12ShadowArtifacts({ rootDir: input.rootDir, outputDir: input.outputDir, record, history, readiness, governanceDecision, v2Knowledge, statisticalGovernance, evidenceQuality });
    } catch (error) {
      const failure = createFailure('artifact_persistence', timestamp, repositoryState, error);
      artifactFailures.push(failure);
      record.executionFailures.push(failure);
    }
  }

  return {
    config,
    repositoryState,
    record,
    authoritativeV1Findings,
    v2Analyses,
    v2Knowledge,
    parity,
    readiness,
    governanceDecision,
    history,
    artifacts,
    artifactFailures,
    authoritativeHealthChanged: false,
  };
}

export interface Phase12ArtifactWriteSet {
  rootDir: string;
  outputDir: string;
  record: Phase12ShadowExecutionRecord;
  history: Phase12ShadowHistory;
  readiness: DetectorReplacementReadiness;
  governanceDecision: DetectorMigrationGovernanceDecision;
  v2Knowledge?: SliceKnowledgePublication;
  statisticalGovernance?: ReturnType<typeof evaluatePhase13StatisticalGovernance>;
  evidenceQuality?: ReturnType<typeof evaluatePhase14EvidenceQuality>;
}

export type Phase12WrittenArtifacts = Phase12ShadowRunResult['artifacts'];

export async function writePhase12ShadowArtifacts(input: Phase12ArtifactWriteSet): Promise<Phase12WrittenArtifacts> {
  await mkdir(input.outputDir, { recursive: true });
  const latestShadowExecutionJson = path.join(input.outputDir, 'architecture-doctor-phase12-cron-route-shadow-latest.json');
  const shadowHistoryJson = defaultHistoryPath(input.rootDir, input.outputDir);
  const migrationReadinessJson = path.join(input.outputDir, 'architecture-doctor-phase12-cron-route-readiness.json');
  const knowledgeBackedShadowReport = path.join(input.outputDir, 'architecture-doctor-phase12-cron-route-shadow-report.md');
  const governanceRecordJson = path.join(input.outputDir, 'architecture-doctor-phase12-cron-route-governance.json');

  await writeFile(latestShadowExecutionJson, `${JSON.stringify(input.record, null, 2)}\n`, 'utf8');
  await writeFile(shadowHistoryJson, `${JSON.stringify(input.history, null, 2)}\n`, 'utf8');
  await writeFile(migrationReadinessJson, `${JSON.stringify(input.readiness, null, 2)}\n`, 'utf8');
  await writeFile(knowledgeBackedShadowReport, renderPhase12ShadowReport(input), 'utf8');
  await writeFile(governanceRecordJson, `${JSON.stringify(input.governanceDecision, null, 2)}\n`, 'utf8');
  const phase13 = await writePhase13StatisticalGovernanceArtifacts({
    outputDir: input.outputDir,
    summary: input.statisticalGovernance ?? evaluatePhase13StatisticalGovernance({
      history: input.history,
      generatedAt: input.record.timestamp,
      governanceDecision: input.governanceDecision,
      config: { detectorId: PHASE12_CRON_DETECTOR_ID },
    }),
  });
  const phase14 = await writePhase14EvidenceQualityArtifacts({
    outputDir: input.outputDir,
    summary: input.evidenceQuality ?? evaluatePhase14EvidenceQuality({
      history: input.history,
      phase13: input.statisticalGovernance ?? evaluatePhase13StatisticalGovernance({
        history: input.history,
        generatedAt: input.record.timestamp,
        governanceDecision: input.governanceDecision,
        config: { detectorId: PHASE12_CRON_DETECTOR_ID },
      }),
      generatedAt: input.record.timestamp,
      config: { detectorId: PHASE12_CRON_DETECTOR_ID },
    }),
  });

  return {
    latestShadowExecutionJson,
    shadowHistoryJson,
    migrationReadinessJson,
    knowledgeBackedShadowReport,
    governanceRecordJson,
    phase13StatisticalParityReport: phase13.statisticalParityReport,
    phase13TrendHistory: phase13.trendHistory,
    phase13ReadinessJustification: phase13.readinessJustification,
    phase13DetectorDriftReport: phase13.detectorDriftReport,
    phase13GovernanceRecommendation: phase13.governanceRecommendation,
    phase14EvidenceQualityReport: phase14.evidenceQualityReport,
    phase14EvidenceAssessments: phase14.evidenceAssessments,
    phase14EvidenceDefects: phase14.evidenceDefects,
    phase14IndependenceSummary: phase14.independenceSummary,
    phase14ReadinessDecision: phase14.readinessDecision,
    phase14GovernanceRecommendation: phase14.governanceRecommendation,
  };
}

export function appendShadowHistory(history: Phase12ShadowHistory, record: Phase12ShadowExecutionRecord): Phase12ShadowHistory {
  return {
    version: 1,
    records: [...history.records, record],
  };
}

export function evaluatePhase12ShadowReadiness(input: {
  detectorScope: string;
  repositoryState: RepositoryStateIdentity;
  parityResultRef: string;
  history: Phase12ShadowHistory;
  minimumSuccessfulRuns: number;
  downstreamCompatibilityDocumented: boolean;
  rollbackDefined: boolean;
  governanceDecision: DetectorMigrationGovernanceDecision;
}): DetectorReplacementReadiness {
  const successfulRuns = input.history.records.filter((record) =>
    record.v1ExecutionStatus === 'succeeded'
    && record.v2ExecutionStatus === 'succeeded'
    && (record.parityDecision === 'parity_verified' || record.parityDecision === 'parity_failed')
  );
  const blockers: DetectorReplacementReadiness['blockers'] = [];
  if (successfulRuns.length < input.minimumSuccessfulRuns) {
    blockers.push({
      requirement: 'shadow_execution_completed_successfully',
      reason: `Only ${successfulRuns.length} successful shadow run(s) exist; ${input.minimumSuccessfulRuns} required.`,
    });
  }
  if (new Set(successfulRuns.map((record) => record.repositoryState.identity)).size < 2) {
    blockers.push({
      requirement: 'shadow_execution_completed_successfully',
      reason: 'Successful shadow runs do not cover more than one repository state.',
    });
  }
  if (input.history.records.some((record) => record.unexplainedDifferences.length > 0)) {
    blockers.push({
      requirement: 'real_repository_parity_has_no_unexplained_differences',
      reason: 'At least one shadow run has unresolved unexplained differences.',
    });
  }
  if (input.history.records.some((record) => record.executionFailures.some((failure) => failure.stage === 'v2_shadow_execution'))) {
    blockers.push({
      requirement: 'shadow_execution_completed_successfully',
      reason: 'At least one shadow run has an unresolved v2 execution failure.',
    });
  }
  if (input.history.records.some((record) => record.authoritativeSource !== 'v1')) {
    blockers.push({
      requirement: 'shadow_execution_completed_successfully',
      reason: 'At least one shadow run did not preserve v1 as authoritative.',
    });
  }
  if (input.history.records.some((record) => record.v2FindingsDoubleCounted)) {
    blockers.push({
      requirement: 'downstream_report_and_consumer_compatibility_documented',
      reason: 'At least one shadow run double-counted v2 findings.',
    });
  }
  if (!input.downstreamCompatibilityDocumented) {
    blockers.push({
      requirement: 'downstream_report_and_consumer_compatibility_documented',
      reason: 'Downstream compatibility is not documented.',
    });
  }
  if (!input.rollbackDefined) {
    blockers.push({
      requirement: 'rollback_behaviour_defined',
      reason: 'Rollback behaviour is not defined.',
    });
  }
  if (input.governanceDecision.decision !== 'approved_for_replacement') {
    blockers.push({
      requirement: 'explicit_governance_decision_approves_replacement',
      reason: 'Governance remains explicit and no replacement approval has occurred.',
    });
  }

  return {
    detectorScope: input.detectorScope,
    repositoryState: input.repositoryState,
    parityResultRef: input.parityResultRef,
    ready: false,
    blockers,
  };
}

export async function readRepositoryStateIdentity(rootDir: string): Promise<RepositoryStateIdentity> {
  try {
    const [{ stdout: commitStdout }, { stdout: statusStdout }] = await Promise.all([
      execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: rootDir }),
      execFileAsync('git', ['status', '--porcelain=v1'], { cwd: rootDir }),
    ]);
    const commitSha = commitStdout.trim() || 'unknown';
    const statusLines = statusStdout.split('\n').map((line) => line.trimEnd()).filter(Boolean).sort();
    const dirty = statusLines.length > 0;
    const worktreeFingerprint = dirty
      ? createHash('sha256').update(statusLines.join('\n')).digest('hex')
      : undefined;
    return {
      commitSha,
      dirty,
      worktreeFingerprint,
      identity: dirty ? `${commitSha}:dirty:${worktreeFingerprint}` : `${commitSha}:clean`,
    };
  } catch {
    return {
      commitSha: 'unknown',
      dirty: undefined,
      fallbackIdentity: 'git-unavailable',
      identity: `fallback:git-unavailable:${createHash('sha256').update(path.resolve(rootDir)).digest('hex')}`,
    };
  }
}

async function readShadowHistory(historyPath: string): Promise<Phase12ShadowHistory> {
  try {
    const raw = await readFile(historyPath, 'utf8');
    const parsed = JSON.parse(raw) as Phase12ShadowHistory;
    if (parsed.version === 1 && Array.isArray(parsed.records)) return parsed;
  } catch {
    // Missing or malformed history starts a new append-only stream for this artifact path.
  }
  return { version: 1, records: [] };
}

function defaultHistoryPath(rootDir: string, outputDir?: string): string {
  return path.join(outputDir ?? rootDir, 'architecture-doctor-phase12-cron-route-shadow-history.json');
}

function runV1CronDetector(
  atlas: AtlasSpec,
  inventory: ArchitectureInventory,
  timestamp: string,
  repositoryState: RepositoryStateIdentity,
  failures: ShadowExecutionFailure[],
): DriftFinding[] {
  try {
    return detectPhaseOneDrift(atlas, inventory).filter((finding) =>
      finding.type === 'cron_route_unregistered' || finding.type === 'cron_target_missing'
    );
  } catch (error) {
    failures.push(createFailure('v1_execution', timestamp, repositoryState, error));
    throw error;
  }
}

async function runDefaultV2(
  inventory: ArchitectureInventory,
  verificationRun: SliceVerificationRun,
  timepoint: string,
): Promise<{ analyses: ModuleAnalysisResult[]; knowledge: SliceKnowledgePublication }> {
  const registry = new ModuleAnalyzerRegistry();
  registry.register(createCronRouteRegistrationAnalyzer(inventory));
  let analyses: ModuleAnalysisResult[];
  try {
    analyses = await registry.analyzeAll({ verificationRun, timepoint });
  } catch (error) {
    throw new ShadowStageError('v2_shadow_execution', error);
  }
  try {
    return {
      analyses,
      knowledge: publishModuleKnowledge({
        verificationRun,
        analyses,
        reportLabel: 'Architecture Doctor Phase 12 Cron Route Shadow Report',
      }),
    };
  } catch (error) {
    throw new ShadowStageError('knowledge_publication', error);
  }
}

class ShadowStageError extends Error {
  constructor(
    readonly stage: CronShadowFailureStage,
    readonly causeError: unknown,
  ) {
    super(causeError instanceof Error ? causeError.message : String(causeError));
    this.name = causeError instanceof Error ? causeError.name : 'ShadowStageError';
  }
}

function phase12VerificationRun(timepoint: string): SliceVerificationRun {
  return {
    id: `adv2-phase12-cron-route-${timepoint.replace(/\W+/g, '-').replace(/-$/g, '')}`,
    scope: 'detector:cron-route-registration assetKind:cron phase:12',
    capabilityId: CRON_ROUTE_UNRESOLVED_CAPABILITY_ID,
    capabilityName: CRON_ROUTE_UNRESOLVED_CAPABILITY_NAME,
    assetKind: 'cron',
    mode: 'advisory',
    startedAt: timepoint,
    completedAt: timepoint,
    limitations: [
      'Phase 12 is controlled shadow execution; v1 is authoritative.',
      'v2 is shadow-only and excluded from authoritative health and enforcement calculations.',
      'No replacement approval has occurred.',
    ],
  };
}

function createFailure(
  stage: CronShadowFailureStage,
  timestamp: string,
  repositoryState: RepositoryStateIdentity,
  error: unknown,
): ShadowExecutionFailure {
  return {
    stage,
    detector: PHASE12_CRON_DETECTOR_ID,
    timestamp,
    repositoryState,
    errorCategory: error instanceof Error ? error.name : 'NonErrorThrowable',
    sanitizedErrorSummary: sanitizeError(error),
    effectOnAuthority: stage === 'v1_execution'
      ? 'v1 failed before authority could be established.'
      : 'No effect on authority; v1 remains authoritative and v2 output is excluded from health, severity totals, CI, enforcement, and existing reports.',
  };
}

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '<redacted-email>').slice(0, 500);
}

function renderPhase12ShadowReport(input: Phase12ArtifactWriteSet): string {
  const v2Report = input.v2Knowledge ? renderSliceReport(input.v2Knowledge).markdown : 'No v2 knowledge publication was produced.\n';
  return [
    '# Architecture Doctor Phase 12 Cron Route Shadow Report',
    '',
    `Generated: ${input.record.timestamp}`,
    `Run: ${input.record.runId}`,
    `Repository state: ${input.record.repositoryState.identity}`,
    '',
    '## Authority',
    '',
    '- v1 is authoritative.',
    '- v2 is shadow-only.',
    '- No replacement approval has occurred.',
    '- v2 results are excluded from authoritative health, severity totals, enforcement, CI decisions, and existing reports.',
    '',
    '## Shadow Summary',
    '',
    `- v1 cron detections: ${input.record.v1FindingCount}`,
    `- v2 shadow detections: ${input.record.v2FindingCount}`,
    `- parity decision: ${input.record.parityDecision}`,
    `- unexplained differences: ${input.record.unexplainedDifferences.length}`,
    `- execution failures: ${input.record.executionFailures.length}`,
    `- governance decision: ${input.governanceDecision.decision}`,
    `- readiness blockers: ${input.readiness.blockers.length}`,
    '',
    '## Readiness Blockers',
    '',
    ...(input.readiness.blockers.length > 0
      ? input.readiness.blockers.map((blocker) => `- ${blocker.requirement}: ${blocker.reason}`)
      : ['- None recorded, but replacement still requires explicit governance approval.']),
    '',
    '## Knowledge-Backed v2 Shadow Projection',
    '',
    v2Report,
  ].join('\n');
}
