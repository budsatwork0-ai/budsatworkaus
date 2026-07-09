import type { ArchitectureHealthReport, EnforcementPolicyConfig, FinalSafetyCheckItem, FinalSafetyCheckResult } from './types';

export function runFinalSafetyCheck(
  report: Pick<ArchitectureHealthReport, 'healthScore' | 'baseline'>,
  config: EnforcementPolicyConfig,
): FinalSafetyCheckResult {
  const criticalCount = report.baseline.newFindings.filter((f) => f.severity === 'critical').length;
  const expiredCount = report.baseline.staleAcceptedFindings.length;

  const items: FinalSafetyCheckItem[] = [
    {
      id: 'critical-count-zero',
      label: 'critical count = 0',
      passed: criticalCount === 0,
      value: criticalCount,
      details: criticalCount === 0
        ? 'No unresolved critical findings.'
        : `${criticalCount} unresolved critical finding${criticalCount === 1 ? '' : 's'} must be resolved before activating branch protection.`,
    },
    {
      id: 'health-score-minimum',
      label: `health score >= ${config.minimumHealthScore}`,
      passed: report.healthScore >= config.minimumHealthScore,
      value: report.healthScore,
      details: report.healthScore >= config.minimumHealthScore
        ? `Health score ${report.healthScore} meets minimum threshold ${config.minimumHealthScore}.`
        : `Health score ${report.healthScore} is below minimum threshold ${config.minimumHealthScore}.`,
    },
    {
      id: 'baselines-not-expired',
      label: 'no expired baselines',
      passed: expiredCount === 0,
      value: expiredCount,
      details: expiredCount === 0
        ? 'No stale or expired baseline entries.'
        : `${expiredCount} expired baseline finding${expiredCount === 1 ? '' : 's'} need review before activating branch protection.`,
    },
    {
      id: 'release-cycle-observed',
      label: 'releaseCycleObserved = true',
      passed: config.releaseCycleObserved,
      value: String(config.releaseCycleObserved),
      details: config.releaseCycleObserved
        ? 'At least one clean advisory/warn-only release cycle has been observed and recorded.'
        : 'Set releaseCycleObserved=true in architecture-doctor-enforcement.json after a clean advisory cycle is confirmed.',
    },
    {
      id: 'score-threshold-agreed',
      label: 'scoreThresholdAgreed = true',
      passed: config.scoreThresholdAgreed,
      value: String(config.scoreThresholdAgreed),
      details: config.scoreThresholdAgreed
        ? `Score threshold formally agreed: minimum ${config.minimumHealthScore}/100.`
        : 'Set scoreThresholdAgreed=true in architecture-doctor-enforcement.json after the team formally agrees the threshold.',
    },
  ];

  const passed = items.every((item) => item.passed);
  const failing = items.filter((item) => !item.passed).map((item) => item.label);

  return {
    passed,
    items,
    summary: passed
      ? 'All safety checks passed. Ready to activate branch protection gate when the team decides.'
      : `${failing.length} safety check${failing.length === 1 ? '' : 's'} failed: ${failing.join(', ')}.`,
  };
}

export function renderFinalSafetyCheckMarkdown(result: FinalSafetyCheckResult): string {
  const rows = result.items
    .map((item) => `| ${item.passed ? 'Yes' : 'No'} | ${item.label} | ${item.value} | ${item.details} |`)
    .join('\n');

  return `Overall: **${result.passed ? 'SAFE TO ACTIVATE BRANCH PROTECTION' : 'NOT SAFE — blockers remain'}**

${result.summary}

| Passed | Check | Current value | Details |
|---|---|---|---|
${rows}
`;
}
