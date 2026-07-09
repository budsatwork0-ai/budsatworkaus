import { readFile, writeFile } from 'node:fs/promises';
import type {
  ArchitectureHealthReport,
  ReleaseCycleEvidenceSummary,
  ReleaseCycleHistory,
  ReleaseCycleObservation,
} from './types';

export async function readReleaseCycleHistory(historyPath: string): Promise<ReleaseCycleHistory> {
  try {
    const parsed = JSON.parse(await readFile(historyPath, 'utf8')) as Partial<ReleaseCycleHistory>;
    return {
      version: 1,
      observations: Array.isArray(parsed.observations) ? parsed.observations.filter(isObservation) : [],
    };
  } catch {
    return { version: 1, observations: [] };
  }
}

export async function writeReleaseCycleHistory(historyPath: string, history: ReleaseCycleHistory): Promise<void> {
  await writeFile(historyPath, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
}

export async function writeReleaseCycleEvidenceReport(evidencePath: string, observation: ReleaseCycleObservation): Promise<void> {
  await writeFile(evidencePath, renderReleaseCycleEvidenceMarkdown(observation), 'utf8');
}

export function createReleaseCycleObservation(
  report: ArchitectureHealthReport,
  gitCommit: string,
  runDate = report.generatedAt,
): ReleaseCycleObservation {
  const criticalCount = report.baseline.newFindings.filter((finding) => finding.severity === 'critical').length;
  const expiredBaselines = report.baseline.acceptedFindings.filter((finding) => isExpired(finding.baselineExpiryDate)).length;
  const enforcementMode = report.enforcementPolicy.config.enforcementMode;
  const blockingWouldOccur = report.enforcementPolicy.blockingWouldOccur;
  const thresholdDryRunPasses = report.thresholdDryRun.wouldPass;
  const clean =
    (enforcementMode === 'advisory' || enforcementMode === 'warn_only') &&
    report.healthScore >= report.enforcementPolicy.config.minimumHealthScore &&
    criticalCount === 0 &&
    expiredBaselines === 0 &&
    thresholdDryRunPasses &&
    !blockingWouldOccur;

  return {
    id: `${enforcementMode}-${runDate.replace(/[:.]/g, '-').replace('T', '-').replace('Z', '')}`,
    runDate,
    gitCommit,
    healthScore: report.healthScore,
    criticalCount,
    securityScore: report.architectureHealth.categories.Security.score,
    dependencyCycleCount: report.dependencyGraph.cycles.length,
    baselinedFindings: report.baseline.acceptedFindings.length,
    expiredBaselines,
    enforcementMode,
    blockingWouldOccur,
    clean,
  };
}

export function appendReleaseCycleObservation(
  history: ReleaseCycleHistory,
  observation: ReleaseCycleObservation,
): ReleaseCycleHistory {
  const observations = history.observations.filter((item) => item.id !== observation.id);
  observations.push(observation);
  return { version: 1, observations };
}

export function summarizeReleaseCycleEvidence(
  history: ReleaseCycleHistory,
  priorHistory: ReleaseCycleHistory = { version: 1, observations: [] },
  options: { historyPath?: string; evidencePath?: string; currentObservation?: ReleaseCycleObservation } = {},
): ReleaseCycleEvidenceSummary {
  const cleanObservationCount = history.observations.filter(isCleanObservation).length;
  const evidenceStillMissing: string[] = [];
  if (cleanObservationCount < 2) {
    evidenceStillMissing.push('two complete clean advisory/warn-only release-cycle observations');
  }

  return {
    historyPath: options.historyPath,
    evidencePath: options.evidencePath,
    observationCount: history.observations.length,
    cleanAdvisoryReleaseCycleObserved: cleanObservationCount >= 2,
    evidenceStillMissing,
    currentObservation: options.currentObservation,
  };
}

export function renderReleaseCycleEvidenceMarkdown(observation: ReleaseCycleObservation): string {
  return `# Architecture Doctor Advisory Release-Cycle Evidence

| Field | Value |
|---|---|
| Run date | ${observation.runDate} |
| Git commit | ${observation.gitCommit} |
| Health score | ${observation.healthScore}/100 |
| Critical count | ${observation.criticalCount} |
| Security score | ${observation.securityScore}/100 |
| Dependency cycle count | ${observation.dependencyCycleCount} |
| Baselined findings | ${observation.baselinedFindings} |
| Expired baselines | ${observation.expiredBaselines} |
| Enforcement mode | ${observation.enforcementMode} |
| Would-block status | ${observation.blockingWouldOccur ? 'would block' : 'would not block'} |
| Clean advisory observation | ${observation.clean ? 'yes' : 'no'} |
`;
}

function isObservation(value: unknown): value is ReleaseCycleObservation {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ReleaseCycleObservation>;
  return Boolean(item.id && item.runDate && item.gitCommit && typeof item.healthScore === 'number');
}

function isCleanObservation(observation: ReleaseCycleObservation): boolean {
  return (
    observation.clean === true &&
    (observation.enforcementMode === 'advisory' || observation.enforcementMode === 'warn_only') &&
    observation.healthScore >= 80 &&
    observation.criticalCount === 0 &&
    observation.expiredBaselines === 0 &&
    !observation.blockingWouldOccur
  );
}

function isExpired(value?: string): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time < Date.now();
}
