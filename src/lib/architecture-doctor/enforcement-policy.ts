import { readFile } from 'node:fs/promises';
import type {
  ArchitectureHealthReport,
  EnforcementMode,
  EnforcementPolicyConfig,
  EnforcementPolicyEvaluation,
  ThresholdDryRunResult,
} from './types';

export const DEFAULT_ENFORCEMENT_POLICY: EnforcementPolicyConfig = {
  enforcementMode: 'advisory',
  minimumHealthScore: 80,
  failOnCritical: false,
  failOnExpiredBaseline: false,
  releaseCycleObserved: false,
  scoreThresholdAgreed: false,
};

export async function readEnforcementPolicyConfig(configPath?: string): Promise<EnforcementPolicyConfig> {
  if (!configPath) return DEFAULT_ENFORCEMENT_POLICY;

  try {
    const parsed = JSON.parse(await readFile(configPath, 'utf8')) as Partial<EnforcementPolicyConfig>;
    return normalizeEnforcementPolicyConfig(parsed);
  } catch {
    return DEFAULT_ENFORCEMENT_POLICY;
  }
}

export function normalizeEnforcementPolicyConfig(config: Partial<EnforcementPolicyConfig>): EnforcementPolicyConfig {
  const enforcementMode = isEnforcementMode(config.enforcementMode) ? config.enforcementMode : DEFAULT_ENFORCEMENT_POLICY.enforcementMode;
  const minimumHealthScore =
    typeof config.minimumHealthScore === 'number' && Number.isFinite(config.minimumHealthScore)
      ? Math.max(0, Math.min(100, Math.round(config.minimumHealthScore)))
      : DEFAULT_ENFORCEMENT_POLICY.minimumHealthScore;

  return {
    enforcementMode,
    minimumHealthScore,
    failOnCritical: config.failOnCritical === true,
    failOnExpiredBaseline: config.failOnExpiredBaseline === true,
    releaseCycleObserved: config.releaseCycleObserved === true,
    scoreThresholdAgreed: config.scoreThresholdAgreed === true,
  };
}

export function evaluateEnforcementPolicy(
  report: Pick<ArchitectureHealthReport, 'healthScore' | 'baseline' | 'enforcementReadiness'>,
  config: EnforcementPolicyConfig = DEFAULT_ENFORCEMENT_POLICY,
): EnforcementPolicyEvaluation {
  const normalized = normalizeEnforcementPolicyConfig(config);
  const failureReasons = gateFailureReasons(report, normalized);
  const blockingMode = normalized.enforcementMode === 'block_on_critical' || normalized.enforcementMode === 'block_on_threshold';
  const missingChecklistItems = report.enforcementReadiness.items
    .filter((item) => !item.passed)
    .map((item) => `${item.label}: ${item.details}`);
  const blockingDisabledReasons = blockingDisabledReasonsFor(normalized, missingChecklistItems);

  return {
    config: normalized,
    shouldFail: blockingMode && blockingDisabledReasons.length === 0 && failureReasons.length > 0,
    blockingWouldOccur: failureReasons.length > 0,
    failureReasons,
    blockingDisabledReasons,
    missingChecklistItems,
  };
}

export function evaluateThresholdDryRun(
  report: Pick<ArchitectureHealthReport, 'healthScore'>,
  policy: EnforcementPolicyEvaluation,
): ThresholdDryRunResult {
  const wouldPass = report.healthScore >= policy.config.minimumHealthScore;
  const nonBlockingReasons = [
    ...policy.blockingDisabledReasons,
    ...(policy.config.enforcementMode !== 'block_on_threshold' ? ['enforcementMode is not block_on_threshold'] : []),
  ];

  return {
    currentHealthScore: report.healthScore,
    proposedMinimumHealthScore: policy.config.minimumHealthScore,
    wouldPass,
    wouldFail: !wouldPass,
    nonBlockingReasons: [...new Set(nonBlockingReasons)],
  };
}

export function renderThresholdDryRunMarkdown(result: ThresholdDryRunResult): string {
  return `# Architecture Doctor Warn-Only Threshold Dry Run

| Field | Value |
|---|---|
| Current health score | ${result.currentHealthScore}/100 |
| Proposed minimum threshold | ${result.proposedMinimumHealthScore}/100 |
| Dry-run result | ${result.wouldPass ? 'would pass' : 'would fail'} |

Exact reasons it would not block today:

${result.nonBlockingReasons.map((reason) => `- ${reason}`).join('\n') || '- None.'}
`;
}

function gateFailureReasons(
  report: Pick<ArchitectureHealthReport, 'healthScore' | 'baseline'>,
  config: EnforcementPolicyConfig,
): string[] {
  const reasons: string[] = [];
  const criticalCount = report.baseline.newFindings.filter((finding) => finding.severity === 'critical').length;
  const expiredBaselineCount = report.baseline.acceptedFindings.filter((finding) => isExpired(finding.baselineExpiryDate)).length;

  if ((config.enforcementMode === 'block_on_critical' || config.failOnCritical) && criticalCount > 0) {
    reasons.push(`${criticalCount} unresolved critical finding${criticalCount === 1 ? '' : 's'}`);
  }

  if (config.enforcementMode === 'block_on_threshold' && report.healthScore < config.minimumHealthScore) {
    reasons.push(`health score ${report.healthScore} is below minimum ${config.minimumHealthScore}`);
  }

  if (config.failOnExpiredBaseline && expiredBaselineCount > 0) {
    reasons.push(`${expiredBaselineCount} expired baseline finding${expiredBaselineCount === 1 ? '' : 's'}`);
  }

  return reasons;
}

function blockingDisabledReasonsFor(config: EnforcementPolicyConfig, missingChecklistItems: string[]): string[] {
  const reasons: string[] = [];
  if (config.enforcementMode === 'advisory') reasons.push('enforcementMode is advisory');
  if (config.enforcementMode === 'warn_only') reasons.push('enforcementMode is warn_only');
  if (!config.releaseCycleObserved) reasons.push('releaseCycleObserved is false');
  if (missingChecklistItems.length > 0) reasons.push('enforcement readiness checklist is incomplete');
  return reasons;
}

function isExpired(value?: string): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time < Date.now();
}

function isEnforcementMode(value: unknown): value is EnforcementMode {
  return value === 'advisory' || value === 'warn_only' || value === 'block_on_critical' || value === 'block_on_threshold';
}
