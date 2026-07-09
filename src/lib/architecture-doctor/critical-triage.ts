import type {
  CriticalTriageClassification,
  CriticalTriageItem,
  DependencyCycleClassification,
  DependencyCycleReadinessGroup,
  DependencyGraphReport,
  DriftFinding,
} from './types';

export function triageCriticalCandidates(findings: DriftFinding[]): CriticalTriageItem[] {
  const candidates = findings.filter((finding) => finding.severity === 'critical' || wasCriticalCandidate(finding));
  const seen = new Set<string>();

  return candidates.map((finding) => {
    const duplicateKey = [finding.assetKind, finding.asset, finding.capabilityId ?? 'unknown', finding.riskArea ?? 'standard'].join('|');
    const duplicate = seen.has(duplicateKey);
    seen.add(duplicateKey);
    const classification = duplicate ? 'duplicate/noisy finding' : classifyFinding(finding);
    return {
      finding,
      classification,
      whyItMatters: whyItMatters(finding),
      smallestSafeFix: smallestSafeFix(finding, classification),
      requiredChange: requiredChange(finding, classification),
    };
  });
}

export function groupDependencyCycleReadiness(report: DependencyGraphReport): DependencyCycleReadinessGroup[] {
  return report.cycles.map((cycle) => {
    const domain = cycle.domain ?? 'unknown';
    const capabilityId = cycle.capabilityId;
    const classification = classifyDependencyCycle(cycle);
    return {
      domain,
      capabilityId,
      classification,
      cycles: [cycle],
      recommendation: dependencyCycleRecommendation(classification, domain),
    };
  });
}

export function classifyDependencyCycle(cycle: DependencyGraphReport['cycles'][number]): DependencyCycleClassification {
  if (cycle.files.some(isTestOrToolingFile)) return 'test/tooling noise';
  if (isAcceptableSharedLayerCycle(cycle)) return 'acceptable shared-layer cycle';
  if (cycle.files.some(isProductionFile) && cycle.files.every(isSourceFile)) return 'production architecture issue';
  return 'needs manual review';
}

function classifyFinding(finding: DriftFinding): CriticalTriageClassification {
  if (finding.type.startsWith('repo_') || finding.type.startsWith('atlas_')) return 'manifest/baseline gap';
  if (finding.confidence !== 'confirmed' || finding.type === 'rls_unknown') return 'static-analysis unknown';
  if (finding.type === 'rls_missing_signal' && finding.severity === 'critical') return 'confirmed real issue';
  return 'static-analysis unknown';
}

function wasCriticalCandidate(finding: DriftFinding): boolean {
  return Boolean(
    finding.riskArea &&
      (finding.type.startsWith('repo_') ||
        finding.type.startsWith('atlas_') ||
        finding.type === 'rls_unknown' ||
        finding.type === 'rls_missing_signal'),
  );
}

function whyItMatters(finding: DriftFinding): string {
  if (finding.type === 'rls_missing_signal') {
    return `Sensitive ${finding.riskArea ?? 'data'} table has no static RLS/policy signal in migrations.`;
  }
  if (finding.type === 'rls_unknown') {
    return `Static analysis cannot prove RLS state for sensitive ${finding.riskArea ?? 'data'}.`;
  }
  if (finding.type.startsWith('repo_')) {
    return `The asset may be legitimate, but ownership is not captured in the atlas or manifest.`;
  }
  if (finding.type.startsWith('atlas_')) {
    return `The atlas expects this asset, but the repository scan did not find matching static evidence.`;
  }
  return finding.message;
}

function smallestSafeFix(finding: DriftFinding, classification: CriticalTriageClassification): string {
  if (classification === 'duplicate/noisy finding') return 'Keep one canonical finding for this asset and suppress duplicate score impact.';
  if (classification === 'manifest/baseline gap') return 'Update the capability manifest/atlas or explicitly baseline the reviewed gap.';
  if (classification === 'static-analysis unknown') return 'Improve static evidence detection or add reviewed baseline metadata; do not treat as a blocker yet.';
  if (finding.type === 'rls_missing_signal') return 'Add or verify table RLS/policy coverage through a reviewed migration in a separate production-code phase.';
  return 'Investigate manually before any blocking gate.';
}

function requiredChange(
  finding: DriftFinding,
  classification: CriticalTriageClassification,
): CriticalTriageItem['requiredChange'] {
  if (classification === 'duplicate/noisy finding') return 'none';
  if (classification === 'manifest/baseline gap' || classification === 'static-analysis unknown') return 'manifest/baseline update';
  if (finding.type === 'rls_missing_signal') return 'migration';
  return 'code';
}

function isTestOrToolingFile(file: string): boolean {
  return /(^|\/)(tests?|scripts?|\.codex|\.claude|architecture-doctor|vitest|playwright)/.test(file);
}

function isAcceptableSharedLayerCycle(cycle: DependencyGraphReport['cycles'][number]): boolean {
  const domain = cycle.domain ?? '';
  if (['shared', 'types', 'utils'].includes(domain)) return true;
  if (domain === 'design-system' && cycle.files.every((file) => file.includes('src/lib/design-system/themes/'))) return true;
  if (cycle.files.length <= 2 && cycle.files.every((file) => file.includes('src/lib/types/'))) return true;
  return false;
}

function isProductionFile(file: string): boolean {
  return /(^|\/)src\/(app|lib)\//.test(file) && !isTestOrToolingFile(file);
}

function isSourceFile(file: string): boolean {
  return /(^|\/)src\//.test(file);
}

function dependencyCycleRecommendation(classification: DependencyCycleClassification, domain: string): string {
  if (classification === 'test/tooling noise') return 'Keep advisory-only; tidy test/tool helper imports opportunistically.';
  if (classification === 'acceptable shared-layer cycle') return 'Document as acceptable or flatten the shared barrel when convenient; do not block CI on this class.';
  if (classification === 'production architecture issue') return `Extract shared ${domain} types/helpers into a leaf module before using dependency cycles as a blocking CI signal.`;
  return 'Review manually and assign an owner before deciding whether this can ever block CI.';
}
