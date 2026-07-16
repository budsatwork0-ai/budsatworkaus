import { detectPhaseOneDrift } from '../reporter';
import type { AtlasSpec, ArchitectureInventory, DriftFinding } from '../types';
import type { SliceFinding } from './domain';
import type { ModuleAnalysisResult } from './module-analyzer';
import { CRON_ROUTE_ANALYZER_ID, CRON_ROUTE_REGISTERED_RULE_ID, CRON_TARGET_EXISTS_RULE_ID } from './cron-route-analyzer';

export interface CronRouteParityDetection {
  key: string;
  ruleId: string;
  subject: string;
  type: 'cron_route_unregistered' | 'cron_target_missing';
  asset: string;
  severity: string;
  source: 'v1' | 'v2';
  legacyMessage?: string;
}

export interface CronRouteParityDifference {
  key: string;
  reason: string;
}

export interface CronRouteParityReport {
  analysisRunId?: string;
  repositoryState?: string;
  analyzerId: string;
  v1DetectorId: string;
  executedAt?: string;
  passed: boolean;
  overallDecision: 'parity_verified' | 'parity_failed';
  presentInBoth: CronRouteParityDetection[];
  onlyV1: CronRouteParityDetection[];
  onlyV2: CronRouteParityDetection[];
  severityDifferences: CronRouteParityDifference[];
  evidenceDifferences: CronRouteParityDifference[];
  mappingDifferences: CronRouteParityDifference[];
  intentionalDifferences: CronRouteParityDifference[];
  unexplainedDifferences: CronRouteParityDifference[];
}

const CRON_FINDING_TYPES = new Set(['cron_route_unregistered', 'cron_target_missing']);

export function compareCronRouteV1V2(input: {
  atlas: AtlasSpec;
  inventory: ArchitectureInventory;
  v2Analysis: ModuleAnalysisResult;
  analysisRunId?: string;
  repositoryState?: string;
  executedAt?: string;
  intentionalDifferences?: CronRouteParityDifference[];
}): CronRouteParityReport {
  const v1 = adaptV1CronDriftFindingsToCanonicalDetections(detectPhaseOneDrift(input.atlas, input.inventory));
  const v2 = input.v2Analysis.findings.filter(isCronSliceFinding).map((finding) => v2Detection(finding));
  const v1ByKey = new Map(v1.map((item) => [item.key, item]));
  const v2ByKey = new Map(v2.map((item) => [item.key, item]));
  const presentInBoth: CronRouteParityDetection[] = [];
  const onlyV1: CronRouteParityDetection[] = [];
  const onlyV2: CronRouteParityDetection[] = [];
  const severityDifferences: CronRouteParityDifference[] = [];
  const evidenceDifferences: CronRouteParityDifference[] = [];
  const mappingDifferences: CronRouteParityDifference[] = [];

  for (const item of v1) {
    const matching = v2ByKey.get(item.key);
    if (!matching) {
      onlyV1.push(item);
      continue;
    }
    presentInBoth.push(item);
    if (item.severity !== matching.severity) {
      severityDifferences.push({
        key: item.key,
        reason: `v1 severity is ${item.severity}; v2 severity is ${matching.severity}.`,
      });
    }
  }

  for (const item of v2) {
    if (!v1ByKey.has(item.key)) onlyV2.push(item);
  }

  for (const item of presentInBoth) {
    evidenceDifferences.push({
      key: item.key,
      reason: 'v2 records explicit evidence identifiers, rule identifiers, observed values, expected values, and provenance; v1 drift findings expose only message-level evidence for this detector.',
    });
    mappingDifferences.push({
      key: item.key,
      reason: 'v2 records explicit unresolved cron ownership mapping context; v1 cron drift findings do not carry capability mapping context.',
    });
  }

  const intentionalDifferences = input.intentionalDifferences ?? [];
  const intentionalKeys = new Set(intentionalDifferences.map((item) => item.key));
  const unexplainedDifferences: CronRouteParityDifference[] = [
    ...onlyV1.map((item) => ({ key: item.key, reason: 'Detection exists in v1 but not in v2.' })),
    ...onlyV2.map((item) => ({ key: item.key, reason: 'Detection exists in v2 but not in v1.' })),
    ...severityDifferences,
  ].filter((item) => !intentionalKeys.has(item.key));
  const overallDecision = unexplainedDifferences.length === 0 ? 'parity_verified' : 'parity_failed';

  return {
    analysisRunId: input.analysisRunId,
    repositoryState: input.repositoryState,
    analyzerId: CRON_ROUTE_ANALYZER_ID,
    v1DetectorId: 'architecture-doctor-v1.detectPhaseOneDrift.cron-registration-drift',
    executedAt: input.executedAt,
    passed: overallDecision === 'parity_verified',
    overallDecision,
    presentInBoth,
    onlyV1,
    onlyV2,
    severityDifferences,
    evidenceDifferences,
    mappingDifferences,
    intentionalDifferences,
    unexplainedDifferences,
  };
}

export function adaptV1CronDriftFindingsToCanonicalDetections(findings: DriftFinding[]): CronRouteParityDetection[] {
  return findings.filter(isCronDriftFinding).map((finding) => v1Detection(finding));
}

function isCronDriftFinding(finding: DriftFinding): finding is DriftFinding & { type: 'cron_route_unregistered' | 'cron_target_missing' } {
  return CRON_FINDING_TYPES.has(finding.type);
}

function isCronSliceFinding(finding: SliceFinding): finding is SliceFinding & { type: 'cron_route_unregistered' | 'cron_target_missing' } {
  return CRON_FINDING_TYPES.has(finding.type);
}

function v1Detection(finding: DriftFinding & { type: 'cron_route_unregistered' | 'cron_target_missing' }): CronRouteParityDetection {
  const ruleId = ruleIdForType(finding.type);
  return {
    key: `${finding.type}:${finding.asset}`,
    ruleId,
    subject: finding.asset,
    type: finding.type,
    asset: finding.asset,
    severity: finding.severity,
    source: 'v1',
    legacyMessage: finding.message,
  };
}

function v2Detection(finding: SliceFinding & { type: 'cron_route_unregistered' | 'cron_target_missing' }): CronRouteParityDetection {
  const ruleId = ruleIdForType(finding.type);
  return {
    key: `${finding.type}:${finding.route}`,
    ruleId,
    subject: finding.route,
    type: finding.type,
    asset: finding.route,
    severity: finding.severity,
    source: 'v2',
  };
}

function ruleIdForType(type: 'cron_route_unregistered' | 'cron_target_missing'): string {
  return type === 'cron_route_unregistered' ? CRON_ROUTE_REGISTERED_RULE_ID : CRON_TARGET_EXISTS_RULE_ID;
}
