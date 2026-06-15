import type { ScenarioCategory, SandboxScenarioTemplate } from '@/lib/sandbox/scenarios';
import type { HistoryRow, PackResult, RunResult } from './types';

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
