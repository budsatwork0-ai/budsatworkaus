import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const MAX_PAYLOAD_CHARS = 2000;

export interface AgentErrorRecord {
  agentId: string;
  errorType: string;
  errorMessage: string;
  inputPayload?: unknown;
  modelResponse?: string;
}

export async function persistAgentError(record: AgentErrorRecord): Promise<void> {
  const truncatedPayload =
    record.inputPayload !== undefined
      ? JSON.stringify(record.inputPayload).slice(0, MAX_PAYLOAD_CHARS)
      : null;

  const { error } = await supabase.from('agent_errors').insert({
    agent_id: record.agentId,
    timestamp: new Date().toISOString(),
    error_type: record.errorType,
    error_message: record.errorMessage,
    input_payload: truncatedPayload,
    model_response: record.modelResponse ?? null,
  });

  if (error) {
    // Log but do not rethrow — error persistence must never break the caller.
    console.error('[persistAgentError] failed to write agent_errors row:', error.message);
  }
}
