/**
 * design-developer agent entry point.
 * On partial failure it emits a degraded fallback signal rather than
 * suppressing output entirely.
 *
 * NOTE: validate.ts was introduced in a prior draft — re-exported here
 * so callers have a single import path.
 */

import { buildDegradedSignal, type DegradedSignalEntry } from '@/agents/shared/degraded-signal';

export interface DesignInsight {
  id: string;
  component: string;
  insight: string;
  severity: 'error' | 'warning' | 'info';
  created_at: string;
}

export interface DesignDeveloperResult {
  design_insights: DesignInsight[];
  degraded_signals: DegradedSignalEntry[];
  run_status: 'ok' | 'degraded' | 'failed';
}

/**
 * Placeholder core logic — replace with real validation / LLM calls.
 */
async function runCoreDesignDeveloper(): Promise<{ design_insights: DesignInsight[] }> {
  // TODO: wire up validate.ts and real design-token checks
  return { design_insights: [] };
}

export async function runDesignDeveloperAgent(): Promise<DesignDeveloperResult> {
  const degraded_signals: DegradedSignalEntry[] = [];
  let design_insights: DesignInsight[] = [];

  try {
    const result = await runCoreDesignDeveloper();
    design_insights = result.design_insights;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);

    degraded_signals.push(
      buildDegradedSignal('design-developer', 'design_insight', reason),
    );

    return {
      design_insights: [],
      degraded_signals,
      run_status: 'failed',
    };
  }

  return {
    design_insights,
    degraded_signals,
    run_status: degraded_signals.length > 0 ? 'degraded' : 'ok',
  };
}
