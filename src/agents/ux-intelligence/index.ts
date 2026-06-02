/**
 * UX-Intelligence Agent
 *
 * Analyses agent_events / page signals and emits UX proposals.
 * Mirrors the bud-observer resilience pattern:
 *  - top-level try/catch so the process never crashes
 *  - null-safe accessors throughout
 *  - always returns a valid { ux_proposals: [...] } structure
 *  - errors are emitted as structured events so bud-observer can track them
 */

import { createServiceClient } from '@/lib/supabase/server';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UxProposal {
  id: string;
  type: 'copy' | 'layout' | 'flow' | 'cta' | 'trust';
  target: string;
  suggestion: string;
  confidence: number;
  source_signal: string;
}

export interface UxIntelligenceResult {
  ux_proposals: UxProposal[];
  analysed_at: string;
  error?: string;
}

interface AgentEvent {
  id?: string | null;
  event_type?: string | null;
  payload?: Record<string, unknown> | null;
  created_at?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function safeNumber(v: unknown, fallback = 0): number {
  return typeof v === 'number' && isFinite(v) ? v : fallback;
}

function emitError(context: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err ?? 'unknown error');
  console.error('[ux-intelligence]', context, message);
  // Best-effort: log to Supabase so bud-observer can detect the spike.
  try {
    const db = createServiceClient();
    void db.from('agent_events').insert({
      agent: 'ux-intelligence',
      event_type: 'agent_error',
      payload: { context, message },
    });
  } catch {
    // If Supabase itself is unavailable we can only console-log.
  }
}

// ─── Core analysis ────────────────────────────────────────────────────────────

async function fetchRecentEvents(db: ReturnType<typeof createServiceClient>): Promise<AgentEvent[]> {
  const { data, error } = await db
    .from('agent_events')
    .select('id, event_type, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(`fetchRecentEvents: ${error.message}`);
  }

  return (data ?? []) as AgentEvent[];
}

function deriveProposals(events: AgentEvent[]): UxProposal[] {
  const proposals: UxProposal[] = [];

  // Count error spikes per event_type.
  const errorCounts: Record<string, number> = {};
  for (const ev of events) {
    const type = safeString(ev?.event_type);
    if (!type) continue;
    if (type === 'agent_error' || type === 'error') {
      const key = safeString((ev?.payload as Record<string, unknown>)?.context, type);
      errorCounts[key] = (errorCounts[key] ?? 0) + 1;
    }
  }

  // Propose copy/flow improvements when error rates are elevated.
  for (const [source, count] of Object.entries(errorCounts)) {
    if (count >= 2) {
      proposals.push({
        id: `error-spike-${source}`,
        type: 'flow',
        target: source,
        suggestion:
          `Detected ${count} errors from "${source}" this week. ` +
          'Consider adding a user-facing fallback message or simplifying the flow that triggers this path.',
        confidence: Math.min(0.5 + count * 0.1, 0.95),
        source_signal: 'error_spike',
      });
    }
  }

  // Detect abandoned quote flows (quote_started but no quote_completed).
  const started = events.filter(ev => safeString(ev?.event_type) === 'quote_started').length;
  const completed = events.filter(ev => safeString(ev?.event_type) === 'quote_completed').length;
  if (started > 0) {
    const dropRate = 1 - safeNumber(completed) / safeNumber(started, 1);
    if (dropRate > 0.6) {
      proposals.push({
        id: 'quote-funnel-drop',
        type: 'flow',
        target: 'quote-funnel',
        suggestion:
          `${Math.round(dropRate * 100)}% of users who started a quote did not complete it. ` +
          'Consider surfacing a progress indicator or reducing required fields.',
        confidence: Math.min(0.4 + dropRate * 0.4, 0.9),
        source_signal: 'funnel_analysis',
      });
    }
  }

  return proposals;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function runUxIntelligenceAgent(): Promise<UxIntelligenceResult> {
  const analysed_at = new Date().toISOString();

  try {
    const db = createServiceClient();
    const events = await fetchRecentEvents(db);
    const ux_proposals = deriveProposals(events ?? []);

    // Persist proposals so bud-observer and downstream consumers can read them.
    if (ux_proposals.length > 0) {
      try {
        await db.from('agent_events').insert({
          agent: 'ux-intelligence',
          event_type: 'ux_proposals_emitted',
          payload: { ux_proposals, analysed_at },
        });
      } catch (persistErr) {
        emitError('persist_proposals', persistErr);
        // Non-fatal: still return the proposals.
      }
    }

    return { ux_proposals, analysed_at };
  } catch (err) {
    emitError('runUxIntelligenceAgent', err);
    // Always return a valid structure — never throw out of the agent.
    return {
      ux_proposals: [],
      analysed_at,
      error: err instanceof Error ? err.message : String(err ?? 'unknown'),
    };
  }
}
