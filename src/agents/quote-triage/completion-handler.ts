/**
 * Quote-triage completion handler.
 * After a nominally successful run, validates that the output is non-empty.
 * If output is empty, the run is reclassified as EMPTY_OUTPUT and written
 * to the dead_letter_queue table in Supabase.
 */
import { createServiceClient } from '@/lib/supabase/server';
import { isEmpty } from '@/agents/shared/is-empty-output';

export const EMPTY_OUTPUT_REASON = 'EMPTY_OUTPUT' as const;

export interface QuoteTriageRunResult {
  runId: string;
  agentName: string;
  output: unknown;
  /** ISO timestamp of when the run completed */
  completedAt: string;
}

export interface CompletionHandlerResult {
  reclassified: boolean;
  reason?: typeof EMPTY_OUTPUT_REASON;
}

/**
 * Call this at the end of every quote-triage run that appears successful.
 * If the output is empty it is written to dead_letter_queue and the caller
 * receives { reclassified: true, reason: 'EMPTY_OUTPUT' }.
 */
export async function handleQuoteTriageCompletion(
  result: QuoteTriageRunResult,
): Promise<CompletionHandlerResult> {
  if (!isEmpty(result.output)) {
    return { reclassified: false };
  }

  const supabase = createServiceClient();

  const { error } = await supabase.from('dead_letter_queue').insert({
    run_id: result.runId,
    agent_name: result.agentName,
    failure_reason: EMPTY_OUTPUT_REASON,
    original_output: result.output ?? null,
    failed_at: result.completedAt,
  });

  if (error) {
    // Log but don't swallow — let the caller decide how to surface this.
    console.error(
      '[quote-triage] Failed to write empty-output run to dead_letter_queue:',
      error.message,
    );
  }

  return { reclassified: true, reason: EMPTY_OUTPUT_REASON };
}
