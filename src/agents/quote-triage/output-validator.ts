import { createServiceClient } from '@/lib/supabase/server';

// ─── Error type ───────────────────────────────────────────────────────────────
export class TriageOutputError extends Error {
  constructor(
    message: string,
    public readonly rawInput: unknown,
  ) {
    super(message);
    this.name = 'TriageOutputError';
  }
}

// ─── Validator ────────────────────────────────────────────────────────────────
/**
 * Throws TriageOutputError when the triage agent produced null / empty output.
 * Call this immediately after the LLM/tool execution step.
 */
export function validateTriageOutput(
  output: unknown,
  rawInput: unknown,
): asserts output is NonNullable<typeof output> {
  if (output === null || output === undefined) {
    throw new TriageOutputError('Triage agent returned null output', rawInput);
  }
  if (typeof output === 'string' && output.trim() === '') {
    throw new TriageOutputError('Triage agent returned empty string output', rawInput);
  }
  if (Array.isArray(output) && output.length === 0) {
    throw new TriageOutputError('Triage agent returned empty array output', rawInput);
  }
}

// ─── Recovery event emitter ───────────────────────────────────────────────────
/**
 * Persists a structured recovery event to Supabase so that silent no-output
 * runs become visible and actionable.
 */
export async function emitTriageFailed(
  rawInput: unknown,
  error: TriageOutputError | Error,
  context?: Record<string, unknown>,
): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from('agent_recovery_events').insert({
      agent: 'quote-triage',
      error_name: error.name,
      error_message: error.message,
      raw_input: rawInput,
      context: context ?? null,
      occurred_at: new Date().toISOString(),
    });
  } catch (persistErr) {
    // Never let persistence failure mask the original problem — log and continue.
    console.error(
      '[quote-triage] emitTriageFailed: could not persist recovery event',
      persistErr,
    );
  }
}
