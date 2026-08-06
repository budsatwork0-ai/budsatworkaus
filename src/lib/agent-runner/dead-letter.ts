import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface DeadLetterRecord {
  id?: string;
  agent_name: string;
  payload: unknown;
  error_message: string;
  retry_count: number;
  status: 'pending' | 'resolved' | 'failed';
  created_at?: string;
  updated_at?: string;
}

export async function writeDeadLetter(
  agentName: string,
  payload: unknown,
  error: unknown
): Promise<void> {
  const errorMessage =
    error instanceof Error ? error.message : String(error);

  const { error: insertError } = await supabase
    .from('dead_letter_quotes')
    .insert({
      agent_name: agentName,
      payload,
      error_message: errorMessage,
      retry_count: 0,
      status: 'pending',
    });

  if (insertError) {
    console.error(
      '[dead-letter] Failed to write dead letter record:',
      insertError.message
    );
  }
}
