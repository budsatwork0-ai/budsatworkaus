import { createClient } from '@supabase/supabase-js';
import { runAgent } from './index';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_RETRIES = 3;
const POLL_INTERVAL_MS = 60_000;

async function processPendingDeadLetters(): Promise<void> {
  const { data: rows, error } = await supabase
    .from('dead_letter_quotes')
    .select('*')
    .eq('status', 'pending')
    .lt('retry_count', MAX_RETRIES)
    .order('created_at', { ascending: true })
    .limit(10);

  if (error) {
    console.error('[dead-letter-retry] Failed to fetch pending rows:', error.message);
    return;
  }

  if (!rows || rows.length === 0) return;

  for (const row of rows) {
    try {
      await runAgent(row.agent_name, row.payload);

      await supabase
        .from('dead_letter_quotes')
        .update({ status: 'resolved', updated_at: new Date().toISOString() })
        .eq('id', row.id);

      console.info(`[dead-letter-retry] Resolved dead letter ${row.id}`);
    } catch (retryError) {
      const newRetryCount = (row.retry_count as number) + 1;
      const newStatus = newRetryCount >= MAX_RETRIES ? 'failed' : 'pending';
      const errorMessage =
        retryError instanceof Error ? retryError.message : String(retryError);

      await supabase
        .from('dead_letter_quotes')
        .update({
          retry_count: newRetryCount,
          status: newStatus,
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      console.warn(
        `[dead-letter-retry] Row ${row.id} retry ${newRetryCount}/${MAX_RETRIES} failed: ${errorMessage}`
      );
    }
  }
}

export function startDeadLetterRetryWorker(): NodeJS.Timeout {
  console.info('[dead-letter-retry] Starting retry worker');
  return setInterval(() => {
    processPendingDeadLetters().catch((err) =>
      console.error('[dead-letter-retry] Unhandled error in retry worker:', err)
    );
  }, POLL_INTERVAL_MS);
}

// Allow direct invocation for manual runs / cron jobs
export { processPendingDeadLetters };
