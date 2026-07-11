import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseAtlasFile } from '../atlas-parser';
import { scanRepository } from '../repo-scanner';
import type { AtlasSpec, ArchitectureInventory, DriftFinding } from '../types';
import {
  CRON_ROUTE_UNRESOLVED_CAPABILITY_ID,
  CRON_ROUTE_UNRESOLVED_CAPABILITY_NAME,
  createCronRouteRegistrationAnalyzer,
} from './cron-route-analyzer';
import type { CronRouteParityReport } from './cron-route-parity';
import { compareCronRouteV1V2 } from './cron-route-parity';
import type { SliceKnowledgePublication, SliceReport, SliceVerificationRun } from './domain';
import { renderSliceReport } from './report';
import { detectPhaseOneDrift } from '../reporter';
import type { ModuleAnalysisResult } from './module-analyzer';
import { runModuleAnalysisPipeline } from './pipeline';
import { ModuleAnalyzerRegistry } from './registry';
import {
  createDetectorMigrationGovernanceDecision,
  evaluateReplacementReadiness,
  type DetectorMigrationGovernanceDecision,
  type DetectorReplacementReadiness,
  type RepositoryStateIdentity,
} from './migration-governance';

const execFileAsync = promisify(execFile);

export interface Phase11RunnerInput {
  rootDir: string;
  atlasPath: string;
  actor: string;
  rationale: string;
  now?: Date;
}

export interface Phase11RunnerResult {
  atlas: AtlasSpec;
  inventory: ArchitectureInventory;
  verificationRun: SliceVerificationRun;
  repositoryState: RepositoryStateIdentity;
  v1CronFindings: DriftFinding[];
  v2Analyses: ModuleAnalysisResult[];
  v2Knowledge: SliceKnowledgePublication;
  v2Report: SliceReport;
  parity: CronRouteParityReport;
  governanceDecision: DetectorMigrationGovernanceDecision;
  readiness: DetectorReplacementReadiness;
}

export async function runPhase11CronRouteMigrationGate(input: Phase11RunnerInput): Promise<Phase11RunnerResult> {
  const now = input.now ?? new Date();
  const timepoint = now.toISOString();
  const repositoryState = await readRepositoryState(input.rootDir);
  const atlas = await parseAtlasFile(input.atlasPath);
  const inventory = await scanRepository(input.rootDir);
  const verificationRun = phase11VerificationRun(timepoint);
  const registry = new ModuleAnalyzerRegistry();
  registry.register(createCronRouteRegistrationAnalyzer(inventory));
  const { analyses, knowledge } = await runModuleAnalysisPipeline({
    registry,
    verificationRun,
    timepoint,
    reportLabel: 'Architecture Doctor Phase 11 Cron Route Knowledge Report',
  });
  const v2Analysis = analyses[0];
  const parity = compareCronRouteV1V2({
    atlas,
    inventory,
    v2Analysis,
    analysisRunId: verificationRun.id,
    repositoryState: repositoryState.commitSha,
    executedAt: timepoint,
  });
  const parityResultRef = `phase11-cron-route-parity:${verificationRun.id}`;
  const governanceDecision = createDetectorMigrationGovernanceDecision({
    id: `phase11-cron-route-governance-${verificationRun.id}`,
    decision: 'needs_review',
    actor: input.actor,
    rationale: input.rationale,
    timestamp: timepoint,
    detectorScope: verificationRun.scope,
    repositoryState,
    parityResultRef,
  });
  const readiness = evaluateReplacementReadiness({
    detectorScope: verificationRun.scope,
    repositoryState,
    parityResultRef,
    parity,
    deterministic: deterministicForStableInventory(atlas, inventory, v2Analysis, verificationRun, timepoint, repositoryState.commitSha, parity),
    constitutionalInvariantsSatisfied: true,
    downstreamCompatibilityDocumented: false,
    shadowExecutionCompleted: false,
    rollbackDefined: false,
    governanceDecision,
  });

  return {
    atlas,
    inventory,
    verificationRun,
    repositoryState,
    v1CronFindings: detectPhaseOneDrift(atlas, inventory).filter((finding) =>
      finding.type === 'cron_route_unregistered' || finding.type === 'cron_target_missing'
    ),
    v2Analyses: analyses,
    v2Knowledge: knowledge,
    v2Report: renderSliceReport(knowledge),
    parity,
    governanceDecision,
    readiness,
  };
}

function phase11VerificationRun(timepoint: string): SliceVerificationRun {
  return {
    id: `adv2-phase11-cron-route-${timepoint.replace(/\W+/g, '-').replace(/-$/g, '')}`,
    scope: 'detector:cron-route-registration assetKind:cron phase:11',
    capabilityId: CRON_ROUTE_UNRESOLVED_CAPABILITY_ID,
    capabilityName: CRON_ROUTE_UNRESOLVED_CAPABILITY_NAME,
    assetKind: 'cron',
    mode: 'advisory',
    startedAt: timepoint,
    completedAt: timepoint,
    limitations: [
      'Phase 11 is advisory-only; v1 remains authoritative.',
      'No detector replacement occurred.',
      'Cron ownership and capability mappings are not automatically resolved.',
    ],
  };
}

function deterministicForStableInventory(
  atlas: AtlasSpec,
  inventory: ArchitectureInventory,
  firstAnalysis: ModuleAnalysisResult,
  verificationRun: SliceVerificationRun,
  timepoint: string,
  repositoryState: string,
  firstParity: CronRouteParityReport,
): boolean {
  const secondAnalysis = createCronRouteRegistrationAnalyzer(inventory).analyze({ verificationRun, timepoint }) as ModuleAnalysisResult;
  const secondParity = compareCronRouteV1V2({
    atlas,
    inventory,
    v2Analysis: secondAnalysis,
    analysisRunId: verificationRun.id,
    repositoryState,
    executedAt: timepoint,
  });
  return JSON.stringify(firstAnalysis.findings) === JSON.stringify(secondAnalysis.findings)
    && JSON.stringify(firstParity.unexplainedDifferences) === JSON.stringify(secondParity.unexplainedDifferences);
}

async function readRepositoryState(rootDir: string): Promise<RepositoryStateIdentity> {
  try {
    const [{ stdout: commitStdout }, { stdout: statusStdout }] = await Promise.all([
      execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: rootDir }),
      execFileAsync('git', ['status', '--porcelain'], { cwd: rootDir }),
    ]);
    return {
      commitSha: commitStdout.trim() || 'unknown',
      dirty: statusStdout.trim().length > 0,
    };
  } catch {
    return { commitSha: 'unknown' };
  }
}
