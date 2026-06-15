import type { ScenarioCategory, SandboxScenarioTemplate } from '@/lib/sandbox/scenarios';
import type { Batch, HistoryRow, PackResult, RunResult } from './types';

const PASS_THRESHOLD = 0.5;

/**
 * Derives the manual pack summary string for the current browser session.
 * Returns null when no manual run has occurred this session (caller shows the
 * last cron batch instead).
 */
export function deriveManualSummary(
  packResults: PackResult[],
  lastResult: RunResult | null,
  lastScenario: SandboxScenarioTemplate | null,
): string | null {
  if (packResults.length > 0) {
    const passed = packResults.filter((row) => row.result.score.f1Score >= PASS_THRESHOLD).length;
    const avgF1 = packResults.reduce((sum, row) => sum + row.result.score.f1Score, 0) / packResults.length;
    return `${passed}/${packResults.length} passed — avg F1 ${avgF1.toFixed(2)}`;
  }
  if (lastResult && lastScenario) {
    const passed = lastResult.score.f1Score >= PASS_THRESHOLD;
    return `${passed ? 'Pass' : 'Fail'} — ${lastScenario.title} — F1 ${lastResult.score.f1Score.toFixed(2)}`;
  }
  return null;
}

/** Formats the last known cron batch as a human-readable summary. */
export function formatCronBatchSummary(batch: Batch): string {
  const f1Part = batch.avg_f1 !== null ? ` — avg F1 ${batch.avg_f1.toFixed(2)}` : '';
  return `${batch.pass_count}/${batch.scenario_count} passed${f1Part} (last cron run)`;
}

export function toPackResultStatic(scenario: SandboxScenarioTemplate, result: RunResult): PackResult {
  return {
    scenarioSlug: scenario.slug,
    scenarioTitle: scenario.title,
    category: scenario.category,
    agentId: scenario.agentId,
    expectedActionTypes: scenario.expectedActionTypes,
    result,
  };
}

export function historyRowToPackResult(row: HistoryRow): PackResult {
  return {
    scenarioSlug: row.scenario.slug ?? row.scenario.id,
    scenarioTitle: row.scenario.title,
    category: row.scenario.category as ScenarioCategory,
    agentId: row.scenario.agentId,
    expectedActionTypes: row.scenario.expectedActionTypes,
    result: {
      trainingRunId: row.id,
      status: row.status as RunResult['status'],
      summary: row.response?.summary ?? '',
      proposedActions: (row.response?.proposedActions ?? []).map((action) => ({
        action_type: action.action_type ?? 'unknown',
        preview: action.preview,
      })),
      llmCalls: row.response?.llmCalls ?? 0,
      costCents: row.costCents,
      durationMs: row.durationMs,
      score: row.score ?? { precisionScore: 0, recallScore: 0, f1Score: 0, hit: false },
    },
  };
}
