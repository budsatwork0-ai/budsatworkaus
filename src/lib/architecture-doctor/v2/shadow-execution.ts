import { detectPhaseOneDrift } from '../reporter';
import type { ArchitectureInventory, AtlasSpec, DriftFinding } from '../types';
import type { CronRouteParityReport } from './cron-route-parity';
import { compareCronRouteV1V2 } from './cron-route-parity';
import { createCronRouteRegistrationAnalyzer } from './cron-route-analyzer';
import type { SliceKnowledgePublication, SliceVerificationRun } from './domain';
import type { ModuleAnalysisResult } from './module-analyzer';
import { runModuleAnalysisPipeline } from './pipeline';
import { ModuleAnalyzerRegistry } from './registry';

export interface CronRouteShadowExecutionResult {
  mode: 'shadow';
  v1Authoritative: true;
  v2Enabled: boolean;
  authoritativeV1Findings: DriftFinding[];
  v2Analyses: ModuleAnalysisResult[];
  v2Knowledge?: SliceKnowledgePublication;
  parity?: CronRouteParityReport;
  executionFailure?: {
    phase: 'v2_execution';
    message: string;
  };
  aggregateHealthFindingCount: number;
}

export async function runCronRouteShadowExecution(input: {
  atlas: AtlasSpec;
  inventory: ArchitectureInventory;
  verificationRun: SliceVerificationRun;
  timepoint: string;
  repositoryState?: string;
  v2Enabled: boolean;
  runV2?: () => Promise<{ analyses: ModuleAnalysisResult[]; knowledge: SliceKnowledgePublication }>;
}): Promise<CronRouteShadowExecutionResult> {
  const authoritativeV1Findings = detectPhaseOneDrift(input.atlas, input.inventory).filter((finding) =>
    finding.type === 'cron_route_unregistered' || finding.type === 'cron_target_missing'
  );

  if (!input.v2Enabled) {
    return {
      mode: 'shadow',
      v1Authoritative: true,
      v2Enabled: false,
      authoritativeV1Findings,
      v2Analyses: [],
      aggregateHealthFindingCount: authoritativeV1Findings.length,
    };
  }

  try {
    const result = input.runV2 ? await input.runV2() : await runDefaultV2(input.inventory, input.verificationRun, input.timepoint);
    const v2Analysis = result.analyses.find((analysis) => analysis.analyzerId === 'cron-route-registration') ?? result.analyses[0];
    const parity = compareCronRouteV1V2({
      atlas: input.atlas,
      inventory: input.inventory,
      v2Analysis,
      analysisRunId: input.verificationRun.id,
      repositoryState: input.repositoryState,
      executedAt: input.timepoint,
    });

    return {
      mode: 'shadow',
      v1Authoritative: true,
      v2Enabled: true,
      authoritativeV1Findings,
      v2Analyses: result.analyses,
      v2Knowledge: result.knowledge,
      parity,
      aggregateHealthFindingCount: authoritativeV1Findings.length,
    };
  } catch (error) {
    return {
      mode: 'shadow',
      v1Authoritative: true,
      v2Enabled: true,
      authoritativeV1Findings,
      v2Analyses: [],
      executionFailure: {
        phase: 'v2_execution',
        message: error instanceof Error ? error.message : String(error),
      },
      aggregateHealthFindingCount: authoritativeV1Findings.length,
    };
  }
}

async function runDefaultV2(
  inventory: ArchitectureInventory,
  verificationRun: SliceVerificationRun,
  timepoint: string,
): Promise<{ analyses: ModuleAnalysisResult[]; knowledge: SliceKnowledgePublication }> {
  const registry = new ModuleAnalyzerRegistry();
  registry.register(createCronRouteRegistrationAnalyzer(inventory));
  return runModuleAnalysisPipeline({
    registry,
    verificationRun,
    timepoint,
    reportLabel: 'Architecture Doctor Phase 11 Cron Route Shadow Report',
  });
}
