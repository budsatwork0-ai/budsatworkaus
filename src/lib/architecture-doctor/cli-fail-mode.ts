import type { ArchitectureHealthReport, DriftSeverity } from './types';

export interface FailModeResult {
  shouldFail: boolean;
  reasons: string[];
}

export interface FailModeOptions {
  advisory?: boolean;
}

export function evaluateFailMode(
  report: ArchitectureHealthReport,
  failOn: string[] = [],
  options: FailModeOptions = {},
): FailModeResult {
  const reasons: string[] = [];
  for (const rule of failOn) {
    if (rule === 'critical') {
      const count = report.baseline.newFindings.filter((finding) => finding.severity === 'critical').length;
      if (count > 0) reasons.push(`${count} critical new finding${count === 1 ? '' : 's'}`);
      continue;
    }
    if (rule === 'new') {
      if (report.baseline.newFindings.length > 0) {
        reasons.push(`${report.baseline.newFindings.length} new finding${report.baseline.newFindings.length === 1 ? '' : 's'}`);
      }
      continue;
    }
    if (rule.startsWith('score-below=')) {
      const threshold = Number(rule.slice('score-below='.length));
      if (!Number.isFinite(threshold)) throw new Error(`Invalid --fail-on ${rule}. Expected score-below=<number>.`);
      if (report.healthScore < threshold) reasons.push(`score ${report.healthScore} is below ${threshold}`);
      continue;
    }
    if (isSeverity(rule)) {
      const count = report.baseline.newFindings.filter((finding) => severityRank(finding.severity) >= severityRank(rule)).length;
      if (count > 0) reasons.push(`${count} ${rule}-or-worse new finding${count === 1 ? '' : 's'}`);
      continue;
    }
    throw new Error(`Unsupported --fail-on "${rule}". Use critical, new, or score-below=<number>.`);
  }
  if (options.advisory && reasons.length > 0) {
    return {
      shouldFail: false,
      reasons: reasons.map((reason) => `${reason} (advisory-only; not failing)`),
    };
  }
  return { shouldFail: reasons.length > 0, reasons };
}

function isSeverity(value: string): value is DriftSeverity {
  return ['critical', 'high', 'medium', 'low', 'info'].includes(value);
}

function severityRank(severity: DriftSeverity): number {
  return { info: 0, low: 1, medium: 2, high: 3, critical: 4 }[severity];
}
