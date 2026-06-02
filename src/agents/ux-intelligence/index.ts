/**
 * ux-intelligence agent entry point.
 * On partial failure it emits a degraded fallback signal rather than
 * suppressing output entirely.
 */

import { buildDegradedSignal, type DegradedSignalEntry } from '@/agents/shared/degraded-signal';

export interface UxProposal {
  id: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  created_at: string;
}

export interface ConversionSignal {
  id: string;
  signal: string;
  confidence: number;
  created_at: string;
}

export interface UxIntelligenceResult {
  ux_proposals: UxProposal[];
  conversion_signals: ConversionSignal[];
  degraded_signals: DegradedSignalEntry[];
  run_status: 'ok' | 'degraded' | 'failed';
}

/**
 * Placeholder core logic — replace with real LLM/DB calls.
 * Kept minimal so this file compiles without external dependencies
 * that may not exist yet.
 */
async function runCoreUxIntelligence(): Promise<{
  ux_proposals: UxProposal[];
  conversion_signals: ConversionSignal[];
}> {
  // TODO: wire up real data sources
  return { ux_proposals: [], conversion_signals: [] };
}

export async function runUxIntelligenceAgent(): Promise<UxIntelligenceResult> {
  const degraded_signals: DegradedSignalEntry[] = [];
  let ux_proposals: UxProposal[] = [];
  let conversion_signals: ConversionSignal[] = [];

  try {
    const result = await runCoreUxIntelligence();
    ux_proposals = result.ux_proposals;
    conversion_signals = result.conversion_signals;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);

    degraded_signals.push(
      buildDegradedSignal('ux-intelligence', 'ux_proposal', reason),
    );
    degraded_signals.push(
      buildDegradedSignal('ux-intelligence', 'conversion_signal', reason),
    );

    return {
      ux_proposals: [],
      conversion_signals: [],
      degraded_signals,
      run_status: 'failed',
    };
  }

  return {
    ux_proposals,
    conversion_signals,
    degraded_signals,
    run_status: degraded_signals.length > 0 ? 'degraded' : 'ok',
  };
}
