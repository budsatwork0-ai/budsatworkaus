/**
 * Signal collector — ingests raw conversion signals and UX proposals
 * into Supabase, with explicit try/catch so failures surface as
 * logged warnings rather than silent drops.
 *
 * Each ingest function also records a pipeline emission timestamp
 * so the health-check utility can detect stale pipelines.
 */
import { createServiceClient } from '@/lib/supabase/server';
import { recordPipelineEmission } from './health-check';

export interface ConversionSignal {
  event_type: string;
  quote_id?: string;
  session_id?: string;
  metadata?: Record<string, unknown>;
  occurred_at?: string;
}

export interface UxProposal {
  proposal_type: string;
  context?: Record<string, unknown>;
  proposed_at?: string;
}

/**
 * Ingests a conversion signal. Failures are caught and logged — never thrown.
 */
export async function ingestConversionSignal(signal: ConversionSignal): Promise<void> {
  try {
    const supabase = createServiceClient();
    const row = {
      event_type: signal.event_type,
      quote_id: signal.quote_id ?? null,
      session_id: signal.session_id ?? null,
      metadata: signal.metadata ?? {},
      occurred_at: signal.occurred_at ?? new Date().toISOString(),
    };
    const { error } = await supabase.from('conversion_signals').insert(row);
    if (error) {
      console.warn('[signal-collector] Failed to insert conversion_signal:', error.message, { row });
      return;
    }
    await recordPipelineEmission('conversion_signals');
  } catch (err) {
    console.warn('[signal-collector] Unexpected error ingesting conversion_signal:', err);
  }
}

/**
 * Ingests a UX proposal. Failures are caught and logged — never thrown.
 */
export async function ingestUxProposal(proposal: UxProposal): Promise<void> {
  try {
    const supabase = createServiceClient();
    const row = {
      proposal_type: proposal.proposal_type,
      context: proposal.context ?? {},
      proposed_at: proposal.proposed_at ?? new Date().toISOString(),
    };
    const { error } = await supabase.from('ux_proposals').insert(row);
    if (error) {
      console.warn('[signal-collector] Failed to insert ux_proposal:', error.message, { row });
      return;
    }
    await recordPipelineEmission('ux_proposals');
  } catch (err) {
    console.warn('[signal-collector] Unexpected error ingesting ux_proposal:', err);
  }
}
