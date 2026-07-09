import { readFile } from 'node:fs/promises';
import type { ArchitectureHealthReport, ArchitectureSubScores, ReportDiff } from './types';

export async function readPreviousReport(reportPath?: string): Promise<ArchitectureHealthReport | null> {
  if (!reportPath) return null;
  try {
    return JSON.parse(await readFile(reportPath, 'utf8')) as ArchitectureHealthReport;
  } catch {
    return null;
  }
}

export function diffReports(current: ArchitectureHealthReport, previous: ArchitectureHealthReport | null, previousReportPath?: string): ReportDiff {
  if (!previous) {
    return {
      previousReportPath,
      hasPrevious: false,
      scoreMovement: null,
      subScoreMovement: {},
      newFindingKeys: current.findings.map((finding) => finding.key ?? '').filter(Boolean),
      resolvedFindingKeys: [],
      worsenedAreas: [],
      improvedAreas: [],
    };
  }

  const currentKeys = new Set(current.findings.map((finding) => finding.key ?? '').filter(Boolean));
  const previousKeys = new Set((previous.findings ?? []).map((finding) => finding.key ?? '').filter(Boolean));
  const subScoreMovement: Partial<Record<keyof ArchitectureSubScores, number>> = {};
  const worsenedAreas: string[] = [];
  const improvedAreas: string[] = [];

  for (const key of Object.keys(current.subScores) as Array<keyof ArchitectureSubScores>) {
    const movement = current.subScores[key] - (previous.subScores?.[key] ?? current.subScores[key]);
    subScoreMovement[key] = movement;
    if (movement < 0) worsenedAreas.push(key);
    if (movement > 0) improvedAreas.push(key);
  }

  return {
    previousReportPath,
    hasPrevious: true,
    scoreMovement: current.healthScore - previous.healthScore,
    subScoreMovement,
    newFindingKeys: [...currentKeys].filter((key) => !previousKeys.has(key)),
    resolvedFindingKeys: [...previousKeys].filter((key) => !currentKeys.has(key)),
    worsenedAreas,
    improvedAreas,
  };
}
